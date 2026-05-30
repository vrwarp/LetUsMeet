import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

/**
 * Clears the Firestore emulator data for the current project.
 */
export async function clearFirestore() {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'demo-letusmeet';
  const response = await fetch(
    `http://127.0.0.1:8081/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
  if (!response.ok) {
    console.error(`Failed to clear Firestore: ${response.statusText}`);
  }
}

/**
 * Clears the Auth emulator data for the current project.
 */
export async function clearAuth() {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'demo-letusmeet';
  const response = await fetch(
    `http://127.0.0.1:9099/emulator/v1/projects/${projectId}/accounts`,
    { method: 'DELETE' }
  );
  if (!response.ok) {
    console.error(`Failed to clear Auth: ${response.statusText}`);
  }
}

/**
 * Clears the shared Vite ZK Mock Store file.
 */
export async function clearMockZkStore() {
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const storePath = path.join(currentDir, '..', '..', 'mock-zk-store.json');
    if (fs.existsSync(storePath)) {
      fs.writeFileSync(storePath, '{}', 'utf-8');
    }
  } catch (e) {
    console.error(`Failed to clear Mock ZK store: ${e}`);
  }
}

/**
 * Clears both Firestore and Auth emulators, and the Vite mock ZK store.
 */
export async function clearEmulators() {
  await Promise.all([clearFirestore(), clearAuth(), clearMockZkStore()]);

  // Pre-populate the chaff_pool/current document to avoid long-polling stalls on non-existent documents in WebKit
  try {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'demo-letusmeet';
    const chaffUrl = `http://127.0.0.1:8081/v1/projects/${projectId}/databases/(default)/documents/chaff_pool/current`;
    await fetch(chaffUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `projects/${projectId}/databases/(default)/documents/chaff_pool/current`,
        fields: {
          activePollIds: { arrayValue: { values: [] } }
        }
      })
    });
  } catch (e) {
    console.error(`Failed to pre-populate chaff pool: ${e}`);
  }
}
