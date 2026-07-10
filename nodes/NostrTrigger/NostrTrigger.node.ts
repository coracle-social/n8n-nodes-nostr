import type {
	INodeType,
	INodeTypeDescription,
	ITriggerFunctions,
	ITriggerResponse,
} from 'n8n-workflow'

import { nowSec } from '../../nostr'
import type { Event, Filter } from '../../nostr'
import { RelayPool, query, subscribe } from '../../relay'
import type { SubscribeHandle } from '../../relay'
import {
	authenticateOption,
	buildFilter,
	eventToJson,
	filterModeField,
	nostrKeyTest,
	relaysField,
	resolveRelays,
	resolveSigner,
	tagFiltersField,
} from '../shared'

interface TriggerOptions {
	authenticate?: boolean
	overlapSeconds?: number
	includeHistorical?: boolean
	emitEnvelope?: boolean
	maxSeenIds?: number
}

interface TriggerStaticData {
	lastCreatedAt?: number
	seenIds?: string[]
}

const showFields = { show: { filterMode: ['fields'] } }

export class NostrTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nostr Trigger',
		name: 'nostrTrigger',
		icon: { light: 'file:nostr.svg', dark: 'file:nostr.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{"kinds: " + ($parameter["kinds"] || "any")}}',
		description: 'Starts a workflow when a matching Nostr event arrives',
		eventTriggerDescription: 'Waiting for matching Nostr events',
		activationMessage: 'Your subscription is now live on the configured relays.',
		defaults: { name: 'Nostr Trigger' },
		inputs: [],
		outputs: ['main'],
		credentials: [{ name: 'nostrPrivateKeyApi', required: false, testedBy: 'nostrKeyTest' }],
		properties: [
			relaysField,
			filterModeField,
			{
				displayName: 'Kinds',
				name: 'kinds',
				type: 'string',
				displayOptions: showFields,
				default: '1',
				description: 'Comma-separated event kinds to subscribe to',
			},
			{
				displayName: 'Authors',
				name: 'authors',
				type: 'string',
				typeOptions: { rows: 2 },
				displayOptions: showFields,
				default: '',
				description: 'Author public keys, as npub or hex, one per line or comma-separated',
			},
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				displayOptions: showFields,
				default: '',
				description: 'Full-text search, on relays that support NIP-50',
			},
			{ ...tagFiltersField, displayOptions: showFields },
			{
				displayName: 'Filter',
				name: 'filter',
				type: 'json',
				displayOptions: { show: { filterMode: ['rawFilter'] } },
				default: '{"kinds":[1]}',
				description: 'A raw NIP-01 filter. Limit and until are ignored for a live subscription.',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				options: [
					authenticateOption,
					{
						displayName: 'Emit Envelope',
						name: 'emitEnvelope',
						type: 'boolean',
						default: false,
						description: 'Whether to wrap output as { event, relay } instead of the bare event',
					},
					{
						displayName: 'Include Historical Events',
						name: 'includeHistorical',
						type: 'boolean',
						default: false,
						description: 'Whether to deliver stored events on first activation, not just new ones',
					},
					{
						displayName: 'Max Seen IDs',
						name: 'maxSeenIds',
						type: 'number',
						default: 5000,
						description: 'How many recent event IDs to remember for deduplication',
					},
					{
						displayName: 'Overlap (Seconds)',
						name: 'overlapSeconds',
						type: 'number',
						default: 60,
						description:
							'How far before the last seen event to resume after a restart. Relay timestamps are second-granular and clocks drift, so some overlap avoids missing events.',
					},
				],
			},
		],
	}

	// The trigger uses the credential for NIP-42 auth, so n8n's verification
	// requires it to declare a test too. Same local npub derivation as the action node.
	methods = {
		credentialTest: { nostrKeyTest },
	}

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const options = this.getNodeParameter('options', {}) as TriggerOptions
		const authenticate = options.authenticate ?? true
		const overlapSeconds = options.overlapSeconds ?? 60
		const maxSeenIds = options.maxSeenIds ?? 5000
		const emitEnvelope = options.emitEnvelope ?? false

		const relays = await resolveRelays(this)
		const signer = await resolveSigner(this)
		const filters = buildFilter(this, undefined, { allowLimitUntil: false })

		const pool = new RelayPool({ authenticate, signer })

		const staticData = this.getWorkflowStaticData('node') as TriggerStaticData
		const seen = new Set<string>(staticData.seenIds ?? [])
		// Insertion order is arrival order, which is what we trim by.
		const seenOrder: string[] = [...seen]

		const firstRun = staticData.lastCreatedAt === undefined
		const since = firstRun
			? options.includeHistorical
				? undefined
				: nowSec()
			: Math.max(0, (staticData.lastCreatedAt as number) - overlapSeconds)

		const liveFilters: Filter[] = filters.map((filter) =>
			since === undefined ? { ...filter } : { ...filter, since },
		)

		const remember = (event: Event): boolean => {
			if (seen.has(event.id)) return false
			seen.add(event.id)
			seenOrder.push(event.id)
			while (seenOrder.length > maxSeenIds) {
				const evicted = seenOrder.shift()
				if (evicted) seen.delete(evicted)
			}
			if (event.created_at > (staticData.lastCreatedAt ?? 0))
				staticData.lastCreatedAt = event.created_at
			staticData.seenIds = seenOrder
			return true
		}

		const emit = (event: Event, relay: string): void => {
			const json = eventToJson(event, { envelope: emitEnvelope, relay })
			// The 4th argument is n8n's native dedup key. Our own `seen` set is still
			// the authority: the same id arrives from every relay carrying it.
			this.emit([this.helpers.returnJsonArray([json])], undefined, undefined, event.id)
		}

		let handle: SubscribeHandle | undefined

		const closeFunction = async (): Promise<void> => {
			await handle?.close()
			await pool.close()
		}

		/**
		 * "Execute step" in the editor must return promptly. A live tail never would,
		 * so fetch just the single most recent matching event — enough to preview the
		 * output shape without opening a tail. Formatted like the live path so the
		 * preview matches what the running trigger will emit.
		 */
		const manualTriggerFunction = async (): Promise<void> => {
			const events = await query(pool, filters, relays, {
				limit: 1,
				timeoutMs: 5_000,
				closeOnEose: true,
				dedup: true,
				authenticate,
				signer,
			})
			const json = events.map((event) => eventToJson(event, { envelope: emitEnvelope }))
			this.emit([this.helpers.returnJsonArray(json)])
		}

		if (this.getMode() === 'trigger') {
			handle = await subscribe(pool, liveFilters, relays, {
				authenticate,
				signer,
				overlapSeconds,
				onEvent: (event, relay) => {
					if (remember(event)) emit(event, relay)
				},
				onError: (relay, reason) => {
					// One dead relay must not stop the others.
					this.logger.warn(`Nostr Trigger: subscription on ${relay} ended: ${reason}`)
				},
			})
		}

		return { closeFunction, manualTriggerFunction }
	}
}
