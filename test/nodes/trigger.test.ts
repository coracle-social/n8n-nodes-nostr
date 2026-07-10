/**
 * Drives the real NostrTrigger.trigger() against live in-process relays.
 */
import { afterEach, describe, expect, it } from 'vitest'

import { NostrTrigger } from '../../src/nodes/NostrTrigger/NostrTrigger.node'
import { MockRelay, startMockRelay } from '../helpers/mockRelay'
import { mockTriggerFunctions } from '../helpers/mockExecuteFns'
import { SK_HEX, makeEvent } from '../helpers/events'
import type { ITriggerResponse } from 'n8n-workflow'

const relays: MockRelay[] = []
const closers: Array<() => Promise<void>> = []
const track = <T extends MockRelay>(r: T): T => (relays.push(r), r)

afterEach(async () => {
	for (const close of closers.splice(0)) await close()
	await Promise.all(relays.splice(0).map((r) => r.stop()))
})

const node = new NostrTrigger()
const CREDS = { privateKey: SK_HEX, defaultRelays: '' }

const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms))

async function startTrigger(params: Record<string, unknown>, extra: Record<string, unknown> = {}) {
	const mock = mockTriggerFunctions({ params, credentials: CREDS, mode: 'trigger', ...extra })
	const response: ITriggerResponse = await node.trigger.call(mock.fns as never)
	if (response.closeFunction) closers.push(response.closeFunction as () => Promise<void>)
	return { mock, response }
}

describe('NostrTrigger live subscription', () => {
	it('emits a live event once, keyed by its id', async () => {
		const relay = track(await startMockRelay())
		const { mock } = await startTrigger({
			relays: relay.url,
			filterMode: 'fields',
			kinds: '1',
			options: {},
		})
		await settle()

		const event = makeEvent({ content: 'live', created_at: Math.floor(Date.now() / 1000) })
		relay.broadcast(event)
		await settle()

		expect(mock.emits).toHaveLength(1)
		expect(mock.emits[0].deduplicationKey).toBe(event.id)
		expect((mock.emits[0].data[0][0].json as any).content).toBe('live')
		expect((mock.emits[0].data[0][0].json as any).relay).toBe(relay.url)
	}, 15_000)

	it('emits only once when two relays carry the same event', async () => {
		const a = track(await startMockRelay())
		const b = track(await startMockRelay())
		const { mock } = await startTrigger({
			relays: `${a.url}\n${b.url}`,
			filterMode: 'fields',
			kinds: '1',
			options: {},
		})
		await settle()

		const event = makeEvent({ content: 'dup', created_at: Math.floor(Date.now() / 1000) })
		a.broadcast(event)
		b.broadcast(event)
		await settle()

		expect(mock.emits).toHaveLength(1)
		expect(mock.emits[0].deduplicationKey).toBe(event.id)
	}, 15_000)

	it('records the newest created_at so a restart can resume', async () => {
		const relay = track(await startMockRelay())
		const { mock } = await startTrigger({
			relays: relay.url,
			filterMode: 'fields',
			kinds: '1',
			options: {},
		})
		await settle()

		const createdAt = Math.floor(Date.now() / 1000)
		relay.broadcast(makeEvent({ content: 'x', created_at: createdAt }))
		await settle()

		expect(mock.staticData.lastCreatedAt).toBe(createdAt)
		expect(mock.staticData.seenIds).toHaveLength(1)
	}, 15_000)

	it('resumes from lastCreatedAt minus the overlap window', async () => {
		const relay = track(await startMockRelay())
		const lastCreatedAt = 1_700_000_000
		await startTrigger(
			{ relays: relay.url, filterMode: 'fields', kinds: '1', options: { overlapSeconds: 60 } },
			{ staticData: { lastCreatedAt, seenIds: [] } },
		)
		await settle()

		// The relay stored the REQ's filters when it served the subscription.
		const subs = (relay as unknown as { subs: Map<unknown, Map<string, any[]>> }).subs
		const filters = [...subs.values()][0]
		const filter = [...filters.values()][0][0]
		expect(filter.since).toBe(lastCreatedAt - 60)
	}, 15_000)

	it('skips stored history on a first run unless asked', async () => {
		const old = makeEvent({ content: 'ancient', created_at: 1_600_000_000 })
		const relay = track(await startMockRelay({ events: [old] }))

		const { mock } = await startTrigger({
			relays: relay.url,
			filterMode: 'fields',
			kinds: '1',
			options: {},
		})
		await settle()

		expect(mock.emits).toHaveLength(0)
	}, 15_000)

	it('delivers stored history when includeHistorical is on', async () => {
		const old = makeEvent({ content: 'ancient', created_at: 1_600_000_000 })
		const relay = track(await startMockRelay({ events: [old] }))

		const { mock } = await startTrigger({
			relays: relay.url,
			filterMode: 'fields',
			kinds: '1',
			options: { includeHistorical: true },
		})
		await settle()

		expect(mock.emits).toHaveLength(1)
		expect((mock.emits[0].data[0][0].json as any).content).toBe('ancient')
	}, 15_000)

	it('closes every socket on closeFunction', async () => {
		const a = track(await startMockRelay())
		const b = track(await startMockRelay())
		const { response } = await startTrigger({
			relays: `${a.url}\n${b.url}`,
			filterMode: 'fields',
			kinds: '1',
			options: {},
		})
		await settle()
		expect(a.clientCount).toBe(1)
		expect(b.clientCount).toBe(1)

		await (response.closeFunction as () => Promise<void>)()
		closers.length = 0
		await settle()

		expect(a.clientCount).toBe(0)
		expect(b.clientCount).toBe(0)
	}, 15_000)

	it('keeps running when one relay rejects the subscription', async () => {
		const good = track(await startMockRelay())
		const hostile = track(await startMockRelay({ authMode: 'on-req-no-challenge' }))

		const { mock } = await startTrigger({
			relays: `${good.url}\n${hostile.url}`,
			filterMode: 'fields',
			kinds: '1',
			options: { authenticate: false },
		})
		await settle(500)

		good.broadcast(makeEvent({ content: 'still alive', created_at: Math.floor(Date.now() / 1000) }))
		await settle()

		expect(mock.emits).toHaveLength(1)
		expect((mock.emits[0].data[0][0].json as any).content).toBe('still alive')
	}, 15_000)
})

describe('NostrTrigger manual mode', () => {
	it('returns a bounded batch instead of tailing forever', async () => {
		const relay = track(await startMockRelay({ events: [makeEvent({ content: 'stored' })] }))
		const mock = mockTriggerFunctions({
			params: { relays: relay.url, filterMode: 'fields', kinds: '1', options: {} },
			credentials: CREDS,
			mode: 'manual',
		})

		const response = await node.trigger.call(mock.fns as never)
		if (response.closeFunction) closers.push(response.closeFunction as () => Promise<void>)

		expect(relay.clientCount).toBe(0) // no live tail was opened

		const started = Date.now()
		await response.manualTriggerFunction!()
		expect(Date.now() - started).toBeLessThan(6_000)

		expect(mock.emits).toHaveLength(1)
		expect((mock.emits[0].data[0][0].json as any).content).toBe('stored')
	}, 15_000)
})
