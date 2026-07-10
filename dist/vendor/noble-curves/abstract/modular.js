"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNegativeLE = void 0;
exports.mod = mod;
exports.pow = pow;
exports.pow2 = pow2;
exports.invert = invert;
exports.tonelliShanks = tonelliShanks;
exports.FpSqrt = FpSqrt;
exports.validateField = validateField;
exports.FpPow = FpPow;
exports.FpInvertBatch = FpInvertBatch;
exports.FpDiv = FpDiv;
exports.FpLegendre = FpLegendre;
exports.FpIsSquare = FpIsSquare;
exports.nLength = nLength;
exports.Field = Field;
exports.FpSqrtOdd = FpSqrtOdd;
exports.FpSqrtEven = FpSqrtEven;
exports.hashToPrivateScalar = hashToPrivateScalar;
exports.getFieldBytesLength = getFieldBytesLength;
exports.getMinHashLength = getMinHashLength;
exports.mapHashToField = mapHashToField;
const utils_1 = require("../utils");
const _0n = BigInt(0), _1n = BigInt(1), _2n = BigInt(2), _3n = BigInt(3);
const _4n = BigInt(4), _5n = BigInt(5), _7n = BigInt(7);
const _8n = BigInt(8), _9n = BigInt(9), _16n = BigInt(16);
function mod(a, b) {
    const result = a % b;
    return result >= _0n ? result : b + result;
}
function pow(num, power, modulo) {
    return FpPow(Field(modulo), num, power);
}
function pow2(x, power, modulo) {
    let res = x;
    while (power-- > _0n) {
        res *= res;
        res %= modulo;
    }
    return res;
}
function invert(number, modulo) {
    if (number === _0n)
        throw new Error('invert: expected non-zero number');
    if (modulo <= _0n)
        throw new Error('invert: expected positive modulus, got ' + modulo);
    let a = mod(number, modulo);
    let b = modulo;
    let x = _0n, y = _1n, u = _1n, v = _0n;
    while (a !== _0n) {
        const q = b / a;
        const r = b % a;
        const m = x - u * q;
        const n = y - v * q;
        b = a, a = r, x = u, y = v, u = m, v = n;
    }
    const gcd = b;
    if (gcd !== _1n)
        throw new Error('invert: does not exist');
    return mod(x, modulo);
}
function assertIsSquare(Fp, root, n) {
    if (!Fp.eql(Fp.sqr(root), n))
        throw new Error('Cannot find square root');
}
function sqrt3mod4(Fp, n) {
    const p1div4 = (Fp.ORDER + _1n) / _4n;
    const root = Fp.pow(n, p1div4);
    assertIsSquare(Fp, root, n);
    return root;
}
function sqrt5mod8(Fp, n) {
    const p5div8 = (Fp.ORDER - _5n) / _8n;
    const n2 = Fp.mul(n, _2n);
    const v = Fp.pow(n2, p5div8);
    const nv = Fp.mul(n, v);
    const i = Fp.mul(Fp.mul(nv, _2n), v);
    const root = Fp.mul(nv, Fp.sub(i, Fp.ONE));
    assertIsSquare(Fp, root, n);
    return root;
}
function sqrt9mod16(P) {
    const Fp_ = Field(P);
    const tn = tonelliShanks(P);
    const c1 = tn(Fp_, Fp_.neg(Fp_.ONE));
    const c2 = tn(Fp_, c1);
    const c3 = tn(Fp_, Fp_.neg(c1));
    const c4 = (P + _7n) / _16n;
    return (Fp, n) => {
        let tv1 = Fp.pow(n, c4);
        let tv2 = Fp.mul(tv1, c1);
        const tv3 = Fp.mul(tv1, c2);
        const tv4 = Fp.mul(tv1, c3);
        const e1 = Fp.eql(Fp.sqr(tv2), n);
        const e2 = Fp.eql(Fp.sqr(tv3), n);
        tv1 = Fp.cmov(tv1, tv2, e1);
        tv2 = Fp.cmov(tv4, tv3, e2);
        const e3 = Fp.eql(Fp.sqr(tv2), n);
        const root = Fp.cmov(tv1, tv2, e3);
        assertIsSquare(Fp, root, n);
        return root;
    };
}
function tonelliShanks(P) {
    if (P < _3n)
        throw new Error('sqrt is not defined for small field');
    let Q = P - _1n;
    let S = 0;
    while (Q % _2n === _0n) {
        Q /= _2n;
        S++;
    }
    let Z = _2n;
    const _Fp = Field(P);
    while (FpLegendre(_Fp, Z) === 1) {
        if (Z++ > 1000)
            throw new Error('Cannot find square root: probably non-prime P');
    }
    if (S === 1)
        return sqrt3mod4;
    let cc = _Fp.pow(Z, Q);
    const Q1div2 = (Q + _1n) / _2n;
    return function tonelliSlow(Fp, n) {
        if (Fp.is0(n))
            return n;
        if (FpLegendre(Fp, n) !== 1)
            throw new Error('Cannot find square root');
        let M = S;
        let c = Fp.mul(Fp.ONE, cc);
        let t = Fp.pow(n, Q);
        let R = Fp.pow(n, Q1div2);
        while (!Fp.eql(t, Fp.ONE)) {
            if (Fp.is0(t))
                return Fp.ZERO;
            let i = 1;
            let t_tmp = Fp.sqr(t);
            while (!Fp.eql(t_tmp, Fp.ONE)) {
                i++;
                t_tmp = Fp.sqr(t_tmp);
                if (i === M)
                    throw new Error('Cannot find square root');
            }
            const exponent = _1n << BigInt(M - i - 1);
            const b = Fp.pow(c, exponent);
            M = i;
            c = Fp.sqr(b);
            t = Fp.mul(t, c);
            R = Fp.mul(R, b);
        }
        return R;
    };
}
function FpSqrt(P) {
    if (P % _4n === _3n)
        return sqrt3mod4;
    if (P % _8n === _5n)
        return sqrt5mod8;
    if (P % _16n === _9n)
        return sqrt9mod16(P);
    return tonelliShanks(P);
}
const isNegativeLE = (num, modulo) => (mod(num, modulo) & _1n) === _1n;
exports.isNegativeLE = isNegativeLE;
const FIELD_FIELDS = [
    'create', 'isValid', 'is0', 'neg', 'inv', 'sqrt', 'sqr',
    'eql', 'add', 'sub', 'mul', 'pow', 'div',
    'addN', 'subN', 'mulN', 'sqrN'
];
function validateField(field) {
    const initial = {
        ORDER: 'bigint',
        MASK: 'bigint',
        BYTES: 'number',
        BITS: 'number',
    };
    const opts = FIELD_FIELDS.reduce((map, val) => {
        map[val] = 'function';
        return map;
    }, initial);
    (0, utils_1._validateObject)(field, opts);
    return field;
}
function FpPow(Fp, num, power) {
    if (power < _0n)
        throw new Error('invalid exponent, negatives unsupported');
    if (power === _0n)
        return Fp.ONE;
    if (power === _1n)
        return num;
    let p = Fp.ONE;
    let d = num;
    while (power > _0n) {
        if (power & _1n)
            p = Fp.mul(p, d);
        d = Fp.sqr(d);
        power >>= _1n;
    }
    return p;
}
function FpInvertBatch(Fp, nums, passZero = false) {
    const inverted = new Array(nums.length).fill(passZero ? Fp.ZERO : undefined);
    const multipliedAcc = nums.reduce((acc, num, i) => {
        if (Fp.is0(num))
            return acc;
        inverted[i] = acc;
        return Fp.mul(acc, num);
    }, Fp.ONE);
    const invertedAcc = Fp.inv(multipliedAcc);
    nums.reduceRight((acc, num, i) => {
        if (Fp.is0(num))
            return acc;
        inverted[i] = Fp.mul(acc, inverted[i]);
        return Fp.mul(acc, num);
    }, invertedAcc);
    return inverted;
}
function FpDiv(Fp, lhs, rhs) {
    return Fp.mul(lhs, typeof rhs === 'bigint' ? invert(rhs, Fp.ORDER) : Fp.inv(rhs));
}
function FpLegendre(Fp, n) {
    const p1mod2 = (Fp.ORDER - _1n) / _2n;
    const powered = Fp.pow(n, p1mod2);
    const yes = Fp.eql(powered, Fp.ONE);
    const zero = Fp.eql(powered, Fp.ZERO);
    const no = Fp.eql(powered, Fp.neg(Fp.ONE));
    if (!yes && !zero && !no)
        throw new Error('invalid Legendre symbol result');
    return yes ? 1 : zero ? 0 : -1;
}
function FpIsSquare(Fp, n) {
    const l = FpLegendre(Fp, n);
    return l === 1;
}
function nLength(n, nBitLength) {
    if (nBitLength !== undefined)
        (0, utils_1.anumber)(nBitLength);
    const _nBitLength = nBitLength !== undefined ? nBitLength : n.toString(2).length;
    const nByteLength = Math.ceil(_nBitLength / 8);
    return { nBitLength: _nBitLength, nByteLength };
}
function Field(ORDER, bitLenOrOpts, isLE = false, opts = {}) {
    if (ORDER <= _0n)
        throw new Error('invalid field: expected ORDER > 0, got ' + ORDER);
    let _nbitLength = undefined;
    let _sqrt = undefined;
    let modFromBytes = false;
    let allowedLengths = undefined;
    if (typeof bitLenOrOpts === 'object' && bitLenOrOpts != null) {
        if (opts.sqrt || isLE)
            throw new Error('cannot specify opts in two arguments');
        const _opts = bitLenOrOpts;
        if (_opts.BITS)
            _nbitLength = _opts.BITS;
        if (_opts.sqrt)
            _sqrt = _opts.sqrt;
        if (typeof _opts.isLE === 'boolean')
            isLE = _opts.isLE;
        if (typeof _opts.modFromBytes === 'boolean')
            modFromBytes = _opts.modFromBytes;
        allowedLengths = _opts.allowedLengths;
    }
    else {
        if (typeof bitLenOrOpts === 'number')
            _nbitLength = bitLenOrOpts;
        if (opts.sqrt)
            _sqrt = opts.sqrt;
    }
    const { nBitLength: BITS, nByteLength: BYTES } = nLength(ORDER, _nbitLength);
    if (BYTES > 2048)
        throw new Error('invalid field: expected ORDER of <= 2048 bytes');
    let sqrtP;
    const f = Object.freeze({
        ORDER,
        isLE,
        BITS,
        BYTES,
        MASK: (0, utils_1.bitMask)(BITS),
        ZERO: _0n,
        ONE: _1n,
        allowedLengths: allowedLengths,
        create: (num) => mod(num, ORDER),
        isValid: (num) => {
            if (typeof num !== 'bigint')
                throw new Error('invalid field element: expected bigint, got ' + typeof num);
            return _0n <= num && num < ORDER;
        },
        is0: (num) => num === _0n,
        isValidNot0: (num) => !f.is0(num) && f.isValid(num),
        isOdd: (num) => (num & _1n) === _1n,
        neg: (num) => mod(-num, ORDER),
        eql: (lhs, rhs) => lhs === rhs,
        sqr: (num) => mod(num * num, ORDER),
        add: (lhs, rhs) => mod(lhs + rhs, ORDER),
        sub: (lhs, rhs) => mod(lhs - rhs, ORDER),
        mul: (lhs, rhs) => mod(lhs * rhs, ORDER),
        pow: (num, power) => FpPow(f, num, power),
        div: (lhs, rhs) => mod(lhs * invert(rhs, ORDER), ORDER),
        sqrN: (num) => num * num,
        addN: (lhs, rhs) => lhs + rhs,
        subN: (lhs, rhs) => lhs - rhs,
        mulN: (lhs, rhs) => lhs * rhs,
        inv: (num) => invert(num, ORDER),
        sqrt: _sqrt ||
            ((n) => {
                if (!sqrtP)
                    sqrtP = FpSqrt(ORDER);
                return sqrtP(f, n);
            }),
        toBytes: (num) => (isLE ? (0, utils_1.numberToBytesLE)(num, BYTES) : (0, utils_1.numberToBytesBE)(num, BYTES)),
        fromBytes: (bytes, skipValidation = true) => {
            if (allowedLengths) {
                if (!allowedLengths.includes(bytes.length) || bytes.length > BYTES) {
                    throw new Error('Field.fromBytes: expected ' + allowedLengths + ' bytes, got ' + bytes.length);
                }
                const padded = new Uint8Array(BYTES);
                padded.set(bytes, isLE ? 0 : padded.length - bytes.length);
                bytes = padded;
            }
            if (bytes.length !== BYTES)
                throw new Error('Field.fromBytes: expected ' + BYTES + ' bytes, got ' + bytes.length);
            let scalar = isLE ? (0, utils_1.bytesToNumberLE)(bytes) : (0, utils_1.bytesToNumberBE)(bytes);
            if (modFromBytes)
                scalar = mod(scalar, ORDER);
            if (!skipValidation)
                if (!f.isValid(scalar))
                    throw new Error('invalid field element: outside of range 0..ORDER');
            return scalar;
        },
        invertBatch: (lst) => FpInvertBatch(f, lst),
        cmov: (a, b, c) => (c ? b : a),
    });
    return Object.freeze(f);
}
function FpSqrtOdd(Fp, elm) {
    if (!Fp.isOdd)
        throw new Error("Field doesn't have isOdd");
    const root = Fp.sqrt(elm);
    return Fp.isOdd(root) ? root : Fp.neg(root);
}
function FpSqrtEven(Fp, elm) {
    if (!Fp.isOdd)
        throw new Error("Field doesn't have isOdd");
    const root = Fp.sqrt(elm);
    return Fp.isOdd(root) ? Fp.neg(root) : root;
}
function hashToPrivateScalar(hash, groupOrder, isLE = false) {
    hash = (0, utils_1.ensureBytes)('privateHash', hash);
    const hashLen = hash.length;
    const minLen = nLength(groupOrder).nByteLength + 8;
    if (minLen < 24 || hashLen < minLen || hashLen > 1024)
        throw new Error('hashToPrivateScalar: expected ' + minLen + '-1024 bytes of input, got ' + hashLen);
    const num = isLE ? (0, utils_1.bytesToNumberLE)(hash) : (0, utils_1.bytesToNumberBE)(hash);
    return mod(num, groupOrder - _1n) + _1n;
}
function getFieldBytesLength(fieldOrder) {
    if (typeof fieldOrder !== 'bigint')
        throw new Error('field order must be bigint');
    const bitLength = fieldOrder.toString(2).length;
    return Math.ceil(bitLength / 8);
}
function getMinHashLength(fieldOrder) {
    const length = getFieldBytesLength(fieldOrder);
    return length + Math.ceil(length / 2);
}
function mapHashToField(key, fieldOrder, isLE = false) {
    const len = key.length;
    const fieldLen = getFieldBytesLength(fieldOrder);
    const minLen = getMinHashLength(fieldOrder);
    if (len < 16 || len < minLen || len > 1024)
        throw new Error('expected ' + minLen + '-1024 bytes of input, got ' + len);
    const num = isLE ? (0, utils_1.bytesToNumberLE)(key) : (0, utils_1.bytesToNumberBE)(key);
    const reduced = mod(num, fieldOrder - _1n) + _1n;
    return isLE ? (0, utils_1.numberToBytesLE)(reduced, fieldLen) : (0, utils_1.numberToBytesBE)(reduced, fieldLen);
}
//# sourceMappingURL=modular.js.map