"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NostrV1 = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const relay_1 = require("../../../relay");
const shared_1 = require("../../shared");
const credentialTest_1 = require("./methods/credentialTest");
const router_1 = require("./router");
class NostrV1 {
    description;
    constructor(baseDescription) {
        this.description = {
            ...baseDescription,
            version: 1,
            defaults: { name: 'Nostr' },
            inputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            usableAsTool: true,
            credentials: [
                {
                    name: 'nostrPrivateKeyApi',
                    required: false,
                    testedBy: 'nostrKeyTest',
                    displayOptions: { hide: { resource: ['utility'] } },
                },
            ],
            properties: [
                {
                    displayName: 'Resource',
                    name: 'resource',
                    type: 'options',
                    noDataExpression: true,
                    default: 'event',
                    options: [
                        { name: 'Event', value: 'event' },
                        { name: 'Encryption', value: 'encryption' },
                        { name: 'Utility', value: 'utility' },
                    ],
                },
                ...router_1.resources.event.description,
                ...router_1.resources.encryption.description,
                ...router_1.resources.utility.description,
            ],
        };
    }
    methods = {
        credentialTest: { nostrKeyTest: credentialTest_1.nostrKeyTest },
    };
    async execute() {
        const items = this.getInputData();
        const resource = this.getNodeParameter('resource', 0);
        const operation = this.getNodeParameter('operation', 0);
        const run = (0, router_1.route)(resource, operation);
        if (!run) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `The operation "${operation}" is not supported for "${resource}".`);
        }
        const signer = await (0, shared_1.resolveSigner)(this);
        const pool = new relay_1.RelayPool({ authenticate: true, signer });
        const returnData = [];
        try {
            for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
                try {
                    returnData.push(...(await run({ ctx: this, itemIndex, pool })));
                }
                catch (error) {
                    if (this.continueOnFail()) {
                        returnData.push({
                            json: { error: error.message },
                            pairedItem: { item: itemIndex },
                        });
                        continue;
                    }
                    if (error instanceof n8n_workflow_1.NodeOperationError)
                        throw error;
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), error, { itemIndex });
                }
            }
        }
        finally {
            await pool.close();
        }
        return [returnData];
    }
}
exports.NostrV1 = NostrV1;
//# sourceMappingURL=NostrV1.node.js.map