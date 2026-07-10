import type { Event, Filter, RelayMessage } from './types'

/** Parses a relay->client frame. Throws on anything that is not valid NIP-01. */
export function parseRelayMessage(raw: string): RelayMessage {
	let frame: unknown
	try {
		frame = JSON.parse(raw)
	} catch {
		throw new Error('relay sent malformed JSON')
	}
	if (!Array.isArray(frame) || typeof frame[0] !== 'string') {
		throw new Error('relay sent a frame that is not a tagged array')
	}

	switch (frame[0]) {
		case 'EVENT':
			if (typeof frame[1] !== 'string' || typeof frame[2] !== 'object' || frame[2] === null) {
				throw new Error('malformed EVENT frame')
			}
			return { type: 'EVENT', subId: frame[1], event: frame[2] as Event }

		case 'OK':
			if (typeof frame[1] !== 'string' || typeof frame[2] !== 'boolean') {
				throw new Error('malformed OK frame')
			}
			return { type: 'OK', id: frame[1], ok: frame[2], reason: asString(frame[3]) }

		case 'EOSE':
			if (typeof frame[1] !== 'string') throw new Error('malformed EOSE frame')
			return { type: 'EOSE', subId: frame[1] }

		case 'CLOSED':
			if (typeof frame[1] !== 'string') throw new Error('malformed CLOSED frame')
			return { type: 'CLOSED', subId: frame[1], reason: asString(frame[2]) }

		case 'NOTICE':
			return { type: 'NOTICE', message: asString(frame[1]) }

		case 'AUTH':
			if (typeof frame[1] !== 'string') throw new Error('malformed AUTH frame')
			return { type: 'AUTH', challenge: frame[1] }

		default:
			throw new Error(`unknown relay frame type ${JSON.stringify(frame[0])}`)
	}
}

const asString = (v: unknown): string => (typeof v === 'string' ? v : '')

export const serializeEventFrame = (event: Event): string => JSON.stringify(['EVENT', event])
export const serializeAuthFrame = (event: Event): string => JSON.stringify(['AUTH', event])
export const serializeCloseFrame = (subId: string): string => JSON.stringify(['CLOSE', subId])
export const serializeReqFrame = (subId: string, filters: Filter[]): string =>
	JSON.stringify(['REQ', subId, ...filters])

/**
 * Relay URL as it must appear in a NIP-42 auth event's `relay` tag: the relay
 * compares this against its own canonical URL, so lowercase the host, keep the
 * scheme and path, and drop a bare trailing slash.
 */
export function normalizeRelayUrl(url: string): string {
	try {
		const parsed = new URL(url)
		parsed.hostname = parsed.hostname.toLowerCase()
		const str = parsed.toString()
		return str.endsWith('/') && parsed.pathname === '/' ? str.slice(0, -1) : str
	} catch {
		return url
	}
}

/** True when a relay's rejection reason means "authenticate and try again". */
export const isAuthRequired = (reason: string): boolean =>
	/^(auth-required|restricted)\b/i.test(reason.trim())
