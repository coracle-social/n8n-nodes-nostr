import { NodeOperationError } from 'n8n-workflow'

import { optionalCredentials, paramReader } from './context'
import type { NodeFns } from './context'

/** Splits a textarea of relay URLs on newlines, commas, or whitespace. */
export function parseRelayList(raw: string): string[] {
	const seen = new Set<string>()
	for (const token of (raw ?? '').split(/[\s,]+/)) {
		const url = token.trim()
		if (!url) continue
		if (!/^wss?:\/\//i.test(url)) continue
		seen.add(url.replace(/\/+$/, ''))
	}
	return [...seen]
}

/**
 * Relays from the node's own field, falling back to the credential's defaults.
 *
 * Zero relays is always a configuration error rather than an empty result: a
 * publish to nowhere silently succeeds, which is the worst possible outcome.
 */
export async function resolveRelays(fns: NodeFns, itemIndex?: number): Promise<string[]> {
	const param = paramReader(fns, itemIndex)
	const fromNode = parseRelayList(param<string>('relays', ''))
	if (fromNode.length > 0) return fromNode

	const credentials = await optionalCredentials(fns)
	const fromCredential = parseRelayList((credentials?.defaultRelays as string) ?? '')
	if (fromCredential.length > 0) return fromCredential

	throw new NodeOperationError(
		fns.getNode(),
		'No relays configured. Set the Relays field on this node, or add Default Relays to your Nostr credential.',
	)
}
