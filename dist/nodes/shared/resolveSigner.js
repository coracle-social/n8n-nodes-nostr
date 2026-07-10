"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSecretKey = resolveSecretKey;
exports.resolveSigner = resolveSigner;
exports.requireSigner = requireSigner;
exports.requireSecretKey = requireSecretKey;
const n8n_workflow_1 = require("n8n-workflow");
const nostr_1 = require("../../nostr");
const relay_1 = require("../../relay");
const context_1 = require("./context");
const params_1 = require("./params");
async function resolveSecretKey(fns) {
    const credentials = await (0, context_1.optionalCredentials)(fns);
    const privateKey = credentials?.privateKey;
    if (!privateKey)
        return undefined;
    return (0, params_1.normalizeOrThrow)(fns, nostr_1.normalizeSecretKey, privateKey);
}
async function resolveSigner(fns) {
    const secretKey = await resolveSecretKey(fns);
    return secretKey ? (0, relay_1.makeSecretKeySigner)(secretKey) : undefined;
}
async function requireSigner(fns, what) {
    const signer = await resolveSigner(fns);
    if (!signer) {
        throw new n8n_workflow_1.NodeOperationError(fns.getNode(), `${what} requires a Nostr credential. Add one with your private key to this node.`);
    }
    return signer;
}
async function requireSecretKey(fns, what) {
    const secretKey = await resolveSecretKey(fns);
    if (!secretKey) {
        throw new n8n_workflow_1.NodeOperationError(fns.getNode(), `${what} requires a Nostr credential. Add one with your private key to this node.`);
    }
    return secretKey;
}
//# sourceMappingURL=resolveSigner.js.map