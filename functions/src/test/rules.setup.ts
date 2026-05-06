import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Setup for Firestore Security Rules testing.
 */

let testEnv: RulesTestEnvironment;

export async function setupRulesTestEnv() {
  testEnv = await initializeTestEnvironment({
    projectId: 'rules-test-project',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8081,
    },
  });
  return testEnv;
}

export function getTestEnv() {
  return testEnv;
}

export function getAuthenticatedContext(uid: string) {
  return testEnv.authenticatedContext(uid);
}

export function getUnauthenticatedContext() {
  return testEnv.unauthenticatedContext();
}
