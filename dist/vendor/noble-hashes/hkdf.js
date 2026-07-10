"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hkdf = void 0;
exports.extract = extract;
exports.expand = expand;
const hmac_1 = require("./hmac");
const utils_1 = require("./utils");
function extract(hash, ikm, salt) {
    (0, utils_1.ahash)(hash);
    if (salt === undefined)
        salt = new Uint8Array(hash.outputLen);
    return (0, hmac_1.hmac)(hash, (0, utils_1.toBytes)(salt), (0, utils_1.toBytes)(ikm));
}
const HKDF_COUNTER = Uint8Array.from([0]);
const EMPTY_BUFFER = Uint8Array.of();
function expand(hash, prk, info, length = 32) {
    (0, utils_1.ahash)(hash);
    (0, utils_1.anumber)(length);
    const olen = hash.outputLen;
    if (length > 255 * olen)
        throw new Error('Length should be <= 255*HashLen');
    const blocks = Math.ceil(length / olen);
    if (info === undefined)
        info = EMPTY_BUFFER;
    const okm = new Uint8Array(blocks * olen);
    const HMAC = hmac_1.hmac.create(hash, prk);
    const HMACTmp = HMAC._cloneInto();
    const T = new Uint8Array(HMAC.outputLen);
    for (let counter = 0; counter < blocks; counter++) {
        HKDF_COUNTER[0] = counter + 1;
        HMACTmp.update(counter === 0 ? EMPTY_BUFFER : T)
            .update(info)
            .update(HKDF_COUNTER)
            .digestInto(T);
        okm.set(T, olen * counter);
        HMAC._cloneInto(HMACTmp);
    }
    HMAC.destroy();
    HMACTmp.destroy();
    (0, utils_1.clean)(T, HKDF_COUNTER);
    return okm.slice(0, length);
}
const hkdf = (hash, ikm, salt, info, length) => expand(hash, extract(hash, ikm, salt), info, length);
exports.hkdf = hkdf;
//# sourceMappingURL=hkdf.js.map