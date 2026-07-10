/*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
export declare function isBytes(a: unknown): a is Uint8Array;
export declare function anumber(n: number): void;
export declare function abytes(b: Uint8Array | undefined, ...lengths: number[]): void;
export declare function ahash(h: IHash): void;
export declare function aexists(instance: any, checkFinished?: boolean): void;
export declare function aoutput(out: any, instance: any): void;
export type TypedArray = Int8Array | Uint8ClampedArray | Uint8Array | Uint16Array | Int16Array | Uint32Array | Int32Array;
export declare function u8(arr: TypedArray): Uint8Array;
export declare function u32(arr: TypedArray): Uint32Array;
export declare function clean(...arrays: TypedArray[]): void;
export declare function createView(arr: TypedArray): DataView;
export declare function rotr(word: number, shift: number): number;
export declare function rotl(word: number, shift: number): number;
export declare const isLE: boolean;
export declare function byteSwap(word: number): number;
export declare const swap8IfBE: (n: number) => number;
export declare const byteSwapIfBE: typeof swap8IfBE;
export declare function byteSwap32(arr: Uint32Array): Uint32Array;
export declare const swap32IfBE: (u: Uint32Array) => Uint32Array;
export declare function bytesToHex(bytes: Uint8Array): string;
export declare function hexToBytes(hex: string): Uint8Array;
export declare const nextTick: () => Promise<void>;
export declare function asyncLoop(iters: number, tick: number, cb: (i: number) => void): Promise<void>;
export declare function utf8ToBytes(str: string): Uint8Array;
export declare function bytesToUtf8(bytes: Uint8Array): string;
export type Input = string | Uint8Array;
export declare function toBytes(data: Input): Uint8Array;
export type KDFInput = string | Uint8Array;
export declare function kdfInputToBytes(data: KDFInput): Uint8Array;
export declare function concatBytes(...arrays: Uint8Array[]): Uint8Array;
type EmptyObj = {};
export declare function checkOpts<T1 extends EmptyObj, T2 extends EmptyObj>(defaults: T1, opts?: T2): T1 & T2;
export type IHash = {
    (data: Uint8Array): Uint8Array;
    blockLen: number;
    outputLen: number;
    create: any;
};
export declare abstract class Hash<T extends Hash<T>> {
    abstract blockLen: number;
    abstract outputLen: number;
    abstract update(buf: Input): this;
    abstract digestInto(buf: Uint8Array): void;
    abstract digest(): Uint8Array;
    abstract destroy(): void;
    abstract _cloneInto(to?: T): T;
    abstract clone(): T;
}
export type HashXOF<T extends Hash<T>> = Hash<T> & {
    xof(bytes: number): Uint8Array;
    xofInto(buf: Uint8Array): Uint8Array;
};
export type CHash = ReturnType<typeof createHasher>;
export type CHashO = ReturnType<typeof createOptHasher>;
export type CHashXO = ReturnType<typeof createXOFer>;
export declare function createHasher<T extends Hash<T>>(hashCons: () => Hash<T>): {
    (msg: Input): Uint8Array;
    outputLen: number;
    blockLen: number;
    create(): Hash<T>;
};
export declare function createOptHasher<H extends Hash<H>, T extends Object>(hashCons: (opts?: T) => Hash<H>): {
    (msg: Input, opts?: T): Uint8Array;
    outputLen: number;
    blockLen: number;
    create(opts?: T): Hash<H>;
};
export declare function createXOFer<H extends HashXOF<H>, T extends Object>(hashCons: (opts?: T) => HashXOF<H>): {
    (msg: Input, opts?: T): Uint8Array;
    outputLen: number;
    blockLen: number;
    create(opts?: T): HashXOF<H>;
};
export declare const wrapConstructor: typeof createHasher;
export declare const wrapConstructorWithOpts: typeof createOptHasher;
export declare const wrapXOFConstructorWithOpts: typeof createXOFer;
export declare function randomBytes(bytesLength?: number): Uint8Array;
export {};
