#!/usr/bin/env node
/**
 * Runs n8n's own community-package static analyser against the tarball we would
 * actually publish.
 *
 * `@n8n/scan-community-package` is what n8n runs on a submission. Its CLI only
 * accepts a published package name (it downloads from npm and checks provenance),
 * so we call its `analyzePackage(dir)` directly on a freshly packed tarball.
 *
 * It applies `@n8n/eslint-plugin-community-nodes`, which — among much else —
 * forbids runtime dependencies, non-MIT licenses, and the `setTimeout`,
 * `clearTimeout`, `globalThis` and `process` globals. That last rule is why
 * src/relay/timers.ts exists.
 *
 * Run: npm run scan
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workDir = mkdtempSync(join(tmpdir(), 'n8nostr-scan-'))

// `npm publish --dry-run` exports npm_config_dry_run, which every nested npm
// command inherits — so `npm pack` below would silently produce no tarball.
// prepublishOnly runs this script, so force the flag off for the child.
const childEnv = { ...process.env, npm_config_dry_run: 'false' }

const sh = (cmd, args, cwd) =>
	execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: childEnv })

try {
	process.stdout.write('packing…\n')
	sh('npm', ['pack', '--dry-run=false', '--pack-destination', workDir, '--silent'], ROOT)
	const tarball = readdirSync(workDir).find((f) => f.endsWith('.tgz'))
	if (!tarball) throw new Error('npm pack produced no tarball')

	const pkgDir = join(workDir, 'pkg')
	sh('mkdir', ['-p', pkgDir])
	sh('tar', ['xzf', join(workDir, tarball), '-C', pkgDir, '--strip-components=1'])

	const { analyzePackage } = await import('@n8n/scan-community-package/scanner/scanner.mjs')
	const result = await analyzePackage(pkgDir)

	if (result.passed) {
		console.log('\n✅ passed n8n community-package static analysis\n')
	} else {
		console.error(`\n❌ failed: ${result.message}\n`)
		if (result.details) console.error(result.details)
		process.exitCode = 1
	}
} finally {
	rmSync(workDir, { recursive: true, force: true })
}
