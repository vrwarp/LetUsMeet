# LetUsMeet

A modern, efficient tool for scheduling group meetings and polls. Built with Next.js 16, Firebase App Hosting, and Cloud Functions (2nd Gen).

## Project Structure

This is a monorepo containing:
- `frontend/`: Next.js application.
- `functions/`: Firebase Cloud Functions (2nd Gen) in TypeScript.

---

## Deployment Guide (Firebase App Hosting)

Deploying a Next.js monorepo to Firebase App Hosting requires specific configuration to handle standalone output and monorepo path resolution.

### 1. Frontend Configuration (`frontend/`)

#### Standalone Build & Path Flattening
Firebase App Hosting expects the standalone output to be at the root of the build directory. In a monorepo, Next.js nests the output (e.g., `.next/standalone/frontend/`). 

We use a "flattening" script in `frontend/package.json` to fix this:
```json
"build": "next build && cp -r .next/standalone/frontend/. .next/standalone/ && rm -rf .next/standalone/frontend"
```

#### Monorepo Path Resolution (`next.config.js`)
Ensure the build process can find the workspace root for tracing dependencies:
```javascript
experimental: {
  outputFileTracingRoot: path.join(__dirname, ".."),
  turbopack: {
    root: path.join(__dirname, ".."),
  },
}
```

### 2. Backend Configuration (`functions/`)

#### ESM and Linting
The functions use `"type": "module"`. Ensure `eslintrc` uses the `.cjs` extension to avoid module scope errors:
- `functions/.eslintrc.js` → `functions/.eslintrc.cjs`

#### Bypassing CORS with Next.js Rewrites
2nd Gen functions often face CORS preflight failures due to 302 redirects between `cloudfunctions.net` and `run.app`. To resolve this, we proxy all function calls through the Next.js server.

1. **Next.js Config**: Add rewrites in `frontend/next.config.js`:
   ```javascript
   async rewrites() {
     return [{
       source: "/api/functions/:path*",
       destination: "https://:path*-wu3h4frdia-uc.a.run.app", // Match your project suffix
     }];
   }
   ```
2. **Frontend Calls**: Use `httpsCallableFromURL` to call the local proxy path:
   ```typescript
   const url = `${window.location.origin}/api/functions/${name.toLowerCase()}`;
   return httpsCallableFromURL(functions, url);
   ```

### 3. Firebase Console Setup

#### Authentication
- **Enable Anonymous Auth**: Required for guest voting.
- **Authorized Domains**: Add your App Hosting domain (e.g., `*.hosted.app`) to the authorized list.

#### Firestore
- **Provision Database**: Ensure the `(default)` database is manually created in the Firebase Console.

#### IAM Permissions (Critical)
Since the frontend server (App Hosting) proxies requests to the functions, you must grant the App Hosting service account permission to invoke the functions:

```bash
gcloud run services add-iam-policy-binding [FUNCTION_NAME] \
  --region=us-central1 \
  --member="serviceAccount:firebase-app-hosting-compute@[PROJECT_ID].iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

---

## Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   cd frontend && npm install
   cd ../functions && npm install
   ```

2. **Run Emulators**:
   ```bash
   npx firebase emulators:start
   ```

3. **Run Frontend**:
   ```bash
   cd frontend && npm run dev
   ```