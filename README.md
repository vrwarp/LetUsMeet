# LetUsMeet 📅

A high-performance, real-time meeting poll application built with **Vite**, **React 19**, and **Firebase**. 

**LetUsMeet** emphasizes **instant synchronization and real-time collaboration**. As users select their availability, votes are broadcasted live to all participants, eliminating the need for page refreshes and providing a seamless scheduling experience.

## 🚀 Architecture: Real-Time Serverless

This project uses a client-centric architecture that eliminates complex backends, prioritizing real-time data sync and rapid UI updates.

- **Frontend**: Vite + React 19 + Tailwind CSS v4.
- **Database**: Cloud Firestore (Direct client-side access).
- **Real-Time Sync**: Leverages Firestore `onSnapshot` to instantly push updates to the UI, so organizers and participants see consensus building in real-time.
- **Accessibility**: Built with inclusive design in mind, ensuring WCAG 2.1 AA compliance across the scheduling and results matrices.
- **Security**: Robust data validation and authorization via **Firestore Security Rules**.
- **Auth**: Firebase Anonymous & Google Authentication for frictionless participation.

## 🛠️ Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Environment**:
   This command concurrently starts the Vite dev server and the Firebase Emulators (Auth, Firestore, Hosting).
   ```bash
   npm run dev
   ```

3. **Access Services**:
   - **App**: [http://localhost:5173](http://localhost:5173)
   - **Firebase UI**: [http://localhost:4000](http://localhost:4000)

## 🧪 Testing

The project utilizes **Vitest** for unit tests and **Playwright** against Firebase Emulators for full End-to-End (E2E) testing.

```bash
# Run all tests (Builds frontend, then runs unit + E2E)
npm test

# Run unit tests only
npm run test:unit

# Run E2E tests with emulators
npm run test:e2e
```

## 📦 Deployment

Deploying the application is a single-step process utilizing Firebase Hosting.

```bash
# Builds the frontend and deploys hosting, firestore rules, and auth configuration
npm run deploy
```

## 🔐 Security & Access Model

LetUsMeet uses a robust "Token-based Organizer" pattern to securely manage polls:
- **Organizer UID**: If the user is logged in via Google Auth, their UID is stored as the poll owner.
- **Admin Token**: If the user is an anonymous guest, a secure UUID is generated and stored locally in their browser. Security rules strictly require this token to allow poll modifications.
- **Claiming Polls**: Guests can seamlessly claim their anonymous polls by signing in later.
- **Vote Integrity**: Rules ensure that a user can only create or modify their own vote, and only while the poll status is `OPEN`. Changes are instantly broadcast to all connected clients.

---
Built with ❤️ by Antigravity.