import { test, expect } from './helpers/base-test';
import { BrowserContext, Page } from '@playwright/test';
import { setupWebAuthn } from './helpers/webauthn-helper';
import { mockGoogleSignIn, clickSetupSecureAccess } from './helpers/auth-helper';

async function waitForDashboardReady(page: Page) {
  await expect(page.getByText('Loading your polls...')).not.toBeVisible({ timeout: 150000 });
  await expect(page.getByTestId('dashboard-title')).toBeVisible({ timeout: 15000 });
}

function setupConsoleLogs(page: Page, label: string) {
  page.on('console', msg => {
    console.log(`[BROWSER ${label}] ${msg.type()}: ${msg.text()}`);
  });
}

test.describe('Device Management & Recovery', () => {
  let sponsorContext: BrowserContext;
  let newDeviceContext: BrowserContext;

  test.beforeEach(async ({ browser }, testInfo) => {
    sponsorContext = await browser.newContext();
    newDeviceContext = await browser.newContext();

    await setupWebAuthn(sponsorContext, testInfo);
    await setupWebAuthn(newDeviceContext, testInfo);
  });

  test.afterEach(async () => {
    await sponsorContext.close();
    await newDeviceContext.close();
  });

  test('User Journey: Initial Setup & Authorizing a New Device', async () => {
    const email = `device-test-${Date.now()}@example.com`;
    const sponsorPage = await sponsorContext.newPage();
    const newPage = await newDeviceContext.newPage();
    setupConsoleLogs(sponsorPage, 'SPONSOR');
    setupConsoleLogs(newPage, 'NEW');

    // 1. Sponsor Setup
    await sponsorPage.goto('/');
    await mockGoogleSignIn(sponsorPage, email);
    await clickSetupSecureAccess(sponsorPage);

    await sponsorPage.goto('/create');
    await sponsorPage.getByTestId('organizer-name-input').fill('Sponsor User');
    const pollTitle = `Device Test Poll ${Date.now()}`;
    await sponsorPage.getByTestId('poll-title-input').fill(pollTitle);
    await sponsorPage.getByTestId('add-slot-btn').click();
    await sponsorPage.getByTestId('create-submit-btn').click();

    await sponsorPage.waitForURL(url => url.pathname.startsWith('/poll/') && url.hash.includes('key='), { timeout: 60000 });

    await sponsorPage.goto('/dashboard');
    await waitForDashboardReady(sponsorPage);
    await expect(sponsorPage.locator('h2', { hasText: pollTitle })).toBeVisible({ timeout: 15000 });

    // 2. New Device Login
    await newPage.goto('/');
    await mockGoogleSignIn(newPage, email);

    // Verify "Unrecognized Device" error
    await newPage.goto('/dashboard');
    await expect(newPage.getByTestId('mismatch-error')).toBeVisible({ timeout: 15000 });
    await expect(newPage.getByText(/Unrecognized Device/i)).toBeVisible();

    // 3. Request Authorization
    await newPage.getByTestId('request-auth-btn').click();
    await expect(newPage.getByTestId('auth-pending-msg')).toBeVisible({ timeout: 15000 });

    const verificationCode = await newPage.locator('.font-mono.text-3xl').textContent();
    expect(verificationCode?.trim()).toBeTruthy();

    // 4. Sponsor Approves
    try {
      await sponsorPage.bringToFront();
    } catch (e) {
      console.warn("bringToFront failed on sponsorPage, continuing:", e);
    }
    const requestItem = sponsorPage.getByTestId('pending-auth-request').first();
    await expect(requestItem).toBeVisible({ timeout: 20000 });
    await expect(requestItem.getByText(verificationCode!.trim())).toBeVisible();

    const approveBtnSponsor = requestItem.getByTestId('approve-auth-btn');
    await expect(approveBtnSponsor).toBeVisible();
    await approveBtnSponsor.click();

    // 5. New Device should detect and reload automatically
    await expect(newPage.getByTestId('mismatch-error')).not.toBeVisible({ timeout: 30000 });
    await newPage.goto('/dashboard');
    await waitForDashboardReady(newPage);
    await expect(newPage.locator('h2', { hasText: pollTitle })).toBeVisible({ timeout: 15000 });
  });

  test('User Journey: Device Revocation & AMK Rotation', async () => {
    const email = `revoke-test-${Date.now()}@example.com`;
    const sponsorPage = await sponsorContext.newPage();
    const newPage = await newDeviceContext.newPage();
    setupConsoleLogs(sponsorPage, 'SPONSOR');
    setupConsoleLogs(newPage, 'NEW');

    // 1. Setup both devices
    await sponsorPage.goto('/');
    await mockGoogleSignIn(sponsorPage, email);
    await clickSetupSecureAccess(sponsorPage);
    await sponsorPage.goto('/dashboard');
    await waitForDashboardReady(sponsorPage);

    await newPage.goto('/');
    await mockGoogleSignIn(newPage, email);

    await newPage.goto('/dashboard');
    await newPage.getByTestId('request-auth-btn').click();

    await sponsorPage.goto('/dashboard');
    const approveBtn = sponsorPage.getByTestId('approve-auth-btn').first();
    await expect(approveBtn).toBeVisible({ timeout: 15000 });
    await approveBtn.click();

    await expect(newPage.getByTestId('mismatch-error')).not.toBeVisible({ timeout: 30000 });

    // 2. Sponsor Revokes New Device
    try {
      await sponsorPage.bringToFront();
    } catch (e) {
      console.warn("bringToFront failed on sponsorPage (revoke), continuing:", e);
    }
    await waitForDashboardReady(sponsorPage);

    const isMobile = sponsorPage.viewportSize()?.width != null && sponsorPage.viewportSize()!.width < 768;

    if (isMobile) {
      // Mobile: tap device node to open the Authorized Devices modal, then revoke from there
      const deviceNode = sponsorPage.getByTestId('device-item').filter({ hasNotText: '(Current)' });
      await expect(deviceNode).toBeVisible({ timeout: 15000 });
      await deviceNode.tap();

      // Wait for the modal to appear
      const modalRevokeBtn = sponsorPage.getByTestId('revoke-device-btn-modal');
      await expect(modalRevokeBtn).toBeVisible({ timeout: 10000 });

      // The modal's revoke button opens a styled confirm dialog; confirm it.
      await modalRevokeBtn.tap();
      await sponsorPage.getByTestId('confirm-dialog-confirm').click();
    } else {
      // Desktop: revoke button is directly visible on the device item card
      const deviceItem = sponsorPage.getByTestId('device-item').filter({ hasNotText: '(Current)' });
      await expect(deviceItem).toBeVisible({ timeout: 15000 });

      // Revoke opens a styled confirm dialog; confirm it.
      await deviceItem.getByTestId('revoke-device-btn').click();
      await sponsorPage.getByTestId('confirm-dialog-confirm').click();
    }

    await expect(sponsorPage.getByTestId('rotation-success-toast')).toBeVisible({ timeout: 15000 });

    // 3. Revoked Device loses access
    try {
      await newPage.bringToFront();
    } catch (e) {
      console.warn("bringToFront failed on newPage (revoked), continuing:", e);
    }
    await newPage.reload();
    await expect(newPage.getByTestId('mismatch-error')).toBeVisible({ timeout: 15000 });
    await expect(newPage.getByText(/Unrecognized Device/i)).toBeVisible();
  });

  test('User Journey: Recovery from Device Loss (Silent PRF Recovery)', async () => {
    const email = `prf-test-${Date.now()}@example.com`;
    const page = await sponsorContext.newPage();
    setupConsoleLogs(page, 'RECOVERY');

    // 1. Setup Device 1
    await page.goto('/');
    await mockGoogleSignIn(page, email);
    await clickSetupSecureAccess(page);

    await page.goto('/create');
    await page.getByTestId('organizer-name-input').fill('PRF User');
    await page.getByTestId('poll-title-input').fill('PRF Recovery Test');
    await page.getByTestId('add-slot-btn').click();
    await page.getByTestId('create-submit-btn').click();
    await page.waitForURL(url => url.pathname.startsWith('/poll/') && url.hash.includes('key='), { timeout: 60000 });

    // 2. Simulate "Loss" by clearing IndexedDB and localStorage
    await page.evaluate(async () => {
      const DB_NAME = "LetUsMeet_Keys";
      const STORES = ["identities", "master_keys", "device_keys"];

      await new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME);
        request.onsuccess = () => {
          const db = request.result;
          if (db.objectStoreNames.length > 0) {
            const tx = db.transaction(STORES, 'readwrite');
            STORES.forEach(store => {
              if (db.objectStoreNames.contains(store)) {
                tx.objectStore(store).clear();
              }
            });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
          } else {
            resolve(true);
          }
        };
        request.onerror = () => resolve(false);
      });

      // Clear mock storage database if it exists
      await new Promise((resolve) => {
        const req = indexedDB.open("Mock_Storage_DB");
        req.onsuccess = () => {
          const db = req.result;
          if (db.objectStoreNames.contains("store")) {
            const tx = db.transaction("store", "readwrite");
            tx.objectStore("store").clear();
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
          } else {
            resolve(true);
          }
        };
        req.onerror = () => resolve(false);
      });

      localStorage.removeItem('deviceId');
    });

    // 3. Go to dashboard - Should recover silently via PRF
    await page.goto('/dashboard');
    await waitForDashboardReady(page);

    await expect(page.getByTestId('mismatch-error')).not.toBeVisible({ timeout: 45000 });
    await expect(page.locator('h2', { hasText: 'PRF Recovery Test' })).toBeVisible({ timeout: 30000 });
  });
});
