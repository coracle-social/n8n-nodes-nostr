import { VersionedNodeType } from 'n8n-workflow'
import type { INodeTypeBaseDescription, IVersionedNodeType } from 'n8n-workflow'

import { NostrV1 } from './v1/NostrV1.node'

export class Nostr extends VersionedNodeType {
	constructor() {
		const baseDescription: INodeTypeBaseDescription = {
			displayName: 'Nostr',
			name: 'nostr',
			icon: { light: 'file:nostr.svg', dark: 'file:nostr.dark.svg' },
			group: ['transform'],
			subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
			description: 'Publish, query and encrypt on the Nostr protocol',
			defaultVersion: 1,
		}

		const nodeVersions: IVersionedNodeType['nodeVersions'] = {
			1: new NostrV1(baseDescription),
		}

		super(nodeVersions, baseDescription)
	}
}
