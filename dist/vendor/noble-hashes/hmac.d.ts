import { Hash, type CHash, type Input } from './utils';
export declare class HMAC<T extends Hash<T>> extends Hash<HMAC<T>> {
    oHash: T;
    iHash: T;
    blockLen: number;
    outputLen: number;
    private finished;
    private destroyed;
    constructor(hash: CHash, _key: Input);
    update(buf: Input): this;
    digestInto(out: Uint8Array): void;
    digest(): Uint8Array;
    _cloneInto(to?: HMAC<T>): HMAC<T>;
    clone(): HMAC<T>;
    destroy(): void;
}
export declare const hmac: {
    (hash: CHash, key: Input, message: Input): Uint8Array;
    create(hash: CHash, key: Input): HMAC<any>;
};
