"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nostrKeyTest = nostrKeyTest;
const nostr_1 = require("../../../../nostr");
async function nostrKeyTest(credential) {
    try {
        const privateKey = (credential.data?.privateKey ?? '');
        const secretKey = (0, nostr_1.normalizeSecretKey)(privateKey);
        const npub = nostr_1.nip19.npubEncode((0, nostr_1.getPublicKey)(secretKey));
        return { status: 'OK', message: `Valid key for ${npub}` };
    }
    catch (err) {
        return { status: 'Error', message: err.message };
    }
}
//# sourceMappingURL=credentialTest.js.map