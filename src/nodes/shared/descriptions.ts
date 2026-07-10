import type { INodeProperties } from 'n8n-workflow'

export const relaysField: INodeProperties = {
	displayName: 'Relays',
	name: 'relays',
	type: 'string',
	typeOptions: { rows: 3 },
	default: '',
	placeholder: 'wss://relay.damus.io\nwss://nos.lol',
	description: 'One relay URL per line. Leave empty to use the default relays from your credential.',
}

export const filterModeField: INodeProperties = {
	displayName: 'Filter Mode',
	name: 'filterMode',
	type: 'options',
	noDataExpression: true,
	default: 'fields',
	options: [
		{ name: 'Fields', value: 'fields', description: 'Build the filter from individual fields' },
		{ name: 'Raw Filter JSON', value: 'rawFilter', description: 'Supply a raw NIP-01 filter object' },
	],
	description: 'How to build the Nostr filter',
}

export const tagFiltersField: INodeProperties = {
	displayName: 'Tag Filters',
	name: 'tagFilters',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true },
	default: {},
	placeholder: 'Add tag filter',
	description: 'Filter on indexed tags, such as #e, #p or #t',
	options: [
		{
			name: 'tag',
			displayName: 'Tag',
			values: [
				{
					displayName: 'Tag',
					name: 'tag',
					type: 'string',
					default: 't',
					placeholder: 't',
					description: 'A single-letter tag name, such as e, p or t',
				},
				{
					displayName: 'Values',
					name: 'values',
					type: 'string',
					default: '',
					placeholder: 'nostr, bitcoin',
					description: 'Comma-separated values to match for this tag',
				},
			],
		},
	],
}
