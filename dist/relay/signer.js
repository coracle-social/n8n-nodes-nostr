"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeSecretKeySigner = makeSecretKeySigner;
const nostr_1 = require("../nostr");
function makeSecretKeySigner(secretKey) {
    return {
        getPublicKey: () => (0, nostr_1.getPublicKey)(secretKey),
        signEvent: (template) => (0, nostr_1.finalizeEvent)({ ...template }, secretKey),
    };
}
//# sourceMappingURL=signer.js.map