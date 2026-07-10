import { type CurveFnWithCreate } from './_shortw_utils';
import type { CurveLengths } from './abstract/curve';
import { type H2CHasher, type H2CMethod } from './abstract/hash-to-curve';
import { mod } from './abstract/modular';
import { type WeierstrassPoint as PointType, type WeierstrassPointCons } from './abstract/weierstrass';
import type { Hex, PrivKey } from './utils';
import { bytesToNumberBE, numberToBytesBE } from './utils';
export declare const secp256k1: CurveFnWithCreate;
declare function taggedHash(tag: string, ...messages: Uint8Array[]): Uint8Array;
declare function lift_x(x: bigint): PointType<bigint>;
declare function schnorrGetPublicKey(secretKey: Hex): Uint8Array;
declare function schnorrSign(message: Hex, secretKey: PrivKey, auxRand?: Hex): Uint8Array;
declare function schnorrVerify(signature: Hex, message: Hex, publicKey: Hex): boolean;
export type SecpSchnorr = {
    keygen: (seed?: Uint8Array) => {
        secretKey: Uint8Array;
        publicKey: Uint8Array;
    };
    getPublicKey: typeof schnorrGetPublicKey;
    sign: typeof schnorrSign;
    verify: typeof schnorrVerify;
    Point: WeierstrassPointCons<bigint>;
    utils: {
        randomSecretKey: (seed?: Uint8Array) => Uint8Array;
        pointToBytes: (point: PointType<bigint>) => Uint8Array;
        lift_x: typeof lift_x;
        taggedHash: typeof taggedHash;
        randomPrivateKey: (seed?: Uint8Array) => Uint8Array;
        numberToBytesBE: typeof numberToBytesBE;
        bytesToNumberBE: typeof bytesToNumberBE;
        mod: typeof mod;
    };
    lengths: CurveLengths;
};
export declare const schnorr: SecpSchnorr;
export declare const secp256k1_hasher: H2CHasher<bigint>;
export declare const hashToCurve: H2CMethod<bigint>;
export declare const encodeToCurve: H2CMethod<bigint>;
export {};
