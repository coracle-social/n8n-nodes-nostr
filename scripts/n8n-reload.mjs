#!/usr/bin/env node
/**
 * Rebuilds the package and reinstalls it into a running n8n container.
 *
 * This mirrors what n8n's own installer does (see
 * `dist/modules/community-packages/community-packages.service.js` inside the
 * image): extract the tarball straight into `node_modules/<name>`, strip
 * `devDependencies` / `peerDependencies` / `optionalDependencies` from the
 * extracted package.json, then `npm install` inside that directory.
 *
 * The strip matters. npm 7+ auto-installs peer dependencies, and this package
 * declares `n8n-workflow` as one. A plain `npm install` therefore drags a second
 * copy of n8n-workflow (and its whole tree, including a native isolated-vm
 * build) into ~/.n8n/nodes, where it shadows n8n's own copy and breaks
 * `instanceof` checks across the two module instances.
 *
 * Since this package has no runtime dependencies, the install step is a no-op.
 *
 * Usage:  npm run n8n:reload
 * Env:    N8N_CONTAINER (default n8n-nostr), N8N_PORT (5678), CONTAINER_RUNTIME
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CONTAINER = process.env.N8N_CONTAINER ?? 'n8n-nostr'
const PORT = process.env.N8N_PORT ?? '5678'
const PKG = 'n8n-nodes-nostr'
const PKG_DIR = `/home/node/.n8n/nodes/node_modules/${PKG}`

// `spawnSync(bin, ...)` with shell:true triggers DEP0190; probe the binary directly.
const has = (bin) => spawnSync(bin, ['--version'], { stdio: 'ignore' }).error === undefined
const RUNTIME = process.env.CONTAINER_RUNTIME ?? (has('podman') ? 'podman' : 'docker')

const run = (cmd, args, opts = {}) =>
	execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...opts })

const step = (msg) => process.stdout.write(`\n▸ ${msg}\n`)

/** Blocking sleep without spawning a process. */
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

const containerRunning = () => {
	try {
		return run(RUNTIME, ['inspect', '-f', '{{.State.Running}}', CONTAINER]).trim() === 'true'
	} catch {
		return false
	}
}

if (!containerRunning()) {
	console.error(
		`\n${RUNTIME}: container "${CONTAINER}" is not running.\n` +
			`Start it first, or set N8N_CONTAINER to the right name.\n`,
	)
	process.exit(1)
}

const workDir = mkdtempSync(join(tmpdir(), 'n8n-reload-'))

try {
	step('building')
	run('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })

	step('packing')
	// --dry-run=false: npm_config_dry_run leaks into nested npm commands.
	run('npm', ['pack', '--dry-run=false', '--silent', '--pack-destination', workDir], { cwd: ROOT })
	const tarball = readdirSync(workDir).find((f) => f.endsWith('.tgz'))
	if (!tarball) throw new Error('npm pack produced no tarball')

	step(`copying into ${CONTAINER}`)
	run(RUNTIME, ['cp', join(workDir, tarball), `${CONTAINER}:/tmp/${PKG}.tgz`])

	step('installing the way n8n does (extract, strip peer deps, install)')
	// Single shell so a failure anywhere aborts the reinstall rather than
	// leaving a half-extracted package behind.
	const script = `
set -e
rm -rf ${PKG_DIR}
mkdir -p ${PKG_DIR}
tar -xzf /tmp/${PKG}.tgz -C ${PKG_DIR} --strip-components=1
node -e '
  const fs = require("fs");
  const p = "${PKG_DIR}/package.json";
  const { devDependencies, peerDependencies, optionalDependencies, ...rest } = JSON.parse(fs.readFileSync(p, "utf8"));
  fs.writeFileSync(p, JSON.stringify(rest, null, 2));
'
cd ${PKG_DIR}
npm install --audit=false --fund=false --bin-links=false --install-strategy=shallow --ignore-scripts=true --package-lock=false >/dev/null
rm -f /tmp/${PKG}.tgz
echo "installed $(node -p "require('${PKG_DIR}/package.json').version")"
`
	process.stdout.write('  ' + run(RUNTIME, ['exec', CONTAINER, 'sh', '-c', script]))

	step('restarting n8n')
	run(RUNTIME, ['restart', CONTAINER])

	step('waiting for n8n to come back')
	// /healthz flips to ok before the REST layer is ready, so poll a REST route.
	const deadline = Date.now() + 90_000
	let ready = false
	while (Date.now() < deadline) {
		const res = spawnSync('curl', ['-sf', '-o', '/dev/null', `http://localhost:${PORT}/rest/settings`])
		if (res.status === 0) {
			ready = true
			break
		}
		sleepSync(1_000)
	}
	if (!ready) throw new Error(`n8n did not become ready on port ${PORT} within 90s`)

	console.log(`\n✅ reloaded. Open http://localhost:${PORT} and hard-refresh (the editor caches node types).\n`)
} finally {
	rmSync(workDir, { recursive: true, force: true })
}
