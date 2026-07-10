import type { Event, EventTemplate, Filter } from '../nostr'

/**
 * The outcome of one operation against one relay.
 *
 * Nostr publishes fan out, and each relay answers for itself. A rejection by one
 * relay is not an error for the operation as a whole, so these are always
 * returned as data — never thrown.
 */
export interface PerRelayResult {
	relay: string
	ok: boolean
	reason: string
	durationMs: number
}

export interface Signer {
	getPublicKey(): string
	signEvent(template: EventTemplate): Event
}

export interface AuthOptions {
	/** Whether to answer a relay's NIP-42 challenge. Requires a signer. */
	authenticate: boolean
	signer?: Signer
}

export interface PublishOptions extends AuthOptions {
	timeoutMs: number
}

export interface QueryOptions extends AuthOptions {
	/** Stop once this many distinct events have been collected. */
	limit?: number
	/** Hard wall-clock deadline. A relay that never sends EOSE cannot hang us. */
	timeoutMs: number
	closeOnEose: boolean
	dedup?: boolean
	/** Collapse replaceable/addressable kinds to the newest version. */
	dedupReplaceable?: boolean
}

export interface SubscribeOptions extends AuthOptions {
	/**
	 * How far back to rewind the `since` cursor when a dropped socket reconnects.
	 * Relay timestamps are second-granular and clocks drift, so resuming exactly
	 * at the last seen event risks missing one. Callers must de-duplicate.
	 */
	overlapSeconds?: number
	onEvent(event: Event, relay: string): void
	onEose?(relay: string): void
	onError?(relay: string, reason: string): void
}

export interface SubscribeHandle {
	close(): Promise<void>
}

export interface ReqHandlers {
	onEvent(event: Event): void
	onEose?(): void
	/** Terminal for this subscription on this relay. */
	onClosed?(reason: string): void
}

export interface ReqHandle {
	close(): void
}

export enum ConnState {
	Disconnected = 'disconnected',
	Connecting = 'connecting',
	Open = 'open',
	Closing = 'closing',
}

export enum AuthState {
	/** No challenge seen, or none needed. */
	None = 'none',
	/** Challenge received but not answered (no signer, or not asked to). */
	Challenged = 'challenged',
	/** AUTH event sent, awaiting the relay's OK. */
	Pending = 'pending',
	Ok = 'ok',
	Failed = 'failed',
}

export type RelayMessage =
	| { type: 'EVENT'; subId: string; event: Event }
	| { type: 'OK'; id: string; ok: boolean; reason: string }
	| { type: 'EOSE'; subId: string }
	| { type: 'CLOSED'; subId: string; reason: string }
	| { type: 'NOTICE'; message: string }
	| { type: 'AUTH'; challenge: string }

export type { Event, Filter }
