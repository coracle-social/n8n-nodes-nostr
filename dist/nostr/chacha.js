"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chacha20 = chacha20;
exports.equalBytes = equalBytes;
const node_crypto_1 = require("node:crypto");
function chacha20(key, nonce12, data) {
    const iv = new Uint8Array(16);
    iv.set(nonce12, 4);
    const c = (0, node_crypto_1.createCipheriv)('chacha20', key, iv);
    return new Uint8Array(Buffer.concat([c.update(data), c.final()]));
}
function equalBytes(a, b) {
    if (a.length !== b.length)
        return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++)
        diff |= a[i] ^ b[i];
    return diff === 0;
}
//# sourceMappingURL=chacha.js.map