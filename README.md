# LetUsMeet 📅

A high-performance, real-time meeting poll application built with **Vite**, **React**, and **Firebase**.

## 🚀 Architecture: Classic Firebase (Serverless)

This project uses a simplified, client-centric architecture that eliminates the need for complex backend deployments and CORS proxies.

- **Frontend**: Vite + React 19 + Tailwind CSS (via Vanilla CSS modules).
- **Database**: Cloud Firestore (Direct client-side access).
- **Real-time**: Leverages Firestore `onSnapshot` for instant UI updates across all participants.
- **Security**: Robust data validation and authorization via **Firestore Security Rules**.
- **Auth**: Firebase Anonymous & Google Authentication.

## 🛠️ Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Environment**:
   This command starts the Vite dev server and the Firebase Emulators (Auth & Firestore) simultaneously.
   ```bash
   npm run dev
   ```

3. **Access Services**:
   - **App**: [http://localhost:5173](http://localhost:5173)
   - **Firebase UI**: [http://localhost:4000](http://localhost:4000)

## 🧪 Testing

The project uses **Vitest** for unit testing and the Firebase Emulator for integration tests.

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run E2E tests with emulators
npm run test:e2e
```

## 📦 Deployment

Deploying the application is now a single-step process.

1. **Build the Frontend**:
   ```bash
   npm run build
   ```

2. **Deploy to Firebase Hosting / App Hosting**:
   Since the backend has been decommissioned, you only need to deploy the static assets and security rules.
   ```bash
   npx firebase deploy --only hosting,firestore:rules
   ```

## 🔐 Security Model

We use a "Token-based Organizer" pattern for polls:
- **Organizer UID**: If the user is logged in, their UID is stored as the owner.
- **Admin Token**: If the user is a guest, a secure UUID is generated and stored locally. Security rules allow updates if this token is provided in the request data.
- **Vote Integrity**: Rules ensure that a user can only create or modify their own vote, and only while the poll status is `OPEN`.

---
Built with ❤️ by Antigravity.