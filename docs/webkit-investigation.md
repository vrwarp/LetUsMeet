# WebKit E2E Slowness Investigation

**Status: RESOLVED 2026-06-01.** Root cause: on WebKit + the Firestore emulator, setting
BOTH `experimentalAutoDetectLongPolling: true` and `experimentalForceLongPolling: true`
made auto-detect probing break the WebChannel stream, so every `getDoc`/`setDoc` waited
~30s for its stream ack — making genesis (and all write-heavy flows) blow past Playwright's
60s timeouts. **Fix** (`frontend/src/firebase.ts`, scoped to `isWebKitUA && useEmulator` so
production Safari is untouched): force long-polling with `autoDetectLongPolling: false` +
`experimentalLongPollingOptions: { timeoutSeconds: 5 }`.

**Result:** full WebKit suite **23 passed in 3.2 min** (was 14 passed / 9 failed in ~56 min).
`getActiveAmk()` genesis dropped from ~60s to **274ms**.

The detailed reasoning trail (six falsified hypotheses, instrumentation, the read-fix that
worked-but-was-insufficient, and the final transport fix) is preserved in the updates below.

---

(historical) Captured 2026-06-01 during the `mockZkStorage` removal work.

> Note: `mockZkStorage` removal was validated against Chromium + Firefox (both 23/23,
> fast). WebKit was **not** cleanly validated — see the data-quality caveat below. Do
> not assume WebKit is green without an isolated run.

## Symptom

WebKit (and webkit-mobile) E2E suites are functionally green but take ~20–25× longer
than Chromium/Firefox. The app appears to *freeze for 30–45 seconds before continuing*
at various steps. Crypto is mock-mode (instant) and Firebase emulator REST calls
complete quickly, so the lost time is **not** in a slow network fetch or in WebCrypto.

### Empirical baseline (without `mockZkStorage`, charproof `BrowserLocalDeviceStore` active)

| Project        | Result                          | Wall time |
|----------------|---------------------------------|-----------|
| chromium       | 23 passed                       | ~2–3 min  |
| firefox        | 23 passed                       | ~1.8 min  |
| webkit (run A) | 14 passed, 1 flaky, 2 skipped   | 55.8 min  |
| webkit (run B) | 14 passed, **9 failed**, 2 skipped | 49.4 min  |
| webkit-mobile  | 15 passed, 2 skipped            | 55.7 min  |

**Slowness is consistent (~50–56 min); pass/fail is NOT.** Two WebKit runs on identical
code gave 1 flaky vs 9 failed. The failures are timeout-driven — the per-step stalls
cross Playwright's expect/test timeout thresholds.

⚠ **Data-quality caveat:** these runs were launched concurrently (3 background Docker
containers + a foreground `npm test`) on one machine. Resource contention inflates
already-marginal timeouts into hard failures, so the 9-failed rate is contaminated and
must not be read as a clean code signal. Run B was also the *shortest* (49.4m),
consistent with bailing early under contention. **To get a trustworthy WebKit pass/fail
signal, run WebKit alone with nothing else competing for CPU/IO.**

Takeaway: the *stall* is real and roughly fixed-duration per step (good debugging
target); the *failure count* observed here is unreliable.

## UPDATE 2026-06-01 (#6) — read-fix works but is INSUFFICIENT; writes have the same 30s stall (FINAL)

Patched `getAccountKeys` to a bounded read (race `getDoc` vs 3s timeout → treat as
missing) and added a marker around the genesis write. Isolated WebKit run:

```
🔬 [FIX] getAccountKeys bounded-timeout 3s -> null
🔬 [GEN] getAccountKeys END +3002ms          (was 30s — read fix works)
🔬 [GEN] setAccountKeys END +30063ms          (the WRITE is ALSO 30s)
⏳ [Enroll] getActiveAmk() resolved in 33069ms (was 60s)
→ test STILL fails: page.waitForURL Timeout 60000ms (poll creation = more writes)
```

`setAccountKeys` (setDoc) measured at 30063ms / 30065ms / 106ms — i.e. **~30s per write,
intermittent** (first write to a previously-missing doc stalls; some later writes fast).

**Unified root cause (final):** WebKit does not deliver the Firestore watch/long-poll
stream promptly against the emulator. `getDoc` on a missing doc waits ~30s for the initial
snapshot; `setDoc` waits ~30s for the write to echo back through the listener stream. Same
broken stream, both directions. Likely a WebKit response-streaming/buffering issue (chunks
not surfaced to the app until the connection cycles ~30s).

**Conclusion:** there is **no clean app/test-side fix**.
- Read fix (bounded `getDoc`) works but only covers reads.
- The write stall is pervasive (every `setDoc`) and can't be safely bounded — you'd
  proceed before the write is confirmed.
- Transport tuning (3 configs) had no effect on the 30s.

**Recommendation:** exclude WebKit / webkit-mobile from the E2E suite (they are NOT in
`npm test`, and this is a test-environment artifact — real Safari vs real Firestore is not
implicated). Revert all diagnostic instrumentation. If WebKit E2E coverage is ever
required, the fix must live upstream (charproof using bounded/REST one-shot reads AND a
write path that doesn't block on listener echo) or in the Firestore-emulator/WebKit
transport itself — out of scope for app/test code.

---

## UPDATE 2026-06-01 (#5) — transport tuning is a DEAD END; 30s is a fixed missing-doc timeout

Tried `experimentalLongPollingOptions: { timeoutSeconds: 5 }` (WebKit only): `getAccountKeys`
still **30108ms** (vs 30054ms untuned) — zero effect. The ~30s is a FIXED timeout,
immune to the client long-poll timeout setting.

Transport configs tried, all fail:
| Config | getAccountKeys |
|---|---|
| forceLongPolling: true (default) | ~30.0s |
| forceLongPolling: false | ~60s (worse) |
| forceLongPolling: true + timeoutSeconds: 5 | ~30.1s |

Why the `chaff_pool` pre-seed trick can't be reused: it works by making the **exact read
doc exist**. Genesis reads `account_keys/default`, which MUST be absent to trigger setup —
so it can't be pre-seeded. Transport flags don't move the 30s, and the doc can't be made
to exist. **Test-harness/transport tuning is therefore a dead end for the genesis read.**

Remaining viable fixes: (1) exclude WebKit from E2E (not in `npm test`); (2) upstream
charproof change so `getAccountKeys` uses a bounded/one-shot read with fast fallback.

Infra note: the Docker build context was bloating with `frontend/test-results` (the
`.dockerignore` pattern `test-results` didn't match the `frontend/` path) and filled the
disk mid-investigation. Fixed `.dockerignore` (added `frontend/test-results`,
`playwright-report`) and pruned 54GB of Docker cache/images.

---

## UPDATE 2026-06-01 (#4) — ROOT CAUSE CONFIRMED: Firestore getDoc/setDoc stream-confirmation stall on WebKit

Patched charproof's `getActiveAmk`/`setupGenesisDevice` with internal timing markers (via
`scripts/patch-charproof-diagnostic.cjs`, injected in the Docker build after `npm ci`).
Isolated WebKit genesis run:

```
🔬 [GEN] getAccountKeys START
🔬 [GEN] getAccountKeys END +30054ms          ← 30s in the missing-doc getDoc
🔬 [GEN] setupGenesis START
🔬 [GEN] loadDeviceKeys done +5ms
🔬 [GEN] generateDeviceKeyPair END +7ms        ← keypair gen 2ms (mock works; candidate #2 DEAD)
🔬 [GEN] before derivePrfMasterKey +10ms
⏳ [Enroll] getActiveAmk() resolved in 60133ms ← a SECOND ~30s after this point
```

**Confirmed:** `store.getAccountKeys()` — the `getDoc(users/{uid}/account_keys/default)`
of a **non-existent document** — takes **30s** on WebKit. `setupGenesisDevice` compute is
10ms. The remaining ~30s (total 60s) is after `before derivePrfMasterKey`, where the only
Firestore op is the genesis **write** `setAccountKeys()` — almost certainly the same
mechanism (not yet bracketed with a marker).

**Mechanism:** the Firestore SDK's watch/long-poll **stream-confirmation** is
pathologically slow on the Playwright WebKit (GTK/Linux) build against the **emulator**.
The `/Listen` and `/Write` HTTP POSTs return in <100ms (proven), but the SDK promise that
resolves `getDoc` (confirm absence) / `setDoc` (confirm commit) waits ~30s for the stream.
Corroborated by the pre-existing `chaff_pool` pre-seed workaround comment ("avoid
long-polling stalls on non-existent documents in WebKit"). Transport toggling does NOT
help: `forceLongPolling:true` → ~30–45s; `forceLongPolling:false` → ~60s (worse).

**Scope:** reproduces only WebKit + Firestore **emulator** + Playwright. Real Safari vs
real Firestore is unlikely to exhibit this → most likely a TEST-ENVIRONMENT issue, not a
user-facing production bug. `account_keys/default` is per-user and MUST be absent to
trigger genesis, so the `chaff_pool` pre-seed trick can't be applied directly.

**Open fix directions (need a decision):**
1. Test-harness transport: find a Firestore emulator/WebKit config that doesn't stall
   stream confirmations (neither force-long-polling state works; may need a different
   SDK transport or emulator setting).
2. charproof read strategy: `getDocFromServer`/one-shot REST read for `getAccountKeys`
   instead of watch-based `getDoc` (upstream change).
3. Accept WebKit is unsupported in E2E and exclude it from the suite (it's not in
   `npm test`).

NOTE: build-time diagnostic patch lives in `scripts/patch-charproof-diagnostic.cjs` +
`Dockerfile.e2e` RUN step; app-level diagnostics in `firebase.ts`/`useAuth.ts`/
`DeviceEnrollmentGate.tsx`. All uncommitted — revert before shipping.

---

## UPDATE 2026-06-01 (#3) — stall localized to a 45s NON-I/O gap inside setupGenesisDevice

Instrumented the enrollment chain (`enrollDevice`/`getActiveAmk` timing), request
START+END for every non-asset fetch, IndexedDB `open()` timing, AND IndexedDB
transaction (`get`/`put`) timing. One isolated WebKit genesis test:

- `getActiveAmk()` resolves in **45110ms / 60152ms** (varies; >60s → the 60s test
  timeout fires first → hard fail). The post-`setState` gate dismissal is prompt, so the
  delay is entirely inside `getActiveAmk`, NOT React.
- Chronological fetch trace: `getAccountKeys()` getDoc completes at ~10.9s, then **a 45s
  window with ZERO network activity**, then `derivePrfMasterKey` logs "Creating
  credential" at ~55.9s. No fetch starts-without-ending (XHR/fetch both covered).
- IndexedDB `open()`: all <150ms. IndexedDB transactions (`get`/`put`): **all <41ms**
  (69 @ 0–9ms, 8 @ 10–99ms, 77 total). 

  ⚠ CORRECTION: an earlier ad-hoc bucket grep mis-reported "27 tx @ 10–40s, 7 @ >40s";
  that was a regex parsing artifact around the emoji prefix. Re-extraction proved ALL
  IDB transactions are fast. (Recorded so this false lead isn't repeated.)

**Eliminated by direct measurement:** Firestore reads, Firestore writes, transport
(forceLongPolling on AND off both stall), IndexedDB open, IndexedDB transactions, React
render. **The 45s is pure in-JS time inside `setupGenesisDevice`**, in the window between
`loadDeviceKeys()` (fast IDB) and `derivePrfMasterKey()`'s `createCredential` log — i.e.
`generateDeviceKeyPair()` + `exportDevicePrivateKey/PublicKey()` + `getDeviceId()`. These
are supposed to be MockCryptoProvider (instant) under `__MOCK_ZK`, yet consume 45s.

**Leading hypothesis (untested):** despite the "MOCK mode" banner, the **device keypair
generation is NOT actually mocked** (or hits real `crypto.subtle.generateKey` for
RSA-OAEP), and WebKit-in-Docker software RSA keygen / entropy is pathologically slow.
Alternatively a busy-wait/sync-deopt in the mock path. CANNOT be resolved from app-level
instrumentation — needs charproof-internal timing.

**Next experiment:** patch `node_modules/charproof/dist/.../setupGenesisDevice` timing
via a Dockerfile `RUN sed` step (survives `npm ci`, gets bundled by vite), logging before
`generateDeviceKeyPair`, after it, after exports, before `derivePrfMasterKey`. That names
the exact ~45s call. Then the fix follows (ensure the op is genuinely mocked / cheap on
WebKit).

NOTE: working tree currently carries DIAGNOSTIC instrumentation in `firebase.ts`
(fetch + IDB patches), `useAuth.ts` (enroll timing), `DeviceEnrollmentGate.tsx` (gate
timing). All uncommitted; revert before shipping.

---

## UPDATE 2026-06-01 (#2) — instrumentation FALSIFIES the I/O theories; it's a UI state-transition hang

Added direct instrumentation (timed `/Write/channel`, and monkey-patched
`IDBFactory.prototype.open`) and ran device-management on WebKit isolated. Results
**falsify the entire performance framing**, including update #1 below:

| Suspect | Verdict | Evidence |
|---|---|---|
| Firestore reads (T1/T2) | FAST | 62/69 `/Listen/channel` <100ms |
| Firestore writes (T3) | FAST | 46/46 `/Write/channel` <1s (max 858ms) |
| charproof IndexedDB (T4) | FAST | `LetUsMeet_Keys` opens 0–70ms |
| Firebase Auth IndexedDB (T5) | FAST | `firebaseLocalStorageDb` 0–137ms |

**The wall-clock is consumed by 60s Playwright timeouts on UI transitions that don't
happen.** In one device-management run: 5 × `Timeout: 60000ms`, of which 3 were
`getByRole('heading', { name: 'Secure your account' })` **not disappearing** (the
`DeviceEnrollmentGate`), plus a `waitForURL('/poll/…')`. The `Load failed` errors remain
navigation-teardown beacons (red herring).

**Mechanism:** `clickSetupSecureAccess` clicks "Set up secure access" →
`DeviceEnrollmentGate.handleEnroll` → `useAuth.enrollDevice` → `getActiveAmk()` →
`setIsDeviceRegistered(true)`. The gate hides only when `isDeviceRegistered` flips true.
All I/O inside `getActiveAmk` (genesis `setDoc` + IndexedDB writes) is proven fast, yet
the flag flips **tens of seconds late, sometimes >60s → hard failure**. Cross-checking
the earlier partial run (tests *passed* with ~49s gaps) vs this run (gate exceeds 60s →
fail) shows the same operation is **slow-and-variable**, which is why the suite is both
slow AND flaky.

**Conclusion:** this is a **functional / state-propagation problem on WebKit, not slow
I/O.** The hidden delay is somewhere in the `enrollDevice → getActiveAmk → genesis`
chain that is NOT network and NOT IndexedDB — candidates: the charproof PRF
serialization (`globalPrfLock` / `prfPromise` await chain), a `setTimeout`/backoff on the
auth path, React 19 state-flush on WebKit, or a render gate awaiting `document.fonts.ready`.

**Next experiment:** time the enrollment chain itself — wrap `enrollDevice` and log
`performance.now()` before/after `getActiveAmk()`, and add timing inside the
`derivePrfMasterKey` await (app-side can't edit charproof, so instrument at the
`enrollDevice` boundary). One isolated WebKit run then shows whether the seconds are in
`getActiveAmk` (→ charproof PRF/auth chain) or after it returns (→ React/render).

NOTE: the I/O instrumentation (timed writes, `IDBFactory.open` patch) currently lives in
`frontend/src/firebase.ts` as DIAGNOSTIC blocks — remove or gate before shipping.

---

## UPDATE 2026-06-01 (#1, SUPERSEDED) — partial isolated run narrows it to the WRITE path

> Superseded by #2: writes were later proven fast. Kept for the reasoning trail.


A WebKit run in isolation (killed at 18/25, full log preserved) was mined directly.
Findings, with evidence:

1. **Reads are fast and fully logged.** 69/78 `/Listen/channel` returned 200; 62 in
   <100ms, all <6s. Matches the "emulator calls are instant" observation.
2. **The 5s abort wrapper never fired** (`aborted (5s timeout)` count = 0). It is
   irrelevant to the stall and can be removed.
3. **`TypeError: Load failed` errors are a red herring.** All 16 are `RID=rpc …
   TYPE=xmlhttp` WebChannel *terminate beacons* fired at page unload; they fail in
   0–3ms because WebKit is tearing down the document on navigation. They correlate with
   `[hosting] GET /` (new navigation), not with the freeze.
4. **The 30–48s freezes land immediately after `MockPrfProvider.createCredential`**,
   i.e. inside genesis/setup. Example: `02:51:41 [Mock PRF] Creating… + Listen resolved
   13ms` → **48s of silence** → `02:52:29` next activity (teardown beacon + fresh boot).
   14 such gaps (≥8s) totalling ~13 min in the partial run; individual gaps 60–153s.
5. **The diagnostic wrapper only times `/Listen/channel`.** For every other request
   (incl. `/Write/channel`) the `else` branch logs *only on failure* — so successful
   **writes are never logged** (`Write/channel resolved` count = 0, not because writes
   don't happen but because they're untimed). The freeze window's only Firestore traffic
   is the genesis **write** (`setAccountKeys` → `setDoc`), which is precisely the
   untimed path.

**Conclusion (high confidence):** the stall is in **Firestore writes over the WebChannel
`/Write/channel` endpoint under `experimentalForceLongPolling`, hanging ~30–48s on
WebKit** — invisible until now because only reads were instrumented. This is Theory 3
narrowed to the write path, and it explains why manual observation said "reads are
instant" (only reads were logged).

**Remaining ambiguity:** the genesis window also contains an un-instrumented IndexedDB
write (`saveDeviceKeys`, Theory 4). Favoring the Firestore-write explanation: the stalls
recur across many later tests (voting/edits = Firestore writes; only one genesis
IndexedDB write per context), and the *pre-existing* 30–45s predates the IndexedDB store
(it was present with the old localStorage store too).

**Decisive next experiment:** widen the fetch wrapper to time ALL requests (or at least
`/Write/channel`), not just `/Listen/channel`; run WebKit isolated once.
- `Write/channel resolved in ~45000ms` → confirmed transport stall → fix = transport
  selection (e.g. `experimentalForceLongPolling: false` for WebKit, keep auto-detect).
- Writes fast → it's the IndexedDB path (Theory 4) instead → fix = memoize `openDB`.

---

## Key reframe

"Fetches are instant" + "looks like a deadlock before continuing" points away from a
slow network call and toward **time spent sleeping in retry-backoff loops between
fast-but-empty reads**. Those `setTimeout` sleeps are invisible to a `fetch` wrapper.

---

## Theory 1 — `serverTimestamp()` + `orderBy` + backoff loops (strongest)

The genesis event is written with `createdAt: serverTimestamp()`
(`node_modules/charproof/dist/browser/FirestoreLedgerEventStore.js:30`) and read back via:

```js
const q = query(eventsRef, orderBy("createdAt", "asc"), limit(1));
const snapshot = await withRetry(() => getDocs(q));
if (snapshot.empty) return null;
```
(`FirestoreLedgerEventStore.js:118-128`)

Firestore **excludes docs with a still-pending `serverTimestamp()` from `orderBy`
queries on that field**, so the fresh genesis doc returns `snapshot.empty === true`
until the server resolves the timestamp. The caller then spins:

```js
const maxAttempts = 10; let delay = 200;
for (...) { const g = await getGenesisEvent(...); if (g) return ...;
  await new Promise(r => setTimeout(r, delay)); delay = Math.min(delay*1.5, 2000); }
```
(`session.js:56-78`) ≈ **12s** of sleeps. `getLedgerSession` has the same loop
(`session.js:150-163`) ≈ another **12s**. The dashboard decrypts multiple entries →
stacks to 30–45s.

**Fits all facts:** each `getDocs` returns fast-but-empty (fetch log looks instant);
it's `setTimeout` sleeping (not WebCrypto); looks like a freeze before continuing.

**Why WebKit-specific:** under forced long-polling the server-confirmed snapshot that
resolves the timestamp syncs slower on WebKit's WebChannel, so "empty" persists for
more iterations than on Chromium/Firefox.

**Discriminating test:** log iteration count + `snapshot.empty` in the loops. WebKit
burning 6–10 iterations where Chromium burns 0–1 confirms it. Quick check: order by
`__name__` or a client `Date.now()` instead of `serverTimestamp` and see if the stall
vanishes.

---

## Theory 2 — WebKit long-poll stall on not-yet-existent documents (complementary)

`frontend/e2e/helpers/emulator-helper.ts` pre-populates `chaff_pool/current` with the
comment *"to avoid long-polling stalls on non-existent documents in WebKit."* That is a
prior observation that `getDoc`/`onSnapshot` against a **missing** doc under
long-polling hangs ~30s on WebKit (server holds the long-poll open until its timeout
instead of returning "not found" promptly). The genesis read hits
`polls/{ledgerId}/events` right after creation — possibly not server-visible yet — so it
can hit the same stall. The `chaff_pool` getDoc (`FirestoreLedgerEventStore.js:36`) is
on the append path too.

**Discriminating test:** check whether the 30–45s correlates with reads of docs created
moments earlier in the same test. If pre-creating the `polls/{id}` parent doc removes
the stall, confirmed.

---

## Theory 3 — `experimentalForceLongPolling` itself is the trigger

`frontend/src/firebase.ts` forces long-polling in emulator mode
(`experimentalForceLongPolling: useEmulator`). Theories 1 & 2 are both
long-polling-specific failure modes. The 5s `/Listen/channel` abort (currently scoped to
WebKit) is a band-aid over a "network queue lock" (per its own comment): WebKit caps
~6 connections/host, held-open long-poll channels on the Firestore port can starve
subsequent operations, and the SDK falls back to cache (empty) → feeds Theory 1's loops.

**Discriminating test:** set `experimentalForceLongPolling: false` for WebKit only,
keep `experimentalAutoDetectLongPolling`. If the 30–45s collapses, transport is the root
(fix = transport selection, not retry tuning). Risk: auto-detect probing has its own
WebKit latency — measure both.

---

## Theory 4 — IndexedDB `openDB` 10s timeout × N uncached calls (⚠ newly relevant)

`BrowserLocalDeviceStore.getDatabase()` calls `openDB()` **on every store op with no
handle caching**, and `openDB()` has a **10s timeout** (`node_modules/charproof/dist/idb.js:10`).
If WebKit IndexedDB is slow/blocked, 3–4 serial `loadDeviceKeys`/`loadMasterKey`/
`loadIdentity` calls each waiting ~10s ≈ 30–40s.

**Caveat:** the *historical* 30–45s was observed *with* `mockZkStorage` (localStorage, no
IndexedDB), so this was **not** the original cause. But we removed `mockZkStorage`, so
WebKit now routes through this IndexedDB store for the first time — this is a **possible
regression our cleanup introduced for WebKit**, to isolate from the pre-existing issue.

**Discriminating test:** log timing around each `openDB()` on WebKit. Individual opens
~10s confirms it. Real fix would memoize the DB handle (charproof-side).

---

## Lower probability

- **Theory 5 — Auth IndexedDB persistence:** Firebase Auth's default
  `browserLocalPersistence` uses IndexedDB; same WebKit-IDB risk, but would stall
  *sign-in*, not mid-flow "continue" → lower.
- **Theory 6 — real `navigator.credentials` hang:** low, because WebKit runs in
  `__MOCK_ZK` mode using `MockPrfProvider` (no `navigator.credentials` calls). Only
  relevant if the real `WebAuthnPrfProvider` runs before the mock flag is read.

---

## Recommended next step

One full-capture WebKit run (do **not** pipe through `tail` — write the whole log to a
file) with **iteration-count logging inside the `session.js` genesis/ledger backoff
loops**. That single data point separates Theory 1/2 (high iteration counts → sleeping
between fast-empty reads) from Theory 3/4 (low iterations, slow individual awaits →
transport/IndexedDB). Everything above hinges on which world you're in.

Note: most specs don't wire up console logging — only `device-management.spec.ts` calls
`setupConsoleLogs`. Add temporary logging broadly, or run a single instrumented spec.
