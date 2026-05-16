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
  // Listen for all future pages in this context
  context.on('page', async (page) => {
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
  });

  // Also enable it for any already existing pages
  for (const page of context.pages()) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('WebAuthn.enable').catch(() => {});
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
    }).catch(() => {});
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
