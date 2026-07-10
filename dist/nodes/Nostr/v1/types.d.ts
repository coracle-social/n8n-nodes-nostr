import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import type { RelayPool } from '../../../relay';
export interface OperationContext {
    ctx: IExecuteFunctions;
    itemIndex: number;
    pool: RelayPool;
}
export type OperationFn = (c: OperationContext) => Promise<INodeExecutionData[]>;
export interface ResourceModule {
    description: INodeProperties[];
    operations: Record<string, OperationFn>;
}
