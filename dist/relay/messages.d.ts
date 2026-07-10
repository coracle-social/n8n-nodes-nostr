import type { Event, Filter, RelayMessage } from './types';
export declare function parseRelayMessage(raw: string): RelayMessage;
export declare const serializeEventFrame: (event: Event) => string;
export declare const serializeAuthFrame: (event: Event) => string;
export declare const serializeCloseFrame: (subId: string) => string;
export declare const serializeReqFrame: (subId: string, filters: Filter[]) => string;
export declare function normalizeRelayUrl(url: string): string;
export declare const isAuthRequired: (reason: string) => boolean;
