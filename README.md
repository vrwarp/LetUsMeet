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
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, ".."),
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};
```


### 2. Backend Configuration (`functions/`)

#### ESM and Linting
The functions use `"type": "module"`. Ensure `eslintrc` uses the `.cjs` extension to avoid module scope errors:
- `functions/.eslintrc.js` → `functions/.eslintrc.cjs`

#### Bypassing CORS with Secure API Proxy
2nd Gen functions often face CORS preflight failures due to redirects between `cloudfunctions.net` and `run.app`. We solve this by proxying all calls through a secure Next.js API Route that signs requests with the App Hosting server's identity.

1. **Secure Proxy Route**: Requests are handled by `frontend/src/app/api/functions/[name]/route.ts`. This route fetches an ID token from the Google Metadata Server and forwards it to the private Cloud Function.
2. **Frontend Calls**: Use `httpsCallableFromURL` in `pollApi.ts` to call the local proxy path:
   ```typescript
   const url = `${window.location.origin}/api/functions/${name.toLowerCase()}`;
   return httpsCallableFromURL(functions, url);
   ```

### 3. Firebase Console Setup

#### IAM Permissions (Critical)
Since the frontend server (App Hosting) proxies requests, you must grant it permission to invoke your Cloud Run functions. You can do this for the whole project at once:

```bash
# Grant the App Hosting service account permission to call ANY Cloud Run service in this project
gcloud projects add-iam-policy-binding letusmeet-6f4e1 \
  --member="serviceAccount:firebase-app-hosting-compute@letusmeet-6f4e1.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

#### Authentication
- **Enable Anonymous Auth**: Required for guest voting.
- **Authorized Domains**: Add your App Hosting domain (e.g., `*.hosted.app`) to the authorized list.

#### Firestore
- **Provision Database**: Ensure the `(default)` database is manually created in the Firebase Console.

### Troubleshooting 401/403 (Unauthorized/Forbidden)
If you see 401/403 errors in your App Hosting logs:
1. Ensure the **IAM Permissions** command above was run successfully.
2. Ensure your function names in the Cloud Run dashboard match the names being called (all lowercase).



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