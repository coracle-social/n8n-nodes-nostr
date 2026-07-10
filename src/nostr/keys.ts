import { hexToBytes } from '../vendor/noble-hashes/utils'
import { decode } from './nip19'

const HEX64 = /^[0-9a-fA-F]{64}$/

function tryDecode(code: string): ReturnType<typeof decode> | undefined {
	try {
		return decode(code)
	} catch {
		return undefined
	}
}

/**
 * Accepts an `nsec1…` bech32 string or a 64-character hex string and returns
 * the 32-byte secret key. Throws a user-facing Error otherwise.
 */
export function normalizeSecretKey(input: string): Uint8Array {
	const value = (input ?? '').trim()
	if (HEX64.test(value)) return hexToBytes(value.toLowerCase())
	if (value.startsWith('nsec1')) {
		const decoded = tryDecode(value)
		if (decoded?.type === 'nsec') return decoded.data
	}
	throw new Error(
		'Invalid secret key: expected an nsec1… bech32 string or a 64-character hex string.',
	)
}

/**
 * Accepts an `npub1…`/`nprofile1…` bech32 string or a 64-character hex string
 * and returns the 64-character lowercase hex public key. Throws otherwise.
 */
export function normalizePubkey(input: string): string {
	const value = (input ?? '').trim()
	if (HEX64.test(value)) return value.toLowerCase()
	if (value.startsWith('npub1')) {
		const decoded = tryDecode(value)
		if (decoded?.type === 'npub') return decoded.data
	}
	if (value.startsWith('nprofile1')) {
		const decoded = tryDecode(value)
		if (decoded?.type === 'nprofile') return decoded.data.pubkey
	}
	throw new Error(
		'Invalid public key: expected an npub1…/nprofile1… bech32 string or a 64-character hex string.',
	)
}

/**
 * Accepts a `note1…`/`nevent1…` bech32 string or a 64-character hex string and
 * returns the 64-character lowercase hex event id. Throws otherwise.
 */
export function normalizeId(input: string): string {
	const value = (input ?? '').trim()
	if (HEX64.test(value)) return value.toLowerCase()
	if (value.startsWith('note1')) {
		const decoded = tryDecode(value)
		if (decoded?.type === 'note') return decoded.data
	}
	if (value.startsWith('nevent1')) {
		const decoded = tryDecode(value)
		if (decoded?.type === 'nevent') return decoded.data.id
	}
	throw new Error(
		'Invalid event id: expected a note1…/nevent1… bech32 string or a 64-character hex string.',
	)
}
