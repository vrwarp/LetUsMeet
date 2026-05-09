import firebaseFunctionsTest from "firebase-functions-test";
import { CallableRequest } from "firebase-functions/v2/https";

/**
 * Shared test utilities for Firebase Cloud Functions.
 */

export const testEnv = firebaseFunctionsTest({
  projectId: "letusmeet-6f4e1",
});

/**
 * Creates a mock Auth context for v2 Callable functions.
 */
export const makeAuthContext = (uid: string) => ({
  uid,
  token: {
    email: `${uid}@example.com`,
    email_verified: true,
  } as any,
  rawToken: "mock-token",
});

/**
 * Creates a mock CallableRequest object for v2 functions.
 * Note: v2 functions can often be called directly with this object in tests,
 * but using testEnv.wrap() is sometimes more reliable.
 */
export function makeCallableRequest<T>(data: T, uid?: string): CallableRequest<T> {
  return {
    data,
    auth: uid ? (makeAuthContext(uid) as any) : undefined,
    rawRequest: {
      on: () => {},
      removeListener: () => {},
      get: () => {},
    } as any,
    acceptsStreaming: false,
  };
}
