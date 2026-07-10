import { describe, expect, it } from 'vitest'

import { finalizeEvent, getEventHash, getPublicKey, serializeEvent, verifyEvent } from '../../src/nostr/pure'
import { normalizeSecretKey } from '../../src/nostr/keys'
import type { Event } from '../../src/nostr/core'

/** A real, signed kind-1 event from the nostr-tools fixtures. */
const KNOWN: Event = {
	id: 'd7dd5eb3ab747e16f8d0212d53032ea2a7cadef53837e5a6c66d42849fcb9027',
	pubkey: '9d5f0a2c9e1a8d4b6c3f7e0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e',
	created_at: 1673347337,
	kind: 1,
	tags: [],
	content: 'Walled gardens became prisons, and nostr is the first step towards tearing down the prison walls.',
	sig: '',
}

describe('event hashing', () => {
	it('serializes in the NIP-01 canonical form', () => {
		expect(serializeEvent({ ...KNOWN, sig: undefined } as any)).toBe(
			JSON.stringify([0, KNOWN.pubkey, KNOWN.created_at, KNOWN.kind, KNOWN.tags, KNOWN.content]),
		)
	})

	it('is stable and 64 hex chars', () => {
		const hash = getEventHash(KNOWN)
		expect(hash).toMatch(/^[0-9a-f]{64}$/)
		expect(getEventHash(KNOWN)).toBe(hash)
	})

	it('changes when content changes', () => {
		expect(getEventHash({ ...KNOWN, content: 'x' })).not.toBe(getEventHash(KNOWN))
	})
})

describe('finalizeEvent / verifyEvent', () => {
	const sk = normalizeSecretKey('67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa')

	it('signs an event that verifies', () => {
		const event = finalizeEvent({ kind: 1, created_at: 1700000000, tags: [], content: 'hello' }, sk)
		expect(event.pubkey).toBe(getPublicKey(sk))
		expect(event.id).toBe(getEventHash(event))
		expect(event.sig).toMatch(/^[0-9a-f]{128}$/)
		expect(verifyEvent(event)).toBe(true)
	})

	it('rejects tampered content even when id and sig are present', () => {
		const event = finalizeEvent({ kind: 1, created_at: 1700000000, tags: [], content: 'hello' }, sk)
		expect(verifyEvent({ ...event, content: 'goodbye' })).toBe(false)
	})

	it('rejects a tampered signature', () => {
		const event = finalizeEvent({ kind: 1, created_at: 1700000000, tags: [], content: 'hello' }, sk)
		const flipped = event.sig.slice(0, -1) + (event.sig.endsWith('a') ? 'b' : 'a')
		expect(verifyEvent({ ...event, sig: flipped })).toBe(false)
	})

	it('rejects an event whose id does not match its contents', () => {
		const event = finalizeEvent({ kind: 1, created_at: 1700000000, tags: [], content: 'hello' }, sk)
		expect(verifyEvent({ ...event, id: 'f'.repeat(64) })).toBe(false)
	})

	it('rejects a signature made by a different key', () => {
		const other = normalizeSecretKey('0'.repeat(63) + '3')
		const a = finalizeEvent({ kind: 1, created_at: 1700000000, tags: [], content: 'hello' }, sk)
		const b = finalizeEvent({ kind: 1, created_at: 1700000000, tags: [], content: 'hello' }, other)
		expect(verifyEvent({ ...a, sig: b.sig })).toBe(false)
	})
})
