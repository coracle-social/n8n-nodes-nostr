import { pickNewest, verifyEvent } from '../nostr'
import type { Event, Filter } from '../nostr'
import type { RelayPool } from './RelayPool'
import { onTimeout } from './timers'
import type { QueryOptions } from './types'

let subCounter = 0
const nextSubId = (): string => `n8n-q${++subCounter}`

/**
 * Collects events matching `filters` from every relay, then stops.
 *
 * Nostr has no "the query is done" signal we can rely on: EOSE is advisory and
 * some relays never send it. Termination is therefore whichever comes first:
 *
 *   1. `limit` distinct events collected,
 *   2. every relay sent EOSE (when `closeOnEose`),
 *   3. `timeoutMs` elapsed — a hard deadline, not a fallback.
 *
 * Events are verified before being returned; a relay can serve anything it likes.
 */
export async function query(
	pool: RelayPool,
	filters: Filter[],
	relays: string[],
	opts: QueryOptions,
): Promise<Event[]> {
	const dedup = opts.dedup ?? true
	const collected = new Map<string, Event>()
	const order: string[] = []

	return new Promise<Event[]>((resolve) => {
		let finished = false
		const subs: Array<{ close(): void }> = []
		const eosed = new Set<string>()

		const finish = () => {
			if (finished) return
			finished = true
			cancelDeadline()
			for (const sub of subs) {
				try {
					sub.close()
				} catch {
					/* socket already gone */
				}
			}
			let events = order.map((id) => collected.get(id)!).filter(Boolean)
			if (opts.dedupReplaceable) events = pickNewest(events)
			if (opts.limit !== undefined) events = events.slice(0, opts.limit)
			resolve(events)
		}

		const cancelDeadline = onTimeout(opts.timeoutMs, finish)

		const onRelayDone = (url: string) => {
			eosed.add(url)
			if (opts.closeOnEose && eosed.size >= relays.length) finish()
		}

		for (const url of relays) {
			const subId = nextSubId()
			const conn = pool.connection(url, opts)
			const handle = conn.req(subId, filters, {
				onEvent: (event) => {
					if (finished) return
					if (dedup && collected.has(event.id)) return
					if (!verifyEvent(event)) return
					if (!collected.has(event.id)) order.push(event.id)
					collected.set(event.id, event)
					// Only a plain (non-replaceable) limit can short-circuit: newest-wins
					// collapsing may reduce the count after the fact.
					if (opts.limit !== undefined && !opts.dedupReplaceable && collected.size >= opts.limit) {
						finish()
					}
				},
				onEose: () => onRelayDone(url),
				onClosed: () => onRelayDone(url),
			})
			subs.push(handle)
		}

		if (relays.length === 0) finish()
	})
}
