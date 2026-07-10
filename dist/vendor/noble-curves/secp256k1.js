"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeToCurve = exports.hashToCurve = exports.secp256k1_hasher = exports.schnorr = exports.secp256k1 = void 0;
const sha2_1 = require("../noble-hashes/sha2");
const utils_1 = require("../noble-hashes/utils");
const _shortw_utils_1 = require("./_shortw_utils");
const hash_to_curve_1 = require("./abstract/hash-to-curve");
const modular_1 = require("./abstract/modular");
const weierstrass_1 = require("./abstract/weierstrass");
const utils_2 = require("./utils");
const secp256k1_CURVE = {
    p: BigInt('0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f'),
    n: BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'),
    h: BigInt(1),
    a: BigInt(0),
    b: BigInt(7),
    Gx: BigInt('0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'),
    Gy: BigInt('0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8'),
};
const secp256k1_ENDO = {
    beta: BigInt('0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee'),
    basises: [
        [BigInt('0x3086d221a7d46bcde86c90e49284eb15'), -BigInt('0xe4437ed6010e88286f547fa90abfe4c3')],
        [BigInt('0x114ca50f7a8e2f3f657c1108d9d44cfd8'), BigInt('0x3086d221a7d46bcde86c90e49284eb15')],
    ],
};
const _0n = BigInt(0);
const _1n = BigInt(1);
const _2n = BigInt(2);
function sqrtMod(y) {
    const P = secp256k1_CURVE.p;
    const _3n = BigInt(3), _6n = BigInt(6), _11n = BigInt(11), _22n = BigInt(22);
    const _23n = BigInt(23), _44n = BigInt(44), _88n = BigInt(88);
    const b2 = (y * y * y) % P;
    const b3 = (b2 * b2 * y) % P;
    const b6 = ((0, modular_1.pow2)(b3, _3n, P) * b3) % P;
    const b9 = ((0, modular_1.pow2)(b6, _3n, P) * b3) % P;
    const b11 = ((0, modular_1.pow2)(b9, _2n, P) * b2) % P;
    const b22 = ((0, modular_1.pow2)(b11, _11n, P) * b11) % P;
    const b44 = ((0, modular_1.pow2)(b22, _22n, P) * b22) % P;
    const b88 = ((0, modular_1.pow2)(b44, _44n, P) * b44) % P;
    const b176 = ((0, modular_1.pow2)(b88, _88n, P) * b88) % P;
    const b220 = ((0, modular_1.pow2)(b176, _44n, P) * b44) % P;
    const b223 = ((0, modular_1.pow2)(b220, _3n, P) * b3) % P;
    const t1 = ((0, modular_1.pow2)(b223, _23n, P) * b22) % P;
    const t2 = ((0, modular_1.pow2)(t1, _6n, P) * b2) % P;
    const root = (0, modular_1.pow2)(t2, _2n, P);
    if (!Fpk1.eql(Fpk1.sqr(root), y))
        throw new Error('Cannot find square root');
    return root;
}
const Fpk1 = (0, modular_1.Field)(secp256k1_CURVE.p, { sqrt: sqrtMod });
exports.secp256k1 = (0, _shortw_utils_1.createCurve)({ ...secp256k1_CURVE, Fp: Fpk1, lowS: true, endo: secp256k1_ENDO }, sha2_1.sha256);
const TAGGED_HASH_PREFIXES = {};
function taggedHash(tag, ...messages) {
    let tagP = TAGGED_HASH_PREFIXES[tag];
    if (tagP === undefined) {
        const tagH = (0, sha2_1.sha256)((0, utils_2.utf8ToBytes)(tag));
        tagP = (0, utils_2.concatBytes)(tagH, tagH);
        TAGGED_HASH_PREFIXES[tag] = tagP;
    }
    return (0, sha2_1.sha256)((0, utils_2.concatBytes)(tagP, ...messages));
}
const pointToBytes = (point) => point.toBytes(true).slice(1);
const Pointk1 = (() => exports.secp256k1.Point)();
const hasEven = (y) => y % _2n === _0n;
function schnorrGetExtPubKey(priv) {
    const { Fn, BASE } = Pointk1;
    const d_ = (0, weierstrass_1._normFnElement)(Fn, priv);
    const p = BASE.multiply(d_);
    const scalar = hasEven(p.y) ? d_ : Fn.neg(d_);
    return { scalar, bytes: pointToBytes(p) };
}
function lift_x(x) {
    const Fp = Fpk1;
    if (!Fp.isValidNot0(x))
        throw new Error('invalid x: Fail if x ≥ p');
    const xx = Fp.create(x * x);
    const c = Fp.create(xx * x + BigInt(7));
    let y = Fp.sqrt(c);
    if (!hasEven(y))
        y = Fp.neg(y);
    const p = Pointk1.fromAffine({ x, y });
    p.assertValidity();
    return p;
}
const num = utils_2.bytesToNumberBE;
function challenge(...args) {
    return Pointk1.Fn.create(num(taggedHash('BIP0340/challenge', ...args)));
}
function schnorrGetPublicKey(secretKey) {
    return schnorrGetExtPubKey(secretKey).bytes;
}
function schnorrSign(message, secretKey, auxRand = (0, utils_1.randomBytes)(32)) {
    const { Fn } = Pointk1;
    const m = (0, utils_2.ensureBytes)('message', message);
    const { bytes: px, scalar: d } = schnorrGetExtPubKey(secretKey);
    const a = (0, utils_2.ensureBytes)('auxRand', auxRand, 32);
    const t = Fn.toBytes(d ^ num(taggedHash('BIP0340/aux', a)));
    const rand = taggedHash('BIP0340/nonce', t, px, m);
    const { bytes: rx, scalar: k } = schnorrGetExtPubKey(rand);
    const e = challenge(rx, px, m);
    const sig = new Uint8Array(64);
    sig.set(rx, 0);
    sig.set(Fn.toBytes(Fn.create(k + e * d)), 32);
    if (!schnorrVerify(sig, m, px))
        throw new Error('sign: Invalid signature produced');
    return sig;
}
function schnorrVerify(signature, message, publicKey) {
    const { Fn, BASE } = Pointk1;
    const sig = (0, utils_2.ensureBytes)('signature', signature, 64);
    const m = (0, utils_2.ensureBytes)('message', message);
    const pub = (0, utils_2.ensureBytes)('publicKey', publicKey, 32);
    try {
        const P = lift_x(num(pub));
        const r = num(sig.subarray(0, 32));
        if (!(0, utils_2.inRange)(r, _1n, secp256k1_CURVE.p))
            return false;
        const s = num(sig.subarray(32, 64));
        if (!(0, utils_2.inRange)(s, _1n, secp256k1_CURVE.n))
            return false;
        const e = challenge(Fn.toBytes(r), pointToBytes(P), m);
        const R = BASE.multiplyUnsafe(s).add(P.multiplyUnsafe(Fn.neg(e)));
        const { x, y } = R.toAffine();
        if (R.is0() || !hasEven(y) || x !== r)
            return false;
        return true;
    }
    catch (error) {
        return false;
    }
}
exports.schnorr = (() => {
    const size = 32;
    const seedLength = 48;
    const randomSecretKey = (seed = (0, utils_1.randomBytes)(seedLength)) => {
        return (0, modular_1.mapHashToField)(seed, secp256k1_CURVE.n);
    };
    exports.secp256k1.utils.randomSecretKey;
    function keygen(seed) {
        const secretKey = randomSecretKey(seed);
        return { secretKey, publicKey: schnorrGetPublicKey(secretKey) };
    }
    return {
        keygen,
        getPublicKey: schnorrGetPublicKey,
        sign: schnorrSign,
        verify: schnorrVerify,
        Point: Pointk1,
        utils: {
            randomSecretKey: randomSecretKey,
            randomPrivateKey: randomSecretKey,
            taggedHash,
            lift_x,
            pointToBytes,
            numberToBytesBE: utils_2.numberToBytesBE,
            bytesToNumberBE: utils_2.bytesToNumberBE,
            mod: modular_1.mod,
        },
        lengths: {
            secretKey: size,
            publicKey: size,
            publicKeyHasPrefix: false,
            signature: size * 2,
            seed: seedLength,
        },
    };
})();
const isoMap = (() => (0, hash_to_curve_1.isogenyMap)(Fpk1, [
    [
        '0x8e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38daaaaa8c7',
        '0x7d3d4c80bc321d5b9f315cea7fd44c5d595d2fc0bf63b92dfff1044f17c6581',
        '0x534c328d23f234e6e2a413deca25caece4506144037c40314ecbd0b53d9dd262',
        '0x8e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38daaaaa88c',
    ],
    [
        '0xd35771193d94918a9ca34ccbb7b640dd86cd409542f8487d9fe6b745781eb49b',
        '0xedadc6f64383dc1df7c4b2d51b54225406d36b641f5e41bbc52a56612a8c6d14',
        '0x0000000000000000000000000000000000000000000000000000000000000001',
    ],
    [
        '0x4bda12f684bda12f684bda12f684bda12f684bda12f684bda12f684b8e38e23c',
        '0xc75e0c32d5cb7c0fa9d0a54b12a0a6d5647ab046d686da6fdffc90fc201d71a3',
        '0x29a6194691f91a73715209ef6512e576722830a201be2018a765e85a9ecee931',
        '0x2f684bda12f684bda12f684bda12f684bda12f684bda12f684bda12f38e38d84',
    ],
    [
        '0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffff93b',
        '0x7a06534bb8bdb49fd5e9e6632722c2989467c1bfc8e8d978dfb425d2685c2573',
        '0x6484aa716545ca2cf3a70c3fa8fe337e0a3d21162f0d6299a7bf8192bfd2a76f',
        '0x0000000000000000000000000000000000000000000000000000000000000001',
    ],
].map((i) => i.map((j) => BigInt(j)))))();
const mapSWU = (() => (0, weierstrass_1.mapToCurveSimpleSWU)(Fpk1, {
    A: BigInt('0x3f8731abdd661adca08a5558f0f5d272e953d363cb6f0e5d405447c01a444533'),
    B: BigInt('1771'),
    Z: Fpk1.create(BigInt('-11')),
}))();
exports.secp256k1_hasher = (() => (0, hash_to_curve_1.createHasher)(exports.secp256k1.Point, (scalars) => {
    const { x, y } = mapSWU(Fpk1.create(scalars[0]));
    return isoMap(x, y);
}, {
    DST: 'secp256k1_XMD:SHA-256_SSWU_RO_',
    encodeDST: 'secp256k1_XMD:SHA-256_SSWU_NU_',
    p: Fpk1.ORDER,
    m: 1,
    k: 128,
    expand: 'xmd',
    hash: sha2_1.sha256,
}))();
exports.hashToCurve = (() => exports.secp256k1_hasher.hashToCurve)();
exports.encodeToCurve = (() => exports.secp256k1_hasher.encodeToCurve)();
//# sourceMappingURL=secp256k1.js.map