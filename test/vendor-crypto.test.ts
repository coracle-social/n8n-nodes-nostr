/**
 * Proves the vendored crypto is byte-for-byte correct against published specs.
 *
 * We ship copies of @noble/curves, @noble/hashes and @scure/base rather than
 * depending on them (see VENDOR.md), so nothing but this file stands between a
 * bad re-vendor and silently producing invalid signatures. Vectors come from the
 * specs themselves, not from the libraries, so a corrupted vendor cannot make
 * these pass.
 */
import { describe, expect, it } from 'vitest'

import { schnorr } from '../src/vendor/noble-curves/secp256k1'
import { sha256 } from '../src/vendor/noble-hashes/sha2'
import { hmac } from '../src/vendor/noble-hashes/hmac'
import { hkdf } from '../src/vendor/noble-hashes/hkdf'
import { bech32 } from '../src/vendor/scure-base/index'

const hex = (s: string) => Uint8Array.from(Buffer.from(s, 'hex'))
const toHex = (b: Uint8Array) => Buffer.from(b).toString('hex')

describe('BIP-340 schnorr (vendored @noble/curves)', () => {
	// https://github.com/bitcoin/bips/blob/master/bip-0340/test-vectors.csv
	const vectors = [
		{
			n: 0,
			secret: '0000000000000000000000000000000000000000000000000000000000000003',
			pubkey: 'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9',
			aux: '0000000000000000000000000000000000000000000000000000000000000000',
			message: '0000000000000000000000000000000000000000000000000000000000000000',
			signature:
				'e907831f80848d1069a5371b402410364bdf1c5f8307b0084c55f1ce2dca821525f66a4a85ea8b71e482a74f382d2ce5ebeee8fdb2172f477df4900d310536c0',
		},
		{
			n: 1,
			secret: 'b7e151628aed2a6abf7158809cf4f3c762e7160f38b4da56a784d9045190cfef',
			pubkey: 'dff1d77f2a671c5f36183726db2341be58feae1da2deced843240f7b502ba659',
			aux: '0000000000000000000000000000000000000000000000000000000000000001',
			message: '243f6a8885a308d313198a2e03707344a4093822299f31d0082efa98ec4e6c89',
			signature:
				'6896bd60eeae296db48a229ff71dfe071bde413e6d43f917dc8dcf8c78de33418906d11ac976abccb20b091292bff4ea897efcb639ea871cfa95f6de339e4b0a',
		},
		{
			n: 2,
			secret: 'c90fdaa22168c234c4c6628b80dc1cd129024e088a67cc74020bbea63b14e5c9',
			pubkey: 'dd308afec5777e13121fa72b9cc1b7cc0139715309b086c960e18fd969774eb8',
			aux: 'c87aa53824b4d7ae2eb035a2b5bbbccc080e76cdc6d1692c4b0b62d798e6d906',
			message: '7e2d58d8b3bcdf1abadec7829054f90dda9805aab56c77333024b9d0a508b75c',
			signature:
				'5831aaeed7b44bb74e5eab94ba9d4294c49bcf2a60728d8b4c200f50dd313c1bab745879a5ad954a72c45a91c3a51d3c7adea98d82f8481e0e1e03674a6f3fb7',
		},
	]

	it.each(vectors)('vector $n: signs deterministically with aux', (v) => {
		const sig = schnorr.sign(hex(v.message), hex(v.secret), hex(v.aux))
		expect(toHex(sig)).toBe(v.signature)
	})

	it.each(vectors)('vector $n: derives the x-only pubkey', (v) => {
		expect(toHex(schnorr.getPublicKey(hex(v.secret)))).toBe(v.pubkey)
	})

	it.each(vectors)('vector $n: verifies', (v) => {
		expect(schnorr.verify(hex(v.signature), hex(v.message), hex(v.pubkey))).toBe(true)
	})

	it('rejects a signature from the wrong key', () => {
		const v = vectors[1]
		expect(schnorr.verify(hex(vectors[0].signature), hex(v.message), hex(v.pubkey))).toBe(false)
	})

	it('rejects a tampered message', () => {
		const v = vectors[1]
		const tampered = hex(v.message)
		tampered[0] ^= 0x01
		expect(schnorr.verify(hex(v.signature), tampered, hex(v.pubkey))).toBe(false)
	})
})

describe('SHA-256 (vendored @noble/hashes)', () => {
	it('matches the NIST vector for "abc"', () => {
		expect(toHex(sha256(new TextEncoder().encode('abc')))).toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
		)
	})

	it('matches the empty-string vector', () => {
		expect(toHex(sha256(new Uint8Array(0)))).toBe(
			'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		)
	})
})

describe('HMAC-SHA256 (vendored @noble/hashes)', () => {
	// RFC 4231 test case 2.
	it('matches RFC 4231 case 2', () => {
		const key = new TextEncoder().encode('Jefe')
		const msg = new TextEncoder().encode('what do ya want for nothing?')
		expect(toHex(hmac(sha256, key, msg))).toBe(
			'5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
		)
	})
})

describe('HKDF-SHA256 (vendored @noble/hashes)', () => {
	// RFC 5869 test case 1. NIP-44 v2 depends on this exact construction.
	it('matches RFC 5869 case 1', () => {
		const ikm = hex('0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b')
		const salt = hex('000102030405060708090a0b0c')
		const info = hex('f0f1f2f3f4f5f6f7f8f9')
		expect(toHex(hkdf(sha256, ikm, salt, info, 42))).toBe(
			'3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865',
		)
	})
})

describe('bech32 (vendored @scure/base)', () => {
	// NIP-19 test vector.
	const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d'
	const npub = 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6'

	it('encodes an npub', () => {
		const words = bech32.toWords(hex(pubkey))
		expect(bech32.encode('npub', words, 5000)).toBe(npub)
	})

	it('decodes an npub back to the pubkey', () => {
		const { prefix, words } = bech32.decode(npub as `${string}1${string}`, 5000)
		expect(prefix).toBe('npub')
		expect(toHex(Uint8Array.from(bech32.fromWords(words)))).toBe(pubkey)
	})

	it('rejects a corrupted checksum', () => {
		const bad = npub.slice(0, -1) + (npub.endsWith('6') ? '7' : '6')
		expect(() => bech32.decode(bad as `${string}1${string}`, 5000)).toThrow()
	})
})
