/**
 * A trigger runs for weeks. Sockets drop. These prove the subscription comes
 * back and resumes near where it stopped, rather than replaying its whole window.
 */
import { afterEach, describe, expect, it } from 'vitest'

import { RelayPool } from '../../src/relay/RelayPool'
import { subscribe } from '../../src/relay/subscribe'
import { MockRelay, startMockRelay } from '../helpers/mockRelay'
import { makeEvent } from '../helpers/events'
import type { Event } from '../../src/nostr'

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

const settle = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('subscription reconnect', () => {
	it('re-subscribes after the socket drops and delivers new events', async () => {
		const relay = track(await startMockRelay())
		const got: Event[] = []

		await subscribe(newPool(), [{ kinds: [1] }], [relay.url], {
			authenticate: false,
			onEvent: (event) => got.push(event),
		})
		await settle(300)
		expect(relay.clientCount).toBe(1)

		relay.dropClients()
		await settle(200)
		expect(relay.clientCount).toBe(0)

		// Backoff starts at ~1s with jitter.
		await settle(2_000)
		expect(relay.clientCount).toBe(1)

		relay.broadcast(makeEvent({ content: 'after reconnect', created_at: Math.floor(Date.now() / 1000) }))
		await settle(300)

		expect(got.map((e) => e.content)).toContain('after reconnect')
	}, 20_000)

	it('advances the since cursor so a reconnect does not replay the whole window', async () => {
		const relay = track(await startMockRelay())
		const pool = newPool()

		await subscribe(pool, [{ kinds: [1], since: 1_000 }], [relay.url], {
			authenticate: false,
			overlapSeconds: 60,
			onEvent: () => undefined,
		})
		await settle(300)

		const createdAt = 1_700_000_000
		relay.broadcast(makeEvent({ content: 'seen', created_at: createdAt }))
		await settle(300)

		relay.dropClients()
		await settle(2_000)

		// The REQ the relay received after reconnecting must carry the advanced cursor.
		const subs = (relay as unknown as { subs: Map<unknown, Map<string, Filter[]>> }).subs
		const filters = [...subs.values()][0]
		const filter = [...filters.values()][0][0] as { since: number }

		expect(filter.since).toBe(createdAt - 60)
		expect(filter.since).toBeGreaterThan(1_000)
	}, 20_000)

	it('stops reconnecting once the pool is closed', async () => {
		const relay = track(await startMockRelay())
		const pool = newPool()

		await subscribe(pool, [{ kinds: [1] }], [relay.url], {
			authenticate: false,
			onEvent: () => undefined,
		})
		await settle(300)

		await pool.close()
		await settle(2_000)

		expect(relay.clientCount).toBe(0)
	}, 20_000)
})

type Filter = Record<string, unknown>
