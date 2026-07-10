import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeBaseDescription, INodeTypeDescription } from 'n8n-workflow';
import { nostrKeyTest } from './methods/credentialTest';
export declare class NostrV1 implements INodeType {
    description: INodeTypeDescription;
    constructor(baseDescription: INodeTypeBaseDescription);
    methods: {
        credentialTest: {
            nostrKeyTest: typeof nostrKeyTest;
        };
    };
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
