### **Product Requirements Document (PRD)**

**Product Name:** LetUsMeet
**Objective:** To build a frictionless, highly intuitive group scheduling web application that eliminates back-and-forth coordination messaging.[1] The platform prioritizes rapid participation by removing mandatory account creation while offering robust Google Calendar integration for power users.

**Core Capabilities & Features:**
1. **Zero-Friction Authentication:** 
   * Participants are never required to create an account, download an app, or remember a password to vote.[2]
   * Organizers can use Google OAuth for one-click account creation to save polls, manage dashboards, and sync calendars.
2. **Dual-Mode Scheduling:**
   * **Exact Scheduling:** Organizers can propose specific dates and exact time slots (e.g., Monday, Nov 12th at 10:00 AM).
   * **Fuzzy Scheduling:** Organizers can propose dates accompanied by text-based dayparts (e.g., "Morning," "Afternoon," "Evening") for flexible coordination when exact hours are not yet necessary.
3. **Trinary Voting System:**
   * Replicating the most effective consensus mechanic, participants vote on time slots using three options: "Yes," "No," and "If-need-be" (If I have to).[3] This granular compromise vector breaks scheduling deadlocks.
4. **Google Calendar Integration:**
   * Bidirectional sync via the Google Calendar API. Organizers see their existing calendar conflicts visually overlaid on the poll creation screen to prevent double-booking. 
   * Once a time is finalized, the app autonomously generates the Google Calendar event and dispatches it to all participants who provided an email address.

---

### **User Journeys**

**Journey 1: The Authenticated Organizer**
1. **Initiation:** The user lands on the homepage and clicks "Sign in with Google."
2. **Poll Creation:** The organizer clicks "Create New Poll." They input the meeting title and location.
3. **Time Proposal:** The organizer's Google Calendar is fetched and displayed. They select dates. The system asks: *"Do you want to propose exact times or general times of day?"* 
   * If *General*, they select "Morning," "Afternoon," or "Evening" blocks.
   * If *Exact*, they click and drag over specific calendar hours.
4. **Distribution:** The system generates a secure, unique URL. The organizer copies the link and pastes it into their preferred communication channel (Slack, email, WhatsApp).
5. **Finalization:** After votes roll in, the organizer reviews the dashboard, selects the winning time slot, and clicks "Finalize." The app automatically pushes the event to their Google Calendar.

**Journey 2: The Anonymous Participant**
1. **Access:** The participant receives the link and clicks it. It opens instantly in their mobile or desktop browser without a login wall.[2]
2. **Orientation:** They see the meeting details, who invited them, and a clean grid of proposed dates and times (or dayparts).
3. **Voting:** They click the slots to cycle through their choices: one click for "Yes," two clicks for "If-need-be," and they leave it empty for "No".[3]
4. **Submission:** They click "Continue," type their name, optionally add their email (to receive the final calendar invite), and click "Submit".[3] 

---

### **UX Requirements**

**1. "Bento Grid" Architecture:**
To present complex scheduling data without visual clutter, the interface will utilize a Bento grid layout. Information is compartmentalized into neat, rounded-corner cards. This prevents cognitive overload and maintains a premium, tactile feel, especially on mobile devices.

**2. Fuzzy Scheduling Clarity:**
When using "Morning, Afternoon, Evening" options, the UX must clearly define what those blocks mean to avoid timezone or cultural confusion. For example, the "Morning" card should subtly display "(8:00 AM - 12:00 PM)" beneath it. 

**3. Ad-Free Mobile Web Optimization:**
The platform must function flawlessly as a responsive web app. Unlike competitors whose mobile web experiences are broken by intrusive display ads [4], this interface must remain strictly ad-free, dedicating 100% of the screen real estate to the voting bento grid and essential buttons.

**4. Visual Trinary Indicators:**
The Yes/No/If-need-be voting states must be colorblind-friendly and instantly recognizable:
*   **Yes:** Solid green card with a checkmark icon.
*   **If-need-be:** Yellow card with a dashed outline or warning icon.
*   **No:** Empty, neutral gray card.

---

### **Product Implementation Phases**

**Phase 1: The Core Engine (MVP)**
*   **Focus:** Core polling logic and anonymous participation.
*   **Deliverables:** 
    *   Database architecture to handle polls, dates, and anonymous user sessions.
    *   UI/UX for creating basic polls with *exact* time and date options.
    *   Participant view with the trinary voting mechanic (Yes/No/If-need-be).[3]
    *   Unique URL generation and sharing capabilities.

**Phase 2: Fuzzy Scheduling & UX Polish**
*   **Focus:** Expanding time options and implementing the Bento Grid design.
*   **Deliverables:**
    *   Introduce the "Text + Date" (Morning/Afternoon/Evening) scheduling feature.
    *   Migrate the frontend to the modular Bento grid layout for both desktop and mobile.
    *   Implement responsive design rules to ensure the voting grid scrolls cleanly on small screens without breaking.

**Phase 3: The Google Ecosystem Integration**
*   **Focus:** Organizer accounts and calendar syncing.
*   **Deliverables:**
    *   Implement Google OAuth for organizer account creation and login.
    *   Integrate the Google Calendar API (`/calendar/v3/events`).
    *   Build the visual overlay that displays the organizer's existing Google Calendar events during the poll creation step.
    *   Automate calendar event creation when a poll is finalized, dispatching standard `.ics` invites or direct Google Calendar invites to participants.

**Phase 4: Progressive Web App (PWA) Optimization**
*   **Focus:** Speed, reliability, and edge-case management.
*   **Deliverables:**
    *   Convert the web app into a high-performance PWA with sub-3-second load times.
    *   Implement Service Workers to cache the app shell, allowing participants to load the voting grid even on poor network connections.
    *   Develop a dashboard for organizers to view past polls, duplicate common meeting types, and manage their default availability.