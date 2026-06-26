# Contributing to LetUsMeet

Thanks for contributing! This guide covers local setup and the conventions we
keep green. For an architectural orientation read [`CLAUDE.md`](./CLAUDE.md);
for the product and cryptography write-up read [`README.md`](./README.md).

## Prerequisites

- **Node.js 22** — pinned in `.nvmrc` and every workspace's `engines.node`.
  Use `nvm use` (or your manager's equivalent) to match it.
- **Docker** — only needed to run the containerized Playwright E2E suites.
- The Firebase CLI is installed transitively (`firebase-tools` dev dependency);
  the scripts call it via `npx firebase`.

## Project structure (npm workspaces)

The root `package.json` declares two workspaces, **`frontend`** and
**`functions`**. A single `npm install` at the repo root installs all of them.
The zero-knowledge cryptography is the published **`charproof`** npm package (a
`frontend` dependency), so it is installed — not built — from this repo; there
is no `shared/` workspace. See `CLAUDE.md` for what lives where.

## Setup

```bash
# 1. Install all workspace dependencies
npm install

# 2. (Optional) configure the frontend env. The emulators work without it —
#    frontend/src/firebase.ts falls back to demo placeholders.
cp frontend/.env.example frontend/.env.local   # then edit as needed
```

## Running locally

```bash
# Vite dev server + Firebase emulator suite (Auth, Firestore, Functions,
# Hosting, Pub/Sub), run concurrently:
npm run dev

# Persist emulator data across restarts (writes ./firebase-data on exit):
npm run dev-persistent

# Clear persisted emulator data:
npm run clear-persistent
```

- Frontend dev server: **http://localhost:5273** (the dev script runs
  `vite --host localhost`). Use `localhost`, not `127.0.0.1` — WebAuthn
  passkey enrollment rejects bare IPs as an invalid relying-party domain, so
  poll creation fails on the IP host.
- Emulator UI: **http://localhost:4000**.

## Build, lint, test

```bash
# Build both workspaces
npm run build

# Lint the frontend
npm run lint --prefix frontend

# Unit tests (Vitest; builds the frontend first)
npm run test:unit

# Unit-test coverage
npm run test:coverage

# E2E against local emulators (no Docker)
npm run test:e2e:local

# E2E in Docker, per browser
npm run test:e2e:chromium   # or :firefox / :webkit

# Full pipeline: unit tests, then Chromium + Firefox E2E
npm test
```

**Always run tests through the `npm test` / `npm run test:*` scripts**
(per [`.agents/rules/testing.md`](./.agents/rules/testing.md)). Do not invoke
`vitest` or `playwright` directly — the scripts build the frontend and wire up
the emulator suite for you.

## The bar for a change

- `npm run build` must exit 0.
- `npm run test:unit` must stay green (current baseline: **100 passing**).
- **Lint errors must not increase.** ESLint currently reports a pre-existing
  baseline of **~129 errors** (mostly `@typescript-eslint/no-explicit-any`); the
  codebase is *not* lint-clean today. Don't add new violations, and prefer to
  reduce the count when you touch a file. Check with
  `npm run lint --prefix frontend 2>&1 | tail -3`.

## Code style

- **TypeScript** everywhere. Avoid `any`; prefer precise types (the existing
  `any` usages are technical debt, not a pattern to follow).
- **ESLint** is the source of truth for lint rules (`frontend/eslint.config.js`).
- **Tailwind CSS v4.** Use utility classes. Declare new design tokens
  (colors, fonts, animations) in the `@theme { ... }` block in
  `frontend/src/index.css` rather than hard-coding values. Route buttons through
  the shared `Button` component / `buttonStyles.ts`.
- **Accessibility** is a first-class requirement: use `useFocusTrap` for modal
  focus, the toast/confirm providers for transient UI, semantic roles and
  `aria-*` attributes, and keep new interactive UI keyboard-navigable.
- **Terminology** (keep consistent): poll, response, organizer, confirm,
  Exact Times (`EXACT`), Flexible Windows (`FUZZY`).

## Security-sensitive areas

Cryptography and authentication carry the app's zero-knowledge guarantees. Do
not change crypto/auth logic, the `charproof` integration, or `firestore.rules`
without careful review. Plaintext poll content and responses must never be
written to Firestore.

## Commits & branches

- Work on a feature branch; do not commit directly to the default branch.
- Write clear, imperative commit messages describing *what* and *why*
  (e.g. `Fix focus trap restore on modal unmount`).
- Keep build + unit tests green and lint errors non-increasing before opening a
  pull request.
