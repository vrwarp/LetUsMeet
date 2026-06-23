# CLAUDE.md — contributor & agent guide

Concise orientation for humans and AI agents working in this repo. For the full
product/cryptography write-up see [`README.md`](./README.md); for the day-to-day
dev workflow see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Product in one paragraph

LetUsMeet is a real-time, **client-side zero-knowledge** group-scheduling app.
An organizer creates a poll (either **Exact Times** — specific dated slots — or
**Flexible Windows** — fuzzy ranges), shares a link, participants submit
availability **responses**, and the organizer **confirms** a final time. All
poll content and responses are encrypted in the browser before reaching
Firestore; the server stores only opaque ciphertext and structural metadata.
The crypto is provided by the published `charproof` npm package, not by code in
this repo.

## Workspace layout (npm workspaces)

Root `package.json` defines two workspaces: `frontend` and `functions`.

- **`frontend/`** — React 19 + Vite + TypeScript SPA (the whole UI).
  - `src/pages/` — route components: `HomePage`, `CreatePollPage`,
    `VotePollPage`, `ResultsPage`, `EditPollPage`, `DashboardPage`,
    `PrivacyPolicyPage`, `TermsOfServicePage`, `NotFoundPage`. Routes are wired
    in `src/router.tsx` under a single `Layout`.
  - `src/components/` — UI building blocks: `Layout`, `Button` (+ `buttonStyles.ts`),
    `ActionCard`/`CompactActionCard`, `TimeSlotCard`, `ClaimBanner`,
    `DeviceEnrollmentGate`, `ErrorBoundary` (+ `ErrorState`), `ScrollToTop`.
    - `components/toast/` — `ToastProvider` + `useToast()` (success/error/info
      toasts; errors render `role="alert"`, others `role="status"`).
    - `components/confirm/` — `ConfirmProvider` + `useConfirm()` (promise-based
      confirm dialog, `danger`/`warning` variants).
  - `src/hooks/` — `useAuth` (Firebase anonymous/Google/email auth),
    `useFocusTrap` (modal focus management), `useDocumentTitle`.
  - `src/lib/` — app logic that is NOT crypto:
    - `pollService.ts` — thin wrapper over `charproof`'s ledger session
      (create poll, subscribe to the encrypted event ledger, keystore
      subscription, URL helpers, friendly status strings).
    - `pollReducer.ts` — pure deterministic reducer (`calculatePollState`) that
      folds decrypted ledger events (`POLL_CREATED`, `POLL_UPDATED`,
      `POLL_FINALIZED`/`POLL_UNFINALIZED`, `VOTE_UPSERT`, `VOTE_RETRACTED`) into
      the current poll state. Organizer-only actions are gated on the signer
      matching the poll's `adminPublicKey`.
    - `voteUtils.ts`, `recoveryCorrector.ts`, `dndAnnouncements.ts`,
      `clipboard.ts`, and `lib/testing/mockPrfProvider.ts` (E2E-only).
  - `src/firebase.ts` — Firebase app init, emulator wiring, and
    `initializeZK()` from `charproof`. Reads the `VITE_FIREBASE_*` env vars.
  - `src/index.css` — Tailwind v4 entrypoint; design tokens are declared in an
    `@theme { ... }` block (brand colors, fonts, animations).
- **`functions/`** — Firebase v2 Cloud Functions (TypeScript):
  - `extractTimeSlots`, `extractFuzzySlots` — natural-language slot extraction
    via the AI router.
  - `deleteUserAccount` — GDPR account deletion (recursive Firestore delete +
    auth user delete).
  - `refreshChaffPool` — scheduled (every 15 min) traffic-analysis chaff pool.
  - `src/ai/` — provider abstraction: `router.ts` (primary + 1-retry +
    fallback), `cerebrasProvider.ts` (default model `gpt-oss-120b`),
    `geminiProvider.ts` (default model `gemma-4-26b-a4b-it`). Model/provider
    names are configurable via the `LETUSMEET_CONFIG` secret.
  - `src/prompts/` — system prompts and JSON schemas for structured output.
- **Crypto / zero-knowledge** lives in the external **`charproof`** package
  (`frontend/package.json` dependency). It implements WebAuthn PRF derivation,
  the AIRK recovery scheme, AES-GCM payload encryption, the append-only ledger,
  device enrollment, and chaffing.
- **`shared/types.ts`** — shared TypeScript types imported by the frontend (via
  `frontend/src/types/index.ts`). It is a plain file at the repo root, **not** an
  npm workspace (workspaces are only `frontend` and `functions`).
- **`firestore.rules`** — security rules (see table in `README.md`). Notable:
  the keystore/account-keys/pending-devices paths require `request.auth.uid ==
  userId`; `polls/{id}` and its `events` subcollection are world-readable but
  list-blocked and append-only; `chaff_pool` is read-only to clients.
- **`firebase.json`** — emulator ports and hosting/functions config.
- **`docs/`** — historical investigation records (WebKit E2E transport fix,
  charproof migration). Marked as historical at the top; not current TODOs.

## Canonical commands

Run from the repo root unless noted. Node 22 (`.nvmrc`, all `engines`).

| Task | Command |
| :--- | :--- |
| Install all workspaces | `npm install` |
| Build everything | `npm run build` (frontend + functions) |
| Build frontend only | `npm run build --prefix frontend` |
| Lint frontend | `npm run lint --prefix frontend` |
| Unit tests | `npm run test:unit` (builds frontend, then Vitest) |
| Unit-test coverage | `npm run test:coverage` |
| Dev environment | `npm run dev` (Vite + emulator suite, concurrently) |
| E2E (local emulators) | `npm run test:e2e:local` |
| E2E (Docker, per browser) | `npm run test:e2e:chromium` / `:firefox` / `:webkit` |
| Full test pipeline | `npm test` (unit, then Chromium + Firefox E2E) |

Dev URLs: frontend **http://127.0.0.1:5273** (dev script runs
`vite --host 127.0.0.1`), Emulator UI **http://127.0.0.1:4000**.

## Testing conventions

- **Per `.agents/rules/testing.md`: always run tests via `npm test` /
  `npm run test` / `npm run test:*` — never invoke `vitest` or `playwright`
  directly.**
- **Unit:** Vitest + Testing Library, files `src/**/*.{test,spec}.{ts,tsx}`,
  jsdom environment. Current baseline: **100 passing** unit tests.
- **E2E:** Playwright, run inside Docker against the Firebase emulator suite for
  reproducible browser behavior (Chromium, Firefox, WebKit). The WebKit
  Firestore transport quirk is handled in `src/firebase.ts`.
- Build + unit tests must stay green; see CONTRIBUTING for the bar.

## Lint status (be accurate)

ESLint currently reports **~129 errors and a few warnings** (mostly
`@typescript-eslint/no-explicit-any`). This is a **pre-existing baseline** —
do NOT claim the codebase is lint-clean. The bar is: *do not increase* the
error count. Verify with `npm run lint --prefix frontend 2>&1 | tail -3`.

## Key conventions

- **UI terminology (canonical — keep consistent in copy and code):** a unit of
  scheduling is a **poll**; a participant submission is a **response**; the
  creator is the **organizer**; finalizing a time is **confirm**; the two modes
  are **Exact Times** (`schedulingMode: "EXACT"`) and **Flexible Windows**
  (`"FUZZY"`).
- **Accessibility:** prefer the shared infra — `useFocusTrap` for modals,
  `ToastProvider` (alert vs. status roles), `useDocumentTitle` for per-route
  titles, semantic roles/`aria-*` on interactive controls. New interactive UI
  should be keyboard-navigable and screen-reader friendly.
- **Styling:** Tailwind v4 utility classes; add new design tokens to the
  `@theme` block in `src/index.css`, not inline magic values. Buttons go
  through `Button`/`buttonStyles.ts`.
- **Crypto / auth:** do not change cryptographic or authentication logic
  casually. The zero-knowledge guarantees depend on `charproof` and the
  Firestore rules; treat both as security-sensitive. Plaintext poll content and
  responses must never be sent to Firestore.

## Zero-knowledge model (summary)

All poll metadata and responses are encrypted client-side (AES-GCM) and appended
to an immutable per-poll event ledger; clients decrypt and replay events through
`pollReducer` to compute state. User keys are protected by a WebAuthn PRF–derived
Master Keystore Key and an RSA-OAEP recovery scheme (24-word BIP39 phrase →
PBKDF2 protector). Account deletion is cryptographic shredding. Chaffing traffic
masks real read/write patterns. **See `README.md` for the authoritative
cryptographic specification and the exact parameters.**
