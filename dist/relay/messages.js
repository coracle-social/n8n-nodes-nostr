"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthRequired = exports.serializeReqFrame = exports.serializeCloseFrame = exports.serializeAuthFrame = exports.serializeEventFrame = void 0;
exports.parseRelayMessage = parseRelayMessage;
exports.normalizeRelayUrl = normalizeRelayUrl;
function parseRelayMessage(raw) {
    let frame;
    try {
        frame = JSON.parse(raw);
    }
    catch {
        throw new Error('relay sent malformed JSON');
    }
    if (!Array.isArray(frame) || typeof frame[0] !== 'string') {
        throw new Error('relay sent a frame that is not a tagged array');
    }
    switch (frame[0]) {
        case 'EVENT':
            if (typeof frame[1] !== 'string' || typeof frame[2] !== 'object' || frame[2] === null) {
                throw new Error('malformed EVENT frame');
            }
            return { type: 'EVENT', subId: frame[1], event: frame[2] };
        case 'OK':
            if (typeof frame[1] !== 'string' || typeof frame[2] !== 'boolean') {
                throw new Error('malformed OK frame');
            }
            return { type: 'OK', id: frame[1], ok: frame[2], reason: asString(frame[3]) };
        case 'EOSE':
            if (typeof frame[1] !== 'string')
                throw new Error('malformed EOSE frame');
            return { type: 'EOSE', subId: frame[1] };
        case 'CLOSED':
            if (typeof frame[1] !== 'string')
                throw new Error('malformed CLOSED frame');
            return { type: 'CLOSED', subId: frame[1], reason: asString(frame[2]) };
        case 'NOTICE':
            return { type: 'NOTICE', message: asString(frame[1]) };
        case 'AUTH':
            if (typeof frame[1] !== 'string')
                throw new Error('malformed AUTH frame');
            return { type: 'AUTH', challenge: frame[1] };
        default:
            throw new Error(`unknown relay frame type ${JSON.stringify(frame[0])}`);
    }
}
const asString = (v) => (typeof v === 'string' ? v : '');
const serializeEventFrame = (event) => JSON.stringify(['EVENT', event]);
exports.serializeEventFrame = serializeEventFrame;
const serializeAuthFrame = (event) => JSON.stringify(['AUTH', event]);
exports.serializeAuthFrame = serializeAuthFrame;
const serializeCloseFrame = (subId) => JSON.stringify(['CLOSE', subId]);
exports.serializeCloseFrame = serializeCloseFrame;
const serializeReqFrame = (subId, filters) => JSON.stringify(['REQ', subId, ...filters]);
exports.serializeReqFrame = serializeReqFrame;
function normalizeRelayUrl(url) {
    try {
        const parsed = new URL(url);
        parsed.hostname = parsed.hostname.toLowerCase();
        const str = parsed.toString();
        return str.endsWith('/') && parsed.pathname === '/' ? str.slice(0, -1) : str;
    }
    catch {
        return url;
    }
}
const isAuthRequired = (reason) => /^(auth-required|restricted)\b/i.test(reason.trim());
exports.isAuthRequired = isAuthRequired;
//# sourceMappingURL=messages.js.map