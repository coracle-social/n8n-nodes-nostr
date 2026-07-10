/**
 * Mechanical enforcement of n8n's verified-community-node rules.
 *
 * These are the constraints a human reviewer would check by reading the package,
 * so we check them on every test run instead of hoping. The rules: no runtime
 * dependencies, no environment or filesystem access, and no reach into anything
 * outside the package at runtime.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

import pkg from '../package.json'

const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'src')

function walk(dir: string): string[] {
	const out: string[] = []
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name)
		if (entry.isDirectory()) out.push(...walk(full))
		else if (extname(full) === '.ts') out.push(full)
	}
	return out
}

/**
 * Blanks out comments before scanning for imports. noble's JSDoc is full of
 * `@deprecated use \`import { x } from '@noble/curves/...'\`` examples, which are
 * documentation, not dependencies.
 */
const stripComments = (src: string): string =>
	src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const importsOf = (file: string): string[] =>
	[...stripComments(readFileSync(file, 'utf8')).matchAll(/from\s*['"]([^'"]+)['"]/g)].map((m) => m[1])

/** Our own source: everything under src/ that is not vendored third-party code. */
const ourSources = walk(SRC).filter((f) => !f.includes(`${join('src', 'vendor')}`))
const vendorSources = walk(join(SRC, 'vendor'))

const CHACHA = join(SRC, 'nostr', 'chacha.ts')

describe('package.json', () => {
	it('declares no runtime dependencies', () => {
		expect(pkg.dependencies).toEqual({})
	})

	it('is MIT licensed', () => {
		expect(pkg.license).toBe('MIT')
	})

	it('is named and keyworded so n8n can find it', () => {
		expect(pkg.name).toMatch(/^(@[^/]+\/)?n8n-nodes-/)
		expect(pkg.keywords).toContain('n8n-community-node-package')
	})

	it('points the n8n key at compiled files', () => {
		for (const node of pkg.n8n.nodes) expect(node).toMatch(/^dist\/nodes\/.+\.node\.js$/)
		for (const cred of pkg.n8n.credentials) expect(cred).toMatch(/^dist\/credentials\/.+\.credentials\.js$/)
	})

	it('publishes with provenance', () => {
		expect(pkg.publishConfig).toMatchObject({ access: 'public', provenance: true })
	})

	it('ships the vendored-code attribution alongside dist', () => {
		expect(pkg.files).toContain('THIRD_PARTY_LICENSES.md')
		expect(pkg.files).toContain('VENDOR.md')
	})
})

describe('runtime source is free of forbidden APIs', () => {
	it.each(ourSources.map((f) => [relative(ROOT, f), f]))('%s reads no environment variables', (_name, file) => {
		expect(readFileSync(file, 'utf8')).not.toMatch(/\bprocess\s*\.\s*env\b/)
	})

	it.each(ourSources.map((f) => [relative(ROOT, f), f]))('%s touches no filesystem module', (_name, file) => {
		const src = readFileSync(file, 'utf8')
		expect(src).not.toMatch(/from\s*['"](node:)?(fs|path|os|child_process)['"]/)
		expect(src).not.toMatch(/require\s*\(\s*['"](node:)?(fs|path|os|child_process)['"]\s*\)/)
	})

	it.each(ourSources.map((f) => [relative(ROOT, f), f]))('%s imports no third-party package', (_name, file) => {
		// n8n-workflow is a peer dependency the host injects; everything else must be
		// vendored or relative.
		for (const spec of importsOf(file)) {
			if (spec.startsWith('.')) continue
			if (spec === 'n8n-workflow') continue
			if (spec === 'node:crypto') continue
			throw new Error(`${relative(ROOT, file)} imports ${spec}`)
		}
	})

	it('uses node:crypto in exactly one file, and only for ChaCha20', () => {
		const users = ourSources.filter((f) => importsOf(f).includes('node:crypto'))
		expect(users).toEqual([CHACHA])
		expect(readFileSync(CHACHA, 'utf8')).toMatch(/createCipheriv/)
	})
})

describe('vendored source is self-contained', () => {
	it('resolves only to relative paths and node:crypto', () => {
		for (const file of vendorSources) {
			for (const spec of importsOf(file)) {
				const ok = spec.startsWith('.') || spec === 'node:crypto'
				expect(ok, `${relative(ROOT, file)} imports ${spec}`).toBe(true)
			}
		}
	})

	it('carries its upstream licenses', () => {
		for (const dir of ['noble-hashes', 'noble-curves', 'scure-base']) {
			const license = readFileSync(join(SRC, 'vendor', dir, 'LICENSE'), 'utf8')
			expect(license, dir).toMatch(/MIT/i)
		}
	})

	it('is documented in VENDOR.md with pinned versions', () => {
		const vendorDoc = readFileSync(join(ROOT, 'VENDOR.md'), 'utf8')
		expect(vendorDoc).toMatch(/@noble\/hashes.*1\.8\.0/)
		expect(vendorDoc).toMatch(/@noble\/curves.*1\.9\.7/)
		expect(vendorDoc).toMatch(/@scure\/base.*1\.2\.6/)
	})
})

describe('websockets come from the platform', () => {
	it('never imports ws from src', () => {
		for (const file of ourSources) {
			expect(readFileSync(file, 'utf8'), relative(ROOT, file)).not.toMatch(/from\s*['"]ws['"]/)
		}
	})

	it('constructs the bare WebSocket global', () => {
		const conn = readFileSync(join(SRC, 'relay', 'Connection.ts'), 'utf8')
		expect(conn).toMatch(/new WebSocket\(/)
	})
})

/**
 * Mirrors `no-restricted-globals` from @n8n/eslint-plugin-community-nodes, the
 * ruleset n8n's own `@n8n/scan-community-package` runs against a submission.
 * WebSocket and AbortSignal are deliberately absent from their list, which is
 * what makes src/relay/timers.ts possible.
 */
describe('no restricted globals reach the published build', () => {
	const RESTRICTED = [
		'clearInterval',
		'clearTimeout',
		'globalThis',
		'setInterval',
		'setTimeout',
		'setImmediate',
		'clearImmediate',
		'__dirname',
		'__filename',
	]

	const allSources = [...ourSources, ...vendorSources]

	it.each(RESTRICTED)('no source file references %s', (name) => {
		const pattern = new RegExp(`\\b${name}\\b`)
		const offenders = allSources.filter((file) => pattern.test(stripComments(readFileSync(file, 'utf8'))))
		expect(offenders.map((f) => relative(ROOT, f))).toEqual([])
	})

	it('no source file reads process', () => {
		const offenders = allSources.filter((file) =>
			/\bprocess\s*\./.test(stripComments(readFileSync(file, 'utf8'))),
		)
		expect(offenders.map((f) => relative(ROOT, f))).toEqual([])
	})
})
