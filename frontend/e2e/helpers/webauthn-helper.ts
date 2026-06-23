import { Page, BrowserContext, TestInfo } from '@playwright/test';

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
    // WebKit/Firefox can't drive the CDP virtual authenticator, and WebKit won't
    // let us override navigator.credentials. Instead, opt this context into
    // charproof's supported mock PRF provider (injected via initializeZK behind the
    // build-time __E2E_HOOKS__ flag). The app still runs the real WebCrypto
    // provider; only the hardware authenticator is simulated.
    await context.addInitScript(() => {
      (window as unknown as { __E2E_MOCK_PRF__?: string }).__E2E_MOCK_PRF__ = 'true';
    });
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
    } catch {
      // Ignore
    }
  }
}
