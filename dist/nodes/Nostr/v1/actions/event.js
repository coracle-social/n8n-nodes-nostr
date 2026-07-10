"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.module = exports.operations = exports.description = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const nostr_1 = require("../../../../nostr");
const relay_1 = require("../../../../relay");
const shared_1 = require("../../../shared");
const showFor = (operation) => ({ show: { resource: ['event'], operation } });
const filterFields = {
    show: { resource: ['event'], operation: ['get', 'getMany'], filterMode: ['fields'] },
};
const manyFilterFields = {
    show: { resource: ['event'], operation: ['getMany'], filterMode: ['fields'] },
};
exports.description = [
    {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['event'] } },
        default: 'create',
        options: [
            {
                name: 'Create',
                value: 'create',
                description: 'Create a new event',
                action: 'Create an event',
            },
            {
                name: 'Get',
                value: 'get',
                description: 'Retrieve an event',
                action: 'Get an event',
            },
            {
                name: 'Get Many',
                value: 'getMany',
                description: 'Retrieve a list of events',
                action: 'Get many events',
            },
            {
                name: 'Sign',
                value: 'sign',
                description: 'Sign an event without publishing it',
                action: 'Sign an event',
            },
        ],
    },
    {
        displayName: 'Input Mode',
        name: 'inputMode',
        type: 'options',
        noDataExpression: true,
        displayOptions: showFor(['create', 'sign']),
        default: 'fields',
        options: [
            { name: 'Fields', value: 'fields', description: 'Build the event from individual fields' },
            { name: 'Raw Event JSON', value: 'rawEvent', description: 'Supply a complete event object' },
        ],
        description: 'How to build the event',
    },
    {
        displayName: 'Kind',
        name: 'kind',
        type: 'number',
        displayOptions: {
            show: { resource: ['event'], operation: ['create', 'sign'], inputMode: ['fields'] },
        },
        default: 1,
        description: 'The event kind. 1 is a short text note.',
    },
    {
        displayName: 'Content',
        name: 'content',
        type: 'string',
        typeOptions: { rows: 5 },
        displayOptions: {
            show: { resource: ['event'], operation: ['create', 'sign'], inputMode: ['fields'] },
        },
        default: '',
        description: 'The event content',
    },
    {
        displayName: 'Tags',
        name: 'tags',
        type: 'json',
        displayOptions: {
            show: { resource: ['event'], operation: ['create', 'sign'], inputMode: ['fields'] },
        },
        default: '[]',
        description: 'Event tags, as an array of string arrays. For example [["t","nostr"]].',
    },
    {
        displayName: 'Event',
        name: 'event',
        type: 'json',
        displayOptions: {
            show: { resource: ['event'], operation: ['create', 'sign'], inputMode: ['rawEvent'] },
        },
        default: '{}',
        description: 'A complete event object. If it already has an ID and signature it is published as-is.',
    },
    { ...shared_1.filterModeField, displayOptions: showFor(['get', 'getMany']) },
    {
        displayName: 'Kinds',
        name: 'kinds',
        type: 'string',
        displayOptions: filterFields,
        default: '1',
        description: 'Comma-separated event kinds',
    },
    {
        displayName: 'Authors',
        name: 'authors',
        type: 'string',
        typeOptions: { rows: 2 },
        displayOptions: filterFields,
        default: '',
        description: 'Author public keys, as npub or hex, one per line or comma-separated',
    },
    {
        displayName: 'IDs',
        name: 'ids',
        type: 'string',
        typeOptions: { rows: 2 },
        displayOptions: filterFields,
        default: '',
        description: 'Event IDs, as note, nevent or hex, one per line or comma-separated',
    },
    {
        displayName: 'Search',
        name: 'search',
        type: 'string',
        displayOptions: filterFields,
        default: '',
        description: 'Full-text search, on relays that support NIP-50',
    },
    {
        displayName: 'Since',
        name: 'since',
        type: 'dateTime',
        displayOptions: filterFields,
        default: '',
        description: 'Only events created at or after this time',
    },
    {
        displayName: 'Until',
        name: 'until',
        type: 'dateTime',
        displayOptions: manyFilterFields,
        default: '',
        description: 'Only events created at or before this time',
    },
    {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        typeOptions: { minValue: 1 },
        displayOptions: manyFilterFields,
        default: 50,
        description: 'Max number of results to return',
    },
    { ...shared_1.tagFiltersField, displayOptions: filterFields },
    {
        displayName: 'Filter',
        name: 'filter',
        type: 'json',
        displayOptions: {
            show: { resource: ['event'], operation: ['get', 'getMany'], filterMode: ['rawFilter'] },
        },
        default: '{"kinds":[1],"limit":20}',
        description: 'A raw NIP-01 filter object, or an array of them',
    },
    { ...shared_1.relaysField, displayOptions: showFor(['create', 'get', 'getMany']) },
    {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add option',
        displayOptions: showFor(['create']),
        default: {},
        options: [
            shared_1.authenticateOption,
            shared_1.createdAtOption,
            {
                displayName: 'Split Results Into Items',
                name: 'splitResultsIntoItems',
                type: 'boolean',
                default: false,
                description: 'Whether to emit one item per relay instead of one item per event',
            },
            (0, shared_1.timeoutMsOption)(10000, 'How long to wait for each relay to acknowledge the event'),
        ],
    },
    {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add option',
        displayOptions: showFor(['sign']),
        default: {},
        options: [
            {
                displayName: 'Attach NIP-19',
                name: 'attachNip19',
                type: 'boolean',
                default: true,
                description: 'Whether to include the nevent encoding of the signed event',
            },
            shared_1.createdAtOption,
        ],
    },
    {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add option',
        displayOptions: showFor(['get']),
        default: {},
        options: [
            shared_1.authenticateOption,
            {
                displayName: 'Close On EOSE',
                name: 'closeOnEose',
                type: 'boolean',
                default: true,
                description: 'Whether to stop once every relay reports end of stored events',
            },
            (0, shared_1.timeoutMsOption)(8000, 'Wall-clock deadline. The lookup always returns by this time.'),
        ],
    },
    {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add option',
        displayOptions: showFor(['getMany']),
        default: {},
        options: [
            shared_1.authenticateOption,
            {
                displayName: 'Close On EOSE',
                name: 'closeOnEose',
                type: 'boolean',
                default: true,
                description: 'Whether to stop once every relay reports end of stored events',
            },
            {
                displayName: 'Deduplicate',
                name: 'dedup',
                type: 'boolean',
                default: true,
                description: 'Whether to drop copies of the same event served by several relays',
            },
            {
                displayName: 'Newest Replaceable Only',
                name: 'dedupReplaceable',
                type: 'boolean',
                default: false,
                description: 'Whether to keep only the newest version of each replaceable event',
            },
            {
                displayName: 'Output Mode',
                name: 'outputMode',
                type: 'options',
                default: 'individualEvents',
                options: [
                    { name: 'Individual Events', value: 'individualEvents' },
                    { name: 'Single Array', value: 'singleArray' },
                ],
                description: 'Whether to emit one item per event or a single item holding them all',
            },
            (0, shared_1.timeoutMsOption)(8000, 'Wall-clock deadline. The query always returns by this time.'),
        ],
    },
];
const createdAtFrom = (value) => (0, shared_1.toUnixSeconds)(value) ?? (0, nostr_1.nowSec)();
async function buildSignedEvent(c, createdAt) {
    const inputMode = c.ctx.getNodeParameter('inputMode', c.itemIndex, 'fields');
    if (inputMode === 'rawEvent') {
        const raw = (0, shared_1.parseJsonParam)(c.ctx, 'event', {}, c.itemIndex);
        if (raw.id && raw.sig) {
            if (!(0, nostr_1.verifyEvent)(raw)) {
                throw new n8n_workflow_1.NodeOperationError(c.ctx.getNode(), 'The supplied event has an ID and signature, but they do not verify.', { itemIndex: c.itemIndex });
            }
            return raw;
        }
        const signer = await (0, shared_1.requireSigner)(c.ctx, 'Signing an event');
        return signer.signEvent({
            kind: raw.kind ?? 1,
            content: raw.content ?? '',
            tags: raw.tags ?? [],
            created_at: raw.created_at ?? createdAtFrom(createdAt),
        });
    }
    const tags = (0, shared_1.parseJsonParam)(c.ctx, 'tags', [], c.itemIndex);
    if (!Array.isArray(tags) || tags.some((t) => !Array.isArray(t))) {
        throw new n8n_workflow_1.NodeOperationError(c.ctx.getNode(), 'Tags must be an array of string arrays.', {
            itemIndex: c.itemIndex,
        });
    }
    const signer = await (0, shared_1.requireSigner)(c.ctx, 'Signing an event');
    return signer.signEvent({
        kind: c.ctx.getNodeParameter('kind', c.itemIndex, 1),
        content: c.ctx.getNodeParameter('content', c.itemIndex, ''),
        tags,
        created_at: createdAtFrom(createdAt),
    });
}
const create = async (c) => {
    const opts = c.ctx.getNodeParameter('options', c.itemIndex, {});
    const event = await buildSignedEvent(c, opts.createdAt);
    const relays = await (0, shared_1.resolveRelays)(c.ctx, c.itemIndex);
    const signer = await (0, shared_1.resolveSigner)(c.ctx);
    const results = await (0, relay_1.publish)(c.pool, event, relays, {
        timeoutMs: opts.timeoutMs ?? 10_000,
        authenticate: opts.authenticate ?? true,
        signer,
    });
    const accepted = results.filter((r) => r.ok).map((r) => r.relay);
    const rejected = results.filter((r) => !r.ok).map((r) => r.relay);
    if (opts.splitResultsIntoItems) {
        return results.map((result) => (0, shared_1.toItem)({ ...result, eventId: event.id }, c.itemIndex));
    }
    return [
        (0, shared_1.toItem)({
            event: event,
            results: results,
            accepted,
            rejected,
            allAccepted: rejected.length === 0,
            anyAccepted: accepted.length > 0,
        }, c.itemIndex),
    ];
};
const sign = async (c) => {
    const opts = c.ctx.getNodeParameter('options', c.itemIndex, {});
    const event = await buildSignedEvent(c, opts.createdAt);
    const json = {
        event: event,
        id: event.id,
        pubkey: event.pubkey,
    };
    if (opts.attachNip19 ?? true) {
        json.nevent = nostr_1.nip19.neventEncode({ id: event.id, author: event.pubkey, kind: event.kind });
    }
    return [(0, shared_1.toItem)(json, c.itemIndex)];
};
const get = async (c) => {
    const opts = c.ctx.getNodeParameter('options', c.itemIndex, {});
    const filters = (0, shared_1.buildFilter)(c.ctx, c.itemIndex, { allowLimitUntil: false }).map((filter) => ({
        ...filter,
        limit: 1,
    }));
    const relays = await (0, shared_1.resolveRelays)(c.ctx, c.itemIndex);
    const signer = await (0, shared_1.resolveSigner)(c.ctx);
    const events = await (0, relay_1.query)(c.pool, filters, relays, {
        timeoutMs: opts.timeoutMs ?? 8_000,
        closeOnEose: opts.closeOnEose ?? true,
        dedup: true,
        authenticate: opts.authenticate ?? true,
        signer,
    });
    const newest = events.reduce((best, event) => (!best || event.created_at > best.created_at ? event : best), undefined);
    return newest ? [(0, shared_1.eventToItem)(newest, { itemIndex: c.itemIndex })] : [];
};
const getMany = async (c) => {
    const opts = c.ctx.getNodeParameter('options', c.itemIndex, {});
    const filters = (0, shared_1.buildFilter)(c.ctx, c.itemIndex, { allowLimitUntil: true });
    const relays = await (0, shared_1.resolveRelays)(c.ctx, c.itemIndex);
    const signer = await (0, shared_1.resolveSigner)(c.ctx);
    const limit = filters.length === 1 ? filters[0].limit : undefined;
    const events = await (0, relay_1.query)(c.pool, filters, relays, {
        limit,
        timeoutMs: opts.timeoutMs ?? 8_000,
        closeOnEose: opts.closeOnEose ?? true,
        dedup: opts.dedup ?? true,
        dedupReplaceable: opts.dedupReplaceable ?? false,
        authenticate: opts.authenticate ?? true,
        signer,
    });
    if ((opts.outputMode ?? 'individualEvents') === 'singleArray') {
        return [
            (0, shared_1.toItem)({
                events: events,
                count: events.length,
                relaysQueried: relays,
            }, c.itemIndex),
        ];
    }
    return events.map((event) => (0, shared_1.eventToItem)(event, { itemIndex: c.itemIndex }));
};
exports.operations = { create, get, getMany, sign };
exports.module = { description: exports.description, operations: exports.operations };
//# sourceMappingURL=event.js.map