import { type CurveFn, type CurveType } from './abstract/weierstrass';
import type { CHash } from './utils';
export declare function getHash(hash: CHash): {
    hash: CHash;
};
export type CurveDef = Readonly<Omit<CurveType, 'hash'>>;
export type CurveFnWithCreate = CurveFn & {
    create: (hash: CHash) => CurveFn;
};
export declare function createCurve(curveDef: CurveDef, defHash: CHash): CurveFnWithCreate;
