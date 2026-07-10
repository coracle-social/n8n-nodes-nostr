export declare function getConversationKey(privkeyA: Uint8Array, pubkeyB: string): Uint8Array;
export declare function getMessageKeys(conversationKey: Uint8Array, nonce: Uint8Array): {
    chacha_key: Uint8Array;
    chacha_nonce: Uint8Array;
    hmac_key: Uint8Array;
};
export declare function calcPaddedLen(len: number): number;
export declare function encrypt(plaintext: string, conversationKey: Uint8Array, nonce?: Uint8Array): string;
export declare function decrypt(payload: string, conversationKey: Uint8Array): string;
