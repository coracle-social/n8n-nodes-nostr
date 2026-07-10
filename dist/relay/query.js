"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = query;
const nostr_1 = require("../nostr");
const timers_1 = require("./timers");
let subCounter = 0;
const nextSubId = () => `n8n-q${++subCounter}`;
async function query(pool, filters, relays, opts) {
    const dedup = opts.dedup ?? true;
    const collected = new Map();
    const order = [];
    return new Promise((resolve) => {
        let finished = false;
        const subs = [];
        const eosed = new Set();
        const finish = () => {
            if (finished)
                return;
            finished = true;
            cancelDeadline();
            for (const sub of subs) {
                try {
                    sub.close();
                }
                catch {
                }
            }
            let events = order.map((id) => collected.get(id)).filter(Boolean);
            if (opts.dedupReplaceable)
                events = (0, nostr_1.pickNewest)(events);
            if (opts.limit !== undefined)
                events = events.slice(0, opts.limit);
            resolve(events);
        };
        const cancelDeadline = (0, timers_1.onTimeout)(opts.timeoutMs, finish);
        const onRelayDone = (url) => {
            eosed.add(url);
            if (opts.closeOnEose && eosed.size >= relays.length)
                finish();
        };
        for (const url of relays) {
            const subId = nextSubId();
            const conn = pool.connection(url, opts);
            const handle = conn.req(subId, filters, {
                onEvent: (event) => {
                    if (finished)
                        return;
                    if (dedup && collected.has(event.id))
                        return;
                    if (!(0, nostr_1.verifyEvent)(event))
                        return;
                    if (!collected.has(event.id))
                        order.push(event.id);
                    collected.set(event.id, event);
                    if (opts.limit !== undefined && !opts.dedupReplaceable && collected.size >= opts.limit) {
                        finish();
                    }
                },
                onEose: () => onRelayDone(url),
                onClosed: () => onRelayDone(url),
            });
            subs.push(handle);
        }
        if (relays.length === 0)
            finish();
    });
}
//# sourceMappingURL=query.js.map