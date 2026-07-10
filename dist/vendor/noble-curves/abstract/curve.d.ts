import { type IField } from './modular';
export type AffinePoint<T> = {
    x: T;
    y: T;
} & {
    Z?: never;
};
export interface Group<T extends Group<T>> {
    double(): T;
    negate(): T;
    add(other: T): T;
    subtract(other: T): T;
    equals(other: T): boolean;
    multiply(scalar: bigint): T;
    toAffine?(invertedZ?: any): AffinePoint<any>;
}
export interface CurvePoint<F, P extends CurvePoint<F, P>> extends Group<P> {
    x: F;
    y: F;
    Z?: F;
    double(): P;
    negate(): P;
    add(other: P): P;
    subtract(other: P): P;
    equals(other: P): boolean;
    multiply(scalar: bigint): P;
    assertValidity(): void;
    clearCofactor(): P;
    is0(): boolean;
    isTorsionFree(): boolean;
    isSmallOrder(): boolean;
    multiplyUnsafe(scalar: bigint): P;
    precompute(windowSize?: number, isLazy?: boolean): P;
    toAffine(invertedZ?: F): AffinePoint<F>;
    toBytes(): Uint8Array;
    toHex(): string;
}
export interface CurvePointCons<P extends CurvePoint<any, P>> {
    [Symbol.hasInstance]: (item: unknown) => boolean;
    BASE: P;
    ZERO: P;
    Fp: IField<P_F<P>>;
    Fn: IField<bigint>;
    fromAffine(p: AffinePoint<P_F<P>>): P;
    fromBytes(bytes: Uint8Array): P;
    fromHex(hex: Uint8Array | string): P;
}
export type P_F<P extends CurvePoint<any, P>> = P extends CurvePoint<infer F, P> ? F : never;
export type PC_F<PC extends CurvePointCons<CurvePoint<any, any>>> = PC['Fp']['ZERO'];
export type PC_P<PC extends CurvePointCons<CurvePoint<any, any>>> = PC['ZERO'];
export type PC_ANY = CurvePointCons<CurvePoint<any, CurvePoint<any, CurvePoint<any, CurvePoint<any, CurvePoint<any, CurvePoint<any, CurvePoint<any, CurvePoint<any, CurvePoint<any, CurvePoint<any, any>>>>>>>>>>>;
export interface CurveLengths {
    secretKey?: number;
    publicKey?: number;
    publicKeyUncompressed?: number;
    publicKeyHasPrefix?: boolean;
    signature?: number;
    seed?: number;
}
export type GroupConstructor<T> = {
    BASE: T;
    ZERO: T;
};
export type ExtendedGroupConstructor<T> = GroupConstructor<T> & {
    Fp: IField<any>;
    Fn: IField<bigint>;
    fromAffine(ap: AffinePoint<any>): T;
};
export type Mapper<T> = (i: T[]) => T[];
export declare function negateCt<T extends {
    negate: () => T;
}>(condition: boolean, item: T): T;
export declare function normalizeZ<P extends CurvePoint<any, P>, PC extends CurvePointCons<P>>(c: PC, points: P[]): P[];
export type WOpts = {
    windows: number;
    windowSize: number;
    mask: bigint;
    maxNumber: number;
    shiftBy: bigint;
};
export declare class wNAF<PC extends PC_ANY> {
    private readonly BASE;
    private readonly ZERO;
    private readonly Fn;
    readonly bits: number;
    constructor(Point: PC, bits: number);
    _unsafeLadder(elm: PC_P<PC>, n: bigint, p?: PC_P<PC>): PC_P<PC>;
    private precomputeWindow;
    private wNAF;
    private wNAFUnsafe;
    private getPrecomputes;
    cached(point: PC_P<PC>, scalar: bigint, transform?: Mapper<PC_P<PC>>): {
        p: PC_P<PC>;
        f: PC_P<PC>;
    };
    unsafe(point: PC_P<PC>, scalar: bigint, transform?: Mapper<PC_P<PC>>, prev?: PC_P<PC>): PC_P<PC>;
    createCache(P: PC_P<PC>, W: number): void;
    hasCache(elm: PC_P<PC>): boolean;
}
export declare function mulEndoUnsafe<P extends CurvePoint<any, P>, PC extends CurvePointCons<P>>(Point: PC, point: P, k1: bigint, k2: bigint): {
    p1: P;
    p2: P;
};
export declare function pippenger<P extends CurvePoint<any, P>, PC extends CurvePointCons<P>>(c: PC, fieldN: IField<bigint>, points: P[], scalars: bigint[]): P;
export declare function precomputeMSMUnsafe<P extends CurvePoint<any, P>, PC extends CurvePointCons<P>>(c: PC, fieldN: IField<bigint>, points: P[], windowSize: number): (scalars: bigint[]) => P;
export type BasicCurve<T> = {
    Fp: IField<T>;
    n: bigint;
    nBitLength?: number;
    nByteLength?: number;
    h: bigint;
    hEff?: bigint;
    Gx: T;
    Gy: T;
    allowInfinityPoint?: boolean;
};
export declare function validateBasic<FP, T>(curve: BasicCurve<FP> & T): Readonly<{
    readonly nBitLength: number;
    readonly nByteLength: number;
} & BasicCurve<FP> & T & {
    p: bigint;
}>;
export type ValidCurveParams<T> = {
    p: bigint;
    n: bigint;
    h: bigint;
    a: T;
    b?: T;
    d?: T;
    Gx: T;
    Gy: T;
};
export type FpFn<T> = {
    Fp: IField<T>;
    Fn: IField<bigint>;
};
export declare function _createCurveFields<T>(type: 'weierstrass' | 'edwards', CURVE: ValidCurveParams<T>, curveOpts?: Partial<FpFn<T>>, FpFnLE?: boolean): FpFn<T> & {
    CURVE: ValidCurveParams<T>;
};
