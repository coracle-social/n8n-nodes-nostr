import type { NodeFns } from './context';
export declare function parseRelayList(raw: string): string[];
export declare function resolveRelays(fns: NodeFns, itemIndex?: number): Promise<string[]>;
