import { finalizeEvent } from '../../src/nostr/pure'
import { normalizeSecretKey } from '../../src/nostr/keys'
import { makeSecretKeySigner } from '../../src/relay/signer'
import type { Event } from '../../src/nostr/core'

export const SK_HEX = '67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa'
export const SK = normalizeSecretKey(SK_HEX)
export const SIGNER = makeSecretKeySigner(SK)
export const PUBKEY = SIGNER.getPublicKey()

export function makeEvent(overrides: Partial<Event> = {}): Event {
	return finalizeEvent(
		{
			kind: overrides.kind ?? 1,
			created_at: overrides.created_at ?? 1_700_000_000,
			tags: overrides.tags ?? [],
			content: overrides.content ?? 'hello',
		},
		SK,
	)
}
