"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.module = exports.operations = exports.description = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const nostr_1 = require("../../../../nostr");
const shared_1 = require("../../../shared");
const showFor = (entity) => ({
    show: { resource: ['utility'], operation: ['encode'], entity },
});
exports.description = [
    {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['utility'] } },
        default: 'decode',
        options: [
            {
                name: 'Decode',
                value: 'decode',
                description: 'Decode a NIP-19 entity',
                action: 'Decode a NIP-19 entity',
            },
            {
                name: 'Encode',
                value: 'encode',
                description: 'Encode a NIP-19 entity',
                action: 'Encode a NIP-19 entity',
            },
        ],
    },
    {
        displayName: 'Code',
        name: 'code',
        type: 'string',
        required: true,
        displayOptions: { show: { resource: ['utility'], operation: ['decode'] } },
        default: '',
        placeholder: 'e.g. npub1… / nevent1… / naddr1…',
        description: 'The bech32 entity to decode',
    },
    {
        displayName: 'Entity',
        name: 'entity',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['utility'], operation: ['encode'] } },
        default: 'npub',
        options: [
            { name: 'Naddr', value: 'naddr' },
            { name: 'Nevent', value: 'nevent' },
            { name: 'Note', value: 'note' },
            { name: 'Nprofile', value: 'nprofile' },
            { name: 'Npub', value: 'npub' },
        ],
        description: 'Which entity to encode',
    },
    {
        displayName: 'Public Key',
        name: 'pubkey',
        type: 'string',
        displayOptions: showFor(['npub', 'nprofile', 'naddr']),
        default: '',
        description: 'A 64-character hex public key',
    },
    {
        displayName: 'Event ID',
        name: 'id',
        type: 'string',
        displayOptions: showFor(['note', 'nevent']),
        default: '',
        description: 'A 64-character hex event ID',
    },
    {
        displayName: 'Identifier',
        name: 'identifier',
        type: 'string',
        displayOptions: showFor(['naddr']),
        default: '',
        description: 'The d tag value of the addressable event',
    },
    {
        displayName: 'Kind',
        name: 'kind',
        type: 'number',
        displayOptions: showFor(['naddr', 'nevent']),
        default: 30023,
        description: 'The event kind',
    },
    {
        displayName: 'Author',
        name: 'author',
        type: 'string',
        displayOptions: showFor(['nevent']),
        default: '',
        description: 'A 64-character hex public key of the author',
    },
    {
        displayName: 'Relays',
        name: 'relayHints',
        type: 'string',
        displayOptions: showFor(['nprofile', 'nevent', 'naddr']),
        default: '',
        description: 'Optional relay hints, comma-separated',
    },
];
const decode = async (c) => {
    const code = c.ctx.getNodeParameter('code', c.itemIndex, '').trim();
    try {
        const decoded = nostr_1.nip19.decode(code);
        const data = decoded.type === 'nsec'
            ? (0, nostr_1.bytesToHex)(decoded.data)
            : decoded.data;
        return [(0, shared_1.toItem)({ type: decoded.type, data }, c.itemIndex)];
    }
    catch (err) {
        throw new n8n_workflow_1.NodeOperationError(c.ctx.getNode(), `Could not decode ${JSON.stringify(code)}: ${err.message}`, {
            itemIndex: c.itemIndex,
        });
    }
};
const encode = async (c) => {
    const entity = c.ctx.getNodeParameter('entity', c.itemIndex, 'npub');
    const str = (name) => c.ctx.getNodeParameter(name, c.itemIndex, '').trim();
    const relays = (0, shared_1.splitList)(c.ctx.getNodeParameter('relayHints', c.itemIndex, ''));
    try {
        let encoded;
        switch (entity) {
            case 'npub':
                encoded = nostr_1.nip19.npubEncode(str('pubkey'));
                break;
            case 'note':
                encoded = nostr_1.nip19.noteEncode(str('id'));
                break;
            case 'nprofile':
                encoded = nostr_1.nip19.nprofileEncode({ pubkey: str('pubkey'), relays });
                break;
            case 'nevent':
                encoded = nostr_1.nip19.neventEncode({
                    id: str('id'),
                    relays,
                    author: str('author') || undefined,
                    kind: c.ctx.getNodeParameter('kind', c.itemIndex, undefined),
                });
                break;
            case 'naddr':
                encoded = nostr_1.nip19.naddrEncode({
                    identifier: str('identifier'),
                    pubkey: str('pubkey'),
                    kind: c.ctx.getNodeParameter('kind', c.itemIndex, 30023),
                    relays,
                });
                break;
            default:
                throw new Error(`unknown entity ${entity}`);
        }
        return [(0, shared_1.toItem)({ encoded }, c.itemIndex)];
    }
    catch (err) {
        throw new n8n_workflow_1.NodeOperationError(c.ctx.getNode(), `Could not encode ${entity}: ${err.message}`, {
            itemIndex: c.itemIndex,
        });
    }
};
exports.operations = { encode, decode };
exports.module = { description: exports.description, operations: exports.operations };
//# sourceMappingURL=utility.js.map