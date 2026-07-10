"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRelayList = parseRelayList;
exports.resolveRelays = resolveRelays;
const n8n_workflow_1 = require("n8n-workflow");
const context_1 = require("./context");
const params_1 = require("./params");
function parseRelayList(raw) {
    const seen = new Set();
    for (const url of (0, params_1.splitList)(raw)) {
        if (!/^wss?:\/\//i.test(url))
            continue;
        seen.add(url.replace(/\/+$/, ''));
    }
    return [...seen];
}
async function resolveRelays(fns, itemIndex) {
    const param = (0, context_1.paramReader)(fns, itemIndex);
    const fromNode = parseRelayList(param('relays', ''));
    if (fromNode.length > 0)
        return fromNode;
    const credentials = await (0, context_1.optionalCredentials)(fns);
    const fromCredential = parseRelayList(credentials?.defaultRelays ?? '');
    if (fromCredential.length > 0)
        return fromCredential;
    throw new n8n_workflow_1.NodeOperationError(fns.getNode(), 'No relays configured. Set the Relays field on this node, or add Default Relays to your Nostr credential.');
}
//# sourceMappingURL=resolveRelays.js.map