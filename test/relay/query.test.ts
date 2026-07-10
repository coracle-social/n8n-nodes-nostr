import { afterEach, describe, expect, it } from 'vitest'

import { RelayPool } from '../../src/relay/RelayPool'
import { query } from '../../src/relay/query'
import { finalizeEvent } from '../../src/nostr/pure'
import { MockRelay, startMockRelay } from '../helpers/mockRelay'
import { SK, makeEvent } from '../helpers/events'

const relays: MockRelay[] = []
const pools: RelayPool[] = []
const track = <T extends MockRelay>(r: T): T => (relays.push(r), r)
const newPool = (): RelayPool => {
	const p = new RelayPool()
	pools.push(p)
	return p
}

afterEach(async () => {
	await Promise.all(pools.splice(0).map((p) => p.close()))
	await Promise.all(relays.splice(0).map((r) => r.stop()))
})

const BASE = { timeoutMs: 4_000, closeOnEose: true, authenticate: false }

describe('query termination', () => {
	it('returns on EOSE', async () => {
		const events = [makeEvent({ content: 'a' }), makeEvent({ content: 'b' })]
		const relay = track(await startMockRelay({ events }))

		const got = await query(newPool(), [{ kinds: [1] }], [relay.url], BASE)
		expect(got).toHaveLength(2)
	})

	it('returns as soon as the limit is reached', async () => {
		const events = Array.from({ length: 10 }, (_, i) => makeEvent({ content: `e${i}` }))
		const relay = track(await startMockRelay({ events }))

		const got = await query(newPool(), [{ kinds: [1] }], [relay.url], { ...BASE, limit: 3 })
		expect(got).toHaveLength(3)
	})

	it('honours the wall-clock deadline against a relay that never sends EOSE', async () => {
		const relay = track(await startMockRelay({ events: [makeEvent()], neverEose: true }))

		const started = Date.now()
		const got = await query(newPool(), [{ kinds: [1] }], [relay.url], { ...BASE, timeoutMs: 700 })
		const elapsed = Date.now() - started

		expect(got).toHaveLength(1) // the one event it did serve
		expect(elapsed).toBeGreaterThanOrEqual(600)
		expect(elapsed).toBeLessThan(3_000) // did not hang
	}, 15_000)

	it('returns immediately with no relays', async () => {
		expect(await query(newPool(), [{ kinds: [1] }], [], BASE)).toEqual([])
	})

	it('does not hang when the only relay is unreachable', async () => {
		const started = Date.now()
		const got = await query(newPool(), [{ kinds: [1] }], ['ws://127.0.0.1:1'], { ...BASE, timeoutMs: 3_000 })
		expect(got).toEqual([])
		expect(Date.now() - started).toBeLessThan(6_000)
	}, 15_000)
})

describe('query deduplication', () => {
	it('yields one copy of an event served by two relays', async () => {
		const event = makeEvent({ content: 'shared' })
		const a = track(await startMockRelay({ events: [event] }))
		const b = track(await startMockRelay({ events: [event] }))

		const got = await query(newPool(), [{ kinds: [1] }], [a.url, b.url], BASE)
		expect(got).toHaveLength(1)
		expect(got[0].id).toBe(event.id)
	})

	it('keeps the newest version of a replaceable event', async () => {
		const older = finalizeEvent({ kind: 0, created_at: 1_700_000_000, tags: [], content: '{"name":"old"}' }, SK)
		const newer = finalizeEvent({ kind: 0, created_at: 1_700_000_500, tags: [], content: '{"name":"new"}' }, SK)
		const a = track(await startMockRelay({ events: [older] }))
		const b = track(await startMockRelay({ events: [newer] }))

		const got = await query(newPool(), [{ kinds: [0] }], [a.url, b.url], {
			...BASE,
			dedupReplaceable: true,
		})

		expect(got).toHaveLength(1)
		expect(got[0].content).toBe('{"name":"new"}')
	})

	it('drops events whose signature does not verify', async () => {
		const good = makeEvent({ content: 'good' })
		const forged = { ...makeEvent({ content: 'forged' }), content: 'tampered' }
		const relay = track(await startMockRelay({ events: [good, forged] }))

		const got = await query(newPool(), [{ kinds: [1] }], [relay.url], BASE)
		expect(got.map((e) => e.content)).toEqual(['good'])
	})
})
