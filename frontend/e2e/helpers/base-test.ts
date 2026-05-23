import { test as base, expect, Page, Browser } from '@playwright/test';
import { clearEmulators } from './emulator-helper';
import { setupWebAuthn, clearWebAuthn } from './webauthn-helper';
import { waitForRouterIdle } from './navigation-helper';

export function wrapPageGoto(page: Page) {
  if ((page as any).__gotoWrapped) return;
  (page as any).__gotoWrapped = true;

  const originalGoto = page.goto.bind(page);
  page.goto = async (url, options) => {
    const response = await originalGoto(url, options);
    try {
      await waitForRouterIdle(page, 5000);
      await page.waitForTimeout(500);
    } catch (e) {
      // Safe fallback in case the page doesn't run the React Router app
    }
    return response;
  };
}

// Extend the base test to include automatic emulator clearing and automatic page load waiting
export const test = base.extend<{
  browser: Browser;
  page: Page;
}>({
  browser: async ({ browser }, use) => {
    const originalNewContext = browser.newContext.bind(browser);
    browser.newContext = async (options) => {
      const context = await originalNewContext(options);
      
      // Automatically wrap page.goto for any page opened in this context
      context.on('page', (page) => {
        wrapPageGoto(page);
      });
      
      // Wrap existing pages in the context (if any)
      for (const page of context.pages()) {
        wrapPageGoto(page);
      }
      
      return context;
    };
    await use(browser);
  },
  page: async ({ page }, use) => {
    wrapPageGoto(page);
    await use(page);
  }
});

test.beforeEach(async ({ context }, testInfo) => {
  // Ensure we start with a clean state for every single test
  await clearEmulators();

  // Clear virtual authenticators if chromium
  const isChromium = testInfo.project.name === 'chromium';
  if (isChromium) {
    await clearWebAuthn(context);
  } else {
    // WebKit and Firefox do not support headless virtual authenticators.
    // Inject the mock ZK flag dynamically before any application bundle script runs.
    await context.addInitScript(() => {
      (window as any).__MOCK_ZK = 'true';
    });
  }

  // Setup WebAuthn context
  await setupWebAuthn(context, testInfo);
});

export { expect, waitForRouterIdle };
