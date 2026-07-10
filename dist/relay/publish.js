"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publish = publish;
async function publish(pool, event, relays, opts) {
    return Promise.all(relays.map(async (url) => {
        const started = Date.now();
        try {
            return await pool.connection(url, opts).publish(event, opts.timeoutMs);
        }
        catch (err) {
            return {
                relay: url,
                ok: false,
                reason: err.message || 'unknown error',
                durationMs: Date.now() - started,
            };
        }
    }));
}
//# sourceMappingURL=publish.js.map