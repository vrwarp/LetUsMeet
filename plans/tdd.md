# Technical Design Document: LetUsMeet

## 1. Introduction
LetUsMeet is a web application designed to facilitate frictionless, intuitive group scheduling. Its core offering revolves around eliminating mandatory account creation for general participants while providing organizers with robust tools to manage polls. The application leverages a high-performance "Bento Grid" UI, a trinary voting system, and dual-mode scheduling (exact and fuzzy). 

Following a pivot to a leaner architecture, the application has moved away from heavy third-party integrations (like Google Calendar API for event creation) in favor of a privacy-focused, internal scheduling engine. This Technical Design Document outlines the current serverless architecture implemented using Firebase App Hosting, Cloud Functions for Firebase v2, and Cloud Firestore.

## 2. Architecture Overview
The application follows a serverless, event-driven architecture designed for high scalability and low maintenance.

*   **Frontend (Firebase App Hosting):**
    *   **Framework:** Next.js (App Router) for hybrid rendering (SSR for SEO/initial load, CSR for interactivity).
    *   **Design System:** Tailwind CSS v4, utilizing its new high-performance engine for complex grid layouts.
    *   **Icons:** Lucide React for consistent, lightweight vector icons.
    *   **State Management:** React Context API for application-wide state (e.g., Auth, Notifications) and localized React Hooks for component-level state.
*   **Backend API (Cloud Functions for Firebase v2):**
    *   **Language:** TypeScript, providing rigorous type checking for business logic.
    *   **Interface:** HTTPS Callable Functions (2nd Gen) for automatic authentication context and seamless integration with the Firebase SDK.
    *   **Middleware:** Zod-based validation layer for all incoming requests to ensure schema integrity.
*   **Database (Cloud Firestore):**
    *   **Structure:** NoSQL document-oriented storage.
    *   **Capabilities:** Real-time data synchronization to power live voting updates on the Bento Grid.
*   **Authentication (Firebase Auth):**
    *   **Anonymous Auth:** Enables "Zero-Friction" voting for participants.
    *   **Google OAuth:** Provides persistent identity for organizers to track their polls across devices.

## 3. Data Model (Cloud Firestore)

Firestore is structured into two primary top-level collections and one nested subcollection.

### 3.1 `polls` Collection
Stores the configuration for each scheduling event.
*   `pollId` (String, Document ID): Unique identifier used in the shareable URL.
*   `organizerUid` (String | null): Reference to the creator's UID (if authenticated).
*   `organizerName` (String): The display name of the creator.
*   `organizerEmail` (String): The contact email for the creator.
*   `adminToken` (String): A UUID generated at creation, allowing anonymous organizers to edit their polls.
*   `title` (String): The meeting or event title.
*   `description` (String, optional): Additional context or notes.
*   `location` (String, optional): Physical address or virtual link.
*   `schedulingMode` (Enum: `"EXACT"`, `"FUZZY"`): Determines the rendering of time slots.
*   `timeSlots` (Array of Maps):
    *   **If `EXACT`**: `{ id: string, startTime: ISOString, endTime: ISOString }`
    *   **If `FUZZY`**: `{ id: string, date: YYYY-MM-DD, label: string, time?: string }`
*   `status` (Enum: `"OPEN"`, `"FINALIZED"`): Controls voting availability.
*   `finalizedSlotId` (String, optional): The ID of the winning time slot.
*   `createdAt` (ISOString): Timestamp of creation.

### 3.2 `votes` Collection (Subcollection under `polls`)
Located at `/polls/{pollId}/votes` to ensure strong data locality and efficient security rules.
*   `voteId` (String, Document ID): Unique ID for the specific vote.
*   `participantUid` (String): The UID of the voter (from Firebase Auth).
*   `participantName` (String): The name entered by the user during voting.
*   `participantEmail` (String, optional): Optional contact info for the voter.
*   `selections` (Map): Key-value pairs where the key is `timeSlotId` and the value is `VoteValue`.
    *   `VoteValue` Enum: `"YES"`, `"NO"`, `"IF_NEED_BE"`.
*   `createdAt` (ISOString): Original vote timestamp.
*   `updatedAt` (ISOString): Timestamp of the last edit.

## 4. API Design (Cloud Functions & TypeScript)

All business logic is encapsulated in 2nd-gen HTTPS Callable Functions.

*   **`createPoll(data)`**: 
    *   **Inputs**: Title, Location, Mode, TimeSlots, Organizer Details.
    *   **Process**: Validates data via Zod, generates `adminToken`, and initializes the poll document.
    *   **Returns**: `pollId` and `adminToken`.
*   **`getPoll(pollId)`**:
    *   **Process**: Fetches poll metadata, all associated vote documents, and calculates pre-aggregated counts for the UI.
    *   **Returns**: Poll object, Votes array, and VoteCounts map.
*   **`updatePoll(data)`**:
    *   **Inputs**: `pollId`, `adminToken` (or Auth context), and updated fields.
    *   **Security**: Verifies that the `adminToken` matches the document or `auth.uid` matches `organizerUid`.
*   **`submitVote(data)`**:
    *   **Inputs**: `pollId`, `participantName`, `selections`.
    *   **Process**: Creates or updates a vote document in the subcollection. Prevents voting on finalized polls.
*   **`deleteVote(data)`**:
    *   **Security**: Ensures the `participantUid` of the document matches the caller's UID.
*   **`finalizePoll(data)`**:
    *   **Process**: Updates `status` to `"FINALIZED"` and records the `selectedTimeSlotId`.

## 5. Security & Access Control (Firestore Rules)

Rules are designed to balance open participation with data integrity.

*   **Poll Access**:
    *   `read`: Allowed for everyone with the `pollId`.
    *   `create`: Allowed for anyone; data must pass structural validation.
    *   `update`: Allowed if `request.auth.uid == resource.data.organizerUid`. (Note: `adminToken` updates are handled via backend Functions).
*   **Vote Access**:
    *   `read`: Allowed for everyone.
    *   `write`: Allowed if `request.auth.uid == request.resource.data.participantUid`. This ensures users can only create/edit their own votes.

## 6. Frontend & UX Implementation Details

*   **Bento Grid Architecture**: 
    *   Uses CSS Grid with `auto-fit` and `minmax` patterns to create a layout that feels fluid and organic.
    *   Cards represent different data points: Poll Info, Participant List, Time Slots, and Action Center.
*   **Trinary Voting Mechanic**:
    *   **States**: gray (default/No) -> green (Yes) -> yellow-dashed (If Need Be).
    *   **Logic**: A simple state machine transitions through these states on click, stored locally in React state before submission.
*   **Accessibility (a11y)**:
    *   High-contrast color palettes.
    *   Aria-labels for all interactive voting elements.
    *   Pattern-based visual differences (e.g., solid vs. dashed borders) to support colorblind users.

## 7. Development Phases Alignment

### Phase 1: Foundational Engine (Completed)
*   Baseline Firebase configuration (Hosting, Functions, Firestore).
*   Core Trinary Voting logic and anonymous authentication flow.
*   Exact scheduling implementation.

### Phase 2: UX Refinement & Fuzzy Mode (Completed)
*   Migration to Next.js App Router.
*   Implementation of the "Bento Grid" design system with Tailwind CSS.
*   Support for "Fuzzy" time slots (Labels + Dates).

### Phase 3: Organizer Dashboard & Security (Current)
*   Google OAuth integration for organizers.
*   Admin dashboard for managing multiple active and finalized polls.
*   Refined security rules and admin token management.

### Phase 4: Performance & PWA Optimization (Upcoming)
*   Service worker implementation for offline voting capabilities.
*   Performance tuning for sub-second page loads on mobile networks.
*   Automated notification system for poll finalization.
