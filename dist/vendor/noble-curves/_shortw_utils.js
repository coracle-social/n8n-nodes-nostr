"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHash = getHash;
exports.createCurve = createCurve;
const weierstrass_1 = require("./abstract/weierstrass");
function getHash(hash) {
    return { hash };
}
function createCurve(curveDef, defHash) {
    const create = (hash) => (0, weierstrass_1.weierstrass)({ ...curveDef, hash: hash });
    return { ...create(defHash), create };
}
//# sourceMappingURL=_shortw_utils.js.map