"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitList = splitList;
exports.toUnixSeconds = toUnixSeconds;
exports.normalizeOrThrow = normalizeOrThrow;
exports.parseJsonParam = parseJsonParam;
const n8n_workflow_1 = require("n8n-workflow");
const context_1 = require("./context");
function splitList(raw) {
    return (raw ?? '')
        .split(/[\s,]+/)
        .map((token) => token.trim())
        .filter(Boolean);
}
function toUnixSeconds(value) {
    if (value === undefined || value === null || value === '')
        return undefined;
    const ms = typeof value === 'number' ? value : Date.parse(String(value));
    if (Number.isNaN(ms))
        return undefined;
    return Math.floor(ms / 1000);
}
function normalizeOrThrow(fns, normalize, value, itemIndex) {
    try {
        return normalize(value);
    }
    catch (err) {
        throw new n8n_workflow_1.NodeOperationError(fns.getNode(), err.message, { itemIndex });
    }
}
function parseJsonParam(fns, name, fallback, itemIndex) {
    const param = (0, context_1.paramReader)(fns, itemIndex);
    const raw = param(name, fallback);
    if (typeof raw !== 'string')
        return raw;
    try {
        return JSON.parse(raw);
    }
    catch {
        const label = name.charAt(0).toUpperCase() + name.slice(1);
        throw new n8n_workflow_1.NodeOperationError(fns.getNode(), `${label} is not valid JSON.`, { itemIndex });
    }
}
//# sourceMappingURL=params.js.map