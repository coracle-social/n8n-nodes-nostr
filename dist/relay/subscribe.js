"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribe = subscribe;
const nostr_1 = require("../nostr");
let subCounter = 0;
const nextSubId = () => `n8n-s${++subCounter}`;
const DEFAULT_OVERLAP_SECONDS = 60;
async function subscribe(pool, filters, relays, opts) {
    const overlap = opts.overlapSeconds ?? DEFAULT_OVERLAP_SECONDS;
    const handles = [];
    const subscriptions = [];
    let latestCreatedAt = 0;
    const advanceCursor = (createdAt) => {
        if (createdAt <= latestCreatedAt)
            return;
        latestCreatedAt = createdAt;
        const since = Math.max(0, latestCreatedAt - overlap);
        const resumed = filters.map((filter) => ({ ...filter, since }));
        for (const { url, subId } of subscriptions) {
            pool.connection(url).updateFilters(subId, resumed);
        }
    };
    for (const url of relays) {
        const subId = nextSubId();
        const conn = pool.connection(url, opts);
        conn.autoReconnect = true;
        subscriptions.push({ url, subId });
        handles.push(conn.req(subId, filters, {
            onEvent: (event) => {
                if (!(0, nostr_1.verifyEvent)(event))
                    return;
                advanceCursor(event.created_at);
                opts.onEvent(event, url);
            },
            onEose: () => opts.onEose?.(url),
            onClosed: (reason) => opts.onError?.(url, reason),
        }));
    }
    return {
        close: async () => {
            for (const handle of handles) {
                try {
                    handle.close();
                }
                catch {
                }
            }
        },
    };
}
//# sourceMappingURL=subscribe.js.map