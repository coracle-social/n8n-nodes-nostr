import { finalizeEvent, getPublicKey } from '../nostr'
import type { Event, EventTemplate } from '../nostr'
import type { Signer } from './types'

/**
 * Signs with a raw secret key held in memory for the life of one execution.
 *
 * `finalizeEvent` mutates the template it is handed, so we copy first: the
 * caller's template is often reused across relays or items.
 */
export function makeSecretKeySigner(secretKey: Uint8Array): Signer {
	return {
		getPublicKey: () => getPublicKey(secretKey),
		signEvent: (template: EventTemplate): Event => finalizeEvent({ ...template }, secretKey),
	}
}
