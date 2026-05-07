# Phase 3: Google Ecosystem Integration Design Document

## Objective
The objective of Phase 3 is to integrate LetUsMeet with the Google Calendar API, allowing organizers to seamlessly log in via Google OAuth, view their scheduling conflicts while creating a poll, and automatically finalize polls by generating Google Calendar events that invite all consenting participants.

## Rationale
To provide "Zero-Friction Authentication", the application previously relied entirely on anonymous sessions. However, power users (organizers) need the ability to track their active polls, visualize their availability to prevent double-booking, and automate the tedious process of sending out calendar invites once a meeting time is agreed upon. Integrating deeply with the Google ecosystem provides these capabilities efficiently.

## Architecture & Implementation Details

### 1. Authentication Updates (Frontend)
- **File:** `frontend/src/hooks/useAuth.ts`
- **Design:** The `useAuth` hook was updated to export `signInWithGoogle` and `signOutUser` functions.
- **Implementation:** `signInWithGoogle` uses Firebase Auth`s `signInWithPopup` using a `GoogleAuthProvider`. Crucially, it requests two scopes:
  - `https://www.googleapis.com/auth/calendar.events` (for creating events upon finalization)
  - `https://www.googleapis.com/auth/calendar.readonly` (for fetching free/busy times)
- **Token Storage:** Upon successful sign-in, the returned `accessToken` (and `refreshToken` if present) are securely stored in the `users` collection in Firestore, keyed by the user`s `uid`. This is necessary because the backend Cloud Functions need these tokens to interact with the Google APIs on the user`s behalf.

### 2. Organizer Dashboard (Frontend & Firestore)
- **Files:** `frontend/src/pages/DashboardPage.tsx`, `firestore.indexes.json`
- **Design:** Authenticated users needed a central place to view their polls. A new Dashboard page was created.
- **Implementation:** The dashboard queries the `polls` collection where `organizerUid == user.uid`, ordering the results by `createdAt` descending.
- **Database Configuration:** Because this query involves an equality filter on one field (`organizerUid`) and a range/order filter on another (`createdAt`), it requires a composite index in Firestore. The `firestore.indexes.json` was updated to include this index configuration, which is deployed alongside the rules.

### 3. Busy Times Overlay (Frontend & Backend)
- **Files:** `functions/src/calendar.ts`, `frontend/src/pages/CreatePollPage.tsx`
- **Design:** When creating a poll with "EXACT" scheduling mode, organizers should see their existing calendar conflicts to avoid proposing busy times.
- **Implementation (Backend):** A new Cloud Function `getOrganizerCalendar` was created. It validates the user`s authentication, retrieves their Google tokens from Firestore, initializes an OAuth2 client with these tokens, and calls `google.calendar.freebusy.query` to get busy slots between `timeMin` and `timeMax`.
- **Implementation (Frontend):** In `CreatePollPage`, an effect runs when `schedulingMode === "EXACT"` and the user is authenticated. It calculates the minimum and maximum dates proposed in the slots, calls the `getOrganizerCalendarAction`, and displays a warning banner listing the conflicting times.

### 4. Poll Finalization & Calendar Sync (Frontend & Backend)
- **Files:** `functions/src/polls.ts`, `frontend/src/pages/ResultsPage.tsx`
- **Design:** Once consensus is reached, the organizer needs to finalize the poll, locking it from further votes, and optionally sending out calendar invites.
- **Implementation (Backend):** The `finalizePoll` Cloud Function was created. It verifies that the caller is the `organizerUid` of the poll. It updates the poll`s `status` to `"FINALIZED"` and records the `finalizedSlotId`. If the `schedulingMode` is `"EXACT"`, it initializes the Google Calendar client. It then iterates through the `votes` subcollection, collecting the emails of participants who voted `"YES"` or `"IF_NEED_BE"` for that specific slot. Finally, it creates a new event on the organizer`s primary calendar, adding those participants as attendees.
- **Implementation (Frontend):** The `ResultsPage` was updated to display a "Finalize Here" button next to each proposed time slot, but only if the current user is the poll`s organizer. Clicking this button calls `finalizePollAction` and updates the UI to reflect the locked state.

## Security Considerations
- **Token Exposure:** Access tokens are stored in Firestore. The security rules strictly limit read/write access to the `users/{uid}` documents to the user themselves. However, it`s crucial that backend functions handling these tokens are robust against injection or SSRF attacks.
- **Authorization:** The `finalizePoll` function strictly verifies that `request.auth.uid === pollData.organizerUid` before taking any action, preventing unauthorized users from finalizing polls.

## Edge Cases Handled
- **Fuzzy Scheduling Finalization:** Calendar invites are only sent out if the scheduling mode is "EXACT". For "FUZZY" modes (e.g., "Morning", "Evening"), the poll is simply marked finalized in the database, as exact timestamps are not available to create a Google Calendar event.
- **Vote Filtering:** Only users who explicitly voted `"YES"` or `"IF_NEED_BE"` for the winning slot are added to the Google Calendar event. Users who voted `"NO"` are excluded.
