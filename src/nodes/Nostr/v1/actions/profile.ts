import { NodeOperationError } from 'n8n-workflow'
import type { IDataObject, INodeExecutionData, INodeProperties } from 'n8n-workflow'

import { nip19, normalizePubkey } from '../../../../nostr'
import type { Event } from '../../../../nostr'
import { query as queryRelays } from '../../../../relay'
import { relaysField, resolveRelays, resolveSigner, resolveSecretKey } from '../../../shared'
import { getPublicKey } from '../../../../nostr'
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
			{ name: 'Get', value: 'get', description: 'Fetch profile metadata (kind 0)', action: 'Get a profile' },
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
		description: 'Public keys as npub or hex, one per line or comma-separated. Leave empty to use your own key.',
	},
	{ ...relaysField, displayOptions: { show: { resource: ['profile'] } } },
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		displayOptions: { show: { resource: ['profile'] } },
		default: {},
		options: [
			{
				displayName: 'Authenticate',
				name: 'authenticate',
				type: 'boolean',
				default: true,
				description: 'Whether to answer a relay NIP-42 authentication challenge',
			},
			{
				displayName: 'Timeout (Ms)',
				name: 'timeoutMs',
				type: 'number',
				default: 6000,
				description: 'Wall-clock deadline for the lookup',
			},
		],
	},
]

interface ProfileOpts {
	authenticate?: boolean
	timeoutMs?: number
}

async function resolvePubkeys(c: OperationContext): Promise<string[]> {
	const raw = c.ctx.getNodeParameter('pubkeys', c.itemIndex, '') as string
	const tokens = raw
		.split(/[\s,]+/)
		.map((s) => s.trim())
		.filter(Boolean)

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

	return tokens.map((token) => {
		try {
			return normalizePubkey(token)
		} catch (err) {
			throw new NodeOperationError(c.ctx.getNode(), (err as Error).message, { itemIndex: c.itemIndex })
		}
	})
}

/** Newest wins for replaceable kinds; ties break on the lower id, as NIP-01 says. */
function newestPerPubkey(events: Event[]): Map<string, Event> {
	const byPubkey = new Map<string, Event>()
	for (const event of events) {
		const held = byPubkey.get(event.pubkey)
		if (
			!held ||
			event.created_at > held.created_at ||
			(event.created_at === held.created_at && event.id < held.id)
		) {
			byPubkey.set(event.pubkey, event)
		}
	}
	return byPubkey
}

async function fetchKind(c: OperationContext, kind: number, pubkeys: string[]): Promise<Map<string, Event>> {
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

	return newestPerPubkey(events)
}

const get: OperationFn = async (c) => {
	const pubkeys = await resolvePubkeys(c)
	const found = await fetchKind(c, 0, pubkeys)

	return pubkeys.map((pubkey): INodeExecutionData => {
		const event = found.get(pubkey)
		const npub = nip19.npubEncode(pubkey)
		if (!event) {
			return { json: { pubkey, npub, found: false }, pairedItem: { item: c.itemIndex } }
		}

		let metadata: IDataObject = {}
		try {
			metadata = JSON.parse(event.content) as IDataObject
		} catch {
			// A malformed kind 0 is common in the wild; surface the raw event anyway.
		}

		return {
			json: {
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
			pairedItem: { item: c.itemIndex },
		}
	})
}

const getRelays: OperationFn = async (c) => {
	const pubkeys = await resolvePubkeys(c)
	const found = await fetchKind(c, 10002, pubkeys)

	return pubkeys.map((pubkey): INodeExecutionData => {
		const event = found.get(pubkey)
		const npub = nip19.npubEncode(pubkey)
		if (!event) {
			return { json: { pubkey, npub, found: false, read: [], write: [], relays: [] }, pairedItem: { item: c.itemIndex } }
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

		return {
			json: { pubkey, npub, found: true, read, write, relays: all, created_at: event.created_at },
			pairedItem: { item: c.itemIndex },
		}
	})
}

export const operations: Record<string, OperationFn> = { get, getRelays }

export const module: ResourceModule = { description, operations }
