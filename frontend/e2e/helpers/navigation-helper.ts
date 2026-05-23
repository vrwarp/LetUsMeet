import { Page } from "@playwright/test";

/**
 * Blocks execution until React Router 7 settles into an 'idle' state.
 * This guarantees that React 19 has finished mounting and binding handlers.
 * 
 * @param page Playwright Page instance
 * @param timeout Optional maximum time to wait in milliseconds (default: 5000)
 */
export async function waitForRouterIdle(page: Page, timeout = 10000): Promise<void> {
  await page.waitForFunction(
    () => {
      // Return true only if the application has loaded and router is idle
      return window.__APP_STATUS__?.routerIdle === true;
    },
    null,
    { timeout }
  );
}
