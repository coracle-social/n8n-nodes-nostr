import { createCipheriv } from 'node:crypto'

// ChaCha20 keystream. node's 'chacha20' cipher takes a 16-byte IV:
// 4-byte little-endian block counter (0) followed by the 12-byte nonce.
export function chacha20(key: Uint8Array, nonce12: Uint8Array, data: Uint8Array): Uint8Array {
	const iv = new Uint8Array(16)
	iv.set(nonce12, 4)
	const c = createCipheriv('chacha20', key, iv)
	return new Uint8Array(Buffer.concat([c.update(data), c.final()]))
}

// Constant-time comparison of two byte arrays.
export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false
	let diff = 0
	for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
	return diff === 0
}
