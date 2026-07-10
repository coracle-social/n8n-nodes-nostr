import type { NostrEvent } from './core';
export declare const ClientAuth = 22242;
export declare function isReplaceableKind(kind: number): boolean;
export declare function isEphemeralKind(kind: number): boolean;
export declare function isAddressableKind(kind: number): boolean;
export declare function pickNewest(events: NostrEvent[]): NostrEvent[];
