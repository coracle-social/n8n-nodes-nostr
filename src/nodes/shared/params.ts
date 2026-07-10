import { NodeOperationError } from 'n8n-workflow'

import { paramReader } from './context'
import type { NodeFns } from './context'

/**
 * Splits a user-typed list into trimmed, non-empty tokens. Every list field in
 * these nodes accepts newlines, commas or plain whitespace as separators.
 */
export function splitList(raw: string): string[] {
	return (raw ?? '')
		.split(/[\s,]+/)
		.map((token) => token.trim())
		.filter(Boolean)
}

/** n8n dateTime parameters arrive as ISO strings; Nostr wants unix seconds. */
export function toUnixSeconds(value: unknown): number | undefined {
	if (value === undefined || value === null || value === '') return undefined
	const ms = typeof value === 'number' ? value : Date.parse(String(value))
	if (Number.isNaN(ms)) return undefined
	return Math.floor(ms / 1000)
}

/**
 * Runs one of the `normalize*` helpers from src/nostr, restating the error it
 * throws against this node so the editor can point at the offending item.
 */
export function normalizeOrThrow<T>(
	fns: NodeFns,
	normalize: (value: string) => T,
	value: string,
	itemIndex?: number,
): T {
	try {
		return normalize(value)
	} catch (err) {
		throw new NodeOperationError(fns.getNode(), (err as Error).message, { itemIndex })
	}
}

/**
 * Reads a parameter that n8n hands us as either JSON text or an already-parsed
 * object, depending on whether the field holds a literal or an expression.
 */
export function parseJsonParam(
	fns: NodeFns,
	name: string,
	fallback: unknown,
	itemIndex?: number,
): unknown {
	const param = paramReader(fns, itemIndex)
	const raw = param<unknown>(name, fallback)
	if (typeof raw !== 'string') return raw

	try {
		return JSON.parse(raw)
	} catch {
		const label = name.charAt(0).toUpperCase() + name.slice(1)
		throw new NodeOperationError(fns.getNode(), `${label} is not valid JSON.`, { itemIndex })
	}
}
