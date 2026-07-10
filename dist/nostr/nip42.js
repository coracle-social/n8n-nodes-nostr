"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeAuthEvent = makeAuthEvent;
const kinds_1 = require("./kinds");
const utils_1 = require("./utils");
function makeAuthEvent(relayURL, challenge) {
    return {
        kind: kinds_1.ClientAuth,
        created_at: (0, utils_1.nowSec)(),
        tags: [
            ['relay', relayURL],
            ['challenge', challenge],
        ],
        content: '',
    };
}
//# sourceMappingURL=nip42.js.map