import type {
	ICredentialTestFunctions,
	ICredentialsDecrypted,
	INodeCredentialTestResult,
} from 'n8n-workflow'

import { getPublicKey, nip19, normalizeSecretKey } from '../../nostr'

/**
 * Validates the key's format and derives its npub. There is nothing to reach out
 * to: a Nostr key is not registered anywhere, so a network check would only tell
 * us whether some relay happens to be up.
 */
export async function nostrKeyTest(
	this: ICredentialTestFunctions,
	credential: ICredentialsDecrypted,
): Promise<INodeCredentialTestResult> {
	try {
		const privateKey = (credential.data?.privateKey ?? '') as string
		const secretKey = normalizeSecretKey(privateKey)
		const npub = nip19.npubEncode(getPublicKey(secretKey))
		return { status: 'OK', message: `Valid key for ${npub}` }
	} catch (err) {
		return { status: 'Error', message: (err as Error).message }
	}
}
