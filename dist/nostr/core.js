"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifiedSymbol = void 0;
exports.validateEvent = validateEvent;
exports.sortEvents = sortEvents;
exports.verifiedSymbol = Symbol('verified');
const isRecord = (obj) => obj instanceof Object;
function validateEvent(event) {
    if (!isRecord(event))
        return false;
    if (typeof event.kind !== 'number')
        return false;
    if (typeof event.content !== 'string')
        return false;
    if (typeof event.created_at !== 'number')
        return false;
    if (typeof event.pubkey !== 'string')
        return false;
    if (!event.pubkey.match(/^[a-f0-9]{64}$/))
        return false;
    if (!Array.isArray(event.tags))
        return false;
    for (let i = 0; i < event.tags.length; i++) {
        const tag = event.tags[i];
        if (!Array.isArray(tag))
            return false;
        for (let j = 0; j < tag.length; j++) {
            if (typeof tag[j] !== 'string')
                return false;
        }
    }
    return true;
}
function sortEvents(events) {
    return events.sort((a, b) => {
        if (a.created_at !== b.created_at) {
            return b.created_at - a.created_at;
        }
        return a.id.localeCompare(b.id);
    });
}
//# sourceMappingURL=core.js.map