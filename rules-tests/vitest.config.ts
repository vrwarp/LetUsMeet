import { defineConfig } from 'vitest/config'

// Firestore security-rules tests. These run against the Firestore emulator and
// are launched via `npm run test:rules`, which wraps vitest in
// `firebase emulators:exec` so FIRESTORE_EMULATOR_HOST is set.
export default defineConfig({
  test: {
    include: ['rules-tests/**/*.test.ts'],
    environment: 'node',
    // Every file talks to the same emulator instance; run them serially so
    // clearFirestore() in one file cannot wipe another file's fixtures.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
})
