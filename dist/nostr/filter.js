"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchFilter = matchFilter;
exports.matchFilters = matchFilters;
exports.mergeFilters = mergeFilters;
exports.getFilterLimit = getFilterLimit;
const kinds_1 = require("./kinds");
function matchFilter(filter, event) {
    if (filter.ids && filter.ids.indexOf(event.id) === -1) {
        return false;
    }
    if (filter.kinds && filter.kinds.indexOf(event.kind) === -1) {
        return false;
    }
    if (filter.authors && filter.authors.indexOf(event.pubkey) === -1) {
        return false;
    }
    for (const f in filter) {
        if (f[0] === '#') {
            const tagName = f.slice(1);
            const values = filter[`#${tagName}`];
            if (values && !event.tags.find(([t, v]) => t === f.slice(1) && values.indexOf(v) !== -1))
                return false;
        }
    }
    if (filter.since && event.created_at < filter.since)
        return false;
    if (filter.until && event.created_at > filter.until)
        return false;
    return true;
}
function matchFilters(filters, event) {
    for (let i = 0; i < filters.length; i++) {
        if (matchFilter(filters[i], event)) {
            return true;
        }
    }
    return false;
}
function mergeFilters(...filters) {
    const result = {};
    for (let i = 0; i < filters.length; i++) {
        const filter = filters[i];
        Object.entries(filter).forEach(([property, values]) => {
            if (property === 'kinds' || property === 'ids' || property === 'authors' || property[0] === '#') {
                result[property] = result[property] || [];
                for (let v = 0; v < values.length; v++) {
                    const value = values[v];
                    if (!result[property].includes(value))
                        result[property].push(value);
                }
            }
        });
        if (filter.limit && (!result.limit || filter.limit > result.limit))
            result.limit = filter.limit;
        if (filter.until && (!result.until || filter.until > result.until))
            result.until = filter.until;
        if (filter.since && (!result.since || filter.since < result.since))
            result.since = filter.since;
    }
    return result;
}
function getFilterLimit(filter) {
    if (filter.ids && !filter.ids.length)
        return 0;
    if (filter.kinds && !filter.kinds.length)
        return 0;
    if (filter.authors && !filter.authors.length)
        return 0;
    for (const [key, value] of Object.entries(filter)) {
        if (key[0] === '#' && Array.isArray(value) && !value.length)
            return 0;
    }
    return Math.min(Math.max(0, filter.limit ?? Infinity), filter.ids?.length ?? Infinity, filter.authors?.length && filter.kinds?.every(kind => (0, kinds_1.isReplaceableKind)(kind))
        ? filter.authors.length * filter.kinds.length
        : Infinity, filter.authors?.length && filter.kinds?.every(kind => (0, kinds_1.isAddressableKind)(kind)) && filter['#d']?.length
        ? filter.authors.length * filter.kinds.length * filter['#d'].length
        : Infinity);
}
//# sourceMappingURL=filter.js.map