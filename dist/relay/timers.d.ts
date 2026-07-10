export type Cancel = () => void;
export declare function onTimeout(ms: number, fn: () => void): Cancel;
export declare function delay(ms: number): Promise<void>;
export declare function withTimeout<T>(promise: Promise<T>, ms: number, fallback: () => T): Promise<T>;
