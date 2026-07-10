"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.module = exports.operations = exports.description = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const nostr_1 = require("../../../../nostr");
const shared_1 = require("../../../shared");
exports.description = [
    {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['encryption'] } },
        default: 'encrypt',
        options: [
            {
                name: 'Encrypt',
                value: 'encrypt',
                description: 'Encrypt a message with NIP-44',
                action: 'Encrypt a message',
            },
            {
                name: 'Decrypt',
                value: 'decrypt',
                description: 'Decrypt a NIP-44 message',
                action: 'Decrypt a message',
            },
        ],
    },
    {
        displayName: 'Peer Public Key',
        name: 'peerPublicKey',
        type: 'string',
        required: true,
        displayOptions: { show: { resource: ['encryption'] } },
        default: '',
        placeholder: 'e.g. npub1… or 64-character hex',
        description: 'The other party public key. The conversation key is derived from it and your own secret key.',
    },
    {
        displayName: 'Plaintext',
        name: 'plaintext',
        type: 'string',
        typeOptions: { rows: 4 },
        displayOptions: { show: { resource: ['encryption'], operation: ['encrypt'] } },
        default: '',
        description: 'The message to encrypt',
    },
    {
        displayName: 'Ciphertext',
        name: 'ciphertext',
        type: 'string',
        typeOptions: { rows: 4 },
        displayOptions: { show: { resource: ['encryption'], operation: ['decrypt'] } },
        default: '',
        description: 'The base64 NIP-44 payload to decrypt',
    },
];
async function conversationKey(c) {
    const secretKey = await (0, shared_1.requireSecretKey)(c.ctx, 'NIP-44 encryption');
    const raw = c.ctx.getNodeParameter('peerPublicKey', c.itemIndex, '');
    const peer = (0, shared_1.normalizeOrThrow)(c.ctx, nostr_1.normalizePubkey, raw, c.itemIndex);
    try {
        return nostr_1.nip44.getConversationKey(secretKey, peer);
    }
    catch (err) {
        throw new n8n_workflow_1.NodeOperationError(c.ctx.getNode(), `Could not derive a conversation key: ${err.message}`, {
            itemIndex: c.itemIndex,
        });
    }
}
const encrypt = async (c) => {
    const key = await conversationKey(c);
    const plaintext = c.ctx.getNodeParameter('plaintext', c.itemIndex, '');
    try {
        return [(0, shared_1.toItem)({ ciphertext: nostr_1.nip44.encrypt(plaintext, key), version: 'nip44' }, c.itemIndex)];
    }
    catch (err) {
        throw new n8n_workflow_1.NodeOperationError(c.ctx.getNode(), `Could not encrypt: ${err.message}`, {
            itemIndex: c.itemIndex,
        });
    }
};
const decrypt = async (c) => {
    const key = await conversationKey(c);
    const ciphertext = c.ctx.getNodeParameter('ciphertext', c.itemIndex, '');
    try {
        return [(0, shared_1.toItem)({ plaintext: nostr_1.nip44.decrypt(ciphertext, key) }, c.itemIndex)];
    }
    catch (err) {
        throw new n8n_workflow_1.NodeOperationError(c.ctx.getNode(), `Could not decrypt: ${err.message}`, {
            itemIndex: c.itemIndex,
        });
    }
};
exports.operations = { encrypt, decrypt };
exports.module = { description: exports.description, operations: exports.operations };
//# sourceMappingURL=encryption.js.map