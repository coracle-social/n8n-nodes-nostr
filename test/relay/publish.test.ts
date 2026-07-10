import { afterEach, describe, expect, it } from 'vitest'

import { RelayPool } from '../../src/relay/RelayPool'
import { publish } from '../../src/relay/publish'
import { MockRelay, startMockRelay } from '../helpers/mockRelay'
import { makeEvent } from '../helpers/events'

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

const OPTS = { timeoutMs: 4_000, authenticate: false }

describe('publish fan-out', () => {
	it('returns one result per relay, in order', async () => {
		const a = track(await startMockRelay())
		const b = track(await startMockRelay())

		const results = await publish(newPool(), makeEvent(), [a.url, b.url], OPTS)

		expect(results.map((r) => r.relay)).toEqual([a.url, b.url])
		expect(results.every((r) => r.ok)).toBe(true)
		expect(results.every((r) => r.durationMs >= 0)).toBe(true)
	})

	it('preserves a rejection instead of throwing', async () => {
		const relay = track(await startMockRelay({ rejectPublishReason: 'blocked: pubkey banned' }))

		const [result] = await publish(newPool(), makeEvent(), [relay.url], OPTS)

		expect(result.ok).toBe(false)
		expect(result.reason).toBe('blocked: pubkey banned')
	})

	it('reports one relay down and one up, without failing the operation', async () => {
		const up = track(await startMockRelay())
		const down = 'ws://127.0.0.1:1' // nothing listening

		const results = await publish(newPool(), makeEvent(), [up.url, down], OPTS)

		expect(results[0]).toMatchObject({ relay: up.url, ok: true })
		expect(results[1].ok).toBe(false)
		expect(results[1].reason).toBeTruthy()
	}, 15_000)

	it('never throws when every relay is unreachable', async () => {
		const results = await publish(newPool(), makeEvent(), ['ws://127.0.0.1:1'], OPTS)
		expect(results).toHaveLength(1)
		expect(results[0].ok).toBe(false)
	}, 15_000)

	it('times out waiting for an OK rather than hanging', async () => {
		// Accepts the socket and the EVENT frame, but never answers with an OK.
		const silent = track(await startMockRelay({ silentOnEvent: true }))

		const started = Date.now()
		const [result] = await publish(newPool(), makeEvent(), [silent.url], { ...OPTS, timeoutMs: 800 })

		expect(result.ok).toBe(false)
		expect(result.reason).toMatch(/timed out/)
		expect(Date.now() - started).toBeLessThan(4_000)
	}, 15_000)
})
