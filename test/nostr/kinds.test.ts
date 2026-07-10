import { describe, expect, it } from 'vitest'

import type { NostrEvent } from '../../src/nostr/core'
import {
	isAddressableKind,
	isEphemeralKind,
	isReplaceableKind,
	pickNewest,
} from '../../src/nostr/kinds'

const ALICE = 'a'.repeat(64)
const BOB = 'b'.repeat(64)

/** `pickNewest` reads only kind, pubkey, created_at, id and tags. */
function event(fields: Partial<NostrEvent> & Pick<NostrEvent, 'id'>): NostrEvent {
	return {
		kind: 0,
		pubkey: ALICE,
		created_at: 1_700_000_000,
		tags: [],
		content: '',
		sig: '',
		...fields,
	}
}

const ids = (events: NostrEvent[]): string[] => events.map((e) => e.id).sort()

describe('kind predicates', () => {
	it.each([0, 3, 10000, 10002, 19999])('%i is replaceable', (k) =>
		expect(isReplaceableKind(k)).toBe(true),
	)
	it.each([1, 4, 9999, 20000, 30023])('%i is not replaceable', (k) =>
		expect(isReplaceableKind(k)).toBe(false),
	)
	it.each([20000, 22242, 29999])('%i is ephemeral', (k) => expect(isEphemeralKind(k)).toBe(true))
	it.each([30000, 30023, 39999])('%i is addressable', (k) =>
		expect(isAddressableKind(k)).toBe(true),
	)
})

describe('pickNewest', () => {
	it('keeps the newest event per (pubkey, kind) for replaceable kinds', () => {
		const old = event({ id: 'aa', created_at: 100 })
		const fresh = event({ id: 'bb', created_at: 200 })

		expect(pickNewest([old, fresh])).toEqual([fresh])
		// Order of arrival must not change the winner.
		expect(pickNewest([fresh, old])).toEqual([fresh])
	})

	it('breaks a created_at tie on the lexicographically lowest id', () => {
		const lower = event({ id: 'aa', created_at: 100 })
		const higher = event({ id: 'bb', created_at: 100 })

		expect(pickNewest([lower, higher])).toEqual([lower])
		expect(pickNewest([higher, lower])).toEqual([lower])
	})

	it('collapses each author separately', () => {
		const alice = event({ id: 'aa', pubkey: ALICE })
		const bob = event({ id: 'bb', pubkey: BOB })

		expect(ids(pickNewest([alice, bob]))).toEqual(['aa', 'bb'])
	})

	it('collapses each kind separately, so one author can hold several', () => {
		const metadata = event({ id: 'aa', kind: 0 })
		const relayList = event({ id: 'bb', kind: 10002 })

		expect(ids(pickNewest([metadata, relayList]))).toEqual(['aa', 'bb'])
	})

	it('never collapses regular events, even from one author at one instant', () => {
		const first = event({ id: 'aa', kind: 1 })
		const second = event({ id: 'bb', kind: 1 })

		expect(ids(pickNewest([first, second]))).toEqual(['aa', 'bb'])
	})

	it('keys addressable events on their d tag', () => {
		const post = event({ id: 'aa', kind: 30023, tags: [['d', 'post']] })
		const note = event({ id: 'bb', kind: 30023, tags: [['d', 'note']] })
		const newerPost = event({
			id: 'cc',
			kind: 30023,
			tags: [['d', 'post']],
			created_at: 1_700_000_001,
		})

		expect(ids(pickNewest([post, note, newerPost]))).toEqual(['bb', 'cc'])
	})
})
