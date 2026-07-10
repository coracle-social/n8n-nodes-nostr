import { NodeOperationError } from 'n8n-workflow'
import type { INodeProperties } from 'n8n-workflow'

import { nip44, normalizePubkey } from '../../../../nostr'
import { normalizeOrThrow, requireSecretKey, toItem } from '../../../shared'
import type { OperationContext, OperationFn, ResourceModule } from '../types'

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['encryption'] } },
		default: 'encrypt',
		options: [
			{
				name: 'Encrypt',
				value: 'encrypt',
				description: 'Encrypt a message with NIP-44',
				action: 'Encrypt a message',
			},
			{
				name: 'Decrypt',
				value: 'decrypt',
				description: 'Decrypt a NIP-44 message',
				action: 'Decrypt a message',
			},
		],
	},
	{
		displayName: 'Peer Public Key',
		name: 'peerPublicKey',
		type: 'string',
		required: true,
		displayOptions: { show: { resource: ['encryption'] } },
		default: '',
		placeholder: 'e.g. npub1… or 64-character hex',
		description:
			'The other party public key. The conversation key is derived from it and your own secret key.',
	},
	{
		displayName: 'Plaintext',
		name: 'plaintext',
		type: 'string',
		typeOptions: { rows: 4 },
		displayOptions: { show: { resource: ['encryption'], operation: ['encrypt'] } },
		default: '',
		description: 'The message to encrypt',
	},
	{
		displayName: 'Ciphertext',
		name: 'ciphertext',
		type: 'string',
		typeOptions: { rows: 4 },
		displayOptions: { show: { resource: ['encryption'], operation: ['decrypt'] } },
		default: '',
		description: 'The base64 NIP-44 payload to decrypt',
	},
]

async function conversationKey(c: OperationContext): Promise<Uint8Array> {
	const secretKey = await requireSecretKey(c.ctx, 'NIP-44 encryption')
	const raw = c.ctx.getNodeParameter('peerPublicKey', c.itemIndex, '') as string
	const peer = normalizeOrThrow(c.ctx, normalizePubkey, raw, c.itemIndex)

	try {
		return nip44.getConversationKey(secretKey, peer)
	} catch (err) {
		throw new NodeOperationError(
			c.ctx.getNode(),
			`Could not derive a conversation key: ${(err as Error).message}`,
			{
				itemIndex: c.itemIndex,
			},
		)
	}
}

const encrypt: OperationFn = async (c) => {
	const key = await conversationKey(c)
	const plaintext = c.ctx.getNodeParameter('plaintext', c.itemIndex, '') as string

	try {
		return [toItem({ ciphertext: nip44.encrypt(plaintext, key), version: 'nip44' }, c.itemIndex)]
	} catch (err) {
		throw new NodeOperationError(c.ctx.getNode(), `Could not encrypt: ${(err as Error).message}`, {
			itemIndex: c.itemIndex,
		})
	}
}

const decrypt: OperationFn = async (c) => {
	const key = await conversationKey(c)
	const ciphertext = c.ctx.getNodeParameter('ciphertext', c.itemIndex, '') as string

	try {
		return [toItem({ plaintext: nip44.decrypt(ciphertext, key) }, c.itemIndex)]
	} catch (err) {
		throw new NodeOperationError(c.ctx.getNode(), `Could not decrypt: ${(err as Error).message}`, {
			itemIndex: c.itemIndex,
		})
	}
}

export const operations: Record<string, OperationFn> = { encrypt, decrypt }

export const module: ResourceModule = { description, operations }
