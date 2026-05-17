import { Page, BrowserContext, TestInfo } from '@playwright/test';

/**
 * Mocks the WebAuthn API (navigator.credentials) to simulate PRF extension results.
 * This is used for Firefox and Webkit which don't support CDP WebAuthn virtualization.
 */
export async function mockWebAuthn(page: Page | BrowserContext) {
  const script = `
    if (!window.PublicKeyCredential) {
      window.PublicKeyCredential = class {};
    }

    const originalCreate = navigator.credentials.create.bind(navigator.credentials);
    const originalGet = navigator.credentials.get.bind(navigator.credentials);

    navigator.credentials.create = async (options) => {
      if (options.publicKey && options.publicKey.extensions && options.publicKey.extensions.prf) {
        console.log('[WebAuthn Mock] Intercepted create with PRF');
        // Return a mock credential
        const mockId = new Uint8Array([1, 2, 3, 4]);
        return {
          id: 'mock-id',
          rawId: mockId.buffer,
          type: 'public-key',
          response: {
            clientDataJSON: new Uint8Array([]).buffer,
            attestationObject: new Uint8Array([]).buffer,
            getTransports: () => ['internal']
          },
          getClientExtensionResults: () => ({
            prf: { enabled: true }
          })
        };
      }
      return originalCreate(options);
    };

    navigator.credentials.get = async (options) => {
      if (options.publicKey && options.publicKey.extensions && options.publicKey.extensions.prf) {
        console.log('[WebAuthn Mock] Intercepted get with PRF');
        // Return a mock assertion
        const mockId = options.publicKey.allowCredentials?.[0]?.id || new Uint8Array([1, 2, 3, 4]).buffer;
        
        // Generate a deterministic "PRF" result (32 bytes of zeros or similar)
        const prfResult = new Uint8Array(32).fill(0x42); // 0x42 = 'B'
        
        return {
          id: 'mock-id',
          rawId: mockId,
          type: 'public-key',
          response: {
            clientDataJSON: new Uint8Array([]).buffer,
            authenticatorData: new Uint8Array([]).buffer,
            signature: new Uint8Array([]).buffer,
            userHandle: new Uint8Array([]).buffer
          },
          getClientExtensionResults: () => ({
            prf: {
              results: {
                first: prfResult.buffer
              }
            }
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
  const isChromium = testInfo.project.name === 'chromium';
  if (isChromium) {
    await enableVirtualAuthenticator(context);
  } else {
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
