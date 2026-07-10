import type { Filter } from '../../nostr';
import type { NodeFns } from './context';
export interface BuildFilterOptions {
    allowLimitUntil: boolean;
}
export declare function buildFilter(fns: NodeFns, itemIndex: number | undefined, opts: BuildFilterOptions): Filter[];
