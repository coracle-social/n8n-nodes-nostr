# n8n-nodes-nostr

An [n8n](https://n8n.io) community node package for the
[Nostr](https://github.com/nostr-protocol/nostr) protocol. Publish, sign, and
query events, look up profiles, encrypt and decrypt with NIP-44, encode and
decode NIP-19 entities, authenticate to relays with NIP-42, and trigger
workflows from a live event subscription.

It ships as a self-contained package with **no runtime dependencies**: the
cryptography Node's standard library does not provide (BIP-340 schnorr, bech32)
is vendored into the package and compiled from source. See
[Why vendored crypto](#why-vendored-crypto).

## ⚠️ This is 100% vibe coded

Every line of this package — the protocol layer, the NIP-42 handshake, the
vendored cryptography, the tests, and this README — was written by an AI agent
(Claude), with a human directing at the prompt level. **No human has reviewed
the code line by line.**

That does not mean it is unverified. It means the verification is machine-made
too, and you should judge it on your own terms:

- The vendored crypto is checked byte-for-byte against the published spec
  vectors — BIP-340, NIST SHA-256, RFC 4231, RFC 5869, NIP-19, and the official
  NIP-44 v2 vectors — in `test/vendor-crypto.test.ts` and `test/nostr/`.
- 282 tests run the real relay code against in-process relays, including the
  NIP-42 auth paths, reconnect, and every "this must not hang" guarantee.
- `npm run scan` runs `@n8n/scan-community-package`, n8n's own analyser.
- `npm run verify` loads the compiled output under plain Node and publishes a
  signed event over a real websocket.

None of that substitutes for reading the code. **This package handles your Nostr
secret key**, which is unrecoverable and, on a protocol with no password reset,
is your whole identity. Before pointing it at a key you care about: read
`src/nostr/`, read `src/relay/Connection.ts`, and consider running it with a
throwaway key first.

Bugs, if any, are the kind a confident writer makes — plausible-looking and
consistently formatted. Review accordingly.

## Nodes

This package provides two nodes and one credential.

- **Nostr** — an action node with four resources (Event, Profile, Encryption,
  Utility).
- **Nostr Trigger** — starts a workflow when a matching event arrives on your
  relays.
- **Nostr Private Key API** — the credential holding your secret key and default
  relays.

## Installation

> **Status:** this package is built to n8n's
> [verified community node guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines.md)
> — MIT licensed, zero runtime dependencies, no environment or filesystem access —
> and it passes `@n8n/scan-community-package`, the static analyser n8n runs on
> submissions. It has **not been published to npm or submitted for verification
> yet**, so there is nothing for n8n to fetch. To try it today, build it and
> install it yourself: see
> [Running it in a local n8n instance](#running-it-in-a-local-n8n-instance).

Once it is published, either of these will work on a self-hosted instance:

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

Unverified community nodes are not available on n8n Cloud; you need a
self-hosted instance until the package is verified.

## Credential — Nostr Private Key API

| Field | Description |
| --- | --- |
| **Private Key** | Your Nostr secret key as an `nsec1…` (bech32) or 64-character hex string. Stored encrypted by n8n and never logged. Masked in the UI. |
| **Default Relays** | Relays used whenever a node leaves its **Relays** field empty. One URL per line. |

The credential test validates the key format and derives its `npub` locally — it
makes **no network request**. A valid key reports the derived `npub`; an invalid
one reports why.

The credential is optional for read-only work (querying, decoding). It is
required for anything that signs or encrypts: publishing, signing, and NIP-44
encrypt/decrypt.

## Nostr (action node)

Pick a **Resource**, then an **Operation**.

### Event

- **Publish** — build and sign an event (or pass a fully-formed raw event) and
  broadcast it to relays. Returns one result **per relay** (see
  [Relay semantics](#relay-semantics)).
- **Sign** — finalize and sign an event offline, without touching the network.
  Returns the signed event, its `id`, `pubkey`, and optionally an `nevent`.
- **Query** — fetch stored events matching a filter. Terminates deterministically
  on `limit`, on end-of-stored-events, or on a wall-clock timeout, and dedups
  across relays.

Both **Publish** and **Sign** accept either **Fields** mode (`kind`, `content`,
`tags`) or **Raw Event JSON** mode. A raw event that already carries a valid `id`
and `sig` is published as-is; otherwise it is finalized with your credential.

### Profile

- **Get** — fetch a user's kind-0 metadata (newest wins) and parse it into named
  fields (`name`, `display_name`, `about`, `picture`, `nip05`, `lud16`, …). A
  pubkey with no profile returns `{ found: false }` rather than an error.
- **Get Relays** — fetch a user's kind-10002 relay list (NIP-65) as `read` /
  `write` / combined lists.

Leave **pubkeys** empty to use your own key from the credential.

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
2. **Nostr** node — Resource **Event**, Operation **Publish**:
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

- **Publish returns per-relay results, never one boolean.** Each relay
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
`src/vendor/` and compiles it with its own TypeScript build. ChaCha20 for NIP-44
uses Node's built-in `node:crypto`.

The result: `package.json` has `"dependencies": {}`, and the only Node built-in
used at runtime is `node:crypto`. Provenance, versions, tarball hashes, and the
exact deviations from upstream are documented in
[`VENDOR.md`](./VENDOR.md); the full upstream license texts are in
[`THIRD_PARTY_LICENSES.md`](./THIRD_PARTY_LICENSES.md). The vendored crypto is
proven byte-for-byte against the published BIP-340, SHA-256, HMAC, HKDF, bech32,
and NIP-44 v2 spec vectors in the test suite.

## Two constraints that shape the code

`npm run scan` runs [`@n8n/scan-community-package`](https://www.npmjs.com/package/@n8n/scan-community-package),
the same static analyser n8n applies to a submission. Two of its rules are not
obvious, and both leave visible marks on this codebase. **Please don't "clean
them up".**

1. **`no-restricted-globals` forbids `setTimeout`, `clearTimeout`, `setInterval`,
   `globalThis` and `process`**, and `no-restricted-imports` does not allow
   `node:timers`. Every deadline in the relay layer is therefore built on
   `AbortSignal.timeout` in [`src/relay/timers.ts`](./src/relay/timers.ts).
   `WebSocket` and `AbortSignal` are *not* on the restricted list, which is the
   only reason a websocket client can be a verified community node at all.
   Note that `AbortSignal.timeout` rejects a non-integer delay, and its timer is
   unref'd — see the comments in that file.

2. **The vendored `@noble/hashes` crypto shim is the `cryptoNode.ts` flavour**,
   not the browser one. The browser flavour reads `globalThis`, which rule 1
   forbids; the node flavour imports `node:crypto`, which is explicitly allowed.

`test/compliance.test.ts` mirrors both rules so a violation fails the unit tests
long before it reaches the scanner.

## Running it in a local n8n instance

The package is not on npm, so n8n cannot fetch it. Build it and install it into a
container yourself. Every command below was run end to end against **n8n 2.29.9**.

### 1. Get the image

Docker Hub rate-limits anonymous pulls per IP address, and `docker.n8n.io` is a
Hub mirror that draws from the same quota. If you see:

```
toomanyrequests: You have reached your unauthenticated pull rate limit
```

either run `docker login` (a free account raises the limit), or pull from
GitHub's registry, which allows anonymous pulls and carries the same images
(`linux/amd64` and `linux/arm64`):

```bash
podman pull ghcr.io/n8n-io/n8n:2.29.9    # or: docker pull ghcr.io/n8n-io/n8n:2.29.9
```

### 2. Start n8n

```bash
podman run -d --name n8n-nostr \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  -e N8N_DIAGNOSTICS_ENABLED=false \
  ghcr.io/n8n-io/n8n:2.29.9
```

Open <http://localhost:5678> and create the owner account. That setup screen
appears **once**, on a fresh instance; the account lives in the `n8n_data`
volume and survives restarts. To start over: `podman volume rm n8n_data`.

### 3. Build and install the node

```bash
npm install
npm run n8n:reload
```

`n8n:reload` builds, packs, copies the tarball into the container, installs it,
and restarts n8n. It honours `N8N_CONTAINER` (default `n8n-nostr`), `N8N_PORT`
(`5678`), and `CONTAINER_RUNTIME` (autodetects podman, else docker).

It deliberately mirrors what n8n's own installer does
(`dist/modules/community-packages/community-packages.service.js` inside the
image): extract the tarball straight into `~/.n8n/nodes/node_modules/<name>`,
**strip `devDependencies`, `peerDependencies` and `optionalDependencies`** from
the extracted `package.json`, then `npm install` inside that directory with
`--ignore-scripts`.

Do not skip the strip. npm 7+ auto-installs peer dependencies, and this package
declares `n8n-workflow` as one, so a plain `npm install n8n-nodes-nostr.tgz`
pulls a **second copy of `n8n-workflow`** — plus its dependency tree and a native
`isolated-vm` build — into `~/.n8n/nodes`. That copy shadows n8n's own, and
`instanceof` checks across the two module instances stop working, so things like
`NodeOperationError` silently stop being caught. With the strip, exactly one
directory lands in `node_modules` and nothing else is fetched: the package has no
runtime dependencies, so the install step is a no-op.

### 4. Confirm it loaded

Hard-refresh the editor and search the node panel for **Nostr**. You should see
three entries, because `usableAsTool` makes n8n generate a tool variant that an
AI Agent node can call:

| Node type | Shows up as |
| --- | --- |
| `n8n-nodes-nostr.nostr` | Nostr |
| `n8n-nodes-nostr.nostrTrigger` | Nostr Trigger |
| `n8n-nodes-nostr.nostrTool` | Nostr Tool |

plus the `nostrPrivateKeyApi` credential. To check without the browser:

```bash
curl -s -X POST http://localhost:5678/rest/login -H 'Content-Type: application/json' \
  -c /tmp/c.txt -d '{"emailOrLdapLoginId":"YOU@example.com","password":"YOUR_PASSWORD"}' >/dev/null
curl -s -b /tmp/c.txt http://localhost:5678/types/nodes.json \
  | grep -o '"name":"n8n-nodes-nostr[^"]*"'
```

### 5. Iterate

After any code change:

```bash
npm run n8n:reload
```

then hard-refresh the editor — it caches node types.

### Gotchas

- **Settings → Community Nodes will not list the package.** That page reads the
  `installed_packages` database table, which only the GUI installer writes. A
  manual install loads and runs identically; n8n just won't offer to update or
  uninstall it there. `GET /rest/community-packages` returns `[]`, as expected.
- **No Install button on that page?** It needs an Owner or Admin account, and
  `N8N_COMMUNITY_PACKAGES_ENABLED` plus `N8N_UNVERIFIED_PACKAGES_ENABLED` (both
  default `true`). The usual culprit is
  `N8N_COMMUNITY_PACKAGES_MANAGED_BY_ENV=true`, which makes the page read-only.
  None of this matters for the flow above, which bypasses the UI entirely.
- **`/healthz` goes green before the REST API is ready.** If you script against a
  fresh container, poll `/rest/settings`, not `/healthz`.
- **Live-mount alternative.** For tight iteration you can bind-mount a package
  directory over `/home/node/.n8n/custom` instead of installing. Nodes then load
  under `CUSTOM.*` names rather than `n8n-nodes-nostr.*`, which is close to but
  not identical to how a published package behaves — `n8n:reload` exercises the
  real path.

## Publishing and verification

**Gitea is the primary remote** (`gitea.coracle.social/coracle/n8n-nodes-nostr`).
It runs the full gate on every push via `.gitea/workflows/ci.yml`: lint, tests,
build, `verify-dist`, n8n's static analyser, and a check that the vendored crypto
still reproduces from upstream.

**A GitHub mirror exists solely to publish.** That is not a preference; it is
forced by three facts:

1. n8n's
   [verification guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines.md)
   state that *"From May 1st 2026, nodes submitted for verification must be
   published using GitHub Actions with a provenance statement."*
2. n8n's own scanner enforces it. `@n8n/scan-community-package` reads
   `dist.attestations.provenance` from the npm registry and fails with *"Package
   was not published with npm provenance"* when it is absent.
3. npm can only generate provenance under `GITHUB_ACTIONS` or `GITLAB_CI`. It
   does not merely read an environment variable — it signs the attestation
   through Sigstore using the CI's OIDC token. Gitea Actions sets
   `GITHUB_ACTIONS=true` for compatibility, so npm takes the GitHub branch and
   then fails on the missing `ACTIONS_ID_TOKEN_REQUEST_URL`.

Because provenance attests *repository and commit*, `package.json`'s
`repository.url` must point at the GitHub mirror, not at Gitea.

```
gitea (origin, source of truth)  ──push mirror──►  github (publish only)
        │                                                  │
        └─ .gitea/workflows/ci.yml                          └─ .github/workflows/publish.yml
           lint · test · verify · scan                         npm publish --provenance
```

### Releasing

1. Push to Gitea; CI must be green.
2. The mirror syncs to GitHub.
3. Cut a GitHub release. `.github/workflows/publish.yml` runs `npm ci`, the whole
   gate, and `npm publish` — `publishConfig` supplies `--provenance --access public`.

Prerequisites on the GitHub side: a public repo whose URL matches
`repository.url`, `permissions: id-token: write` (already set), and either an npm
Trusted Publisher for the package or an `NPM_TOKEN` secret.

Running `npm publish` from a laptop **fails on purpose**:

```
npm error EUSAGE Automatic provenance generation not supported for provider: <name>
```

That guard is the point. It makes it impossible to accidentally ship an
unattested build that n8n would then refuse to verify.

## Development

```bash
npm install
npm run build       # tsc + copy icons/codex into dist/
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (n8n nodes + credentials rulesets) + tsc --noEmit
npm test            # vitest run
npm run verify      # build, then load dist/ under plain node and exercise it
npm run scan        # run n8n's own @n8n/scan-community-package on the tarball
npm run vendor      # re-vendor the crypto from pinned upstream tarballs
npm run n8n:reload  # rebuild and reinstall into a running n8n container
```

`npm publish --dry-run` runs the whole `prepublishOnly` chain (build → lint →
test → verify → scan) without contacting the registry, and without generating
provenance. It is the closest local approximation of a release.

`npm run prepublishOnly` chains build → lint → test → verify → scan, so a
release cannot skip any of them.

### Repo layout

```
src/
  nostr/         protocol + crypto. Depends only on src/vendor and node:crypto.
                 Events, filters, NIP-19, NIP-42, NIP-44, keys.
  relay/         transport. Depends only on src/nostr and the WebSocket global.
                 Connection (NIP-42 state machine), RelayPool, publish/query/
                 subscribe, and timers.ts (see below).
  nodes/         the n8n surface: Nostr (versioned action node), NostrTrigger,
                 and shared parameter/credential helpers.
  credentials/   NostrPrivateKeyApi.
  vendor/        @noble/hashes, @noble/curves, @scure/base. Generated — never
                 hand-edit; run `npm run vendor`.
test/
  vendor-crypto  vendored crypto vs published spec vectors.
  nostr/         NIP-44 official vectors, NIP-19 TLV, event signing, key parsing.
  relay/         message framing, NIP-42 both trigger paths, publish fan-out,
                 query termination, dedup, reconnect. Runs against an in-process
                 relay (test/helpers/mockRelay.ts) — never a real one.
  nodes/         drives the real execute() and trigger() with mock n8n contexts.
  compliance     mirrors n8n's verification rules so violations fail `npm test`.
scripts/
  vendor.mjs     re-vendors crypto reproducibly and rewrites VENDOR.md.
  copy-icons.mjs mirrors *.svg and *.node.json into dist/.
  verify-dist.mjs loads the compiled output under plain node.
  scan.mjs       runs n8n's official community-package analyser.
  n8n-reload.mjs rebuilds and reinstalls into a running container.
```

Layering is enforced by direction: `nostr` never imports `relay`, `relay` never
imports `nodes`, and nothing outside `vendor` reaches for a third-party package.
`test/compliance.test.ts` checks this mechanically.

### Things that will bite you

- **TypeScript is pinned to `~5.8.3` on purpose.** 5.9 tightened `TypedArray`
  variance and the vendored noble code stops compiling. That is the version
  noble itself builds with.
- **`npm run vendor` is the only sanctioned way to change `src/vendor/`.** It is
  reproducible: re-running it on an unchanged tree produces no diff, and it
  rewrites [`VENDOR.md`](./VENDOR.md) with versions and tarball hashes.
- **`dependencies` must stay `{}`.** `npm install --save-dev` will silently drop
  the empty key from `package.json`; put it back. `test/compliance.test.ts`
  fails if it goes missing.
- **Descriptions must not end with a period.** `eslint-plugin-n8n-nodes-base`
  enforces this on node parameters, opposite to normal prose.

## License

[MIT](./LICENSE) © 2026 Jonathan Staab. Vendored and adapted third-party code
retains its own licenses; see [`THIRD_PARTY_LICENSES.md`](./THIRD_PARTY_LICENSES.md).

The node icons are the Nostr community icon by Andrea Nicolini, from
[mbarulli/nostr-logo](https://github.com/mbarulli/nostr-logo), released under
CC0 1.0 (public domain).
