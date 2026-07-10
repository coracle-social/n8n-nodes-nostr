import type { Filter } from '../nostr';
import type { RelayPool } from './RelayPool';
import type { SubscribeHandle, SubscribeOptions } from './types';
export declare function subscribe(pool: RelayPool, filters: Filter[], relays: string[], opts: SubscribeOptions): Promise<SubscribeHandle>;
