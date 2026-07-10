import type { INodeProperties } from 'n8n-workflow'

export const relaysField: INodeProperties = {
	displayName: 'Relays',
	name: 'relays',
	type: 'string',
	typeOptions: { rows: 3 },
	default: '',
	placeholder: 'e.g. wss://relay.damus.io',
	description:
		'One relay URL per line. Leave empty to use the default relays from your credential.',
}

export const filterModeField: INodeProperties = {
	displayName: 'Filter Mode',
	name: 'filterMode',
	type: 'options',
	noDataExpression: true,
	default: 'fields',
	options: [
		{ name: 'Fields', value: 'fields', description: 'Build the filter from individual fields' },
		{
			name: 'Raw Filter JSON',
			value: 'rawFilter',
			description: 'Supply a raw NIP-01 filter object',
		},
	],
	description: 'How to build the Nostr filter',
}

/**
 * Entries for an Options collection. Every node that reaches a relay offers the
 * same NIP-42 toggle and deadline, and every node that builds an event offers
 * the same timestamp override.
 */
export const authenticateOption: INodeProperties = {
	displayName: 'Authenticate',
	name: 'authenticate',
	type: 'boolean',
	default: true,
	description: 'Whether to answer a relay NIP-42 authentication challenge',
}

export const createdAtOption: INodeProperties = {
	displayName: 'Created At',
	name: 'createdAt',
	type: 'dateTime',
	default: '',
	description: 'Event timestamp. Defaults to now.',
}

/** The deadline differs per operation, so the caller supplies both it and its wording. */
export function timeoutMsOption(defaultMs: number, description: string): INodeProperties {
	return {
		displayName: 'Timeout (Ms)',
		name: 'timeoutMs',
		type: 'number',
		default: defaultMs,
		description,
	}
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
					placeholder: 'e.g. t',
					description: 'A single-letter tag name, such as e, p or t',
				},
				{
					displayName: 'Values',
					name: 'values',
					type: 'string',
					default: '',
					placeholder: 'e.g. nostr, bitcoin',
					description: 'Comma-separated values to match for this tag',
				},
			],
		},
	],
}
