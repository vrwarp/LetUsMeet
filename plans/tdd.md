# Technical Design Document: LetUsMeet

## 1. Introduction
LetUsMeet is a web application designed to facilitate frictionless, intuitive group scheduling. Its core offering revolves around eliminating mandatory account creation for general participants while leveraging Google Calendar integration for power users (organizers). The application uses dual-mode scheduling (exact and fuzzy), a trinary voting system, and a bento grid UI. This Technical Design Document outlines the software architecture to implement the features specified in the PRD, relying on Firebase App Hosting, Cloud Functions for Firebase, Node.js, and Cloud Firestore.

## 2. Architecture Overview
The application will follow a serverless architecture leveraging the Firebase ecosystem.

*   **Frontend (Firebase App Hosting):**
    *   A responsive Web App / Progressive Web App (PWA) built using a modern JavaScript framework (e.g., React or Next.js, as supported by App Hosting).
    *   Responsible for rendering the Bento Grid UI, managing client-side routing, interacting with Firebase Authentication, and calling the backend API.
*   **Backend API (Cloud Functions for Firebase):**
    *   Written in Node.js using TypeScript for improved type safety and maintainability.
    *   Provides business logic for poll creation, voting aggregation, and Google Calendar integration.
    *   Secures sensitive operations (e.g., interacting with external APIs).
*   **Database (Cloud Firestore):**
    *   A NoSQL document database used to store application state, including Users, Polls, and Votes in real-time.
*   **Authentication (Firebase Auth):**
    *   Handles "Zero-Friction Authentication" using Anonymous Authentication for participants.
    *   Provides Google OAuth integration for organizers.

## 3. Data Model (Cloud Firestore)

Firestore will be structured with the following primary collections:

### 3.1 `users` Collection
Stores information about authenticated organizers. Anonymous users typically do not require an explicit document unless caching preferences.
*   `uid` (String, Document ID): Firebase Auth UID.
*   `email` (String): Organizer's email.
*   `displayName` (String): Organizer's name.
*   `googleTokens` (Map): Securely stored OAuth tokens (access and refresh) for Calendar integration. *(Note: Consider storing sensitive tokens securely, potentially encrypting them or utilizing Google Cloud Secret Manager if needed).*
*   `createdAt` (Timestamp)

### 3.2 `polls` Collection
Stores the configuration for each scheduling poll.
*   `pollId` (String, Document ID): Unique identifier (also used in the shareable URL).
*   `organizerUid` (String): Reference to the creator's UID.
*   `title` (String): Meeting title.
*   `location` (String): Meeting location.
*   `schedulingMode` (String): Enum (`"EXACT"`, `"FUZZY"`).
*   `timeSlots` (Array of Maps):
    *   If `EXACT`: `{ id: "t1", startTime: Timestamp, endTime: Timestamp }`
    *   If `FUZZY`: `{ id: "t1", date: String (YYYY-MM-DD), daypart: "Morning" | "Afternoon" | "Evening" }`
*   `status` (String): Enum (`"OPEN"`, `"FINALIZED"`).
*   `finalizedSlotId` (String, optional): The chosen time slot.
*   `createdAt` (Timestamp)

### 3.3 `votes` Collection (Subcollection under `polls`)
Structured as a subcollection `/polls/{pollId}/votes` to ensure strong locality and manageable security rules.
*   `voteId` (String, Document ID): Typically derived from the participant's anonymous UID or a unique identifier.
*   `participantName` (String): Name entered by the user.
*   `participantEmail` (String, optional): Provided for final calendar invites.
*   `selections` (Map): Key-value pairs where key is `timeSlotId` and value is the vote.
    *   e.g., `{ "t1": "YES", "t2": "IF_NEED_BE", "t3": "NO" }`
*   `createdAt` (Timestamp)
*   `updatedAt` (Timestamp)

## 4. API Design (Cloud Functions & TypeScript)

Cloud Functions (callable functions or HTTP endpoints) will expose the core logic.

*   `createPoll(data)`: Validates input and creates a new document in the `polls` collection. Returns the unique `pollId`.
*   `submitVote(pollId, participantData, selections)`: Validates the trinary votes against valid time slots for the poll and records the vote in the subcollection.
*   `getOrganizerCalendar(dateRange)`: Authenticates the organizer and fetches their existing Google Calendar events for the specified range to power the visual overlay during poll creation.
*   `finalizePoll(pollId, selectedTimeSlotId)`:
    1.  Updates the poll status to `FINALIZED`.
    2.  Uses the organizer's stored Google OAuth tokens to create a new event via the Google Calendar API (`/calendar/v3/events`).
    3.  Iterates through the `votes` subcollection to gather participant emails and adds them as attendees to the generated Calendar event.

## 5. Security & Access Control (Firestore Rules)

Firebase Security Rules will enforce the authorization model:
*   `polls`:
    *   Read: Publicly readable (anyone with the URL needs to see poll options).
    *   Create: Requires authentication (organizer).
    *   Update/Delete: Only the `organizerUid` can modify or finalize the poll.
*   `votes`:
    *   Read: Publicly readable (participants need to see the current consensus).
    *   Create: Allowed if the poll is `OPEN`. Requires an anonymous or real UID.
    *   Update: Only the user who created the vote document can modify it.
*   `users`:
    *   Read/Write: Strictly limited to the user themselves (e.g., `request.auth.uid == userId`).

## 6. Frontend & UX Implementation Details

*   **Firebase App Hosting:** The Next.js/React app will be deployed using Firebase App Hosting for optimized delivery, routing, and PWA capabilities (Service Workers for caching).
*   **Zero-Friction Auth Flow:** When a user lands on a poll URL, the app checks for an active Firebase session. If none exists, `signInAnonymously()` is called seamlessly in the background.
*   **Bento Grid Architecture:** CSS Grid will be heavily utilized to compartmentalize information into rounded cards. Responsive breakpoints will ensure the grid collapses gracefully into a vertical scroll on mobile while remaining 100% ad-free.
*   **Trinary Voting Mechanics:**
    *   State management (e.g., React Context or Redux) will track clicks on time slot cards.
    *   Click logic: Initial state (`NO`, gray) -> Click 1 (`YES`, solid green) -> Click 2 (`IF_NEED_BE`, dashed yellow) -> Click 3 (`NO`).
*   **Fuzzy Scheduling Clarity:** The UI components rendering time slots will include conditional logic to render explicit time bounds (e.g., `8:00 AM - 12:00 PM`) when a `FUZZY` "Morning" slot is presented.

## 7. Development Phases Alignment

This project will be developed iteratively in four major phases.

### Phase 1: The Core Engine (MVP)
*   **Goal:** Establish the foundational infrastructure and basic polling capabilities to enable immediate usage without user accounts.
*   **Tasks:**
    *   Set up the Firebase project (App Hosting, Cloud Firestore, Authentication, Functions).
    *   Implement Firestore security rules and define data structures for Polls and Votes.
    *   Create the web frontend with exact scheduling options and a basic participant view.
    *   Implement the core trinary voting mechanic using anonymous sessions.
    *   Develop the unique URL generation system for sharing polls.
    *   Deploy the MVP for initial testing.

### Phase 2: Fuzzy Scheduling & UX Polish
*   **Goal:** Improve flexibility and the overall visual experience.
*   **Tasks:**
    *   Update backend and frontend data models to support "Fuzzy Scheduling" (Text + Date formatting).
    *   Completely overhaul the user interface, migrating to the "Bento Grid" layout using modern CSS Grid and Flexbox techniques.
    *   Ensure the application is fully responsive on all devices and ad-free.
    *   Refine visual states for voting (e.g., colorblind-friendly indicators).

### Phase 3: The Google Ecosystem Integration
*   **Goal:** Empower organizers with advanced features, including Google Calendar integration.
*   **Tasks:**
    *   Enable Google OAuth in Firebase Auth for organizer account creation.
    *   Build out the organizer dashboard to track created polls.
    *   Develop Cloud Functions in TypeScript to securely interact with the Google Calendar API (`/calendar/v3/events`).
    *   Implement the visual overlay for poll creation, fetching an organizer's busy times to prevent conflicts.
    *   Automate standard `.ics` invites and Google Calendar generation upon poll finalization.

### Phase 4: Progressive Web App (PWA) Optimization
*   **Goal:** Maximize app performance, reliability, and edge-case management.
*   **Tasks:**
    *   Configure service workers to cache essential assets (the App Shell).
    *   Implement offline support so participants can view the grid and queue votes even on poor connections.
    *   Optimize Firebase App Hosting deployment for sub-3-second load times.
    *   Add features for organizers to duplicate past polls and set default availability profiles.
