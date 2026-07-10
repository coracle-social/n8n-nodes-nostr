/**
 * Drives the real NostrV1.execute() against real relays running in-process.
 */
import { afterEach, describe, expect, it } from 'vitest'

import { NostrV1 } from '../../nodes/Nostr/v1/NostrV1.node'
import { nip44 } from '../../nostr'
import { MockRelay, startMockRelay } from '../helpers/mockRelay'
import { mockExecuteFunctions } from '../helpers/mockExecuteFns'
import { PUBKEY, SK, SK_HEX, makeEvent } from '../helpers/events'

const relays: MockRelay[] = []
const track = <T extends MockRelay>(r: T): T => (relays.push(r), r)

afterEach(async () => {
	await Promise.all(relays.splice(0).map((r) => r.stop()))
})

const node = new NostrV1({
	displayName: 'Nostr',
	name: 'nostr',
	group: ['transform'],
	description: 'test',
	defaultVersion: 1,
})

const CREDS = { privateKey: SK_HEX, defaultRelays: '' }

const run = (params: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
	node.execute.call(mockExecuteFunctions({ params, credentials: CREDS, ...extra }) as never)

describe('event: create', () => {
	it('reports every relay result and never collapses them', async () => {
		const good = track(await startMockRelay())
		const bad = track(await startMockRelay({ rejectPublishReason: 'blocked: nope' }))

		const [items] = await run({
			resource: 'event',
			operation: 'create',
			inputMode: 'fields',
			kind: 1,
			content: 'hello from n8n',
			tags: '[]',
			relays: `${good.url}\n${bad.url}`,
			options: { timeoutMs: 3000 },
		})

		const json = items[0].json as any
		expect(json.results).toHaveLength(2)
		expect(json.accepted).toEqual([good.url])
		expect(json.rejected).toEqual([bad.url])
		expect(json.allAccepted).toBe(false)
		expect(json.anyAccepted).toBe(true)
		expect(json.event.pubkey).toBe(PUBKEY)
	})

	it('splits results into one item per relay when asked', async () => {
		const a = track(await startMockRelay())
		const b = track(await startMockRelay())

		const [items] = await run({
			resource: 'event',
			operation: 'create',
			inputMode: 'fields',
			kind: 1,
			content: 'split',
			tags: '[]',
			relays: `${a.url}\n${b.url}`,
			options: { timeoutMs: 3000, splitResultsIntoItems: true },
		})

		expect(items).toHaveLength(2)
		expect(items.every((i) => (i.json as any).ok)).toBe(true)
	})

	it('throws without a credential, since it cannot sign', async () => {
		const relay = track(await startMockRelay())
		const fns = mockExecuteFunctions({
			params: {
				resource: 'event',
				operation: 'create',
				inputMode: 'fields',
				kind: 1,
				content: 'x',
				tags: '[]',
				relays: relay.url,
				options: {},
			},
		})

		await expect(node.execute.call(fns as never)).rejects.toThrow(/requires a Nostr credential/)
	})

	it('captures the error as an item under continueOnFail', async () => {
		const relay = track(await startMockRelay())
		const fns = mockExecuteFunctions({
			params: {
				resource: 'event',
				operation: 'create',
				inputMode: 'fields',
				kind: 1,
				content: 'x',
				tags: '[]',
				relays: relay.url,
				options: {},
			},
			continueOnFail: true,
		})

		const [items] = await node.execute.call(fns as never)
		expect(items).toHaveLength(1)
		expect((items[0].json as any).error).toMatch(/requires a Nostr credential/)
	})

	it('refuses to relay a pre-signed event whose signature does not verify', async () => {
		const relay = track(await startMockRelay())
		const forged = { ...makeEvent({ content: 'real' }), content: 'forged' }

		const fns = mockExecuteFunctions({
			params: {
				resource: 'event',
				operation: 'create',
				inputMode: 'rawEvent',
				event: JSON.stringify(forged),
				relays: relay.url,
				options: {},
			},
			credentials: CREDS,
		})

		await expect(node.execute.call(fns as never)).rejects.toThrow(/do not verify/)
	})
})

describe('event: sign', () => {
	it('produces a verifiable event and an nevent, without touching a relay', async () => {
		const [items] = await run({
			resource: 'event',
			operation: 'sign',
			inputMode: 'fields',
			kind: 1,
			content: 'offline',
			tags: '[]',
			options: {},
		})

		const json = items[0].json as any
		expect(json.pubkey).toBe(PUBKEY)
		expect(json.event.sig).toMatch(/^[0-9a-f]{128}$/)
		expect(json.nevent).toMatch(/^nevent1/)
	})
})

describe('event: get', () => {
	it('returns the single newest event matching the filter', async () => {
		const older = makeEvent({ content: 'older', created_at: 1_000 })
		const newer = makeEvent({ content: 'newer', created_at: 2_000 })
		const a = track(await startMockRelay({ events: [older] }))
		const b = track(await startMockRelay({ events: [newer] }))

		const [items] = await run({
			resource: 'event',
			operation: 'get',
			filterMode: 'fields',
			kinds: '1',
			relays: `${a.url}\n${b.url}`,
			options: { timeoutMs: 3000 },
		})

		expect(items).toHaveLength(1)
		expect((items[0].json as any).content).toBe('newer')
	})

	it('returns nothing when no event matches', async () => {
		const relay = track(await startMockRelay({ events: [] }))

		const [items] = await run({
			resource: 'event',
			operation: 'get',
			filterMode: 'fields',
			kinds: '1',
			relays: relay.url,
			options: { timeoutMs: 3000 },
		})

		expect(items).toHaveLength(0)
	})
})

describe('event: get many', () => {
	it('returns one item per event and dedups across relays', async () => {
		const shared = makeEvent({ content: 'shared' })
		const a = track(await startMockRelay({ events: [shared, makeEvent({ content: 'only-a' })] }))
		const b = track(await startMockRelay({ events: [shared] }))

		const [items] = await run({
			resource: 'event',
			operation: 'getMany',
			filterMode: 'fields',
			kinds: '1',
			limit: 10,
			relays: `${a.url}\n${b.url}`,
			options: { timeoutMs: 3000 },
		})

		const contents = items.map((i) => (i.json as any).content).sort()
		expect(contents).toEqual(['only-a', 'shared'])
	})

	it('returns a single array item when asked', async () => {
		const relay = track(await startMockRelay({ events: [makeEvent()] }))

		const [items] = await run({
			resource: 'event',
			operation: 'getMany',
			filterMode: 'fields',
			kinds: '1',
			limit: 10,
			relays: relay.url,
			options: { timeoutMs: 3000, outputMode: 'singleArray' },
		})

		expect(items).toHaveLength(1)
		expect((items[0].json as any).count).toBe(1)
		expect((items[0].json as any).relaysQueried).toEqual([relay.url])
	})

	it('works without a credential', async () => {
		const relay = track(await startMockRelay({ events: [makeEvent()] }))
		const fns = mockExecuteFunctions({
			params: {
				resource: 'event',
				operation: 'getMany',
				filterMode: 'fields',
				kinds: '1',
				limit: 10,
				relays: relay.url,
				options: { timeoutMs: 3000 },
			},
		})

		const [items] = await node.execute.call(fns as never)
		expect(items).toHaveLength(1)
	})
})

describe('encryption', () => {
	it('round-trips a message through encrypt and decrypt', async () => {
		const peer = 'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9'

		const [encrypted] = await run({
			resource: 'encryption',
			operation: 'encrypt',
			peerPublicKey: peer,
			plaintext: 'secret message',
		})
		const ciphertext = (encrypted[0].json as any).ciphertext as string
		expect((encrypted[0].json as any).version).toBe('nip44')

		const [decrypted] = await run({
			resource: 'encryption',
			operation: 'decrypt',
			peerPublicKey: peer,
			ciphertext,
		})
		expect((decrypted[0].json as any).plaintext).toBe('secret message')
	})

	it('agrees with the library on the conversation key', async () => {
		const peer = 'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9'
		const [encrypted] = await run({
			resource: 'encryption',
			operation: 'encrypt',
			peerPublicKey: peer,
			plaintext: 'x',
		})
		const key = nip44.getConversationKey(SK, peer)
		expect(nip44.decrypt((encrypted[0].json as any).ciphertext, key)).toBe('x')
	})

	it('throws without a credential', async () => {
		const fns = mockExecuteFunctions({
			params: { resource: 'encryption', operation: 'encrypt', peerPublicKey: PUBKEY, plaintext: 'x' },
		})
		await expect(node.execute.call(fns as never)).rejects.toThrow(/requires a Nostr credential/)
	})
})

describe('utility: NIP-19', () => {
	it('encodes an npub', async () => {
		const [items] = await run({ resource: 'utility', operation: 'encode', entity: 'npub', pubkey: PUBKEY })
		expect((items[0].json as any).encoded).toMatch(/^npub1/)
	})

	it('decodes back to the same pubkey', async () => {
		const [encoded] = await run({ resource: 'utility', operation: 'encode', entity: 'npub', pubkey: PUBKEY })
		const [decoded] = await run({
			resource: 'utility',
			operation: 'decode',
			code: (encoded[0].json as any).encoded,
		})
		expect(decoded[0].json).toEqual({ type: 'npub', data: PUBKEY })
	})

	it('throws on an undecodable code', async () => {
		const fns = mockExecuteFunctions({ params: { resource: 'utility', operation: 'decode', code: 'garbage' } })
		await expect(node.execute.call(fns as never)).rejects.toThrow(/Could not decode/)
	})
})

describe('routing', () => {
	it('rejects an unknown resource/operation pair', async () => {
		const fns = mockExecuteFunctions({ params: { resource: 'event', operation: 'teleport' } })
		await expect(node.execute.call(fns as never)).rejects.toThrow(/not supported/)
	})
})
