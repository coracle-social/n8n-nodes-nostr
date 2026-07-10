import { NodeOperationError } from 'n8n-workflow'

import { normalizeId, normalizePubkey } from '../../nostr'
import type { Filter } from '../../nostr'
import { paramReader } from './context'
import type { NodeFns } from './context'
import { normalizeOrThrow, parseJsonParam, splitList, toUnixSeconds } from './params'

export interface BuildFilterOptions {
	/** A trigger's live tail has no meaningful `limit` or `until`. */
	allowLimitUntil: boolean
}

interface TagFilterEntry {
	tag: string
	values: string
}

export function buildFilter(
	fns: NodeFns,
	itemIndex: number | undefined,
	opts: BuildFilterOptions,
): Filter[] {
	const param = paramReader(fns, itemIndex)
	const mode = param<string>('filterMode', 'fields')

	if (mode === 'rawFilter') {
		const parsed = parseJsonParam(fns, 'filter', {}, itemIndex)
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
			throw new NodeOperationError(
				fns.getNode(),
				`Invalid kind ${JSON.stringify(k)}: expected an integer.`,
				{
					itemIndex,
				},
			)
		}
		return n
	})
	if (kinds.length) filter.kinds = kinds

	const authors = splitList(param<string>('authors', '')).map((a) =>
		normalizeOrThrow(fns, normalizePubkey, a, itemIndex),
	)
	if (authors.length) filter.authors = authors

	const ids = splitList(param<string>('ids', '')).map((i) =>
		normalizeOrThrow(fns, normalizeId, i, itemIndex),
	)
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
				{ itemIndex },
			)
		}
		const values = splitList(entry.values ?? '')
		if (values.length) (filter as Record<string, unknown>)[`#${letter}`] = values
	}

	return [filter]
}
