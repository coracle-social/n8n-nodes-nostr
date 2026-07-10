import type { NodeFns } from './context';
export declare function splitList(raw: string): string[];
export declare function toUnixSeconds(value: unknown): number | undefined;
export declare function normalizeOrThrow<T>(fns: NodeFns, normalize: (value: string) => T, value: string, itemIndex?: number): T;
export declare function parseJsonParam(fns: NodeFns, name: string, fallback: unknown, itemIndex?: number): unknown;
