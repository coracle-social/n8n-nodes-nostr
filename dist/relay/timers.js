"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onTimeout = onTimeout;
exports.delay = delay;
exports.withTimeout = withTimeout;
function onTimeout(ms, fn) {
    const signal = AbortSignal.timeout(Math.max(0, Math.round(ms)));
    let cancelled = false;
    const handler = () => {
        if (!cancelled)
            fn();
    };
    signal.addEventListener('abort', handler, { once: true });
    return () => {
        cancelled = true;
        signal.removeEventListener('abort', handler);
    };
}
function delay(ms) {
    return new Promise((resolve) => {
        onTimeout(ms, resolve);
    });
}
function withTimeout(promise, ms, fallback) {
    return new Promise((resolve, reject) => {
        const cancel = onTimeout(ms, () => resolve(fallback()));
        promise.then((value) => {
            cancel();
            resolve(value);
        }, (err) => {
            cancel();
            reject(err);
        });
    });
}
//# sourceMappingURL=timers.js.map