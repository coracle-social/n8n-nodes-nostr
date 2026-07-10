"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientAuth = void 0;
exports.isReplaceableKind = isReplaceableKind;
exports.isEphemeralKind = isEphemeralKind;
exports.isAddressableKind = isAddressableKind;
exports.pickNewest = pickNewest;
exports.ClientAuth = 22242;
function isReplaceableKind(kind) {
    return kind === 0 || kind === 3 || (10000 <= kind && kind < 20000);
}
function isEphemeralKind(kind) {
    return 20000 <= kind && kind < 30000;
}
function isAddressableKind(kind) {
    return 30000 <= kind && kind < 40000;
}
function firstDTag(event) {
    for (const tag of event.tags) {
        if (tag[0] === 'd')
            return tag[1] ?? '';
    }
    return '';
}
function groupKey(event) {
    if (isAddressableKind(event.kind))
        return `a:${event.pubkey}:${event.kind}:${firstDTag(event)}`;
    if (isReplaceableKind(event.kind))
        return `r:${event.pubkey}:${event.kind}`;
    return `u:${event.id}`;
}
function isNewer(a, b) {
    if (a.created_at !== b.created_at)
        return a.created_at > b.created_at;
    return a.id < b.id;
}
function pickNewest(events) {
    const map = new Map();
    for (const event of events) {
        const key = groupKey(event);
        const existing = map.get(key);
        if (!existing || isNewer(event, existing))
            map.set(key, event);
    }
    return Array.from(map.values());
}
//# sourceMappingURL=kinds.js.map