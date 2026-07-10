"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConversationKey = getConversationKey;
exports.getMessageKeys = getMessageKeys;
exports.calcPaddedLen = calcPaddedLen;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
const secp256k1_1 = require("../vendor/noble-curves/secp256k1");
const hkdf_1 = require("../vendor/noble-hashes/hkdf");
const hmac_1 = require("../vendor/noble-hashes/hmac");
const sha2_1 = require("../vendor/noble-hashes/sha2");
const utils_1 = require("../vendor/noble-hashes/utils");
const index_1 = require("../vendor/scure-base/index");
const chacha_1 = require("./chacha");
const utils_2 = require("./utils");
const minPlaintextSize = 0x0001;
const maxPlaintextSize = 0xffff;
function getConversationKey(privkeyA, pubkeyB) {
    const sharedX = secp256k1_1.secp256k1.getSharedSecret(privkeyA, (0, utils_1.hexToBytes)('02' + pubkeyB)).subarray(1, 33);
    return (0, hkdf_1.extract)(sha2_1.sha256, sharedX, utils_2.utf8Encoder.encode('nip44-v2'));
}
function getMessageKeys(conversationKey, nonce) {
    const keys = (0, hkdf_1.expand)(sha2_1.sha256, conversationKey, nonce, 76);
    return {
        chacha_key: keys.subarray(0, 32),
        chacha_nonce: keys.subarray(32, 44),
        hmac_key: keys.subarray(44, 76),
    };
}
function calcPaddedLen(len) {
    if (!Number.isSafeInteger(len) || len < 1)
        throw new Error('expected positive integer');
    if (len <= 32)
        return 32;
    const nextPower = 1 << (Math.floor(Math.log2(len - 1)) + 1);
    const chunk = nextPower <= 256 ? 32 : nextPower / 8;
    return chunk * (Math.floor((len - 1) / chunk) + 1);
}
function writeU16BE(num) {
    if (!Number.isSafeInteger(num) || num < minPlaintextSize || num > maxPlaintextSize)
        throw new Error('invalid plaintext size: must be between 1 and 65535 bytes');
    const arr = new Uint8Array(2);
    new DataView(arr.buffer).setUint16(0, num, false);
    return arr;
}
function pad(plaintext) {
    const unpadded = utils_2.utf8Encoder.encode(plaintext);
    const unpaddedLen = unpadded.length;
    const prefix = writeU16BE(unpaddedLen);
    const suffix = new Uint8Array(calcPaddedLen(unpaddedLen) - unpaddedLen);
    return (0, utils_1.concatBytes)(prefix, unpadded, suffix);
}
function unpad(padded) {
    const unpaddedLen = new DataView(padded.buffer).getUint16(0);
    const unpadded = padded.subarray(2, 2 + unpaddedLen);
    if (unpaddedLen < minPlaintextSize ||
        unpaddedLen > maxPlaintextSize ||
        unpadded.length !== unpaddedLen ||
        padded.length !== 2 + calcPaddedLen(unpaddedLen))
        throw new Error('invalid padding');
    return utils_2.utf8Decoder.decode(unpadded);
}
function hmacAad(key, message, aad) {
    if (aad.length !== 32)
        throw new Error('AAD associated data must be 32 bytes');
    const combined = (0, utils_1.concatBytes)(aad, message);
    return (0, hmac_1.hmac)(sha2_1.sha256, key, combined);
}
function decodePayload(payload) {
    if (typeof payload !== 'string')
        throw new Error('payload must be a valid string');
    const plen = payload.length;
    if (plen < 132 || plen > 87472)
        throw new Error('invalid payload length: ' + plen);
    if (payload[0] === '#')
        throw new Error('unknown encryption version');
    let data;
    try {
        data = index_1.base64.decode(payload);
    }
    catch (error) {
        throw new Error('invalid base64: ' + error.message);
    }
    const dlen = data.length;
    if (dlen < 99 || dlen > 65603)
        throw new Error('invalid data length: ' + dlen);
    const vers = data[0];
    if (vers !== 2)
        throw new Error('unknown encryption version ' + vers);
    return {
        nonce: data.subarray(1, 33),
        ciphertext: data.subarray(33, -32),
        mac: data.subarray(-32),
    };
}
function encrypt(plaintext, conversationKey, nonce = (0, utils_1.randomBytes)(32)) {
    const { chacha_key, chacha_nonce, hmac_key } = getMessageKeys(conversationKey, nonce);
    const padded = pad(plaintext);
    const ciphertext = (0, chacha_1.chacha20)(chacha_key, chacha_nonce, padded);
    const mac = hmacAad(hmac_key, ciphertext, nonce);
    return index_1.base64.encode((0, utils_1.concatBytes)(new Uint8Array([2]), nonce, ciphertext, mac));
}
function decrypt(payload, conversationKey) {
    const { nonce, ciphertext, mac } = decodePayload(payload);
    const { chacha_key, chacha_nonce, hmac_key } = getMessageKeys(conversationKey, nonce);
    const calculatedMac = hmacAad(hmac_key, ciphertext, nonce);
    if (!(0, chacha_1.equalBytes)(calculatedMac, mac))
        throw new Error('invalid MAC');
    const padded = (0, chacha_1.chacha20)(chacha_key, chacha_nonce, ciphertext);
    return unpad(padded);
}
//# sourceMappingURL=nip44.js.map