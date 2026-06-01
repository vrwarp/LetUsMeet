# WebKit E2E Slowness Investigation

**Status:** Open. Captured 2026-06-01 during the `mockZkStorage` removal work.

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
