import { HashMD } from './_md';
import { type CHash } from './utils';
export declare class SHA256 extends HashMD<SHA256> {
    protected A: number;
    protected B: number;
    protected C: number;
    protected D: number;
    protected E: number;
    protected F: number;
    protected G: number;
    protected H: number;
    constructor(outputLen?: number);
    protected get(): [number, number, number, number, number, number, number, number];
    protected set(A: number, B: number, C: number, D: number, E: number, F: number, G: number, H: number): void;
    protected process(view: DataView, offset: number): void;
    protected roundClean(): void;
    destroy(): void;
}
export declare class SHA224 extends SHA256 {
    protected A: number;
    protected B: number;
    protected C: number;
    protected D: number;
    protected E: number;
    protected F: number;
    protected G: number;
    protected H: number;
    constructor();
}
export declare class SHA512 extends HashMD<SHA512> {
    protected Ah: number;
    protected Al: number;
    protected Bh: number;
    protected Bl: number;
    protected Ch: number;
    protected Cl: number;
    protected Dh: number;
    protected Dl: number;
    protected Eh: number;
    protected El: number;
    protected Fh: number;
    protected Fl: number;
    protected Gh: number;
    protected Gl: number;
    protected Hh: number;
    protected Hl: number;
    constructor(outputLen?: number);
    protected get(): [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number
    ];
    protected set(Ah: number, Al: number, Bh: number, Bl: number, Ch: number, Cl: number, Dh: number, Dl: number, Eh: number, El: number, Fh: number, Fl: number, Gh: number, Gl: number, Hh: number, Hl: number): void;
    protected process(view: DataView, offset: number): void;
    protected roundClean(): void;
    destroy(): void;
}
export declare class SHA384 extends SHA512 {
    protected Ah: number;
    protected Al: number;
    protected Bh: number;
    protected Bl: number;
    protected Ch: number;
    protected Cl: number;
    protected Dh: number;
    protected Dl: number;
    protected Eh: number;
    protected El: number;
    protected Fh: number;
    protected Fl: number;
    protected Gh: number;
    protected Gl: number;
    protected Hh: number;
    protected Hl: number;
    constructor();
}
export declare class SHA512_224 extends SHA512 {
    protected Ah: number;
    protected Al: number;
    protected Bh: number;
    protected Bl: number;
    protected Ch: number;
    protected Cl: number;
    protected Dh: number;
    protected Dl: number;
    protected Eh: number;
    protected El: number;
    protected Fh: number;
    protected Fl: number;
    protected Gh: number;
    protected Gl: number;
    protected Hh: number;
    protected Hl: number;
    constructor();
}
export declare class SHA512_256 extends SHA512 {
    protected Ah: number;
    protected Al: number;
    protected Bh: number;
    protected Bl: number;
    protected Ch: number;
    protected Cl: number;
    protected Dh: number;
    protected Dl: number;
    protected Eh: number;
    protected El: number;
    protected Fh: number;
    protected Fl: number;
    protected Gh: number;
    protected Gl: number;
    protected Hh: number;
    protected Hl: number;
    constructor();
}
export declare const sha256: CHash;
export declare const sha224: CHash;
export declare const sha512: CHash;
export declare const sha384: CHash;
export declare const sha512_256: CHash;
export declare const sha512_224: CHash;
