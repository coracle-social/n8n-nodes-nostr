import { Connection } from './Connection';
import type { AuthOptions } from './types';
export declare class RelayPool {
    private readonly auth;
    private connections;
    constructor(auth?: AuthOptions);
    connection(url: string, auth?: AuthOptions): Connection;
    close(): Promise<void>;
}
