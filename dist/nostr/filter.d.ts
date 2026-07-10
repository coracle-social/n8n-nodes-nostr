import type { Event } from './core';
export type Filter = {
    ids?: string[];
    kinds?: number[];
    authors?: string[];
    since?: number;
    until?: number;
    limit?: number;
    search?: string;
    [key: `#${string}`]: string[] | undefined;
};
export declare function matchFilter(filter: Filter, event: Event): boolean;
export declare function matchFilters(filters: Filter[], event: Event): boolean;
export declare function mergeFilters(...filters: Filter[]): Filter;
export declare function getFilterLimit(filter: Filter): number;
