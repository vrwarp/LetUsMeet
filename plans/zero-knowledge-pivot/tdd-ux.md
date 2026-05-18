Zero-Knowledge UX Architecture & Implementation Guide
=====================================================

1\. Architectural Reality & UX Philosophy
-----------------------------------------

By implementing end-to-end encryption and event sourcing, LetUsMeet is now a mathematically blind system. The server cannot read data, recover lost keys, or fix user errors. The React frontend is the absolute source of truth and the only line of defense.

This requires a fundamental shift in UX. We must aggressively educate the user, fail closed when cryptographic invariants are missing, and provide absolute transparency about system state. This document provides the concrete implementation steps for the five critical UX friction points introduced by this architecture.

2\. URL Fragment & Link Sharing
-------------------------------

**The Problem:** The database is blind. The poll's Symmetric AES Key exists *only* in the URL fragment (`#key=...`). If a user loses this fragment, the poll is permanently inaccessible. If shared publicly, it grants universal read access.

### 2.1 The Fatal Decryption State

If a user navigates to a poll without the key, the application must hard-crash gracefully. It cannot proceed to fetch data it cannot decrypt.

-   **Target File:** `frontend/src/pages/VotePollPage.tsx`

-   **Implementation:**

    1.  In the initial `useEffect` (or ideally before the component mounts via a loader), parse `window.location.hash`.

    2.  If `!hash.startsWith('#key=')` or the extracted string is not a valid 22-character Base64URL string, immediately set a fatal error state.

    3.  **Render `<FatalDecryptionError />`:** A full-screen, un-dismissible component.

    4.  **Copy:** *"Decryption Key Missing. This poll is end-to-end encrypted and cannot be viewed without the full link. Please request the exact, full link from the organizer."*

### 2.2 Custom "Copy Link" Component

Browsers often truncate fragments when users copy from the address bar. We must force users to use our copy mechanism.

-   **Target File:** `frontend/src/components/ActionCard.tsx` (Add a `CopyShareLink` sub-component).

-   **Implementation:**

    1.  Create a prominent button: `Copy Secure Share Link`.

    2.  Action: `await navigator.clipboard.writeText(window.location.href);`

    3.  **Security Tooltip:** On hover or successful click, display a stark warning: *"Link copied! Anyone with this exact link can decrypt and view this poll. Do not share it publicly."*

3\. PRF Onboarding & The Death of "Forgot Password"
---------------------------------------------------

**The Problem:** The user's dashboard is encrypted by a Master Sync Key derived from their device's hardware authenticator (WebAuthn PRF). We have no "Forgot Password" capability. If they lose the device and don't use a synced Passkey ecosystem (like iCloud/Google), their history is gone forever. Triggering a sudden biometric prompt will confuse and alienate users.

### 3.1 The PRF Educational Interstitial

Before requesting the WebAuthn credential, we must block the UI and educate the user.

-   **Target Files:** `frontend/src/pages/DashboardPage.tsx`, `frontend/src/hooks/useAuth.ts`

-   **Implementation:**

    1.  Define a state machine for the Dashboard unlock sequence: `IDLE` -> `SHOW_INTERSTITIAL` -> `PROMPTING_WEBAUTHN` -> `UNLOCKED` | `FAILED`.

    2.  When an authenticated user navigates to the Dashboard, if the Master Sync Key is not in memory, transition to `SHOW_INTERSTITIAL`.

    3.  **Render `<PrfEducationalInterstitial />`:** A blocking modal.

    4.  **Copy:** *"LetUsMeet is end-to-end encrypted. Your device's Passkey is the only way to unlock your dashboard history. We cannot reset your password or recover your data if you lose this device. Please authenticate to unlock your encrypted keys."*

    5.  The "Unlock" button triggers the `navigator.credentials.get()` call and transitions to `PROMPTING_WEBAUTHN`.

### 3.2 The Hardware Mismatch Error

If the PRF derivation completes, but the resulting key throws an AES decryption error when attempting to unwrap the `users/{uid}/keystore` payload, the device is out of sync.

-   **Implementation:** Catch the `DOMException` from `crypto.subtle.decrypt`.

-   **Render `<HardwareMismatchError />`:** Replace the dashboard view.

-   **Copy:** *"Hardware Key Mismatch. The Passkey on this device cannot decrypt your history. To view your past polls, please use the device where you originally created your account."*

4\. The "Ghosting" of Anonymous Users
-------------------------------------

**The Problem:** Anonymous users store their ECDSA Identity Private Key in `IndexedDB`. If they clear their cache, use a private browsing window, or switch devices, their key is wiped. The system will treat them as a new user, and they will be unable to edit their past votes ("ghosted").

### 4.1 The Volatility Warning Banner

We must explicitly warn unauthenticated users about local storage volatility.

-   **Target File:** `frontend/src/pages/VotePollPage.tsx`

-   **Implementation:**

    1.  Check auth state: `const { user } = useAuth();`.

    2.  If `!user`, render `<AnonymousWarningBanner />` pinned to the top of the view.

    3.  **State Management:** Allow the user to dismiss it. Store `{ anonymousWarningDismissed: true }` in `sessionStorage` so it doesn't reappear on every page reload during that active session, but will reappear if they return days later.

    4.  **Copy:** *"You are voting anonymously. Your secure edit key is stored in this browser. If you clear your browser data or use a different device, you will not be able to edit this vote."*

### 4.2 Ghosted Vote Visual Indicator

When rendering the grid, we must differentiate between votes the user can mathematically edit and those they cannot.

-   **Target File:** `frontend/src/components/TimeSlotCard.tsx`

-   **Implementation:**

    1.  The Reducer outputs a map of votes keyed by ECDSA Public Key.

    2.  Compare the Public Key of each vote row against the user's current local Public Key.

    3.  If they attempt to toggle a selection on a row they do not own, intercept the click.

    4.  Show a toast notification: *"You do not possess the secure key required to edit this vote."*

5\. Voting Interaction & Cryptographic Debouncing
-------------------------------------------------

**The Problem:** In an Append-Only system, every click requires stringifying a payload, ECDSA signing, AES-GCM encryption, and a Firestore network request. Rapid clicking will flood the database and lag the main thread.

### 5.1 The Debouncer Hook

We must decouple UI optimism from cryptographic execution.

-   **Target File:** `frontend/src/hooks/useDebouncedVote.ts` (New File)

-   **Implementation:**

    1.  **Draft State:** Maintain local React state (`draftSelections`) representing the user's active toggles. Update this instantly on click so the UI feels perfectly responsive.

    2.  **Timer:** On click, start/reset a `setTimeout` for 1500ms.

    3.  **Execution:** When the timeout fires, pass the `draftSelections` to the crypto layer. Package the `VOTE_UPSERT` action, sign it, encrypt it, and execute `pollService.appendEvent()`.

### 5.2 Cryptographic Sync Indicator

The user needs visual confirmation that their delayed background sync is occurring.

-   **Target File:** `frontend/src/pages/VotePollPage.tsx`

-   **Implementation:** Add a `<CryptoSyncIndicator />` component near the header, bound to the hook's status.

    -   *Drafting (User clicking):* "Unsaved changes..."

    -   *Syncing (Timeout fired, crypto active):* "Encrypting and syncing..." (with a micro-spinner).

    -   *Success (Firestore ACK):* "Saved securely" (with a checkmark, fading out after 2 seconds).

6\. Decryption Loading States (Honest Loading)
----------------------------------------------

**The Problem:** Decrypting an event ledger (AES-GCM decryption + ECDSA signature verification for 50+ events) takes 200ms - 1000ms. A generic spinner feels like poor performance.

### 6.1 The Honest Loading Screen

We will expose the cryptographic pipeline to the user to reinforce the security model and justify the delay.

-   **Target Files:** `frontend/src/pages/VotePollPage.tsx`, `frontend/src/lib/pollReducer.ts`

-   **Implementation:**

    1.  Replace the generic `<LoadingSpinner />` with `<LedgerLoadingScreen statusText={currentStatus} />`.

    2.  Implement a callback or event emitter in the decryption/reducer pipeline to update the UI state.

    3.  **State Machine Mapping:**

        -   *Network Phase (`pollService.fetchLedger`):* `"Fetching encrypted ledger..."`

        -   *Cryptographic Phase (Looping events):* `"Verifying cryptographic signatures..."`

        -   *Reducer Phase (State mapping):* `"Decrypting poll data..."`

    4.  Once `calculatePollState` resolves, hide the loading screen and mount the interactive poll UI.