import { NodeOperationError } from 'n8n-workflow'

import { normalizeId, normalizePubkey } from '../../nostr'
import type { Filter } from '../../nostr'
import { paramReader } from './context'
import type { NodeFns } from './context'

export interface BuildFilterOptions {
	/** A trigger's live tail has no meaningful `limit` or `until`. */
	allowLimitUntil: boolean
}

interface TagFilterEntry {
	tag: string
	values: string
}

const splitList = (raw: string): string[] =>
	(raw ?? '')
		.split(/[\s,]+/)
		.map((s) => s.trim())
		.filter(Boolean)

/** n8n dateTime parameters arrive as ISO strings; Nostr wants unix seconds. */
function toUnixSeconds(value: unknown): number | undefined {
	if (value === undefined || value === null || value === '') return undefined
	const ms = typeof value === 'number' ? value : Date.parse(String(value))
	if (Number.isNaN(ms)) return undefined
	return Math.floor(ms / 1000)
}

export function buildFilter(fns: NodeFns, itemIndex: number | undefined, opts: BuildFilterOptions): Filter[] {
	const param = paramReader(fns, itemIndex)
	const mode = param<string>('filterMode', 'fields')

	if (mode === 'rawFilter') {
		const raw = param<unknown>('filter', {})
		const parsed = typeof raw === 'string' ? safeParse(fns, raw) : raw
		const filters: Filter[] = Array.isArray(parsed) ? (parsed as Filter[]) : [parsed as Filter]
		if (!opts.allowLimitUntil) {
			for (const filter of filters) {
				delete filter.limit
				delete filter.until
			}
		}
		return filters
	}

	const filter: Filter = {}

	const kinds = splitList(param<string>('kinds', '')).map((k) => {
		const n = Number(k)
		if (!Number.isInteger(n) || n < 0) {
			throw new NodeOperationError(fns.getNode(), `Invalid kind ${JSON.stringify(k)}: expected an integer.`)
		}
		return n
	})
	if (kinds.length) filter.kinds = kinds

	const authors = splitList(param<string>('authors', '')).map((a) => normalize(fns, normalizePubkey, a))
	if (authors.length) filter.authors = authors

	const ids = splitList(param<string>('ids', '')).map((i) => normalize(fns, normalizeId, i))
	if (ids.length) filter.ids = ids

	const search = param<string>('search', '').trim()
	if (search) filter.search = search

	const since = toUnixSeconds(param<string>('since', ''))
	if (since !== undefined) filter.since = since

	if (opts.allowLimitUntil) {
		const until = toUnixSeconds(param<string>('until', ''))
		if (until !== undefined) filter.until = until

		const limit = param<number>('limit', 0)
		if (limit > 0) filter.limit = limit
	}

	const tagFilters = param<{ tag?: TagFilterEntry[] }>('tagFilters', {})
	for (const entry of tagFilters?.tag ?? []) {
		const letter = (entry.tag ?? '').trim()
		if (!/^[a-zA-Z]$/.test(letter)) {
			throw new NodeOperationError(
				fns.getNode(),
				`Invalid tag ${JSON.stringify(letter)}: a tag filter must be a single letter, such as e, p or t.`,
			)
		}
		const values = splitList(entry.values ?? '')
		if (values.length) (filter as Record<string, unknown>)[`#${letter}`] = values
	}

	return [filter]
}

function normalize(fns: NodeFns, fn: (value: string) => string, value: string): string {
	try {
		return fn(value)
	} catch (err) {
		throw new NodeOperationError(fns.getNode(), (err as Error).message)
	}
}

function safeParse(fns: NodeFns, raw: string): unknown {
	try {
		return JSON.parse(raw)
	} catch {
		throw new NodeOperationError(fns.getNode(), 'Filter is not valid JSON.')
	}
}
