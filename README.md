# n8n-nodes-nostr

An [n8n](https://n8n.io) community node package for the
[Nostr](https://github.com/nostr-protocol/nostr) protocol. Create and sign
events, fetch them by filter, encrypt and decrypt with NIP-44, encode and
decode NIP-19 entities, authenticate to relays with NIP-42, and trigger
workflows from a live event subscription.

It ships as a self-contained package with **no runtime dependencies**: the
cryptography Node's standard library does not provide (BIP-340 schnorr, bech32)
is vendored into the package and compiled from source. See
[Why vendored crypto](#why-vendored-crypto).

## Nodes

This package provides two nodes and one credential.

- **Nostr** — an action node with three resources (Event, Encryption, Utility).
- **Nostr Trigger** — starts a workflow when a matching event arrives on your
  relays.
- **Nostr Private Key API** — the credential holding your secret key and default
  relays.

## Installation

Requires a **self-hosted** n8n. The package is on npm and passes
`@n8n/scan-community-package`, n8n's own analyser, but it has not been submitted
for verification — and unverified community nodes are not offered on n8n Cloud.

**Community Nodes UI** — Settings → Community Nodes → Install, enter
`n8n-nodes-nostr`. Requires an Owner or Admin account.

**Manually** — in your n8n custom-extensions directory (default `~/.n8n/custom`):

```bash
cd ~/.n8n/custom
npm init -y            # only if this directory has no package.json yet
npm install n8n-nodes-nostr
```

Restart n8n. See the n8n docs on
[installing community nodes](https://docs.n8n.io/integrations/community-nodes/installation-and-management.md).

## Credentials

| Field | Description |
| --- | --- |
| **Private Key** | Your Nostr secret key as an `nsec1…` (bech32) or 64-character hex string. Stored encrypted by n8n and never logged. Masked in the UI. |
| **Default Relays** | Relays used whenever a node leaves its **Relays** field empty. One URL per line. |

The credential test validates the key format and derives its `npub` locally — it
makes **no network request**. A valid key reports the derived `npub`; an invalid
one reports why.

The credential is optional for read-only work (getting events, decoding). It is
required for anything that signs or encrypts: creating, signing, and NIP-44
encrypt/decrypt.

## Nostr (action node)

Pick a **Resource**, then an **Operation**.

### Event

- **Create** — build and sign an event (or pass a fully-formed raw event) and
  broadcast it to relays. Returns one result **per relay** (see
  [Relay semantics](#relay-semantics)).
- **Get** — fetch the single newest event matching a filter. Forces `limit` 1 and
  returns one item, or nothing when no event matches.
- **Get Many** — fetch stored events matching a filter. Terminates
  deterministically on `limit`, on end-of-stored-events, or on a wall-clock
  timeout, and dedups across relays.
- **Sign** — finalize and sign an event offline, without touching the network.
  Returns the signed event, its `id`, `pubkey`, and optionally an `nevent`.

Both **Create** and **Sign** accept either **Fields** mode (`kind`, `content`,
`tags`) or **Raw Event JSON** mode. A raw event that already carries a valid `id`
and `sig` is published as-is; otherwise it is finalized with your credential.

A profile is just a kind-0 event and a relay list a kind-10002 event, so **Get**
with the right `kinds` fetches either; parse the JSON `content` in a downstream
node.

### Encryption (NIP-44)

- **Encrypt** — encrypt plaintext to a peer's public key. Returns
  `{ ciphertext, version: 'nip44' }`.
- **Decrypt** — decrypt a NIP-44 payload from a peer. Returns `{ plaintext }`.

Both derive the conversation key from your secret key and the peer's public key,
so both require a credential. No relays are involved.

### Utility (NIP-19)

- **Decode** — decode any `npub` / `nsec` / `note` / `nprofile` / `nevent` /
  `naddr` into `{ type, data }`, expanding hex, pubkeys, and relay hints.
- **Encode** — build an `npub` / `note` / `nprofile` / `nevent` / `naddr` from its
  parts. Encoding an `nsec` is deliberately not offered: a workflow should never
  move a secret key around as output.

No network, no credential.

## Nostr Trigger

Subscribes to your relays and emits an item for each matching event.

| Option | Default | Notes |
| --- | --- | --- |
| **Relays** | credential defaults | One URL per line. |
| **Filter** (Fields or Raw JSON) | `kinds: 1` | Live tail — no `limit`/`until`. |
| **Authenticate** | `true` | Perform NIP-42 AUTH when a relay requires it. |
| **Overlap Seconds** | `60` | On restart, rewind the subscription start by this much so events near the cutover are not missed. |
| **Include Historical** | `false` | On first activation, also deliver events from before now. |
| **Emit Envelope** | `false` | Wrap output as `{ event, relay }` instead of the flat event. |
| **Max Seen IDs** | `5000` | Bound on the in-memory dedup set. |

Deduplication uses the event `id` as the native n8n deduplication key, so the
same event arriving from several relays fires the workflow once. The
subscription position (`lastCreatedAt`) and a bounded set of seen ids are
persisted in the workflow's static data, so a save/deploy/restart resumes with a
deliberate overlap window instead of replaying or dropping events. Using
**Execute step** in the editor runs a single bounded query and stops, rather than
opening a live tail.

## A worked example

**Cross-post to Nostr when a webhook fires.**

1. **Webhook** node receives a payload with a `message` field.
2. **Nostr** node — Resource **Event**, Operation **Create**:
   - `inputMode`: **Fields**
   - `kind`: `1`
   - `content`: `={{ $json.message }}`
   - `relays`: leave empty to use your credential's default relays
   - credential: your **Nostr Private Key API**
3. Inspect the output: an object with the signed `event` and a `results` array —
   one entry per relay with `relay`, `ok`, `reason`, and `durationMs` — plus
   `accepted` and `rejected` (arrays of relay URLs) and the `allAccepted` /
   `anyAccepted` booleans.

To react to replies, add a **Nostr Trigger** with `kinds: 1` and a `#p` tag
filter set to your own pubkey.

## Relay semantics

Nostr is not request/response, and these nodes surface that faithfully instead of
hiding it:

- **Create returns per-relay results, never one boolean.** Each relay
  independently accepts or rejects an event with its own reason. Acceptance on
  one relay is not acceptance on another, so the node returns the full
  `results[]` array plus `accepted` / `rejected` / `allAccepted` / `anyAccepted`.
  A rejection is **data**, not a workflow error. Enable **Split Results Into
  Items** to emit one item per relay.
- **Queries always terminate.** `EOSE` (end of stored events) is advisory, and
  some relays never send it. Termination is driven by an explicit `limit`
  **and** a wall-clock `timeoutMs`, so a query never hangs.
- **Duplicates are expected and removed.** The same event arriving from N relays
  is deduplicated by `event.id`. For replaceable and addressable kinds (0, 3,
  10002, 30000–39999) the newest `created_at` wins, tie-broken by lowest `id`.
- **NIP-42 AUTH is handled in the connection layer.** Relays may demand a signed
  kind-22242 challenge before accepting a `REQ` or `EVENT`. When
  **Authenticate** is on and a credential is present, the node authenticates
  both eagerly (on an `AUTH` challenge) and reactively (on an `auth-required`
  rejection), retries the blocked frame once, and otherwise records
  `auth-required` as a per-relay reason. A read-only subscription can authenticate
  too. Missing credentials only raise an error when the operation itself strictly
  requires signing.

## Why vendored crypto

n8n's verified community node guidelines favor packages with no runtime
dependencies. Node's standard library covers SHA-256, HMAC, HKDF, and ChaCha20,
but not the BIP-340 schnorr signatures every Nostr event needs, nor bech32 for
NIP-19. Rather than add runtime dependencies, this package vendors the minimal
source it needs — `@noble/curves`, `@noble/hashes`, and `@scure/base` — into
`vendor/` and compiles it with its own TypeScript build. ChaCha20 for NIP-44
uses Node's built-in `node:crypto`.

The result: `package.json` has `"dependencies": {}`, and the only Node built-in
used at runtime is `node:crypto`. Provenance, versions, tarball hashes, and the
exact deviations from upstream are documented in
[`VENDOR.md`](./VENDOR.md); the full upstream license texts are in
[`THIRD_PARTY_LICENSES.md`](./THIRD_PARTY_LICENSES.md). The vendored crypto is
proven byte-for-byte against the published BIP-340, SHA-256, HMAC, HKDF, bech32,
and NIP-44 v2 spec vectors in the test suite.

## License

[MIT](./LICENSE) © 2026 Jonathan Staab. Vendored and adapted third-party code
retains its own licenses; see [`THIRD_PARTY_LICENSES.md`](./THIRD_PARTY_LICENSES.md).

The node icons are the Nostr community icon by Andrea Nicolini, from
[mbarulli/nostr-logo](https://github.com/mbarulli/nostr-logo), released under
CC0 1.0 (public domain).
