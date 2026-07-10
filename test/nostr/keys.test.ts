import { describe, expect, it } from 'vitest'

import { normalizeId, normalizePubkey, normalizeSecretKey } from '../../nostr/keys'
import { bytesToHex } from '../../vendor/noble-hashes/utils'

const SK_HEX = '67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa'
const NSEC = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5'
const PK_HEX = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d'
const NPUB = 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6'

describe('normalizeSecretKey', () => {
	it('accepts hex', () => expect(bytesToHex(normalizeSecretKey(SK_HEX))).toBe(SK_HEX))
	it('accepts nsec', () => expect(bytesToHex(normalizeSecretKey(NSEC))).toBe(SK_HEX))
	it('accepts uppercase hex', () => expect(bytesToHex(normalizeSecretKey(SK_HEX.toUpperCase()))).toBe(SK_HEX))
	it('trims whitespace', () => expect(bytesToHex(normalizeSecretKey(`  ${NSEC}  `))).toBe(SK_HEX))

	it.each(['', 'nope', NPUB, SK_HEX.slice(0, 63), `${SK_HEX}ff`, 'nsec1invalid'])(
		'rejects %s',
		(bad) => {
			expect(() => normalizeSecretKey(bad)).toThrow(/Invalid secret key/)
		},
	)

	it('does not accept an npub as a secret key', () => {
		expect(() => normalizeSecretKey(NPUB)).toThrow()
	})
})

describe('normalizePubkey', () => {
	it('accepts hex', () => expect(normalizePubkey(PK_HEX)).toBe(PK_HEX))
	it('accepts npub', () => expect(normalizePubkey(NPUB)).toBe(PK_HEX))
	it('lowercases hex', () => expect(normalizePubkey(PK_HEX.toUpperCase())).toBe(PK_HEX))

	it.each(['', 'nope', NSEC, 'npub1invalid'])('rejects %s', (bad) => {
		expect(() => normalizePubkey(bad)).toThrow(/Invalid public key/)
	})
})

describe('normalizeId', () => {
	const ID = '5c04292b1080052d593c561c62a92f1cfda739cc14e9e8c26765165ee3a29b7d'

	it('accepts hex', () => expect(normalizeId(ID)).toBe(ID))
	it.each(['', 'nope', NPUB])('rejects %s', (bad) => expect(() => normalizeId(bad)).toThrow())
})
