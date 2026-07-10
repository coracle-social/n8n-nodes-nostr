"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Connection = void 0;
const nostr_1 = require("../nostr");
const messages_1 = require("./messages");
const timers_1 = require("./timers");
const types_1 = require("./types");
const CONNECT_TIMEOUT_MS = 10_000;
const CHALLENGE_WAIT_MS = 1_500;
const AUTH_TIMEOUT_MS = 10_000;
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];
class Connection {
    url;
    state = types_1.ConnState.Disconnected;
    authState = types_1.AuthState.None;
    auth;
    ws;
    sendQueue = [];
    subs = new Map();
    publishes = new Map();
    challenge;
    challengeWaiters = [];
    authPromise;
    authEventId;
    authSettle;
    authFailReason = '';
    autoReconnect = false;
    disposed = false;
    backoffAttempt = 0;
    cancelReconnect;
    connectPromise;
    closeWaiters = [];
    constructor(url, auth) {
        this.url = url;
        this.auth = auth;
    }
    canAuth() {
        return Boolean(this.auth.authenticate && this.auth.signer);
    }
    setAuth(auth) {
        if (auth.signer === this.auth.signer && auth.authenticate === this.auth.authenticate)
            return;
        this.auth = auth;
        if (this.authState === types_1.AuthState.Failed || this.authState === types_1.AuthState.Challenged) {
            this.authState = this.challenge ? types_1.AuthState.Challenged : types_1.AuthState.None;
            this.authPromise = undefined;
            this.authFailReason = '';
        }
    }
    connect(timeoutMs = CONNECT_TIMEOUT_MS) {
        if (this.disposed)
            return Promise.reject(new Error('connection disposed'));
        if (this.state === types_1.ConnState.Open)
            return Promise.resolve();
        if (this.connectPromise)
            return this.connectPromise;
        this.state = types_1.ConnState.Connecting;
        this.connectPromise = new Promise((resolve, reject) => {
            let settled = false;
            const cancelTimer = (0, timers_1.onTimeout)(timeoutMs, () => {
                if (settled)
                    return;
                settled = true;
                this.connectPromise = undefined;
                try {
                    this.ws?.close();
                }
                catch {
                }
                reject(new Error(`timed out connecting to ${this.url}`));
            });
            let ws;
            try {
                ws = new WebSocket(this.url);
            }
            catch (err) {
                cancelTimer();
                settled = true;
                this.connectPromise = undefined;
                this.state = types_1.ConnState.Disconnected;
                reject(err instanceof Error ? err : new Error(String(err)));
                return;
            }
            this.ws = ws;
            ws.addEventListener('open', () => {
                this.state = types_1.ConnState.Open;
                this.backoffAttempt = 0;
                this.flushSendQueue();
                if (settled)
                    return;
                settled = true;
                cancelTimer();
                resolve();
            });
            ws.addEventListener('message', (ev) => {
                this.handleMessage(typeof ev.data === 'string' ? ev.data : String(ev.data));
            });
            ws.addEventListener('error', () => {
            });
            ws.addEventListener('close', () => {
                const wasConnecting = !settled;
                this.handleClose();
                if (wasConnecting) {
                    settled = true;
                    cancelTimer();
                    reject(new Error(`could not connect to ${this.url}`));
                }
            });
        });
        this.connectPromise.catch(() => undefined).then(() => {
            if (this.state !== types_1.ConnState.Open)
                this.connectPromise = undefined;
        });
        return this.connectPromise;
    }
    handleClose() {
        const wasOpen = this.state === types_1.ConnState.Open;
        this.state = types_1.ConnState.Disconnected;
        this.connectPromise = undefined;
        this.ws = undefined;
        this.sendQueue = [];
        this.authState = types_1.AuthState.None;
        this.challenge = undefined;
        this.authPromise = undefined;
        this.authEventId = undefined;
        this.authSettle?.({ ok: false, reason: 'connection closed' });
        this.authSettle = undefined;
        this.releaseChallengeWaiters(undefined);
        for (const rec of this.publishes.values())
            rec.settle(false, 'connection closed before OK');
        this.publishes.clear();
        if (this.disposed || !this.autoReconnect || this.subs.size === 0) {
            if (this.disposed) {
                this.closeWaiters.splice(0).forEach((w) => w());
            }
            else if (!wasOpen && this.subs.size > 0) {
                for (const [subId, sub] of this.subs) {
                    this.subs.delete(subId);
                    sub.handlers.onClosed?.('connection closed');
                }
            }
            return;
        }
        const backoff = BACKOFF_MS[Math.min(this.backoffAttempt, BACKOFF_MS.length - 1)];
        this.backoffAttempt++;
        const jittered = backoff * (0.8 + Math.random() * 0.4);
        this.cancelReconnect = (0, timers_1.onTimeout)(jittered, () => {
            if (this.disposed)
                return;
            this.connect()
                .then(() => this.resubscribeAll())
                .catch(() => undefined);
        });
    }
    resubscribeAll() {
        for (const [subId, sub] of this.subs) {
            sub.authRetried = false;
            this.send((0, messages_1.serializeReqFrame)(subId, sub.filters));
        }
    }
    send(frame) {
        if (this.state === types_1.ConnState.Open && this.ws)
            this.ws.send(frame);
        else
            this.sendQueue.push(frame);
    }
    flushSendQueue() {
        const queued = this.sendQueue.splice(0);
        for (const frame of queued)
            this.ws?.send(frame);
    }
    releaseChallengeWaiters(challenge) {
        this.challengeWaiters.splice(0).forEach((w) => w(challenge));
    }
    waitForChallenge(timeoutMs) {
        if (this.challenge)
            return Promise.resolve(this.challenge);
        return new Promise((resolve) => {
            const cancelTimer = (0, timers_1.onTimeout)(timeoutMs, () => {
                this.challengeWaiters = this.challengeWaiters.filter((w) => w !== waiter);
                resolve(undefined);
            });
            const waiter = (challenge) => {
                cancelTimer();
                resolve(challenge);
            };
            this.challengeWaiters.push(waiter);
        });
    }
    ensureAuth() {
        if (this.authState === types_1.AuthState.Ok)
            return Promise.resolve({ ok: true, reason: '' });
        if (this.authState === types_1.AuthState.Failed) {
            return Promise.resolve({ ok: false, reason: this.authFailReason });
        }
        if (!this.canAuth())
            return Promise.resolve({ ok: false, reason: 'auth-required: no credential' });
        if (!this.authPromise)
            this.authPromise = this.performAuth();
        return this.authPromise;
    }
    async performAuth() {
        const challenge = this.challenge ?? (await this.waitForChallenge(CHALLENGE_WAIT_MS));
        if (!challenge) {
            this.authState = types_1.AuthState.Failed;
            this.authFailReason = 'auth-required: relay never sent a challenge';
            return { ok: false, reason: this.authFailReason };
        }
        const signer = this.auth.signer;
        if (!signer)
            return { ok: false, reason: 'auth-required: no credential' };
        let authEvent;
        try {
            authEvent = signer.signEvent((0, nostr_1.makeAuthEvent)((0, messages_1.normalizeRelayUrl)(this.url), challenge));
        }
        catch (err) {
            this.authState = types_1.AuthState.Failed;
            this.authFailReason = `could not sign auth event: ${err.message}`;
            return { ok: false, reason: this.authFailReason };
        }
        this.authState = types_1.AuthState.Pending;
        this.authEventId = authEvent.id;
        const settled = new Promise((resolve) => {
            this.authSettle = resolve;
        });
        this.send((0, messages_1.serializeAuthFrame)(authEvent));
        const result = await (0, timers_1.withTimeout)(settled, AUTH_TIMEOUT_MS, () => ({
            ok: false,
            reason: 'timed out waiting for auth OK',
        }));
        this.authSettle = undefined;
        if (result.ok) {
            this.authState = types_1.AuthState.Ok;
        }
        else {
            this.authState = types_1.AuthState.Failed;
            this.authFailReason = result.reason || 'auth rejected';
        }
        return result;
    }
    handleMessage(raw) {
        let msg;
        try {
            msg = (0, messages_1.parseRelayMessage)(raw);
        }
        catch {
            return;
        }
        switch (msg.type) {
            case 'AUTH': {
                this.challenge = msg.challenge;
                this.releaseChallengeWaiters(msg.challenge);
                if (this.authState === types_1.AuthState.None) {
                    if (this.canAuth())
                        void this.ensureAuth();
                    else
                        this.authState = types_1.AuthState.Challenged;
                }
                return;
            }
            case 'EVENT': {
                this.subs.get(msg.subId)?.handlers.onEvent(msg.event);
                return;
            }
            case 'EOSE': {
                this.subs.get(msg.subId)?.handlers.onEose?.();
                return;
            }
            case 'OK': {
                if (this.authEventId && msg.id === this.authEventId) {
                    this.authSettle?.({ ok: msg.ok, reason: msg.reason });
                    return;
                }
                const rec = this.publishes.get(msg.id);
                if (!rec)
                    return;
                if (!msg.ok && (0, messages_1.isAuthRequired)(msg.reason)) {
                    if (!this.canAuth()) {
                        rec.settle(false, 'auth-required: no credential');
                        return;
                    }
                    if (!rec.authRetried) {
                        rec.authRetried = true;
                        void this.ensureAuth().then((auth) => {
                            if (!this.publishes.has(msg.id))
                                return;
                            if (auth.ok)
                                this.send((0, messages_1.serializeEventFrame)(rec.event));
                            else
                                rec.settle(false, auth.reason || msg.reason);
                        });
                        return;
                    }
                }
                rec.settle(msg.ok, msg.reason);
                return;
            }
            case 'CLOSED': {
                const sub = this.subs.get(msg.subId);
                if (!sub)
                    return;
                if ((0, messages_1.isAuthRequired)(msg.reason)) {
                    if (!this.canAuth()) {
                        this.subs.delete(msg.subId);
                        sub.handlers.onClosed?.('auth-required: no credential');
                        return;
                    }
                    if (!sub.authRetried) {
                        sub.authRetried = true;
                        void this.ensureAuth().then((auth) => {
                            if (!this.subs.has(msg.subId))
                                return;
                            if (auth.ok) {
                                this.send((0, messages_1.serializeReqFrame)(msg.subId, sub.filters));
                            }
                            else {
                                this.subs.delete(msg.subId);
                                sub.handlers.onClosed?.(auth.reason || msg.reason);
                            }
                        });
                        return;
                    }
                }
                this.subs.delete(msg.subId);
                sub.handlers.onClosed?.(msg.reason);
                return;
            }
            case 'NOTICE':
                return;
        }
    }
    async publish(event, timeoutMs) {
        const started = Date.now();
        const result = (ok, reason) => ({
            relay: this.url,
            ok,
            reason,
            durationMs: Date.now() - started,
        });
        try {
            await this.connect(timeoutMs);
        }
        catch (err) {
            return result(false, err.message);
        }
        return new Promise((resolve) => {
            const cancelTimer = (0, timers_1.onTimeout)(timeoutMs, () => {
                this.publishes.delete(event.id);
                resolve(result(false, 'timed out waiting for OK'));
            });
            this.publishes.set(event.id, {
                event,
                authRetried: false,
                settle: (ok, reason) => {
                    cancelTimer();
                    this.publishes.delete(event.id);
                    resolve(result(ok, reason));
                },
            });
            this.send((0, messages_1.serializeEventFrame)(event));
        });
    }
    req(subId, filters, handlers) {
        this.subs.set(subId, { filters, handlers, authRetried: false });
        this.connect()
            .then(() => {
            if (this.subs.has(subId))
                this.send((0, messages_1.serializeReqFrame)(subId, filters));
        })
            .catch((err) => {
            if (!this.subs.delete(subId))
                return;
            handlers.onClosed?.(err.message);
        });
        return {
            close: () => {
                if (!this.subs.delete(subId))
                    return;
                if (this.state === types_1.ConnState.Open)
                    this.send((0, messages_1.serializeCloseFrame)(subId));
            },
        };
    }
    updateFilters(subId, filters) {
        const sub = this.subs.get(subId);
        if (sub)
            sub.filters = filters;
    }
    async close() {
        if (this.disposed)
            return;
        this.disposed = true;
        this.autoReconnect = false;
        this.cancelReconnect?.();
        for (const subId of [...this.subs.keys()]) {
            if (this.state === types_1.ConnState.Open)
                this.send((0, messages_1.serializeCloseFrame)(subId));
            this.subs.delete(subId);
        }
        if (!this.ws || this.state === types_1.ConnState.Disconnected) {
            this.state = types_1.ConnState.Disconnected;
            return;
        }
        const closed = new Promise((resolve) => this.closeWaiters.push(resolve));
        this.state = types_1.ConnState.Closing;
        try {
            this.ws.close();
        }
        catch {
            return;
        }
        await Promise.race([closed, (0, timers_1.delay)(2_000)]);
    }
}
exports.Connection = Connection;
//# sourceMappingURL=Connection.js.map