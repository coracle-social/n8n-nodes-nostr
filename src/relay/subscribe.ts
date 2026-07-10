import { verifyEvent } from '../nostr'
import type { Filter } from '../nostr'
import type { RelayPool } from './RelayPool'
import type { SubscribeHandle, SubscribeOptions } from './types'

let subCounter = 0
const nextSubId = (): string => `n8n-s${++subCounter}`

const DEFAULT_OVERLAP_SECONDS = 60

/**
 * Opens a long-lived subscription on every relay and streams matching events.
 *
 * Unlike `query`, this never terminates on its own: connections reconnect with
 * backoff and re-issue their REQ. A relay that fails is reported through
 * `onError` and the rest keep running — one dead relay must not stop a workflow.
 *
 * As events arrive we advance each subscription's stored `since` cursor, so a
 * reconnect resumes near where it left off rather than replaying the whole
 * window from the original `since`. The cursor is rewound by `overlapSeconds`
 * because relay clocks drift; the caller de-duplicates by event id.
 */
export async function subscribe(
	pool: RelayPool,
	filters: Filter[],
	relays: string[],
	opts: SubscribeOptions,
): Promise<SubscribeHandle> {
	const overlap = opts.overlapSeconds ?? DEFAULT_OVERLAP_SECONDS
	const handles: Array<{ close(): void }> = []
	const subscriptions: Array<{ url: string; subId: string }> = []

	let latestCreatedAt = 0

	/** Rewrites the `since` on every relay's stored REQ, used only on reconnect. */
	const advanceCursor = (createdAt: number): void => {
		if (createdAt <= latestCreatedAt) return
		latestCreatedAt = createdAt
		const since = Math.max(0, latestCreatedAt - overlap)
		const resumed: Filter[] = filters.map((filter) => ({ ...filter, since }))
		for (const { url, subId } of subscriptions) {
			pool.connection(url).updateFilters(subId, resumed)
		}
	}

	for (const url of relays) {
		const subId = nextSubId()
		const conn = pool.connection(url, opts)
		conn.autoReconnect = true
		subscriptions.push({ url, subId })

		handles.push(
			conn.req(subId, filters, {
				onEvent: (event) => {
					if (!verifyEvent(event)) return
					advanceCursor(event.created_at)
					opts.onEvent(event, url)
				},
				onEose: () => opts.onEose?.(url),
				onClosed: (reason) => opts.onError?.(url, reason),
			}),
		)
	}

	return {
		close: async () => {
			for (const handle of handles) {
				try {
					handle.close()
				} catch {
					/* socket already gone */
				}
			}
		},
	}
}
