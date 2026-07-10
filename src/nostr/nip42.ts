import type { EventTemplate } from './core'
import { ClientAuth } from './kinds'
import { nowSec } from './utils'

/**
 * Creates an EventTemplate for a NIP-42 AUTH event (kind 22242) to be signed.
 */
export function makeAuthEvent(relayURL: string, challenge: string): EventTemplate {
	return {
		kind: ClientAuth,
		created_at: nowSec(),
		tags: [
			['relay', relayURL],
			['challenge', challenge],
		],
		content: '',
	}
}
