"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventToJson = eventToJson;
exports.toItem = toItem;
exports.eventToItem = eventToItem;
function eventToJson(event, opts = {}) {
    const json = opts.envelope
        ? { event: event, relay: opts.relay }
        : { ...event, relay: opts.relay };
    if (!opts.relay)
        delete json.relay;
    return json;
}
function toItem(json, itemIndex) {
    return { json, pairedItem: { item: itemIndex } };
}
function eventToItem(event, opts = {}) {
    const item = { json: eventToJson(event, opts) };
    if (opts.itemIndex !== undefined)
        item.pairedItem = { item: opts.itemIndex };
    return item;
}
//# sourceMappingURL=transform.js.map