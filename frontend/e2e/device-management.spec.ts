import { test, expect } from './helpers/base-test';
import { BrowserContext, Page } from '@playwright/test';
import { setupWebAuthn } from './helpers/webauthn-helper';
import { mockGoogleSignIn } from './helpers/auth-helper';

async function waitForDashboardReady(page: Page) {
  await expect(page.getByText('Decrypting your dashboard...')).not.toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId('dashboard-title')).toBeVisible({ timeout: 15000 });
}

function setupConsoleLogs(page: Page, label: string) {
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('DEBUG')) {
      console.log(`[BROWSER ${label}] ${msg.type()}: ${msg.text()}`);
    }
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
    await sponsorPage.bringToFront();
    const requestItem = sponsorPage.getByTestId('pending-auth-request').first();
    await expect(requestItem).toBeVisible({ timeout: 20000 });
    await expect(requestItem).toContainText(verificationCode!.trim());

    await requestItem.getByTestId('approve-auth-btn').click();
    await expect(requestItem).not.toBeVisible({ timeout: 15000 });

    // 5. New Device Accesses Data
    await newPage.bringToFront();
    await expect(newPage.getByTestId('mismatch-error')).not.toBeVisible({ timeout: 45000 });
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
    await sponsorPage.bringToFront();
    await waitForDashboardReady(sponsorPage);

    const deviceItem = sponsorPage.getByTestId('device-item').filter({ hasNotText: '(Current)' });
    await expect(deviceItem).toBeVisible({ timeout: 15000 });

    // Set up dialog handler BEFORE clicking
    sponsorPage.once('dialog', dialog => dialog.accept());
    await deviceItem.getByTestId('revoke-device-btn').click();

    await expect(sponsorPage.getByTestId('rotation-success-toast')).toBeVisible({ timeout: 15000 });

    // 3. Revoked Device loses access
    await newPage.bringToFront();
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

      await new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(STORES, 'readwrite');
          STORES.forEach(store => tx.objectStore(store).clear());
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      });

      localStorage.removeItem('deviceId');
    });

    // 3. Reload - Should recover silently via PRF
    await page.reload();
    await page.goto('/dashboard');
    await waitForDashboardReady(page);

    await expect(page.getByTestId('mismatch-error')).not.toBeVisible({ timeout: 30000 });
    await expect(page.locator('h2', { hasText: 'PRF Recovery Test' })).toBeVisible({ timeout: 15000 });
  });
});
