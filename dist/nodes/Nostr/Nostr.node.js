"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Nostr = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const NostrV1_node_1 = require("./v1/NostrV1.node");
class Nostr extends n8n_workflow_1.VersionedNodeType {
    constructor() {
        const baseDescription = {
            displayName: 'Nostr',
            name: 'nostr',
            icon: { light: 'file:nostr.svg', dark: 'file:nostr.dark.svg' },
            group: ['transform'],
            subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
            description: 'Publish, query and encrypt on the Nostr protocol',
            defaultVersion: 1,
        };
        const nodeVersions = {
            1: new NostrV1_node_1.NostrV1(baseDescription),
        };
        super(nodeVersions, baseDescription);
    }
}
exports.Nostr = Nostr;
//# sourceMappingURL=Nostr.node.js.map