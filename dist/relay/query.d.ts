import type { Event, Filter } from '../nostr';
import type { RelayPool } from './RelayPool';
import type { QueryOptions } from './types';
export declare function query(pool: RelayPool, filters: Filter[], relays: string[], opts: QueryOptions): Promise<Event[]>;
