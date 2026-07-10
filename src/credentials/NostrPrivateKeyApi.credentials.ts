import type { Icon, ICredentialType, INodeProperties } from 'n8n-workflow'

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
			placeholder: 'nsec1… or 64-character hex',
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

	// Nostr has no HTTP endpoint to probe, so there is no ICredentialTestRequest here.
	// The Nostr node declares `testedBy: 'nostrKeyTest'`, which validates the key's
	// format and derives its npub without touching the network.
}
