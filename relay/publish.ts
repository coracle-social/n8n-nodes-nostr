import type { Event } from '../nostr'
import type { RelayPool } from './RelayPool'
import type { PerRelayResult, PublishOptions } from './types'

/**
 * Sends one event to every relay and reports what each one said.
 *
 * Always resolves with exactly one result per relay, in the order given. A relay
 * that rejects, times out, or refuses to connect is a `PerRelayResult` with
 * `ok: false` — never a thrown error, because the other relays may well have
 * accepted the event and the caller needs to know that.
 */
export async function publish(
	pool: RelayPool,
	event: Event,
	relays: string[],
	opts: PublishOptions,
): Promise<PerRelayResult[]> {
	return Promise.all(
		relays.map(async (url): Promise<PerRelayResult> => {
			const started = Date.now()
			try {
				return await pool.connection(url, opts).publish(event, opts.timeoutMs)
			} catch (err) {
				return {
					relay: url,
					ok: false,
					reason: (err as Error).message || 'unknown error',
					durationMs: Date.now() - started,
				}
			}
		}),
	)
}
