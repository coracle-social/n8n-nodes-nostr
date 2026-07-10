import { schnorr } from '../vendor/noble-curves/secp256k1'
import { bytesToHex, hexToBytes } from '../vendor/noble-hashes/utils'
import { sha256 } from '../vendor/noble-hashes/sha2'
import { verifiedSymbol, validateEvent } from './core'
import type { Nostr, Event, EventTemplate, UnsignedEvent, VerifiedEvent } from './core'
import { utf8Encoder } from './utils'

class JS implements Nostr {
	generateSecretKey(): Uint8Array {
		return schnorr.utils.randomSecretKey()
	}
	getPublicKey(secretKey: Uint8Array): string {
		return bytesToHex(schnorr.getPublicKey(secretKey))
	}
	finalizeEvent(t: EventTemplate, secretKey: Uint8Array): VerifiedEvent {
		const event = t as VerifiedEvent
		event.pubkey = bytesToHex(schnorr.getPublicKey(secretKey))
		event.id = getEventHash(event)
		event.sig = bytesToHex(schnorr.sign(hexToBytes(event.id), secretKey))
		event[verifiedSymbol] = true
		return event
	}
	verifyEvent(event: Event): event is VerifiedEvent {
		// Always recompute — never trust a cached flag — so a tampered
		// `content`/`sig`/`id` on a previously-finalized object is rejected.
		try {
			const hash = getEventHash(event)
			if (hash !== event.id) {
				event[verifiedSymbol] = false
				return false
			}

			const valid = schnorr.verify(hexToBytes(event.sig), hexToBytes(hash), hexToBytes(event.pubkey))
			event[verifiedSymbol] = valid
			return valid
		} catch {
			event[verifiedSymbol] = false
			return false
		}
	}
}

export function serializeEvent(evt: UnsignedEvent): string {
	if (!validateEvent(evt)) throw new Error("can't serialize event with wrong or missing properties")
	return JSON.stringify([0, evt.pubkey, evt.created_at, evt.kind, evt.tags, evt.content])
}

export function getEventHash(event: UnsignedEvent): string {
	const eventHash = sha256(utf8Encoder.encode(serializeEvent(event)))
	return bytesToHex(eventHash)
}

const i: JS = new JS()

export const generateSecretKey = i.generateSecretKey
export const getPublicKey = i.getPublicKey
export const finalizeEvent = i.finalizeEvent
export const verifyEvent = i.verifyEvent
