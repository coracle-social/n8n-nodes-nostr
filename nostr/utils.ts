export const utf8Decoder: TextDecoder = new TextDecoder('utf-8')
export const utf8Encoder: TextEncoder = new TextEncoder()

export { bytesToHex, hexToBytes } from '../vendor/noble-hashes/utils'

/** Current unix time in whole seconds. */
export function nowSec(): number {
	return Math.floor(Date.now() / 1000)
}
