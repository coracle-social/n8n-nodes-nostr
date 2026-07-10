#!/usr/bin/env node
/**
 * Post-build gate: exercise dist/ the way n8n will.
 *
 * The test suite runs TypeScript through vitest. This runs the *compiled*
 * CommonJS under plain node, which is the only thing that proves the vendoring
 * survived tsc: a stray `@noble/*` import typechecks fine and then explodes at
 * n8n load time with "Cannot find module".
 *
 * Run: npm run build && node scripts/verify-dist.mjs
 */
import { createRequire } from 'node:module'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const require = createRequire(import.meta.url)

let failures = 0
const check = (name, fn) => {
	try {
		const result = fn()
		if (result instanceof Promise) return result.then(() => console.log(`  ok  ${name}`), (e) => fail(name, e))
		console.log(`  ok  ${name}`)
	} catch (err) {
		fail(name, err)
	}
}
const fail = (name, err) => {
	failures++
	console.error(`  FAIL ${name}\n       ${err.message}`)
}
const assert = (cond, msg) => {
	if (!cond) throw new Error(msg)
}

const walk = (dir) =>
	readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
		e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
	)

console.log('\ndist static scan')

const jsFiles = walk(DIST).filter((f) => extname(f) === '.js')

check(`${jsFiles.length} compiled files require nothing external`, () => {
	const allowed = new Set(['n8n-workflow', 'node:crypto'])
	for (const file of jsFiles) {
		const src = readFileSync(file, 'utf8')
		for (const m of src.matchAll(/require\(["']([^"']+)["']\)/g)) {
			const spec = m[1]
			if (spec.startsWith('.') || allowed.has(spec)) continue
			throw new Error(`${file.replace(ROOT + '/', '')} requires ${spec}`)
		}
	}
})

check('no @noble or @scure specifier survived vendoring', () => {
	for (const file of jsFiles) {
		const src = readFileSync(file, 'utf8')
		assert(!/require\(["']@(noble|scure)\//.test(src), `${file} still requires an upstream package`)
	}
})

check('no process.env in compiled output', () => {
	for (const file of jsFiles) {
		assert(!/process\s*\.\s*env/.test(readFileSync(file, 'utf8')), `${file} reads process.env`)
	}
})

console.log('\nn8n load surface')

const pkg = require(join(ROOT, 'package.json'))

check('every path in the n8n key exists', () => {
	for (const rel of [...pkg.n8n.nodes, ...pkg.n8n.credentials]) {
		assert(existsSync(join(ROOT, rel)), `missing ${rel}`)
	}
})

let nostrNode, triggerNode

/** Every icon must be `{light, dark}`, distinct, and present on disk beside its class. */
const checkThemedIcon = (icon, dir, what) => {
	assert(icon && typeof icon === 'object', `${what}: icon should be a { light, dark } object`)
	assert(icon.light !== icon.dark, `${what}: light and dark icons must differ`)
	for (const theme of ['light', 'dark']) {
		const ref = icon[theme]
		assert(ref?.startsWith('file:'), `${what}: ${theme} icon must use the file: protocol`)
		const file = join(dir, ref.slice('file:'.length))
		assert(existsSync(file), `${what}: missing ${theme} icon file ${ref}`)
	}
}

check('Nostr node loads, versions, and declares themed icons', () => {
	const { Nostr } = require(join(DIST, 'nodes/Nostr/Nostr.node.js'))
	nostrNode = new Nostr()
	const v1 = nostrNode.nodeVersions[1]
	assert(nostrNode.description.defaultVersion === 1, 'defaultVersion should be 1')
	assert(v1.description.properties.length > 10, 'v1 should expose parameters')
	assert(typeof v1.execute === 'function', 'v1 should have execute()')
	checkThemedIcon(nostrNode.description.icon, join(DIST, 'nodes/Nostr'), 'Nostr node')
	assert(existsSync(join(DIST, 'nodes/Nostr/Nostr.node.json')), 'codex file must sit beside the node')
})

check('Nostr node exposes its three resources', () => {
	const v1 = nostrNode.nodeVersions[1]
	const resource = v1.description.properties.find((p) => p.name === 'resource')
	const values = resource.options.map((o) => o.value).sort()
	assert(
		JSON.stringify(values) === JSON.stringify(['encryption', 'event', 'utility']),
		`unexpected resources: ${values}`,
	)
})

check('Nostr node wires the credential test', () => {
	const v1 = nostrNode.nodeVersions[1]
	assert(v1.description.credentials[0].testedBy === 'nostrKeyTest', 'credential should be testedBy nostrKeyTest')
	assert(typeof v1.methods.credentialTest.nostrKeyTest === 'function', 'nostrKeyTest must be a function')
})

check('Nostr Trigger loads and is a trigger', () => {
	const { NostrTrigger } = require(join(DIST, 'nodes/NostrTrigger/NostrTrigger.node.js'))
	triggerNode = new NostrTrigger()
	assert(triggerNode.description.group.includes('trigger'), 'must be in the trigger group')
	assert(typeof triggerNode.trigger === 'function', 'must implement trigger()')
	assert(triggerNode.description.inputs.length === 0, 'a trigger takes no inputs')
	// n8n verification requires every node that uses a credential to test it.
	assert(
		triggerNode.description.credentials[0].testedBy === 'nostrKeyTest',
		'trigger credential should be testedBy nostrKeyTest',
	)
	assert(typeof triggerNode.methods.credentialTest.nostrKeyTest === 'function', 'trigger must wire nostrKeyTest')
	checkThemedIcon(triggerNode.description.icon, join(DIST, 'nodes/NostrTrigger'), 'Nostr Trigger')
})

check('credential loads and masks the secret', () => {
	const { NostrPrivateKeyApi } = require(join(DIST, 'credentials/NostrPrivateKeyApi.credentials.js'))
	const cred = new NostrPrivateKeyApi()
	assert(cred.name === 'nostrPrivateKeyApi', 'credential name mismatch')
	const key = cred.properties.find((p) => p.name === 'privateKey')
	assert(key.typeOptions.password === true, 'private key must be a password field')
	// n8n verification requires a declarative credential test.
	assert(cred.test?.request?.method === 'GET', 'credential must declare a test request')
	assert(/nip|nostr|damus|\$credentials/.test(cred.test.request.url), 'test URL should target a relay')
	checkThemedIcon(cred.icon, join(DIST, 'credentials'), 'credential')
})

check('credential test derives an npub without network', async () => {
	const { nostrKeyTest } = require(join(DIST, 'nodes/shared/credentialTest.js'))
	const good = await nostrKeyTest.call(
		{},
		{ data: { privateKey: '67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa' } },
	)
	assert(good.status === 'OK', `expected OK, got ${good.status}: ${good.message}`)
	assert(good.message.includes('npub1'), 'should report the derived npub')

	const bad = await nostrKeyTest.call({}, { data: { privateKey: 'garbage' } })
	assert(bad.status === 'Error', 'garbage key should fail the test')
})

console.log('\ncompiled crypto + transport, end to end')

await check('signs, publishes and reads back an event over a real websocket', async () => {
	const { finalizeEvent, normalizeSecretKey, verifyEvent } = require(join(DIST, 'nostr/index.js'))
	const { RelayPool, publish, query } = require(join(DIST, 'relay/index.js'))

	// A minimal NIP-01 relay, speaking to the compiled client over a real socket.
	const store = []
	const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 })
	await new Promise((r) => wss.once('listening', r))
	const url = `ws://127.0.0.1:${wss.address().port}`

	wss.on('connection', (ws) => {
		ws.on('message', (raw) => {
			const frame = JSON.parse(raw.toString())
			if (frame[0] === 'EVENT') {
				store.push(frame[1])
				ws.send(JSON.stringify(['OK', frame[1].id, true, '']))
			} else if (frame[0] === 'REQ') {
				for (const e of store) ws.send(JSON.stringify(['EVENT', frame[1], e]))
				ws.send(JSON.stringify(['EOSE', frame[1]]))
			}
		})
	})

	const sk = normalizeSecretKey('67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa')
	const event = finalizeEvent({ kind: 1, created_at: 1700000000, tags: [], content: 'compiled hello' }, sk)
	assert(verifyEvent(event), 'compiled schnorr produced an event that does not verify')

	const pool = new RelayPool({ authenticate: false })
	try {
		const results = await publish(pool, event, [url], { timeoutMs: 4000, authenticate: false })
		assert(results.length === 1 && results[0].ok, `publish failed: ${JSON.stringify(results)}`)

		const got = await query(pool, [{ kinds: [1] }], [url], {
			timeoutMs: 4000,
			closeOnEose: true,
			authenticate: false,
		})
		assert(got.length === 1, `expected 1 event back, got ${got.length}`)
		assert(got[0].content === 'compiled hello', 'round-tripped content mismatch')
	} finally {
		await pool.close()
		await new Promise((r) => wss.close(r))
	}
})

await check('NIP-44 round-trips through the compiled build', async () => {
	const { nip44, normalizeSecretKey, getPublicKey } = require(join(DIST, 'nostr/index.js'))
	const a = normalizeSecretKey('67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa')
	const b = normalizeSecretKey('0000000000000000000000000000000000000000000000000000000000000003')

	const keyA = nip44.getConversationKey(a, getPublicKey(b))
	const keyB = nip44.getConversationKey(b, getPublicKey(a))
	const ciphertext = nip44.encrypt('compiled secret', keyA)
	assert(nip44.decrypt(ciphertext, keyB) === 'compiled secret', 'NIP-44 round trip failed')
})

console.log()
if (failures) {
	console.error(`${failures} check(s) failed\n`)
	process.exit(1)
}
console.log('dist verified: loads under plain node, no external requires, crypto and transport work\n')
