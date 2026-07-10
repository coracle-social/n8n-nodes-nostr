import { NodeOperationError } from 'n8n-workflow'
import type { IDataObject, INodeExecutionData, INodeProperties } from 'n8n-workflow'

import { getPublicKey, nip19, normalizePubkey, pickNewest } from '../../../../nostr'
import type { Event } from '../../../../nostr'
import { query as queryRelays } from '../../../../relay'
import {
	authenticateOption,
	normalizeOrThrow,
	relaysField,
	resolveRelays,
	resolveSecretKey,
	resolveSigner,
	splitList,
	timeoutMsOption,
	toItem,
} from '../../../shared'
import type { OperationContext, OperationFn, ResourceModule } from '../types'

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['profile'] } },
		default: 'get',
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Fetch profile metadata (kind 0)',
				action: 'Get a profile',
			},
			{
				name: 'Get Relays',
				value: 'getRelays',
				description: 'Fetch a relay list (kind 10002)',
				action: 'Get a relay list',
			},
		],
	},
	{
		displayName: 'Public Keys',
		name: 'pubkeys',
		type: 'string',
		typeOptions: { rows: 2 },
		displayOptions: { show: { resource: ['profile'] } },
		default: '',
		description:
			'Public keys as npub or hex, one per line or comma-separated. Leave empty to use your own key.',
	},
	{ ...relaysField, displayOptions: { show: { resource: ['profile'] } } },
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		displayOptions: { show: { resource: ['profile'] } },
		default: {},
		options: [authenticateOption, timeoutMsOption(6000, 'Wall-clock deadline for the lookup')],
	},
]

interface ProfileOpts {
	authenticate?: boolean
	timeoutMs?: number
}

async function resolvePubkeys(c: OperationContext): Promise<string[]> {
	const tokens = splitList(c.ctx.getNodeParameter('pubkeys', c.itemIndex, '') as string)

	if (tokens.length === 0) {
		const secretKey = await resolveSecretKey(c.ctx)
		if (!secretKey) {
			throw new NodeOperationError(
				c.ctx.getNode(),
				'No public keys given and no credential attached, so there is no key to look up.',
				{ itemIndex: c.itemIndex },
			)
		}
		return [getPublicKey(secretKey)]
	}

	return tokens.map((token) => normalizeOrThrow(c.ctx, normalizePubkey, token, c.itemIndex))
}

async function fetchKind(
	c: OperationContext,
	kind: number,
	pubkeys: string[],
): Promise<Map<string, Event>> {
	const opts = c.ctx.getNodeParameter('options', c.itemIndex, {}) as ProfileOpts
	const relays = await resolveRelays(c.ctx, c.itemIndex)
	const signer = await resolveSigner(c.ctx)

	const events = await queryRelays(c.pool, [{ kinds: [kind], authors: pubkeys }], relays, {
		timeoutMs: opts.timeoutMs ?? 6_000,
		closeOnEose: true,
		dedup: true,
		authenticate: opts.authenticate ?? true,
		signer,
	})

	// Both profile kinds are replaceable, so `pickNewest` collapses each author to
	// one event. Off-kind events are dropped first: a relay may serve more than it
	// was asked for, and that would leave two events competing for one pubkey.
	const newest = pickNewest(events.filter((event) => event.kind === kind))
	return new Map(newest.map((event) => [event.pubkey, event]))
}

const get: OperationFn = async (c) => {
	const pubkeys = await resolvePubkeys(c)
	const found = await fetchKind(c, 0, pubkeys)

	return pubkeys.map((pubkey): INodeExecutionData => {
		const event = found.get(pubkey)
		const npub = nip19.npubEncode(pubkey)
		if (!event) return toItem({ pubkey, npub, found: false }, c.itemIndex)

		let metadata: IDataObject = {}
		try {
			metadata = JSON.parse(event.content) as IDataObject
		} catch {
			// A malformed kind 0 is common in the wild; surface the raw event anyway.
		}

		return toItem(
			{
				pubkey,
				npub,
				found: true,
				name: metadata.name,
				display_name: metadata.display_name,
				about: metadata.about,
				picture: metadata.picture,
				nip05: metadata.nip05,
				lud16: metadata.lud16,
				created_at: event.created_at,
				raw: event as unknown as IDataObject,
			},
			c.itemIndex,
		)
	})
}

const getRelays: OperationFn = async (c) => {
	const pubkeys = await resolvePubkeys(c)
	const found = await fetchKind(c, 10002, pubkeys)

	return pubkeys.map((pubkey): INodeExecutionData => {
		const event = found.get(pubkey)
		const npub = nip19.npubEncode(pubkey)
		if (!event) {
			return toItem({ pubkey, npub, found: false, read: [], write: [], relays: [] }, c.itemIndex)
		}

		const read: string[] = []
		const write: string[] = []
		const all: string[] = []
		for (const tag of event.tags) {
			if (tag[0] !== 'r' || !tag[1]) continue
			const url = tag[1]
			all.push(url)
			const marker = tag[2]
			// A bare `r` tag with no marker means both read and write.
			if (!marker || marker === 'read') read.push(url)
			if (!marker || marker === 'write') write.push(url)
		}

		return toItem(
			{ pubkey, npub, found: true, read, write, relays: all, created_at: event.created_at },
			c.itemIndex,
		)
	})
}

export const operations: Record<string, OperationFn> = { get, getRelays }

export const module: ResourceModule = { description, operations }
