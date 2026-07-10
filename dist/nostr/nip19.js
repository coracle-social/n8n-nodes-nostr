"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bech32MaxSize = void 0;
exports.decode = decode;
exports.nsecEncode = nsecEncode;
exports.npubEncode = npubEncode;
exports.noteEncode = noteEncode;
exports.nprofileEncode = nprofileEncode;
exports.neventEncode = neventEncode;
exports.naddrEncode = naddrEncode;
const utils_1 = require("../vendor/noble-hashes/utils");
const index_1 = require("../vendor/scure-base/index");
const utils_2 = require("./utils");
exports.Bech32MaxSize = 5000;
function integerToUint8Array(n) {
    const uint8Array = new Uint8Array(4);
    uint8Array[0] = (n >> 24) & 0xff;
    uint8Array[1] = (n >> 16) & 0xff;
    uint8Array[2] = (n >> 8) & 0xff;
    uint8Array[3] = n & 0xff;
    return uint8Array;
}
function decode(code) {
    const { prefix, words } = index_1.bech32.decode(code, exports.Bech32MaxSize);
    const data = new Uint8Array(index_1.bech32.fromWords(words));
    switch (prefix) {
        case 'nprofile': {
            const tlv = parseTLV(data);
            if (!tlv[0]?.[0])
                throw new Error('missing TLV 0 for nprofile');
            if (tlv[0][0].length !== 32)
                throw new Error('TLV 0 should be 32 bytes');
            return {
                type: 'nprofile',
                data: {
                    pubkey: (0, utils_1.bytesToHex)(tlv[0][0]),
                    relays: tlv[1] ? tlv[1].map(d => utils_2.utf8Decoder.decode(d)) : [],
                },
            };
        }
        case 'nevent': {
            const tlv = parseTLV(data);
            if (!tlv[0]?.[0])
                throw new Error('missing TLV 0 for nevent');
            if (tlv[0][0].length !== 32)
                throw new Error('TLV 0 should be 32 bytes');
            if (tlv[2] && tlv[2][0].length !== 32)
                throw new Error('TLV 2 should be 32 bytes');
            if (tlv[3] && tlv[3][0].length !== 4)
                throw new Error('TLV 3 should be 4 bytes');
            return {
                type: 'nevent',
                data: {
                    id: (0, utils_1.bytesToHex)(tlv[0][0]),
                    relays: tlv[1] ? tlv[1].map(d => utils_2.utf8Decoder.decode(d)) : [],
                    author: tlv[2]?.[0] ? (0, utils_1.bytesToHex)(tlv[2][0]) : undefined,
                    kind: tlv[3]?.[0] ? parseInt((0, utils_1.bytesToHex)(tlv[3][0]), 16) : undefined,
                },
            };
        }
        case 'naddr': {
            const tlv = parseTLV(data);
            if (!tlv[0]?.[0])
                throw new Error('missing TLV 0 for naddr');
            if (!tlv[2]?.[0])
                throw new Error('missing TLV 2 for naddr');
            if (tlv[2][0].length !== 32)
                throw new Error('TLV 2 should be 32 bytes');
            if (!tlv[3]?.[0])
                throw new Error('missing TLV 3 for naddr');
            if (tlv[3][0].length !== 4)
                throw new Error('TLV 3 should be 4 bytes');
            return {
                type: 'naddr',
                data: {
                    identifier: utils_2.utf8Decoder.decode(tlv[0][0]),
                    pubkey: (0, utils_1.bytesToHex)(tlv[2][0]),
                    kind: parseInt((0, utils_1.bytesToHex)(tlv[3][0]), 16),
                    relays: tlv[1] ? tlv[1].map(d => utils_2.utf8Decoder.decode(d)) : [],
                },
            };
        }
        case 'nsec':
            return { type: prefix, data };
        case 'npub':
        case 'note':
            return { type: prefix, data: (0, utils_1.bytesToHex)(data) };
        default:
            throw new Error(`unknown prefix ${prefix}`);
    }
}
function parseTLV(data) {
    const result = {};
    let rest = data;
    while (rest.length > 0) {
        const t = rest[0];
        const l = rest[1];
        const v = rest.slice(2, 2 + l);
        rest = rest.slice(2 + l);
        if (v.length < l)
            throw new Error(`not enough data to read on TLV ${t}`);
        result[t] = result[t] || [];
        result[t].push(v);
    }
    return result;
}
function encodeBech32(prefix, data) {
    const words = index_1.bech32.toWords(data);
    return index_1.bech32.encode(prefix, words, exports.Bech32MaxSize);
}
function nsecEncode(key) {
    return encodeBech32('nsec', key);
}
function npubEncode(hex) {
    return encodeBech32('npub', (0, utils_1.hexToBytes)(hex));
}
function noteEncode(hex) {
    return encodeBech32('note', (0, utils_1.hexToBytes)(hex));
}
function nprofileEncode(profile) {
    const data = encodeTLV({
        0: [(0, utils_1.hexToBytes)(profile.pubkey)],
        1: (profile.relays || []).map(url => utils_2.utf8Encoder.encode(url)),
    });
    return encodeBech32('nprofile', data);
}
function neventEncode(event) {
    let kindArray;
    if (event.kind !== undefined) {
        kindArray = integerToUint8Array(event.kind);
    }
    const data = encodeTLV({
        0: [(0, utils_1.hexToBytes)(event.id)],
        1: (event.relays || []).map(url => utils_2.utf8Encoder.encode(url)),
        2: event.author ? [(0, utils_1.hexToBytes)(event.author)] : [],
        3: kindArray ? [kindArray] : [],
    });
    return encodeBech32('nevent', data);
}
function naddrEncode(addr) {
    const kind = new ArrayBuffer(4);
    new DataView(kind).setUint32(0, addr.kind, false);
    const data = encodeTLV({
        0: [utils_2.utf8Encoder.encode(addr.identifier)],
        1: (addr.relays || []).map(url => utils_2.utf8Encoder.encode(url)),
        2: [(0, utils_1.hexToBytes)(addr.pubkey)],
        3: [new Uint8Array(kind)],
    });
    return encodeBech32('naddr', data);
}
function encodeTLV(tlv) {
    const entries = [];
    Object.entries(tlv)
        .reverse()
        .forEach(([t, vs]) => {
        vs.forEach(v => {
            const entry = new Uint8Array(v.length + 2);
            entry.set([parseInt(t)], 0);
            entry.set([v.length], 1);
            entry.set(v, 2);
            entries.push(entry);
        });
    });
    return (0, utils_1.concatBytes)(...entries);
}
//# sourceMappingURL=nip19.js.map