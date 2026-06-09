// Test-only WebAuthn PRF provider for E2E runs.
//
// WebKit and Firefox can't drive the CDP virtual authenticator that Chromium uses
// (and WebKit won't let tests override `navigator.credentials`), so for those
// browsers we inject this provider through charproof's supported injection point —
// `initializeZK({ db, auth, prfProvider })`. The real WebCrypto provider is still
// used for all actual encryption; only the hardware authenticator is simulated.
//
// IMPORTANT: this is wired up behind the compile-time `__E2E_HOOKS__` flag (see
// `firebase.ts` / `vite.config.ts`), so it is dead-code-eliminated from production
// builds. charproof 1.0.8 deliberately removed its ambient mock switch; keeping the
// mock build-time-only preserves that guarantee (no runtime path can swap providers
// in production).
//
// Behaviour mirrors a real authenticator closely enough for the device flows:
// each credential is bound to THIS browser context via localStorage, and an
// assertion for a credential that doesn't exist on this "device" rejects with
// `NotAllowedError` — which is what drives the "unrecognized device" recovery gate.

interface StoredCredential {
  userId: string;
  credentialId: string;
  prfResultB64: string;
}

const STORE_KEY = "mock_prf_credentials";

function loadCredentials(): StoredCredential[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveCredentials(creds: StoredCredential[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(creds));
  } catch {
    // private mode / quota — non-fatal for tests
  }
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function toB64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromB64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export class MockPrfProvider {
  // Structurally compatible with charproof's PrfProvider.createCredential, which
  // also receives userName/displayName; we don't need them for the mock.
  async createCredential(
    userId: string
  ): Promise<{ credentialId: string; prfResult: Uint8Array }> {
    const creds = loadCredentials();

    // Reuse an existing credential for this user on this device, mirroring a
    // resident passkey that persists across reloads within the same context.
    const existing = creds.find((c) => c.userId === userId);
    if (existing) {
      return {
        credentialId: existing.credentialId,
        prfResult: fromB64(existing.prfResultB64),
      };
    }

    const credentialId = `mock_cred_${userId}_${toB64(randomBytes(6)).replace(/[^a-zA-Z0-9]/g, "")}`;
    const prfResult = randomBytes(32);
    creds.push({ userId, credentialId, prfResultB64: toB64(prfResult) });
    saveCredentials(creds);
    return { credentialId, prfResult };
  }

  async getAssertion(
    credentialIds: string[]
  ): Promise<{ usedCredentialId: string; prfResult: Uint8Array }> {
    const creds = loadCredentials();
    const match = creds.find((c) => credentialIds.includes(c.credentialId));
    if (!match) {
      // No matching passkey on this device — exactly what a real authenticator
      // reports when a credential lives on another device.
      throw new DOMException("No matching credential on this device.", "NotAllowedError");
    }
    return {
      usedCredentialId: match.credentialId,
      prfResult: fromB64(match.prfResultB64),
    };
  }
}
