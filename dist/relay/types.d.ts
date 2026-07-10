import type { Event, EventTemplate, Filter } from '../nostr';
export interface PerRelayResult {
    relay: string;
    ok: boolean;
    reason: string;
    durationMs: number;
}
export interface Signer {
    getPublicKey(): string;
    signEvent(template: EventTemplate): Event;
}
export interface AuthOptions {
    authenticate: boolean;
    signer?: Signer;
}
export interface PublishOptions extends AuthOptions {
    timeoutMs: number;
}
export interface QueryOptions extends AuthOptions {
    limit?: number;
    timeoutMs: number;
    closeOnEose: boolean;
    dedup?: boolean;
    dedupReplaceable?: boolean;
}
export interface SubscribeOptions extends AuthOptions {
    overlapSeconds?: number;
    onEvent(event: Event, relay: string): void;
    onEose?(relay: string): void;
    onError?(relay: string, reason: string): void;
}
export interface SubscribeHandle {
    close(): Promise<void>;
}
export interface ReqHandlers {
    onEvent(event: Event): void;
    onEose?(): void;
    onClosed?(reason: string): void;
}
export interface ReqHandle {
    close(): void;
}
export declare enum ConnState {
    Disconnected = "disconnected",
    Connecting = "connecting",
    Open = "open",
    Closing = "closing"
}
export declare enum AuthState {
    None = "none",
    Challenged = "challenged",
    Pending = "pending",
    Ok = "ok",
    Failed = "failed"
}
export type RelayMessage = {
    type: 'EVENT';
    subId: string;
    event: Event;
} | {
    type: 'OK';
    id: string;
    ok: boolean;
    reason: string;
} | {
    type: 'EOSE';
    subId: string;
} | {
    type: 'CLOSED';
    subId: string;
    reason: string;
} | {
    type: 'NOTICE';
    message: string;
} | {
    type: 'AUTH';
    challenge: string;
};
export type { Event, Filter };
