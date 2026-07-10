#!/usr/bin/env node
/**
 * Re-vendors third-party cryptography into vendor/.
 *
 * n8n's verified-community-node guidelines forbid runtime dependencies, so the
 * package.json "dependencies" field must stay empty. The crypto we cannot get
 * from the Node standard library (BIP-340 schnorr, bech32) is therefore copied
 * into the tree and compiled by our own tsc.
 *
 * Run: node scripts/vendor.mjs
 * Then: git diff --stat vendor
 *
 * This script is the ONLY sanctioned way to modify vendor/. Hand edits will
 * be overwritten. See VENDOR.md for the provenance record it emits.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const VENDOR = join(ROOT, 'vendor')

/**
 * `dir` is the vendored directory name, `root` the path inside the npm tarball
 * that `entries` are resolved against.
 */
const PACKAGES = [
	{
		npm: '@noble/hashes',
		version: '1.8.0',
		dir: 'noble-hashes',
		root: 'package/src',
		entries: ['sha2.ts', 'hmac.ts', 'hkdf.ts', 'utils.ts'],
		license: 'package/LICENSE',
	},
	{
		npm: '@noble/curves',
		version: '1.9.7',
		dir: 'noble-curves',
		root: 'package/src',
		entries: ['secp256k1.ts'],
		license: 'package/LICENSE',
	},
	{
		npm: '@scure/base',
		version: '1.2.6',
		dir: 'scure-base',
		root: 'package',
		entries: ['index.ts'],
		license: 'package/LICENSE',
	},
]

/**
 * Bare specifiers that noble emits across package boundaries. Everything else
 * bare is a hard error -- a new one means a new runtime dependency snuck in.
 */
const BARE_MAP = {
	'@noble/hashes/crypto': { dir: 'noble-hashes', file: 'crypto.ts' },
	'@noble/hashes/utils': { dir: 'noble-hashes', file: 'utils.ts' },
	'@noble/hashes/sha2': { dir: 'noble-hashes', file: 'sha2.ts' },
	'@noble/hashes/hmac': { dir: 'noble-hashes', file: 'hmac.ts' },
	'@noble/hashes/hkdf': { dir: 'noble-hashes', file: 'hkdf.ts' },
	'@noble/hashes/sha3': { dir: 'noble-hashes', file: 'sha3.ts' },
}

/**
 * `crypto.ts` ships in two flavours and the exports map picks `cryptoNode.ts`
 * under node, which is what we vendor. The other flavour reads `globalThis`,
 * and n8n's community-node ruleset forbids that global outright
 * (`@n8n/eslint-plugin-community-nodes`, rule `no-restricted-globals`). Its
 * `no-restricted-imports` rule explicitly allows `node:crypto`, so the node
 * flavour is both the faithful choice and the compliant one.
 */
const CRYPTO_FLAVOUR = 'cryptoNode.ts'

const banner = (pkg, file) =>
	`// Vendored from ${pkg.npm}@${pkg.version} (${file}) -- ${pkg.npm === '@scure/base' ? 'MIT' : 'MIT'} License.\n` +
	`// DO NOT EDIT BY HAND. Regenerate with \`node scripts/vendor.mjs\`. See VENDOR.md.\n`

function sh(cmd, args, cwd) {
	return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

/** Node builtins that may pass through vendored code untouched. */
const ALLOWED_BUILTINS = new Set(['node:crypto'])

/** Rewrites one import specifier found in `fromFile` (vendored path) to a vendored target. */
function rewriteSpecifier(spec, pkg, fromFile, enqueue) {
	// `cryptoNode.ts` imports node:crypto, which n8n allows. Leave it alone.
	if (ALLOWED_BUILTINS.has(spec)) return spec

	// Bare cross-package specifier -> relative path into the sibling vendor dir.
	if (!spec.startsWith('.')) {
		const target = BARE_MAP[spec.replace(/\.(ts|js)$/, '')]
		if (!target) throw new Error(`Unmapped bare import ${JSON.stringify(spec)} in ${pkg.dir}/${fromFile}`)
		if (target.dir === pkg.dir) {
			enqueue(target.file)
		} else {
			// Cross-package: the other package's own vendor run must cover it.
			const otherPkg = PACKAGES.find((p) => p.dir === target.dir)
			if (!otherPkg) throw new Error(`No vendored package for ${spec}`)
			if (!otherPkg.entries.includes(target.file)) otherPkg.entries.push(target.file)
		}
		const fromDir = dirname(join(pkg.dir, fromFile))
		const toPath = join(target.dir, target.file.replace(/\.ts$/, ''))
		let rel = relative(fromDir, toPath).split('\\').join('/')
		if (!rel.startsWith('.')) rel = './' + rel
		return rel
	}

	// Relative specifier: strip the extension, queue the file for copying.
	const stripped = spec.replace(/\.(ts|js)$/, '')
	const resolved = join(dirname(fromFile), stripped + '.ts').split('\\').join('/')
	enqueue(resolved)
	return stripped
}

const IMPORT_RE = /(\bfrom\s*|\bimport\s*\(?\s*)(['"])([^'"]+)\2/g

/**
 * Returns a same-length copy of `code` with comment bodies blanked out.
 * noble's JSDoc contains `import ... from '@noble/hashes/hmac'` usage examples;
 * rewriting those would corrupt the docs and, worse, hide real unmapped imports
 * behind spurious ones. We match against the mask and splice into the original.
 */
function maskComments(code) {
	const out = Array.from(code)
	let i = 0
	let state = 'code' // code | line | block | sq | dq | tpl
	while (i < code.length) {
		const c = code[i]
		const n = code[i + 1]
		if (state === 'code') {
			if (c === '/' && n === '/') { state = 'line'; out[i] = out[i + 1] = ' '; i += 2; continue }
			if (c === '/' && n === '*') { state = 'block'; out[i] = out[i + 1] = ' '; i += 2; continue }
			if (c === "'") state = 'sq'
			else if (c === '"') state = 'dq'
			else if (c === '`') state = 'tpl'
		} else if (state === 'line') {
			if (c === '\n') state = 'code'
			else out[i] = ' '
		} else if (state === 'block') {
			if (c === '*' && n === '/') { out[i] = out[i + 1] = ' '; i += 2; state = 'code'; continue }
			if (c !== '\n') out[i] = ' '
		} else {
			if (c === '\\') { i += 2; continue }
			if ((state === 'sq' && c === "'") || (state === 'dq' && c === '"') || (state === 'tpl' && c === '`')) {
				state = 'code'
			}
		}
		i++
	}
	return out.join('')
}

/** Rewrites import specifiers in `code`, ignoring anything inside a comment. */
function rewriteImports(code, apply) {
	const masked = maskComments(code)
	const edits = []
	for (const m of masked.matchAll(IMPORT_RE)) {
		const [, kw, q, spec] = m
		const next = apply(spec)
		if (next === spec) continue
		const start = m.index + kw.length + q.length
		edits.push({ start, end: start + spec.length, next })
	}
	let out = code
	for (const e of edits.reverse()) out = out.slice(0, e.start) + e.next + out.slice(e.end)
	return out
}

function processPackage(pkg, extractDir) {
	const srcRoot = join(extractDir, pkg.root)
	const outRoot = join(VENDOR, pkg.dir)
	rmSync(outRoot, { recursive: true, force: true })
	mkdirSync(outRoot, { recursive: true })

	const queue = [...pkg.entries]
	const done = new Set()
	const copied = []

	while (queue.length) {
		let file = queue.shift()
		if (done.has(file)) continue
		done.add(file)

		// crypto.ts / cryptoNode.ts flavour selection.
		let diskFile = file
		if (pkg.dir === 'noble-hashes' && file === 'crypto.ts') diskFile = CRYPTO_FLAVOUR

		const srcPath = join(srcRoot, diskFile)
		if (!existsSync(srcPath)) throw new Error(`Missing source ${srcPath} (wanted by ${pkg.npm})`)

		let code = readFileSync(srcPath, 'utf8')
		code = rewriteImports(code, (spec) =>
			rewriteSpecifier(spec, pkg, file, (f) => {
				if (!done.has(f)) queue.push(f)
			}),
		)

		const outPath = join(outRoot, file)
		mkdirSync(dirname(outPath), { recursive: true })
		writeFileSync(outPath, banner(pkg, diskFile) + code)
		copied.push(file)
	}

	// Upstream LICENSE, verbatim.
	const licSrc = join(extractDir, pkg.license)
	if (!existsSync(licSrc)) throw new Error(`Missing LICENSE for ${pkg.npm}`)
	writeFileSync(join(outRoot, 'LICENSE'), readFileSync(licSrc))

	return copied.sort()
}

/** Fails the build if vendored code reaches for anything n8n review forbids. */
function audit() {
	const offenders = []
	const walk = (dir) => {
		for (const e of readdirSync(dir, { withFileTypes: true })) {
			const p = join(dir, e.name)
			if (e.isDirectory()) walk(p)
			else if (e.name.endsWith('.ts')) {
				// Scan code only: noble's prose mentions globalThis and setTimeout, and a
				// comment is not an API call. maskComments keeps offsets, blanks bodies.
				const src = maskComments(readFileSync(p, 'utf8'))
				// node:crypto is the one builtin n8n's community-node ruleset allows.
				const bareNodeImport = /from\s*['"]node:(?!crypto['"])/
				for (const [label, re] of [
					['process.env', /\bprocess\s*\.\s*env\b/],
					['globalThis', /\bglobalThis\b/],
					['setTimeout/setInterval', /\bset(Timeout|Interval|Immediate)\s*\(/],
					['disallowed node: builtin', bareNodeImport],
					['require()', /\brequire\s*\(/],
					['fs module', /['"]fs['"]/],
				]) {
					if (re.test(src)) offenders.push(`${relative(ROOT, p)}: ${label}`)
				}
			}
		}
	}
	walk(VENDOR)
	return offenders
}

const tmp = mkdtempSync(join(tmpdir(), 'n8nostr-vendor-'))
const record = []

try {
	for (const pkg of PACKAGES) {
		const spec = `${pkg.npm}@${pkg.version}`
		process.stdout.write(`fetching ${spec}\n`)
		const tgz = sh('npm', ['pack', spec, '--silent'], tmp).trim().split('\n').pop().trim()
		const tgzPath = join(tmp, tgz)
		const sha = createHash('sha256').update(readFileSync(tgzPath)).digest('hex')
		const ex = join(tmp, pkg.dir)
		mkdirSync(ex, { recursive: true })
		sh('tar', ['xzf', tgzPath, '-C', ex])
		record.push({ pkg, sha, tgz, ex })
	}

	// Entries can grow while processing (cross-package pulls), so iterate by index.
	const results = []
	for (let i = 0; i < record.length; i++) {
		const { pkg, ex } = record[i]
		results.push({ pkg, files: processPackage(pkg, ex) })
	}
	// noble-curves pulls extra hashes entries; redo hashes once more to pick them up.
	const hashesRec = record.find((r) => r.pkg.dir === 'noble-hashes')
	results.find((r) => r.pkg.dir === 'noble-hashes').files = processPackage(hashesRec.pkg, hashesRec.ex)

	const offenders = audit()
	if (offenders.length) {
		console.error('\nFORBIDDEN API in vendored code:\n' + offenders.map((o) => '  - ' + o).join('\n'))
		process.exit(1)
	}

	const lines = [
		'# Vendored dependencies',
		'',
		'`package.json` declares no runtime dependencies, per n8n\'s verified community node',
		'guidelines. The cryptography that Node\'s standard library does not provide is vendored',
		'here instead, compiled from source by this package\'s own `tsc`.',
		'',
		'Everything below is reproduced under its original license. `LICENSE` files sit alongside',
		'the code in each directory. Regenerate with `node scripts/vendor.mjs`; never hand-edit.',
		'',
		'| Package | Version | License | Vendored to | Files | Tarball SHA-256 |',
		'| --- | --- | --- | --- | --- | --- |',
	]
	for (const { pkg, sha } of record) {
		const files = results.find((r) => r.pkg.dir === pkg.dir).files.length
		lines.push(
			`| \`${pkg.npm}\` | ${pkg.version} | MIT | \`vendor/${pkg.dir}/\` | ${files} | \`${sha}\` |`,
		)
	}
	lines.push(
		'',
		'## What we take, and why',
		'',
		'- **`@noble/curves`** — BIP-340 schnorr signing and verification. Node\'s `crypto` exposes',
		'  secp256k1 for ECDH and ECDSA but not schnorr, which every Nostr event signature needs.',
		'- **`@noble/hashes`** — SHA-256, HMAC and HKDF as byte-array primitives. Node has all three,',
		'  but `@noble/curves` requires the noble callable form, so vendoring it avoids an adapter',
		'  layer between two implementations of the same primitive.',
		'- **`@scure/base`** — bech32/bech32m for NIP-19 (`npub`, `nsec`, `nevent`, `naddr`).',
		'',
		'## Deliberate deviations from upstream',
		'',
		'- Import specifiers are rewritten from `@noble/hashes/x.js` to relative paths, and `.ts`/`.js`',
		'  extensions are stripped, so the tree compiles as CommonJS under our `tsconfig.json`.',
		'- `@noble/hashes` ships two `crypto` shims; we vendor `cryptoNode.ts`, the flavour its own',
		'  exports map selects under Node. It imports `node:crypto` — the single builtin n8n\'s',
		'  community-node ruleset allows — and, unlike the browser flavour, never touches the',
		'  forbidden `globalThis`. The vendored tree therefore contains no filesystem or environment',
		'  access and no restricted global, which `scripts/vendor.mjs` and `test/compliance.test.ts` check.',
		'',
		'No other bytes are changed.',
		'',
	)
	writeFileSync(join(ROOT, 'VENDOR.md'), lines.join('\n'))

	console.log('\nvendored:')
	for (const r of results) console.log(`  ${r.pkg.npm.padEnd(16)} ${String(r.files.length).padStart(2)} files`)
	console.log('\naudit: clean (no process.env, globalThis, timers, require(), fs, or node: builtin but node:crypto)')
	console.log('wrote VENDOR.md')
} finally {
	rmSync(tmp, { recursive: true, force: true })
}
