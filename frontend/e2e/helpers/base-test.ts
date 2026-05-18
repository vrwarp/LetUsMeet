import { test as base, expect } from '@playwright/test';
import { clearEmulators } from './emulator-helper';
import { setupWebAuthn, clearWebAuthn } from './webauthn-helper';

// Extend the base test to include automatic emulator clearing before each test
export const test = base.extend({});

test.beforeEach(async ({ context }, testInfo) => {
  // Ensure we start with a clean state for every single test
  await clearEmulators();

  // Clear virtual authenticators if chromium
  const isChromium = testInfo.project.name === 'chromium';
  if (isChromium) {
    await clearWebAuthn(context);
  }

  // Setup WebAuthn context
  await setupWebAuthn(context, testInfo);
});

export { expect };
