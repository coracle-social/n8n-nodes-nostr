/**
 * NIP-44 v2 against the official vectors, verbatim from nostr-tools.
 *
 * Our implementation derives ChaCha20 from node:crypto rather than a vendored
 * cipher, so these vectors are the only thing proving the two agree.
 */
import { describe, expect, it } from 'vitest'

import { calcPaddedLen, decrypt, encrypt, getConversationKey, getMessageKeys } from '../../nostr/nip44'
import { schnorr } from '../../vendor/noble-curves/secp256k1'
import { bytesToHex, hexToBytes } from '../../vendor/noble-hashes/utils'
import { base64 } from '../../vendor/scure-base/index'

import vectors from '../fixtures/nip44.vectors.json'

const v2 = (vectors as any).v2

/** The encrypt_decrypt vectors give sec2, not pub2. */
const pubFromSec = (secHex: string): Uint8Array => schnorr.getPublicKey(hexToBytes(secHex))

describe('NIP-44 v2 valid vectors', () => {
	it('derives every conversation key', () => {
		for (const v of v2.valid.get_conversation_key) {
			expect(bytesToHex(getConversationKey(hexToBytes(v.sec1), v.pub2))).toBe(v.conversation_key)
		}
	})

	it('derives every message key triple', () => {
		const convKey = hexToBytes(v2.valid.get_message_keys.conversation_key)
		for (const k of v2.valid.get_message_keys.keys) {
			const mk = getMessageKeys(convKey, hexToBytes(k.nonce))
			expect(bytesToHex(mk.chacha_key)).toBe(k.chacha_key)
			expect(bytesToHex(mk.chacha_nonce)).toBe(k.chacha_nonce)
			expect(bytesToHex(mk.hmac_key)).toBe(k.hmac_key)
		}
	})

	it('computes every padded length', () => {
		for (const [len, padded] of v2.valid.calc_padded_len) {
			expect(calcPaddedLen(len)).toBe(padded)
		}
	})

	it('produces every payload byte-for-byte with the vector nonce', () => {
		for (const v of v2.valid.encrypt_decrypt) {
			const convKey = getConversationKey(hexToBytes(v.sec1), bytesToHex(pubFromSec(v.sec2)))
			expect(bytesToHex(convKey)).toBe(v.conversation_key)
			expect(encrypt(v.plaintext, convKey, hexToBytes(v.nonce))).toBe(v.payload)
		}
	})

	it('decrypts every payload back to the plaintext', () => {
		for (const v of v2.valid.encrypt_decrypt) {
			expect(decrypt(v.payload, hexToBytes(v.conversation_key))).toBe(v.plaintext)
		}
	})

	it('round-trips with a random nonce', () => {
		const convKey = hexToBytes(v2.valid.encrypt_decrypt[0].conversation_key)
		const msg = 'the quick brown fox 🦊'
		expect(decrypt(encrypt(msg, convKey), convKey)).toBe(msg)
	})

	// v2.valid.encrypt_decrypt_long_msg carries an empty payload_checksum_sha256 in this
	// revision of the vector file, so there is nothing to assert against. nostr-tools
	// skips it for the same reason; we do not invent an expectation.
})

describe('NIP-44 v2 invalid vectors', () => {
	it('rejects out-of-range plaintext lengths', () => {
		const convKey = hexToBytes(v2.valid.encrypt_decrypt[0].conversation_key)
		for (const len of v2.invalid.encrypt_msg_lengths) {
			expect(() => encrypt('a'.repeat(len), convKey)).toThrow()
		}
	})

	it('rejects truncated payloads', () => {
		const convKey = hexToBytes(v2.valid.encrypt_decrypt[0].conversation_key)
		for (const len of v2.invalid.decrypt_msg_lengths) {
			expect(() => decrypt(base64.encode(new Uint8Array(len)), convKey)).toThrow()
		}
	})

	it('rejects invalid conversation keys', () => {
		for (const v of v2.invalid.get_conversation_key) {
			expect(() => getConversationKey(hexToBytes(v.sec1), v.pub2), v.note).toThrow()
		}
	})

	it('rejects bad versions, bad base64, bad MACs and bad padding', () => {
		for (const v of v2.invalid.decrypt) {
			expect(() => decrypt(v.payload, hexToBytes(v.conversation_key)), v.note).toThrow()
		}
	})
})
