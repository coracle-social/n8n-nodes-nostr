import type { IExecuteFunctions, ITriggerFunctions } from 'n8n-workflow';
export type NodeFns = IExecuteFunctions | ITriggerFunctions;
export type ParamReader = <T>(name: string, fallback?: T) => T;
export declare function paramReader(fns: NodeFns, itemIndex?: number): ParamReader;
export declare function optionalCredentials(fns: NodeFns, name?: string): Promise<Record<string, unknown> | undefined>;
