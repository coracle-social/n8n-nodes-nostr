import { describe, expect, it } from 'vitest'

import {
	decode,
	naddrEncode,
	neventEncode,
	noteEncode,
	npubEncode,
	nprofileEncode,
	nsecEncode,
} from '../../src/nostr/nip19'
import { bytesToHex, hexToBytes } from '../../src/vendor/noble-hashes/utils'

const PUBKEY = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d'
const ID = '5c04292b1080052d593c561c62a92f1cfda739cc14e9e8c26765165ee3a29b7d'

describe('NIP-19 bare entities', () => {
	it('encodes and decodes npub against the spec vector', () => {
		const npub = npubEncode(PUBKEY)
		expect(npub).toBe('npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6')
		expect(decode(npub)).toEqual({ type: 'npub', data: PUBKEY })
	})

	it('encodes and decodes nsec against the spec vector', () => {
		const sk = hexToBytes('67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa')
		const nsec = nsecEncode(sk)
		expect(nsec).toBe('nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5')
		const decoded = decode(nsec)
		expect(decoded.type).toBe('nsec')
		expect(bytesToHex(decoded.data as Uint8Array)).toBe(bytesToHex(sk))
	})

	it('round-trips note', () => {
		expect(decode(noteEncode(ID))).toEqual({ type: 'note', data: ID })
	})
})

describe('NIP-19 TLV entities', () => {
	it('preserves relay order in nprofile', () => {
		const relays = ['wss://r.x.com', 'wss://djbas.sadkb.com']
		const decoded = decode(nprofileEncode({ pubkey: PUBKEY, relays }))
		expect(decoded.type).toBe('nprofile')
		expect(decoded.data).toEqual({ pubkey: PUBKEY, relays })
	})

	it('decodes the spec nprofile vector', () => {
		const decoded = decode(
			'nprofile1qqsrhuxx8l9ex335q7he0f09aej04zpazpl0ne2cgukyawd24mayt8gpp4mhxue69uhhytnc9e3k7mgpz4mhxue69uhkg6nzv9ejuumpv34kytnrdaksjlyr9p',
		)
		expect(decoded.type).toBe('nprofile')
		expect((decoded.data as any).pubkey).toBe(
			'3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
		)
		expect((decoded.data as any).relays).toEqual(['wss://r.x.com', 'wss://djbas.sadkb.com'])
	})

	it('round-trips nevent with author and kind', () => {
		const pointer = { id: ID, relays: ['wss://relay.damus.io'], author: PUBKEY, kind: 1 }
		const decoded = decode(neventEncode(pointer))
		expect(decoded.type).toBe('nevent')
		expect(decoded.data).toEqual(pointer)
	})

	it('encodes kind as a 32-bit big-endian integer in naddr', () => {
		// 30023 exercises the high byte; a little-endian writer would round-trip to 5989.
		const pointer = { identifier: 'banana', pubkey: PUBKEY, kind: 30023, relays: ['wss://relay.nostr.band'] }
		const decoded = decode(naddrEncode(pointer))
		expect(decoded.type).toBe('naddr')
		expect(decoded.data).toEqual(pointer)
		expect((decoded.data as any).kind).toBe(30023)
	})

	it('round-trips an naddr with an empty identifier', () => {
		const pointer = { identifier: '', pubkey: PUBKEY, kind: 30000, relays: [] }
		expect(decode(naddrEncode(pointer)).data).toEqual(pointer)
	})

	it('rejects a corrupted checksum', () => {
		const npub = npubEncode(PUBKEY)
		expect(() => decode(npub.slice(0, -1) + (npub.endsWith('6') ? '7' : '6'))).toThrow()
	})

	it('rejects an unknown prefix', () => {
		expect(() => decode('nfoo1qqqqqqq')).toThrow()
	})
})
