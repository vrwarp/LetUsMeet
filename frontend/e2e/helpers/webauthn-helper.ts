import { Page, BrowserContext, TestInfo } from '@playwright/test';

/**
 * Mocks the WebAuthn API (navigator.credentials) to simulate a hardware
 * authenticator with the PRF extension. Used for Firefox and WebKit, which don't
 * support CDP WebAuthn virtualization.
 *
 * The mock is stateful and device-scoped: each `create` mints a fresh random
 * credential + PRF secret persisted in this context's localStorage, and `get`
 * resolves the PRF result only for a credential that exists on THIS "device",
 * throwing `NotAllowedError` otherwise. This faithfully emulates a real
 * authenticator at the `navigator.credentials` boundary, which is exactly what
 * charproof's real `WebAuthnPrfProvider` consumes.
 *
 * Why this lives entirely in the test harness: charproof >=1.0.6 removed the
 * ambient `window.__MOCK_ZK` provider switch (and no longer ships plaintext mock
 * providers) so that no runtime path can downgrade production crypto. Mocking at
 * this layer preserves that guarantee — the app always runs the real WebCrypto
 * provider; only the browser's authenticator is simulated, and only in tests.
 */
export async function mockWebAuthn(page: Page | BrowserContext) {
  const script = `
    if (!window.PublicKeyCredential) {
      window.PublicKeyCredential = class {};
    }

    const STORE_KEY = 'mock_webauthn_credentials';
    const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
    const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    const loadCreds = () => {
      try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); }
      catch (e) { return []; }
    };
    const saveCreds = (creds) => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(creds)); }
      catch (e) { /* private mode / quota — non-fatal */ }
    };

    const originalCreate = navigator.credentials.create.bind(navigator.credentials);
    const originalGet = navigator.credentials.get.bind(navigator.credentials);

    navigator.credentials.create = async (options) => {
      if (options.publicKey && options.publicKey.extensions && options.publicKey.extensions.prf) {
        console.log('[WebAuthn Mock] Intercepted create with PRF');
        // Mint a fresh credential id + PRF secret and persist it for THIS device.
        const rawId = window.crypto.getRandomValues(new Uint8Array(16));
        const prfResult = window.crypto.getRandomValues(new Uint8Array(32));
        const credentialId = b64(rawId.buffer);
        const creds = loadCreds();
        creds.push({ credentialId, prf: b64(prfResult.buffer) });
        saveCreds(creds);
        return {
          id: credentialId,
          rawId: rawId.buffer,
          type: 'public-key',
          response: {
            clientDataJSON: new Uint8Array([]).buffer,
            attestationObject: new Uint8Array([]).buffer,
            getTransports: () => ['internal']
          },
          // Force the provider down its getAssertion() path so the PRF secret is
          // resolved through the same device-scoped lookup as silent recovery.
          getClientExtensionResults: () => ({ prf: { enabled: true } })
        };
      }
      return originalCreate(options);
    };

    navigator.credentials.get = async (options) => {
      if (options.publicKey && options.publicKey.extensions && options.publicKey.extensions.prf) {
        console.log('[WebAuthn Mock] Intercepted get with PRF');
        const allow = options.publicKey.allowCredentials || [];
        const creds = loadCreds();
        let match = null;
        for (const ac of allow) {
          const idB64 = b64(ac.id);
          match = creds.find((c) => c.credentialId === idB64);
          if (match) break;
        }
        if (!match) {
          // No matching passkey on this device — exactly what a real authenticator
          // reports, and what drives the "unrecognized device" recovery gate.
          throw new DOMException('No matching credential on this device.', 'NotAllowedError');
        }
        const prfResult = fromB64(match.prf);
        const rawId = fromB64(match.credentialId);
        return {
          id: match.credentialId,
          rawId: rawId.buffer,
          type: 'public-key',
          response: {
            clientDataJSON: new Uint8Array([]).buffer,
            authenticatorData: new Uint8Array([]).buffer,
            signature: new Uint8Array([]).buffer,
            userHandle: new Uint8Array([]).buffer
          },
          getClientExtensionResults: () => ({
            prf: { results: { first: prfResult.buffer } }
          })
        };
      }
      return originalGet(options);
    };

    window.PublicKeyCredential.isConditionalMediationAvailable = async () => true;
  `;

  if ('addInitScript' in page) {
    await (page as BrowserContext).addInitScript(script);
  } else {
    // It's a Page
    await (page as Page).addInitScript(script);
  }
}

/**
 * Helper to enable virtual WebAuthn authenticator for a context.
 * Chromium only.
 */
export async function enableVirtualAuthenticator(context: BrowserContext) {
  // Inject synchronization script to prevent race conditions
  await context.addInitScript(`
    window.__webauthnReady = false;
    window.__webauthnPromise = new Promise(resolve => {
      window.__resolveWebAuthn = () => {
        window.__webauthnReady = true;
        resolve();
      };
    });

    const originalCreate = navigator.credentials.create.bind(navigator.credentials);
    const originalGet = navigator.credentials.get.bind(navigator.credentials);

    navigator.credentials.create = async (options) => {
      console.log('[WebAuthn Proxy] create called, ready:', window.__webauthnReady);
      await window.__webauthnPromise;
      return originalCreate(options);
    };

    navigator.credentials.get = async (options) => {
      console.log('[WebAuthn Proxy] get called, ready:', window.__webauthnReady);
      await window.__webauthnPromise;
      return originalGet(options);
    };
  `);

  const setupPage = async (page: Page) => {
    try {
      if ((page as any)._cdpSession) {
        console.log(`[WebAuthn] Virtual authenticator already enabled for page: ${page.url()}`);
        return;
      }
      const cdp = await context.newCDPSession(page);
      await cdp.send('WebAuthn.enable');
      await cdp.send('WebAuthn.addVirtualAuthenticator', {
        options: {
          protocol: 'ctap2',
          transport: 'internal',
          hasResidentKey: true,
          hasUserVerification: true,
          isUserVerified: true,
          automaticPresenceSimulation: true,
          hasPrf: true,
          hasHmacSecret: true,
        },
      });
      // Store the session on the page object to prevent it from being potentially garbage collected
      (page as any)._cdpSession = cdp;

      // Ensure ALL future loads of this page are signaled as ready
      await page.addInitScript(`if (window.__resolveWebAuthn) window.__resolveWebAuthn();`);

      // Signal for the current load immediately in case it's already past init
      await page.evaluate(() => {
        if ((window as any).__resolveWebAuthn) (window as any).__resolveWebAuthn();
      }).catch(() => { });

      console.log(`[WebAuthn] Virtual authenticator enabled and signaled for page: ${page.url()}`);
    } catch (e) {
      console.warn(`[WebAuthn] Failed to enable virtual authenticator for page ${page.url()}:`, e);
    }
  };

  // Listen for all future pages in this context
  context.on('page', async (page) => {
    await setupPage(page);
  });

  // Also enable it for any already existing pages
  for (const page of context.pages()) {
    await setupPage(page);
  }
}

/**
 * High-level helper to setup WebAuthn for a context based on the current project.
 */
export async function setupWebAuthn(context: BrowserContext, testInfo: TestInfo) {
  const isChromium = testInfo.project.name.includes('chromium');
  if (isChromium) {
    await enableVirtualAuthenticator(context);
  } else {
    // WebKit/Firefox can't use the CDP virtual authenticator, so stub the
    // authenticator at the navigator.credentials boundary instead. The app still
    // runs the real WebCrypto provider (charproof removed the __MOCK_ZK switch).
    await mockWebAuthn(context);
  }
}

/**
 * Clears any virtual authenticators for a context.
 */
export async function clearWebAuthn(context: BrowserContext) {
  for (const page of context.pages()) {
    try {
      const cdp = await context.newCDPSession(page);
      await cdp.send('WebAuthn.enable').catch(() => { });
      await cdp.send('WebAuthn.clearAuthenticators').catch(() => { });
      // Store the session on the page object to prevent it from being potentially garbage collected
      (page as any)._cdpSession = cdp;
      console.log(`[WebAuthn] Cleared virtual authenticators for page: ${page.url()}`);
    } catch (e) {
      // Ignore
    }
  }
}
