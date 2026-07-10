import type { OperationFn, ResourceModule } from './types';
export declare const resources: Record<string, ResourceModule>;
export declare function route(resource: string, operation: string): OperationFn | undefined;
