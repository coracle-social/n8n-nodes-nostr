/**
 * NIP-42. Both trigger paths (proactive challenge, and reactive auth-required)
 * must complete, must resend exactly once, and must never loop.
 */
import { afterEach, describe, expect, it } from 'vitest'

import { RelayPool } from '../../src/relay/RelayPool'
import { publish } from '../../src/relay/publish'
import { query } from '../../src/relay/query'
import { AuthState } from '../../src/relay/types'
import { MockRelay, startMockRelay } from '../helpers/mockRelay'
import { SIGNER, makeEvent } from '../helpers/events'

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

const AUTH = { authenticate: true, signer: SIGNER }
const NO_AUTH = { authenticate: false }

describe('NIP-42 on subscriptions', () => {
	it('answers a proactive challenge and then serves the REQ', async () => {
		const event = makeEvent({ content: 'authed read' })
		const relay = track(await startMockRelay({ authMode: 'proactive', events: [event] }))

		const events = await query(newPool(), [{ kinds: [1] }], [relay.url], {
			timeoutMs: 5_000,
			closeOnEose: true,
			...AUTH,
		})

		expect(events.map((e) => e.id)).toEqual([event.id])
		expect(relay.authCount).toBe(1)
	})

	it('recovers from CLOSED auth-required, resending the REQ exactly once', async () => {
		const event = makeEvent({ content: 'reactive' })
		const relay = track(await startMockRelay({ authMode: 'on-req', events: [event] }))

		const events = await query(newPool(), [{ kinds: [1] }], [relay.url], {
			timeoutMs: 5_000,
			closeOnEose: true,
			...AUTH,
		})

		expect(events.map((e) => e.id)).toEqual([event.id])
		expect(relay.authCount).toBe(1)
		// One rejected REQ, one resend. Never more.
		expect(relay.reqCount).toBe(2)
	})

	it('gives up cleanly when the relay demands auth but never sends a challenge', async () => {
		const relay = track(await startMockRelay({ authMode: 'on-req-no-challenge' }))

		const started = Date.now()
		const events = await query(newPool(), [{ kinds: [1] }], [relay.url], {
			timeoutMs: 8_000,
			closeOnEose: true,
			...AUTH,
		})

		expect(events).toEqual([])
		// Bounded by the 1.5s challenge wait, not by the 8s query deadline.
		expect(Date.now() - started).toBeLessThan(5_000)
	}, 15_000)

	it('does not retry forever when the relay rejects our auth event', async () => {
		const relay = track(await startMockRelay({ authMode: 'on-req', rejectAuth: true }))

		const events = await query(newPool(), [{ kinds: [1] }], [relay.url], {
			timeoutMs: 6_000,
			closeOnEose: true,
			...AUTH,
		})

		expect(events).toEqual([])
		expect(relay.authCount).toBe(1)
		expect(relay.reqCount).toBe(1)
	}, 15_000)

	it('reports auth-required as "no credential" when unauthenticated', async () => {
		const relay = track(await startMockRelay({ authMode: 'on-req' }))
		const pool = newPool()
		const errors: string[] = []

		const { subscribe } = await import('../../src/relay/subscribe')
		await subscribe(pool, [{ kinds: [1] }], [relay.url], {
			...NO_AUTH,
			onEvent: () => undefined,
			onError: (_relay, reason) => errors.push(reason),
		})

		await new Promise((r) => setTimeout(r, 500))
		expect(errors).toEqual(['auth-required: no credential'])
		expect(relay.authCount).toBe(0)
	})
})

describe('NIP-42 on publishes', () => {
	it('recovers from OK false auth-required, resending the event once', async () => {
		const relay = track(await startMockRelay({ authMode: 'on-event' }))
		const event = makeEvent({ content: 'authed write' })

		const [result] = await publish(newPool(), event, [relay.url], { timeoutMs: 5_000, ...AUTH })

		expect(result.ok).toBe(true)
		expect(relay.authCount).toBe(1)
		expect(relay.eventCount).toBe(2) // rejected once, accepted on resend
	})

	it('returns ok:false with "no credential" when it cannot authenticate', async () => {
		const relay = track(await startMockRelay({ authMode: 'on-event' }))
		const event = makeEvent()

		const [result] = await publish(newPool(), event, [relay.url], { timeoutMs: 5_000, ...NO_AUTH })

		expect(result.ok).toBe(false)
		expect(result.reason).toBe('auth-required: no credential')
		expect(relay.authCount).toBe(0)
	})

	it('surfaces a rejected auth as a failed publish, without looping', async () => {
		const relay = track(await startMockRelay({ authMode: 'on-event', rejectAuth: true }))
		const event = makeEvent()

		const [result] = await publish(newPool(), event, [relay.url], { timeoutMs: 6_000, ...AUTH })

		expect(result.ok).toBe(false)
		expect(result.reason).toMatch(/auth rejected/)
		expect(relay.authCount).toBe(1)
		expect(relay.eventCount).toBe(1)
	}, 15_000)

	it('reaches AuthState.Ok on the connection after a successful handshake', async () => {
		const relay = track(await startMockRelay({ authMode: 'proactive' }))
		const pool = newPool()
		const event = makeEvent()

		await publish(pool, event, [relay.url], { timeoutMs: 5_000, ...AUTH })
		expect(pool.connection(relay.url).authState).toBe(AuthState.Ok)
	})
})
