"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFilter = buildFilter;
const n8n_workflow_1 = require("n8n-workflow");
const nostr_1 = require("../../nostr");
const context_1 = require("./context");
const params_1 = require("./params");
function buildFilter(fns, itemIndex, opts) {
    const param = (0, context_1.paramReader)(fns, itemIndex);
    const mode = param('filterMode', 'fields');
    if (mode === 'rawFilter') {
        const parsed = (0, params_1.parseJsonParam)(fns, 'filter', {}, itemIndex);
        const filters = Array.isArray(parsed) ? parsed : [parsed];
        if (!opts.allowLimitUntil) {
            for (const filter of filters) {
                delete filter.limit;
                delete filter.until;
            }
        }
        return filters;
    }
    const filter = {};
    const kinds = (0, params_1.splitList)(param('kinds', '')).map((k) => {
        const n = Number(k);
        if (!Number.isInteger(n) || n < 0) {
            throw new n8n_workflow_1.NodeOperationError(fns.getNode(), `Invalid kind ${JSON.stringify(k)}: expected an integer.`, {
                itemIndex,
            });
        }
        return n;
    });
    if (kinds.length)
        filter.kinds = kinds;
    const authors = (0, params_1.splitList)(param('authors', '')).map((a) => (0, params_1.normalizeOrThrow)(fns, nostr_1.normalizePubkey, a, itemIndex));
    if (authors.length)
        filter.authors = authors;
    const ids = (0, params_1.splitList)(param('ids', '')).map((i) => (0, params_1.normalizeOrThrow)(fns, nostr_1.normalizeId, i, itemIndex));
    if (ids.length)
        filter.ids = ids;
    const search = param('search', '').trim();
    if (search)
        filter.search = search;
    const since = (0, params_1.toUnixSeconds)(param('since', ''));
    if (since !== undefined)
        filter.since = since;
    if (opts.allowLimitUntil) {
        const until = (0, params_1.toUnixSeconds)(param('until', ''));
        if (until !== undefined)
            filter.until = until;
        const limit = param('limit', 0);
        if (limit > 0)
            filter.limit = limit;
    }
    const tagFilters = param('tagFilters', {});
    for (const entry of tagFilters?.tag ?? []) {
        const letter = (entry.tag ?? '').trim();
        if (!/^[a-zA-Z]$/.test(letter)) {
            throw new n8n_workflow_1.NodeOperationError(fns.getNode(), `Invalid tag ${JSON.stringify(letter)}: a tag filter must be a single letter, such as e, p or t.`, { itemIndex });
        }
        const values = (0, params_1.splitList)(entry.values ?? '');
        if (values.length)
            filter[`#${letter}`] = values;
    }
    return [filter];
}
//# sourceMappingURL=buildFilter.js.map