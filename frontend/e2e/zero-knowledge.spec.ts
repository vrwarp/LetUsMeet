import { test, expect } from './helpers/base-test';
import { mockGoogleSignIn } from './helpers/auth-helper';
import { setupWebAuthn } from './helpers/webauthn-helper';

test.describe('Zero-Knowledge Pivot (Multi-Device)', () => {

  test('Flow A: Initial Setup (The Genesis Device)', async ({ page, context }) => {
    await page.goto('/');
    
    // 1. Sign in as a new user
    const email = `genesis-${Date.now()}@example.com`;
    await mockGoogleSignIn(page, email);

    // 2. Verify dashboard/profile shows "Protected by Zero-Knowledge" or similar
    // And verify recovery is enabled
    await page.getByTestId('user-profile-btn').click();
    await expect(page.getByTestId('recovery-status')).toContainText('Active');
    await expect(page.getByTestId('device-list')).toContainText('Current');
    
    // 3. Create a poll to verify AMK is working (keystore write)
    await page.goto('/create');
    await page.getByTestId('organizer-name-input').fill('Genesis User');
    await page.getByTestId('poll-title-input').fill('Genesis Poll');
    await page.getByTestId('add-slot-btn').click();
    await page.getByTestId('create-submit-btn').click();
    
    await page.waitForURL(/\/poll\/[^/]+#key=.+/);
    await expect(page.getByTestId('poll-title')).toContainText('Genesis Poll');
    
    // Verify we can see the results (keystore read)
    await page.getByTestId('view-results-link').click();
    await expect(page.getByTestId('results-matrix')).toBeVisible();
  });

  test('Flow B: Authorizing a New Device', async ({ browser, context: sponsorContext }) => {
    // 1. Setup Sponsor Device
    const sponsorPage = await sponsorContext.newPage();
    await sponsorPage.goto('/');
    const email = `multidevice-${Date.now()}@example.com`;
    await mockGoogleSignIn(sponsorPage, email);
    
    // 2. Setup New Device
    const newDeviceContext = await browser.newContext();
    await setupWebAuthn(newDeviceContext, test.info());
    const newDevicePage = await newDeviceContext.newPage();
    await newDevicePage.goto('/');
    
    // Sign in with SAME email
    await mockGoogleSignIn(newDevicePage, email);
    
    // 3. New Device should see "Unrecognized Device" UI
    await expect(newDevicePage.getByTestId('mismatch-error')).toBeVisible();
    await expect(newDevicePage.getByTestId('request-auth-btn')).toBeVisible();
    
    // 4. New Device requests authorization
    await newDevicePage.getByTestId('request-auth-btn').click();
    await expect(newDevicePage.getByTestId('auth-pending-msg')).toBeVisible();
    
    // 5. Sponsor Device sees the request
    await sponsorPage.goto('/dashboard'); // Assuming dashboard shows requests
    const authRequest = sponsorPage.getByTestId('pending-auth-request').first();
    await expect(authRequest).toBeVisible();
    
    // 6. Sponsor Device approves
    await authRequest.getByTestId('approve-auth-btn').click();
    
    // 7. New Device should automatically detect authorization and reload
    await expect(newDevicePage.getByTestId('mismatch-error')).not.toBeVisible({ timeout: 30000 });
    await expect(newDevicePage.getByTestId('user-profile-btn')).toBeVisible();
    
    // 8. New Device verifies it can access existing data
    // (Create a poll on sponsor, read on new device)
    await sponsorPage.goto('/create');
    await sponsorPage.getByTestId('organizer-name-input').fill('Sponsor');
    await sponsorPage.getByTestId('poll-title-input').fill('Shared Poll');
    await sponsorPage.getByTestId('add-slot-btn').click();
    await sponsorPage.getByTestId('create-submit-btn').click();
    await sponsorPage.waitForURL(/\/poll\/[^/]+#key=.+/);
    const pollUrl = sponsorPage.url();
    
    await newDevicePage.goto(pollUrl);
    await expect(newDevicePage.getByTestId('poll-title')).toContainText('Shared Poll');
    
    await newDeviceContext.close();
  });

  test('Flow C: Device Revocation & Data Migration', async ({ browser, context: sponsorContext }) => {
    // 1. Setup two authorized devices
    const sponsorPage = await sponsorContext.newPage();
    await sponsorPage.goto('/');
    const email = `revocation-${Date.now()}@example.com`;
    await mockGoogleSignIn(sponsorPage, email);
    
    const otherDeviceContext = await browser.newContext();
    await setupWebAuthn(otherDeviceContext, test.info());
    const otherDevicePage = await otherDeviceContext.newPage();
    await otherDevicePage.goto('/');
    await mockGoogleSignIn(otherDevicePage, email);
    
    // (Authorization dance)
    await otherDevicePage.getByTestId('request-auth-btn').click();
    await sponsorPage.goto('/dashboard');
    await sponsorPage.getByTestId('approve-auth-btn').click();
    await expect(otherDevicePage.getByTestId('user-profile-btn')).toBeVisible();
    
    // 2. Create data before revocation
    await sponsorPage.goto('/create');
    await sponsorPage.getByTestId('organizer-name-input').fill('Sponsor');
    await sponsorPage.getByTestId('poll-title-input').fill('Old AMK Poll');
    await sponsorPage.getByTestId('add-slot-btn').click();
    await sponsorPage.getByTestId('create-submit-btn').click();
    await sponsorPage.waitForURL(/\/poll\/[^/]+#key=.+/);
    const oldPollUrl = sponsorPage.url();
    
    // 3. Sponsor revokes the other device
    await sponsorPage.goto('/dashboard');
    const otherDeviceRow = sponsorPage.getByTestId('device-item').filter({ hasNotText: 'Current' });
    await otherDeviceRow.getByTestId('revoke-device-btn').click();
    
    // Confirm revocation
    sponsorPage.once('dialog', dialog => dialog.accept());
    
    // 4. Verify AMK rotation (should be transparent to sponsor)
    await expect(sponsorPage.getByTestId('rotation-success-toast')).toBeVisible();
    
    // 5. Verify sponsor can still access old data (migration check)
    await sponsorPage.goto(oldPollUrl);
    await expect(sponsorPage.getByTestId('poll-title')).toContainText('Old AMK Poll');
    
    // 6. Verify other device is now locked out
    await otherDevicePage.reload();
    await expect(otherDevicePage.getByTestId('mismatch-error')).toBeVisible();
    
    await otherDeviceContext.close();
  });

});
