import { NodeOperationError } from 'n8n-workflow'
import type { INodeProperties } from 'n8n-workflow'

import { bytesToHex, nip19 } from '../../../../nostr'
import { splitList, toItem } from '../../../shared'
import type { OperationFn, ResourceModule } from '../types'

const showFor = (entity: string[]) => ({
	show: { resource: ['utility'], operation: ['encode'], entity },
})

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['utility'] } },
		default: 'decode',
		options: [
			{
				name: 'Decode',
				value: 'decode',
				description: 'Decode a NIP-19 entity',
				action: 'Decode a NIP-19 entity',
			},
			{
				name: 'Encode',
				value: 'encode',
				description: 'Encode a NIP-19 entity',
				action: 'Encode a NIP-19 entity',
			},
		],
	},
	{
		displayName: 'Code',
		name: 'code',
		type: 'string',
		required: true,
		displayOptions: { show: { resource: ['utility'], operation: ['decode'] } },
		default: '',
		placeholder: 'npub1… / nevent1… / naddr1…',
		description: 'The bech32 entity to decode',
	},
	{
		displayName: 'Entity',
		name: 'entity',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['utility'], operation: ['encode'] } },
		default: 'npub',
		options: [
			{ name: 'Naddr', value: 'naddr' },
			{ name: 'Nevent', value: 'nevent' },
			{ name: 'Note', value: 'note' },
			{ name: 'Nprofile', value: 'nprofile' },
			{ name: 'Npub', value: 'npub' },
		],
		description: 'Which entity to encode',
	},
	{
		displayName: 'Public Key',
		name: 'pubkey',
		type: 'string',
		displayOptions: showFor(['npub', 'nprofile', 'naddr']),
		default: '',
		description: 'A 64-character hex public key',
	},
	{
		displayName: 'Event ID',
		name: 'id',
		type: 'string',
		displayOptions: showFor(['note', 'nevent']),
		default: '',
		description: 'A 64-character hex event ID',
	},
	{
		displayName: 'Identifier',
		name: 'identifier',
		type: 'string',
		displayOptions: showFor(['naddr']),
		default: '',
		description: 'The d tag value of the addressable event',
	},
	{
		displayName: 'Kind',
		name: 'kind',
		type: 'number',
		displayOptions: showFor(['naddr', 'nevent']),
		default: 30023,
		description: 'The event kind',
	},
	{
		displayName: 'Author',
		name: 'author',
		type: 'string',
		displayOptions: showFor(['nevent']),
		default: '',
		description: 'A 64-character hex public key of the author',
	},
	{
		displayName: 'Relays',
		name: 'relayHints',
		type: 'string',
		displayOptions: showFor(['nprofile', 'nevent', 'naddr']),
		default: '',
		description: 'Optional relay hints, comma-separated',
	},
]

const decode: OperationFn = async (c) => {
	const code = (c.ctx.getNodeParameter('code', c.itemIndex, '') as string).trim()

	try {
		const decoded = nip19.decode(code)
		const data =
			decoded.type === 'nsec'
				? bytesToHex(decoded.data as Uint8Array)
				: (decoded.data as unknown as Record<string, unknown> | string)
		return [toItem({ type: decoded.type, data }, c.itemIndex)]
	} catch (err) {
		throw new NodeOperationError(
			c.ctx.getNode(),
			`Could not decode ${JSON.stringify(code)}: ${(err as Error).message}`,
			{
				itemIndex: c.itemIndex,
			},
		)
	}
}

const encode: OperationFn = async (c) => {
	const entity = c.ctx.getNodeParameter('entity', c.itemIndex, 'npub') as string
	const str = (name: string) => (c.ctx.getNodeParameter(name, c.itemIndex, '') as string).trim()
	const relays = splitList(c.ctx.getNodeParameter('relayHints', c.itemIndex, '') as string)

	try {
		let encoded: string
		switch (entity) {
			case 'npub':
				encoded = nip19.npubEncode(str('pubkey'))
				break
			case 'note':
				encoded = nip19.noteEncode(str('id'))
				break
			case 'nprofile':
				encoded = nip19.nprofileEncode({ pubkey: str('pubkey'), relays })
				break
			case 'nevent':
				encoded = nip19.neventEncode({
					id: str('id'),
					relays,
					author: str('author') || undefined,
					kind: c.ctx.getNodeParameter('kind', c.itemIndex, undefined) as number | undefined,
				})
				break
			case 'naddr':
				encoded = nip19.naddrEncode({
					identifier: str('identifier'),
					pubkey: str('pubkey'),
					kind: c.ctx.getNodeParameter('kind', c.itemIndex, 30023) as number,
					relays,
				})
				break
			default:
				throw new Error(`unknown entity ${entity}`)
		}
		return [toItem({ encoded }, c.itemIndex)]
	} catch (err) {
		throw new NodeOperationError(
			c.ctx.getNode(),
			`Could not encode ${entity}: ${(err as Error).message}`,
			{
				itemIndex: c.itemIndex,
			},
		)
	}
}

export const operations: Record<string, OperationFn> = { encode, decode }

export const module: ResourceModule = { description, operations }
