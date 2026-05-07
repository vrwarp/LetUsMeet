# Technical Design: Phase 3 - Google Ecosystem Integration

## 1. Overview
Phase 3 focuses on enabling organizer accounts through Google OAuth and integrating the Google Calendar API. This allows organizers to see their availability during poll creation and automatically generate calendar events when a poll is finalized.

## 2. Authentication & Token Management

### 2.1 Google OAuth Flow
- **Frontend Initiation:** Organizers sign in using `signInWithPopup` with `GoogleAuthProvider` in the `Layout` component.
- **Scopes:** The application requests `https://www.googleapis.com/auth/calendar.events` and `https://www.googleapis.com/auth/calendar.readonly`.
- **Token Persistence:** Upon successful sign-in, the frontend captures the OAuth `accessToken` and (if provided) the `refreshToken`. These are stored in the Firestore `users` collection under the user's UID.
  - Path: `/users/{uid}/googleTokens`
  - Fields: `accessToken`, `refreshToken` (optional), `expiryDate`.

### 2.2 Backend Authorization
- Cloud Functions use the stored tokens to initialize a `google.auth.OAuth2` client.
- **Token Refresh:** The backend handles automatic token refreshing. If the Google client triggers a `tokens` event (providing a new access token), the backend updates the user's Firestore document.

## 3. Backend Cloud Functions

### 3.1 `getOrganizerCalendar`
- **Purpose:** Fetches busy time slots for the authenticated organizer.
- **API:** Uses `google.calendar.freebusy.query`.
- **Logic:** Accepts a `timeMin` and `timeMax` range. Returns an array of `{ start: string, end: string }` objects representing existing commitments.

### 3.2 `finalizePoll`
- **Purpose:** Finalizes a poll and creates a Google Calendar event.
- **API:** Uses `google.calendar.events.insert`.
- **Logic:**
  - Validates that the caller is the poll organizer.
  - Updates poll status to `FINALIZED`.
  - Collects participant emails from the `votes` subcollection.
  - Creates a calendar event with participants as attendees.
  - Handles timezone-aware scheduling for "Fuzzy" slots by accepting an optional `timezone` parameter.

## 4. Frontend Components

### 4.1 `CalendarOverlay`
- **Purpose:** Displays a visual summary of the organizer's existing commitments.
- **Usage:** Integrated into the `CreatePollPage`.
- **Logic:** Triggered whenever dates are selected or modified. Calls `getOrganizerCalendar` and renders busy slots as small badges to help the organizer avoid conflicts.

### 4.2 `ResultsPage` (Organizer Extensions)
- **Feature:** Added a "Finalize" button in the participation matrix, visible only to the authenticated organizer.
- **Logic:** Triggers `finalizePoll` with the selected slot and the user's local timezone.

## 5. Security & Safety
- **Firestore Rules:** Secure the `users` collection to ensure users can only read/write their own token data.
- **Error Handling:** Frontend components handle unauthenticated states gracefully (e.g., prompting sign-in to see calendar conflicts).
- **Timezones:** Fuzzy slots now use the organizer's local timezone during finalization to ensure correct event placement.
