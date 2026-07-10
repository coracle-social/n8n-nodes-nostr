import { type CHash, type Input } from './utils';
export declare function extract(hash: CHash, ikm: Input, salt?: Input): Uint8Array;
export declare function expand(hash: CHash, prk: Input, info?: Input, length?: number): Uint8Array;
export declare const hkdf: (hash: CHash, ikm: Input, salt: Input | undefined, info: Input | undefined, length: number) => Uint8Array;
