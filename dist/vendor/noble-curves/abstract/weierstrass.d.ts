import { type CHash, type Hex, type PrivKey } from '../utils';
import { type AffinePoint, type BasicCurve, type CurveLengths, type CurvePoint, type CurvePointCons } from './curve';
import { type IField, type NLength } from './modular';
export type { AffinePoint };
export type HmacFnSync = (key: Uint8Array, ...messages: Uint8Array[]) => Uint8Array;
type EndoBasis = [[bigint, bigint], [bigint, bigint]];
export type EndomorphismOpts = {
    beta: bigint;
    basises?: EndoBasis;
    splitScalar?: (k: bigint) => {
        k1neg: boolean;
        k1: bigint;
        k2neg: boolean;
        k2: bigint;
    };
};
export type ScalarEndoParts = {
    k1neg: boolean;
    k1: bigint;
    k2neg: boolean;
    k2: bigint;
};
export declare function _splitEndoScalar(k: bigint, basis: EndoBasis, n: bigint): ScalarEndoParts;
export type ECDSASigFormat = 'compact' | 'recovered' | 'der';
export type ECDSARecoverOpts = {
    prehash?: boolean;
};
export type ECDSAVerifyOpts = {
    prehash?: boolean;
    lowS?: boolean;
    format?: ECDSASigFormat;
};
export type ECDSASignOpts = {
    prehash?: boolean;
    lowS?: boolean;
    format?: ECDSASigFormat;
    extraEntropy?: Uint8Array | boolean;
};
export interface WeierstrassPoint<T> extends CurvePoint<T, WeierstrassPoint<T>> {
    readonly X: T;
    readonly Y: T;
    readonly Z: T;
    get x(): T;
    get y(): T;
    toBytes(isCompressed?: boolean): Uint8Array;
    toHex(isCompressed?: boolean): string;
    readonly px: T;
    readonly py: T;
    readonly pz: T;
    toRawBytes(isCompressed?: boolean): Uint8Array;
    multiplyAndAddUnsafe(Q: WeierstrassPoint<T>, a: bigint, b: bigint): WeierstrassPoint<T> | undefined;
    hasEvenY(): boolean;
    _setWindowSize(windowSize: number): void;
}
export interface WeierstrassPointCons<T> extends CurvePointCons<WeierstrassPoint<T>> {
    new (X: T, Y: T, Z: T): WeierstrassPoint<T>;
    CURVE(): WeierstrassOpts<T>;
    fromPrivateKey(privateKey: PrivKey): WeierstrassPoint<T>;
    normalizeZ(points: WeierstrassPoint<T>[]): WeierstrassPoint<T>[];
    msm(points: WeierstrassPoint<T>[], scalars: bigint[]): WeierstrassPoint<T>;
}
export type WeierstrassOpts<T> = Readonly<{
    p: bigint;
    n: bigint;
    h: bigint;
    a: T;
    b: T;
    Gx: T;
    Gy: T;
}>;
export type WeierstrassExtraOpts<T> = Partial<{
    Fp: IField<T>;
    Fn: IField<bigint>;
    allowInfinityPoint: boolean;
    endo: EndomorphismOpts;
    isTorsionFree: (c: WeierstrassPointCons<T>, point: WeierstrassPoint<T>) => boolean;
    clearCofactor: (c: WeierstrassPointCons<T>, point: WeierstrassPoint<T>) => WeierstrassPoint<T>;
    fromBytes: (bytes: Uint8Array) => AffinePoint<T>;
    toBytes: (c: WeierstrassPointCons<T>, point: WeierstrassPoint<T>, isCompressed: boolean) => Uint8Array;
}>;
export type ECDSAOpts = Partial<{
    lowS: boolean;
    hmac: HmacFnSync;
    randomBytes: (bytesLength?: number) => Uint8Array;
    bits2int: (bytes: Uint8Array) => bigint;
    bits2int_modN: (bytes: Uint8Array) => bigint;
}>;
export interface ECDH {
    keygen: (seed?: Uint8Array) => {
        secretKey: Uint8Array;
        publicKey: Uint8Array;
    };
    getPublicKey: (secretKey: PrivKey, isCompressed?: boolean) => Uint8Array;
    getSharedSecret: (secretKeyA: PrivKey, publicKeyB: Hex, isCompressed?: boolean) => Uint8Array;
    Point: WeierstrassPointCons<bigint>;
    utils: {
        isValidSecretKey: (secretKey: PrivKey) => boolean;
        isValidPublicKey: (publicKey: Uint8Array, isCompressed?: boolean) => boolean;
        randomSecretKey: (seed?: Uint8Array) => Uint8Array;
        randomPrivateKey: (seed?: Uint8Array) => Uint8Array;
        isValidPrivateKey: (secretKey: PrivKey) => boolean;
        normPrivateKeyToScalar: (key: PrivKey) => bigint;
        precompute: (windowSize?: number, point?: WeierstrassPoint<bigint>) => WeierstrassPoint<bigint>;
    };
    lengths: CurveLengths;
}
export interface ECDSA extends ECDH {
    sign: (message: Hex, secretKey: PrivKey, opts?: ECDSASignOpts) => ECDSASigRecovered;
    verify: (signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array, opts?: ECDSAVerifyOpts) => boolean;
    recoverPublicKey(signature: Uint8Array, message: Uint8Array, opts?: ECDSARecoverOpts): Uint8Array;
    Signature: ECDSASignatureCons;
}
export declare class DERErr extends Error {
    constructor(m?: string);
}
export type IDER = {
    Err: typeof DERErr;
    _tlv: {
        encode: (tag: number, data: string) => string;
        decode(tag: number, data: Uint8Array): {
            v: Uint8Array;
            l: Uint8Array;
        };
    };
    _int: {
        encode(num: bigint): string;
        decode(data: Uint8Array): bigint;
    };
    toSig(hex: string | Uint8Array): {
        r: bigint;
        s: bigint;
    };
    hexFromSig(sig: {
        r: bigint;
        s: bigint;
    }): string;
};
export declare const DER: IDER;
export declare function _normFnElement(Fn: IField<bigint>, key: PrivKey): bigint;
export declare function weierstrassN<T>(params: WeierstrassOpts<T>, extraOpts?: WeierstrassExtraOpts<T>): WeierstrassPointCons<T>;
export interface ECDSASignature {
    readonly r: bigint;
    readonly s: bigint;
    readonly recovery?: number;
    addRecoveryBit(recovery: number): ECDSASigRecovered;
    hasHighS(): boolean;
    toBytes(format?: string): Uint8Array;
    toHex(format?: string): string;
    assertValidity(): void;
    normalizeS(): ECDSASignature;
    recoverPublicKey(msgHash: Hex): WeierstrassPoint<bigint>;
    toCompactRawBytes(): Uint8Array;
    toCompactHex(): string;
    toDERRawBytes(): Uint8Array;
    toDERHex(): string;
}
export type ECDSASigRecovered = ECDSASignature & {
    readonly recovery: number;
};
export type ECDSASignatureCons = {
    new (r: bigint, s: bigint, recovery?: number): ECDSASignature;
    fromBytes(bytes: Uint8Array, format?: ECDSASigFormat): ECDSASignature;
    fromHex(hex: string, format?: ECDSASigFormat): ECDSASignature;
    fromCompact(hex: Hex): ECDSASignature;
    fromDER(hex: Hex): ECDSASignature;
};
export declare function SWUFpSqrtRatio<T>(Fp: IField<T>, Z: T): (u: T, v: T) => {
    isValid: boolean;
    value: T;
};
export declare function mapToCurveSimpleSWU<T>(Fp: IField<T>, opts: {
    A: T;
    B: T;
    Z: T;
}): (u: T) => {
    x: T;
    y: T;
};
export declare function ecdh(Point: WeierstrassPointCons<bigint>, ecdhOpts?: {
    randomBytes?: (bytesLength?: number) => Uint8Array;
}): ECDH;
export declare function ecdsa(Point: WeierstrassPointCons<bigint>, hash: CHash, ecdsaOpts?: ECDSAOpts): ECDSA;
export type SignatureType = ECDSASignature;
export type RecoveredSignatureType = ECDSASigRecovered;
export type SignatureLike = {
    r: bigint;
    s: bigint;
};
export type ECDSAExtraEntropy = Hex | boolean;
export type Entropy = Hex | boolean;
export type BasicWCurve<T> = BasicCurve<T> & {
    a: T;
    b: T;
    allowedPrivateKeyLengths?: readonly number[];
    wrapPrivateKey?: boolean;
    endo?: EndomorphismOpts;
    isTorsionFree?: (c: WeierstrassPointCons<T>, point: WeierstrassPoint<T>) => boolean;
    clearCofactor?: (c: WeierstrassPointCons<T>, point: WeierstrassPoint<T>) => WeierstrassPoint<T>;
};
export type SignOpts = ECDSASignOpts;
export type VerOpts = ECDSAVerifyOpts;
export type ProjPointType<T> = WeierstrassPoint<T>;
export type ProjConstructor<T> = WeierstrassPointCons<T>;
export type SignatureConstructor = ECDSASignatureCons;
export type CurvePointsType<T> = BasicWCurve<T> & {
    fromBytes?: (bytes: Uint8Array) => AffinePoint<T>;
    toBytes?: (c: WeierstrassPointCons<T>, point: WeierstrassPoint<T>, isCompressed: boolean) => Uint8Array;
};
export type CurvePointsTypeWithLength<T> = Readonly<CurvePointsType<T> & Partial<NLength>>;
export type CurvePointsRes<T> = {
    Point: WeierstrassPointCons<T>;
    CURVE: CurvePointsType<T>;
    ProjectivePoint: WeierstrassPointCons<T>;
    normPrivateKeyToScalar: (key: PrivKey) => bigint;
    weierstrassEquation: (x: T) => T;
    isWithinCurveOrder: (num: bigint) => boolean;
};
export type PubKey = Hex | WeierstrassPoint<bigint>;
export type CurveType = BasicWCurve<bigint> & {
    hash: CHash;
    hmac?: HmacFnSync;
    randomBytes?: (bytesLength?: number) => Uint8Array;
    lowS?: boolean;
    bits2int?: (bytes: Uint8Array) => bigint;
    bits2int_modN?: (bytes: Uint8Array) => bigint;
};
export type CurveFn = {
    CURVE: CurvePointsType<bigint>;
    keygen: ECDSA['keygen'];
    getPublicKey: ECDSA['getPublicKey'];
    getSharedSecret: ECDSA['getSharedSecret'];
    sign: ECDSA['sign'];
    verify: ECDSA['verify'];
    Point: WeierstrassPointCons<bigint>;
    ProjectivePoint: WeierstrassPointCons<bigint>;
    Signature: ECDSASignatureCons;
    utils: ECDSA['utils'];
    lengths: ECDSA['lengths'];
};
export declare function weierstrassPoints<T>(c: CurvePointsTypeWithLength<T>): CurvePointsRes<T>;
export type WsPointComposed<T> = {
    CURVE: WeierstrassOpts<T>;
    curveOpts: WeierstrassExtraOpts<T>;
};
export type WsComposed = {
    CURVE: WeierstrassOpts<bigint>;
    hash: CHash;
    curveOpts: WeierstrassExtraOpts<bigint>;
    ecdsaOpts: ECDSAOpts;
};
export declare function _legacyHelperEquat<T>(Fp: IField<T>, a: T, b: T): (x: T) => T;
export declare function weierstrass(c: CurveType): CurveFn;
