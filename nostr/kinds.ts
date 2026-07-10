import type { NostrEvent } from './core'

/** Client authentication event (NIP-42). */
export const ClientAuth = 22242

/**
 * Replaceable: for each `(pubkey, kind)` only the latest event is kept.
 * Covers `kind === 0`, `kind === 3`, and `10000 <= kind < 20000`.
 */
export function isReplaceableKind(kind: number): boolean {
	return kind === 0 || kind === 3 || (10000 <= kind && kind < 20000)
}

/** Ephemeral: not stored by relays. `20000 <= kind < 30000`. */
export function isEphemeralKind(kind: number): boolean {
	return 20000 <= kind && kind < 30000
}

/**
 * Addressable (parameterized replaceable): for each `(pubkey, kind, d-tag)`
 * only the latest event is kept. `30000 <= kind < 40000`.
 */
export function isAddressableKind(kind: number): boolean {
	return 30000 <= kind && kind < 40000
}

function firstDTag(event: NostrEvent): string {
	for (const tag of event.tags) {
		if (tag[0] === 'd') return tag[1] ?? ''
	}
	return ''
}

function groupKey(event: NostrEvent): string {
	if (isAddressableKind(event.kind)) return `a:${event.pubkey}:${event.kind}:${firstDTag(event)}`
	if (isReplaceableKind(event.kind)) return `r:${event.pubkey}:${event.kind}`
	// Regular / ephemeral events are each distinct; key on id so none collapse.
	return `u:${event.id}`
}

/** True if `a` should win over `b`: newer `created_at`, tiebreak LOWEST id. */
function isNewer(a: NostrEvent, b: NostrEvent): boolean {
	if (a.created_at !== b.created_at) return a.created_at > b.created_at
	return a.id < b.id
}

/**
 * Collapse a list of events to the newest per `(pubkey, kind[, d-tag])` for
 * replaceable/addressable kinds, keeping regular/ephemeral events untouched.
 * Ties on `created_at` are broken by the lexicographically LOWEST id.
 */
export function pickNewest(events: NostrEvent[]): NostrEvent[] {
	const map = new Map<string, NostrEvent>()
	for (const event of events) {
		const key = groupKey(event)
		const existing = map.get(key)
		if (!existing || isNewer(event, existing)) map.set(key, event)
	}
	return Array.from(map.values())
}
