import { NodeOperationError } from 'n8n-workflow'

import { normalizeSecretKey } from '../../nostr'
import { makeSecretKeySigner } from '../../relay'
import type { Signer } from '../../relay'
import { optionalCredentials } from './context'
import type { NodeFns } from './context'
import { normalizeOrThrow } from './params'

/** The raw secret key, or undefined when no credential is attached. */
export async function resolveSecretKey(fns: NodeFns): Promise<Uint8Array | undefined> {
	const credentials = await optionalCredentials(fns)
	const privateKey = credentials?.privateKey as string | undefined
	if (!privateKey) return undefined

	return normalizeOrThrow(fns, normalizeSecretKey, privateKey)
}

/** A signer, or undefined when no credential is attached. */
export async function resolveSigner(fns: NodeFns): Promise<Signer | undefined> {
	const secretKey = await resolveSecretKey(fns)
	return secretKey ? makeSecretKeySigner(secretKey) : undefined
}

/** For operations that cannot proceed without a key: signing, encryption. */
export async function requireSigner(fns: NodeFns, what: string): Promise<Signer> {
	const signer = await resolveSigner(fns)
	if (!signer) {
		throw new NodeOperationError(
			fns.getNode(),
			`${what} requires a Nostr credential. Add one with your private key to this node.`,
		)
	}
	return signer
}

export async function requireSecretKey(fns: NodeFns, what: string): Promise<Uint8Array> {
	const secretKey = await resolveSecretKey(fns)
	if (!secretKey) {
		throw new NodeOperationError(
			fns.getNode(),
			`${what} requires a Nostr credential. Add one with your private key to this node.`,
		)
	}
	return secretKey
}
