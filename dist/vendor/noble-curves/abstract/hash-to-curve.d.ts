import type { CHash } from '../utils';
import type { AffinePoint, Group, GroupConstructor } from './curve';
import { type IField } from './modular';
export type UnicodeOrBytes = string | Uint8Array;
export type H2COpts = {
    DST: UnicodeOrBytes;
    expand: 'xmd' | 'xof';
    hash: CHash;
    p: bigint;
    m: number;
    k: number;
};
export type H2CHashOpts = {
    expand: 'xmd' | 'xof';
    hash: CHash;
};
export type Opts = H2COpts;
export declare function expand_message_xmd(msg: Uint8Array, DST: UnicodeOrBytes, lenInBytes: number, H: CHash): Uint8Array;
export declare function expand_message_xof(msg: Uint8Array, DST: UnicodeOrBytes, lenInBytes: number, k: number, H: CHash): Uint8Array;
export declare function hash_to_field(msg: Uint8Array, count: number, options: H2COpts): bigint[][];
export type XY<T> = (x: T, y: T) => {
    x: T;
    y: T;
};
export type XYRatio<T> = [T[], T[], T[], T[]];
export declare function isogenyMap<T, F extends IField<T>>(field: F, map: XYRatio<T>): XY<T>;
export interface H2CPoint<T> extends Group<H2CPoint<T>> {
    add(rhs: H2CPoint<T>): H2CPoint<T>;
    toAffine(iz?: bigint): AffinePoint<T>;
    clearCofactor(): H2CPoint<T>;
    assertValidity(): void;
}
export interface H2CPointConstructor<T> extends GroupConstructor<H2CPoint<T>> {
    fromAffine(ap: AffinePoint<T>): H2CPoint<T>;
}
export type MapToCurve<T> = (scalar: bigint[]) => AffinePoint<T>;
export type htfBasicOpts = {
    DST: UnicodeOrBytes;
};
export type H2CMethod<T> = (msg: Uint8Array, options?: htfBasicOpts) => H2CPoint<T>;
export type HTFMethod<T> = H2CMethod<T>;
export type MapMethod<T> = (scalars: bigint[]) => H2CPoint<T>;
export type H2CHasherBase<T> = {
    hashToCurve: H2CMethod<T>;
    hashToScalar: (msg: Uint8Array, options: htfBasicOpts) => bigint;
};
export type H2CHasher<T> = H2CHasherBase<T> & {
    encodeToCurve: H2CMethod<T>;
    mapToCurve: MapMethod<T>;
    defaults: H2COpts & {
        encodeDST?: UnicodeOrBytes;
    };
};
export type Hasher<T> = H2CHasher<T>;
export declare const _DST_scalar: Uint8Array;
export declare function createHasher<T>(Point: H2CPointConstructor<T>, mapToCurve: MapToCurve<T>, defaults: H2COpts & {
    encodeDST?: UnicodeOrBytes;
}): H2CHasher<T>;
