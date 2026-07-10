import type { Icon, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow'

export class NostrPrivateKeyApi implements ICredentialType {
	name = 'nostrPrivateKeyApi'

	displayName = 'Nostr Private Key API'

	icon: Icon = { light: 'file:nostr.svg', dark: 'file:nostr.dark.svg' }

	documentationUrl = 'https://github.com/coracle-social/n8n-nodes-nostr'

	properties: INodeProperties[] = [
		{
			displayName: 'Private Key',
			name: 'privateKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			placeholder: 'e.g. nsec1… or 64-character hex',
			description:
				'Your Nostr secret key, as an nsec bech32 string or 64-character hex. Stored encrypted by n8n. Anyone with this key can post as you.',
		},
		{
			displayName: 'Default Relays',
			name: 'defaultRelays',
			type: 'string',
			typeOptions: { rows: 4 },
			default: 'wss://relay.damus.io\nwss://nos.lol\nwss://relay.primal.net',
			description: 'Relays to use when a node leaves its Relays field empty. One URL per line.',
		},
	]

	// n8n's community-node verification requires a declarative credential `test`.
	// A Nostr key has no HTTP endpoint to authenticate against, so this only checks
	// that the first configured relay answers its NIP-11 info document — it does not
	// prove the key itself is valid. The nodes additionally declare
	// `testedBy: 'nostrKeyTest'`, which validates the key format and derives its npub
	// locally with no network call.
	test: ICredentialTestRequest = {
		request: {
			method: 'GET',
			url: '={{ ($credentials.defaultRelays || "wss://relay.damus.io").split("\\n")[0].trim().replace("wss://", "https://").replace("ws://", "http://") }}',
			headers: { Accept: 'application/nostr+json' },
		},
	}
}
