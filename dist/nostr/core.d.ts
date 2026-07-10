export interface Nostr {
    generateSecretKey(): Uint8Array;
    getPublicKey(secretKey: Uint8Array): string;
    finalizeEvent(event: EventTemplate, secretKey: Uint8Array): VerifiedEvent;
    verifyEvent(event: Event): event is VerifiedEvent;
}
export declare const verifiedSymbol: unique symbol;
export type NostrEvent = {
    kind: number;
    tags: string[][];
    content: string;
    created_at: number;
    pubkey: string;
    id: string;
    sig: string;
    [verifiedSymbol]?: boolean;
};
export type Event = NostrEvent;
export type EventTemplate = Pick<Event, 'kind' | 'tags' | 'content' | 'created_at'>;
export type UnsignedEvent = Pick<Event, 'kind' | 'tags' | 'content' | 'created_at' | 'pubkey'>;
export interface VerifiedEvent extends Event {
    [verifiedSymbol]: true;
}
export declare function validateEvent<T>(event: T): event is T & UnsignedEvent;
export declare function sortEvents(events: Event[]): Event[];
