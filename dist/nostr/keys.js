"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSecretKey = normalizeSecretKey;
exports.normalizePubkey = normalizePubkey;
exports.normalizeId = normalizeId;
const utils_1 = require("../vendor/noble-hashes/utils");
const nip19_1 = require("./nip19");
const HEX64 = /^[0-9a-fA-F]{64}$/;
function tryDecode(code) {
    try {
        return (0, nip19_1.decode)(code);
    }
    catch {
        return undefined;
    }
}
function normalizeSecretKey(input) {
    const value = (input ?? '').trim();
    if (HEX64.test(value))
        return (0, utils_1.hexToBytes)(value.toLowerCase());
    if (value.startsWith('nsec1')) {
        const decoded = tryDecode(value);
        if (decoded?.type === 'nsec')
            return decoded.data;
    }
    throw new Error('Invalid secret key: expected an nsec1… bech32 string or a 64-character hex string.');
}
function normalizePubkey(input) {
    const value = (input ?? '').trim();
    if (HEX64.test(value))
        return value.toLowerCase();
    if (value.startsWith('npub1')) {
        const decoded = tryDecode(value);
        if (decoded?.type === 'npub')
            return decoded.data;
    }
    if (value.startsWith('nprofile1')) {
        const decoded = tryDecode(value);
        if (decoded?.type === 'nprofile')
            return decoded.data.pubkey;
    }
    throw new Error('Invalid public key: expected an npub1…/nprofile1… bech32 string or a 64-character hex string.');
}
function normalizeId(input) {
    const value = (input ?? '').trim();
    if (HEX64.test(value))
        return value.toLowerCase();
    if (value.startsWith('note1')) {
        const decoded = tryDecode(value);
        if (decoded?.type === 'note')
            return decoded.data;
    }
    if (value.startsWith('nevent1')) {
        const decoded = tryDecode(value);
        if (decoded?.type === 'nevent')
            return decoded.data.id;
    }
    throw new Error('Invalid event id: expected a note1…/nevent1… bech32 string or a 64-character hex string.');
}
//# sourceMappingURL=keys.js.map