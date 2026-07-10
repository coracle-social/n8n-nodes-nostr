import type { Signer } from '../../relay';
import type { NodeFns } from './context';
export declare function resolveSecretKey(fns: NodeFns): Promise<Uint8Array | undefined>;
export declare function resolveSigner(fns: NodeFns): Promise<Signer | undefined>;
export declare function requireSigner(fns: NodeFns, what: string): Promise<Signer>;
export declare function requireSecretKey(fns: NodeFns, what: string): Promise<Uint8Array>;
