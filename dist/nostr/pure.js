"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyEvent = exports.finalizeEvent = exports.getPublicKey = exports.generateSecretKey = void 0;
exports.serializeEvent = serializeEvent;
exports.getEventHash = getEventHash;
const secp256k1_1 = require("../vendor/noble-curves/secp256k1");
const utils_1 = require("../vendor/noble-hashes/utils");
const sha2_1 = require("../vendor/noble-hashes/sha2");
const core_1 = require("./core");
const utils_2 = require("./utils");
class JS {
    generateSecretKey() {
        return secp256k1_1.schnorr.utils.randomSecretKey();
    }
    getPublicKey(secretKey) {
        return (0, utils_1.bytesToHex)(secp256k1_1.schnorr.getPublicKey(secretKey));
    }
    finalizeEvent(t, secretKey) {
        const event = t;
        event.pubkey = (0, utils_1.bytesToHex)(secp256k1_1.schnorr.getPublicKey(secretKey));
        event.id = getEventHash(event);
        event.sig = (0, utils_1.bytesToHex)(secp256k1_1.schnorr.sign((0, utils_1.hexToBytes)(event.id), secretKey));
        event[core_1.verifiedSymbol] = true;
        return event;
    }
    verifyEvent(event) {
        try {
            const hash = getEventHash(event);
            if (hash !== event.id) {
                event[core_1.verifiedSymbol] = false;
                return false;
            }
            const valid = secp256k1_1.schnorr.verify((0, utils_1.hexToBytes)(event.sig), (0, utils_1.hexToBytes)(hash), (0, utils_1.hexToBytes)(event.pubkey));
            event[core_1.verifiedSymbol] = valid;
            return valid;
        }
        catch {
            event[core_1.verifiedSymbol] = false;
            return false;
        }
    }
}
function serializeEvent(evt) {
    if (!(0, core_1.validateEvent)(evt))
        throw new Error("can't serialize event with wrong or missing properties");
    return JSON.stringify([0, evt.pubkey, evt.created_at, evt.kind, evt.tags, evt.content]);
}
function getEventHash(event) {
    const eventHash = (0, sha2_1.sha256)(utils_2.utf8Encoder.encode(serializeEvent(event)));
    return (0, utils_1.bytesToHex)(eventHash);
}
const i = new JS();
exports.generateSecretKey = i.generateSecretKey;
exports.getPublicKey = i.getPublicKey;
exports.finalizeEvent = i.finalizeEvent;
exports.verifyEvent = i.verifyEvent;
//# sourceMappingURL=pure.js.map