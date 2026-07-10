"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NostrTrigger = void 0;
const nostr_1 = require("../../nostr");
const relay_1 = require("../../relay");
const shared_1 = require("../shared");
const showFields = { show: { filterMode: ['fields'] } };
class NostrTrigger {
    description = {
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
        credentials: [{ name: 'nostrPrivateKeyApi', required: false }],
        properties: [
            shared_1.relaysField,
            shared_1.filterModeField,
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
            { ...shared_1.tagFiltersField, displayOptions: showFields },
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
                    shared_1.authenticateOption,
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
                        description: 'How far before the last seen event to resume after a restart. Relay timestamps are second-granular and clocks drift, so some overlap avoids missing events.',
                    },
                ],
            },
        ],
    };
    async trigger() {
        const options = this.getNodeParameter('options', {});
        const authenticate = options.authenticate ?? true;
        const overlapSeconds = options.overlapSeconds ?? 60;
        const maxSeenIds = options.maxSeenIds ?? 5000;
        const emitEnvelope = options.emitEnvelope ?? false;
        const relays = await (0, shared_1.resolveRelays)(this);
        const signer = await (0, shared_1.resolveSigner)(this);
        const filters = (0, shared_1.buildFilter)(this, undefined, { allowLimitUntil: false });
        const pool = new relay_1.RelayPool({ authenticate, signer });
        const staticData = this.getWorkflowStaticData('node');
        const seen = new Set(staticData.seenIds ?? []);
        const seenOrder = [...seen];
        const firstRun = staticData.lastCreatedAt === undefined;
        const since = firstRun
            ? options.includeHistorical
                ? undefined
                : (0, nostr_1.nowSec)()
            : Math.max(0, staticData.lastCreatedAt - overlapSeconds);
        const liveFilters = filters.map((filter) => since === undefined ? { ...filter } : { ...filter, since });
        const remember = (event) => {
            if (seen.has(event.id))
                return false;
            seen.add(event.id);
            seenOrder.push(event.id);
            while (seenOrder.length > maxSeenIds) {
                const evicted = seenOrder.shift();
                if (evicted)
                    seen.delete(evicted);
            }
            if (event.created_at > (staticData.lastCreatedAt ?? 0))
                staticData.lastCreatedAt = event.created_at;
            staticData.seenIds = seenOrder;
            return true;
        };
        const emit = (event, relay) => {
            const json = (0, shared_1.eventToJson)(event, { envelope: emitEnvelope, relay });
            this.emit([this.helpers.returnJsonArray([json])], undefined, undefined, event.id);
        };
        let handle;
        const closeFunction = async () => {
            await handle?.close();
            await pool.close();
        };
        const manualTriggerFunction = async () => {
            const events = await (0, relay_1.query)(pool, filters, relays, {
                limit: 1,
                timeoutMs: 5_000,
                closeOnEose: true,
                dedup: true,
                authenticate,
                signer,
            });
            const json = events.map((event) => (0, shared_1.eventToJson)(event, { envelope: emitEnvelope }));
            this.emit([this.helpers.returnJsonArray(json)]);
        };
        if (this.getMode() === 'trigger') {
            handle = await (0, relay_1.subscribe)(pool, liveFilters, relays, {
                authenticate,
                signer,
                overlapSeconds,
                onEvent: (event, relay) => {
                    if (remember(event))
                        emit(event, relay);
                },
                onError: (relay, reason) => {
                    this.logger.warn(`Nostr Trigger: subscription on ${relay} ended: ${reason}`);
                },
            });
        }
        return { closeFunction, manualTriggerFunction };
    }
}
exports.NostrTrigger = NostrTrigger;
//# sourceMappingURL=NostrTrigger.node.js.map