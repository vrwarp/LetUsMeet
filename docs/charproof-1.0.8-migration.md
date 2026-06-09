# charproof 1.0.5 → 1.0.8 migration

This note records what changed in the `charproof` zero-knowledge library between
the version LetUsMeet pinned (`1.0.5`) and the one we now depend on (`^1.0.8`),
and what — if anything — LetUsMeet had to change. References: charproof
`README.md`, `SECURITY.md`, and `firestore.rules` shipped in the 1.0.8 package.

## What we changed in this repo

- **Dependency bump** to `charproof@^1.0.8` (`frontend/package.json` plus the root
  and frontend lockfiles).
- **E2E WebAuthn mock rewrite** (`frontend/e2e/helpers/webauthn-helper.ts`,
  `base-test.ts`). See "Removed: ambient mock switch" below — this is the only
  change with real ramifications for our test suite.

App/runtime code (`firebase.ts`, `pollService.ts`, `Layout.tsx`,
`DashboardPage.tsx`, `useAuth.ts`, the reducer, etc.) needed **no** changes: every
symbol we import is still exported with a compatible signature, `tsc -b` is clean,
the production bundle builds, and the 93 unit tests pass.

## Library changes and how they affect LetUsMeet

### 1. Removed: ambient `window.__MOCK_ZK` / plaintext mock providers (breaking for E2E)

`1.0.5`'s `initializeZK` honored a runtime `window.__MOCK_ZK === "true"` flag and
swapped in plaintext `MockCryptoProvider` / `MockPrfProvider`. `1.0.8` **removes**
that ambient switch and **no longer ships** the mock providers — a deliberate
hardening so no runtime path (XSS, extension) can downgrade production crypto to
plaintext. The only injection point now is an explicit, test-only
`initializeZK({ db, auth, cryptoProvider, prfProvider })`.

Our WebKit/Firefox E2E runs relied on `__MOCK_ZK` (those browsers can't use the
CDP virtual authenticator). With it gone, the app now correctly runs the **real**
`WebCryptoProvider` + `WebAuthnPrfProvider` in every browser.

We did **not** re-introduce an app-level mock (that would undo the hardening).
Instead the E2E harness now stubs the authenticator at the
`navigator.credentials` boundary, which is exactly what the real PRF provider
consumes. The new `mockWebAuthn` is **stateful and device-scoped**: `create`
mints a random credential + PRF secret in that context's `localStorage`; `get`
returns the PRF result only for a credential present on *this* device and throws
`NotAllowedError` otherwise. This reproduces the old per-device passkey semantics
(e.g. the "Silent PRF Recovery from device loss" journey) without any mock code in
the shipped bundle. Chromium is unaffected (it keeps the CDP virtual
authenticator with `hasPrf: true`).

### 2. New: `session.subscribe(onUpdate, onError?)`

`subscribe` now forwards snapshot/processing errors to a second callback.
`pollService.subscribeToLedger` already passed an `onError` (previously ignored),
so ledger error handling now actually fires. No change required.

### 3. New: `session.setAuthorizedSigners(signers)` — evaluated, intentionally not adopted

For multi-writer ledgers SECURITY.md recommends an allowlist so a holder of the
shared symmetric key can't mint a keypair and impersonate another author. This is
**not directly applicable** to LetUsMeet's open-voting model: any link holder may
submit a vote, so there is no fixed signer membership set. Admin authority
(POLL_UPDATED / FINALIZED / UNFINALIZED) is already bound to the genesis signer
key and enforced in `pollReducer.ts` against the cryptographically-verified
`signerPublicKey`, so a participant cannot forge admin events without the admin's
private signing key. The residual concern (sybil/ballot-stuffing via many minted
keypairs) is inherent to open polls and is **not** solved by an allowlist. If we
ever move to closed-membership polls, derive the allowlist from an admin-signed
membership event and call `setAuthorizedSigners` before `subscribe`.

### 4. New: device verification code API — already covered by our UX

`1.0.8` adds `getLocalVerificationCode()` and
`approveDeviceAuthorization(d, { expectedVerificationCode })`. LetUsMeet already
displays the 6-digit code (via the still-exported `generateVerificationCode`) on
both the enrolling and approving devices for human comparison — the recommended
pattern. Passing `expectedVerificationCode` derived from the same pending key
would be tautological (no MITM benefit), so we keep the visual-compare flow.

### 5. Firestore rules / chaff pool — already compliant

The bundled `firestore.rules` requires: per-user key material owner-only;
`polls` + `events` append-only and immutable; `chaff_pool` client-read-only.
Our `firestore.rules` already enforces all of these (and is stricter on event
shape). The 1.0.8 event store writes real and decoy events as
`{ eventId, createdAt: serverTimestamp(), encryptedData, iv }`, which satisfies
our create rule (`serverTimestamp()` resolves to `request.time`). Our
`refreshChaffPool` scheduled function already publishes `chaff_pool/current` with
the `activePollIds` field the store reads. No rules or functions change needed.

## Production / ops follow-ups (no code change, but be aware)

- **WebAuthn PRF is now 256-bit** (was truncated to 128). PRF recovery material
  sealed by older versions will not match; affected users must re-run
  `enablePrfRecovery()` on an authorized device to re-seal under the new key.
- **PBKDF2 is now 600k iterations with a per-record random salt.** Phrase-recovery
  entries created before this change remain readable via a legacy fallback
  (constant salt, 100k), so existing recovery phrases keep working.
- **Decoy writes are now byte-for-byte indistinguishable** from real ciphertext.
  Events remain append-only/immutable, so chaff accumulates permanently — keep
  sync/pagination bounded as the dataset grows.
