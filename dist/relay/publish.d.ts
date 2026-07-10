import type { Event } from '../nostr';
import type { RelayPool } from './RelayPool';
import type { PerRelayResult, PublishOptions } from './types';
export declare function publish(pool: RelayPool, event: Event, relays: string[], opts: PublishOptions): Promise<PerRelayResult[]>;
