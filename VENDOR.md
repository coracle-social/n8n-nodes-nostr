# Vendored dependencies

`package.json` declares no runtime dependencies, per n8n's verified community node
guidelines. The cryptography that Node's standard library does not provide is vendored
here instead, compiled from source by this package's own `tsc`.

Everything below is reproduced under its original license. `LICENSE` files sit alongside
the code in each directory. Regenerate with `node scripts/vendor.mjs`; never hand-edit.

| Package | Version | License | Vendored to | Files | Tarball SHA-256 |
| --- | --- | --- | --- | --- | --- |
| `@noble/hashes` | 1.8.0 | MIT | `src/vendor/noble-hashes/` | 7 | `e8a765d92c04faaccba8776411c5038cb195f812ee629fce07e1d2e6aec80ea0` |
| `@noble/curves` | 1.9.7 | MIT | `src/vendor/noble-curves/` | 7 | `c4c5545645b8d58a080d2faf84982f6fe5dc3a0516e11de8dc571b38cab565e9` |
| `@scure/base` | 1.2.6 | MIT | `src/vendor/scure-base/` | 1 | `09c1bdef467fd38e0d6a96dd56511c0b8d8d5cff6d4c6bd387dae6b31048e82c` |

## What we take, and why

- **`@noble/curves`** — BIP-340 schnorr signing and verification. Node's `crypto` exposes
  secp256k1 for ECDH and ECDSA but not schnorr, which every Nostr event signature needs.
- **`@noble/hashes`** — SHA-256, HMAC and HKDF as byte-array primitives. Node has all three,
  but `@noble/curves` requires the noble callable form, so vendoring it avoids an adapter
  layer between two implementations of the same primitive.
- **`@scure/base`** — bech32/bech32m for NIP-19 (`npub`, `nsec`, `nevent`, `naddr`).

## Deliberate deviations from upstream

- Import specifiers are rewritten from `@noble/hashes/x.js` to relative paths, and `.ts`/`.js`
  extensions are stripped, so the tree compiles as CommonJS under our `tsconfig.json`.
- `@noble/hashes` ships two `crypto` shims; we vendor `cryptoNode.ts`, the flavour its own
  exports map selects under Node. It imports `node:crypto` — the single builtin n8n's
  community-node ruleset allows — and, unlike the browser flavour, never touches the
  forbidden `globalThis`. The vendored tree therefore contains no filesystem or environment
  access and no restricted global, which `scripts/vendor.mjs` and `test/compliance.test.ts` check.

No other bytes are changed.
