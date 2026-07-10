"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hexToBytes = exports.bytesToHex = exports.utf8Encoder = exports.utf8Decoder = void 0;
exports.nowSec = nowSec;
exports.utf8Decoder = new TextDecoder('utf-8');
exports.utf8Encoder = new TextEncoder();
var utils_1 = require("../vendor/noble-hashes/utils");
Object.defineProperty(exports, "bytesToHex", { enumerable: true, get: function () { return utils_1.bytesToHex; } });
Object.defineProperty(exports, "hexToBytes", { enumerable: true, get: function () { return utils_1.hexToBytes; } });
function nowSec() {
    return Math.floor(Date.now() / 1000);
}
//# sourceMappingURL=utils.js.map