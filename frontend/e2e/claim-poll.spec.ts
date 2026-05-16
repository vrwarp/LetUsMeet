import { test, expect } from './helpers/base-test';
import { mockWebAuthn, enableVirtualAuthenticator } from './helpers/webauthn-helper';
import { mockGoogleSignIn } from './helpers/auth-helper';
import { BrowserContext } from '@playwright/test';

test.describe.skip('Claim Poll Flow', () => {

  test.skip('allows a user to claim an anonymous poll from another session', async ({ browser }) => {
    // ---------------------------------------------------------
    // Session 1: The Creator
    // ---------------------------------------------------------
    const creatorContext = await browser.newContext();
    const creatorPage = await creatorContext.newPage();

    await creatorPage.goto('/create');
    await creatorPage.waitForTimeout(2000);

    await creatorPage.getByTestId('organizer-name-input').fill('Anonymous Creator');
    const pollTitle = `Unclaimed Poll ${Date.now()}`;
    await creatorPage.getByTestId('poll-title-input').fill(pollTitle);

    const addSlotBtn = creatorPage.getByTestId('add-slot-btn');
    await expect(addSlotBtn).toBeEnabled();
    await addSlotBtn.click();

    const submitBtn = creatorPage.getByTestId('create-submit-btn');
    await submitBtn.click();

    // Wait for navigation and grab the URL (which includes the adminToken)
    await creatorPage.waitForURL(url => url.pathname.startsWith('/poll/'), { timeout: 60000 });
    const pollUrl = creatorPage.url();

    // Explicitly check that we have an adminToken
    expect(pollUrl).toContain('adminToken=');

    // Close the creator's session
    await creatorContext.close();

    // ---------------------------------------------------------
    // Session 2: The Claimant
    // ---------------------------------------------------------
    const claimantContext = await browser.newContext();
    const claimantPage = await claimantContext.newPage();

    // Claimant visits the poll URL (which includes the adminToken)
    await claimantPage.goto(pollUrl);
    await claimantPage.waitForTimeout(2000); // Wait for auth/state to settle

    // Verify we are on the poll page
    await expect(claimantPage.getByTestId('poll-title')).toBeVisible({ timeout: 15000 });

    // Verify "Claim this Poll" banner appears
    const banner = claimantPage.getByText(/Claim this Poll/i);
    await expect(banner).toBeVisible({ timeout: 30000 });
    await expect(claimantPage.getByRole('button', { name: /Add to My Dashboard/i })).toBeVisible();

    // Click Claim
    await claimantPage.getByTestId('claim-button').click();

    // Handle Google Sign-In mock page in Emulator
    await claimantPage.waitForTimeout(2000);
    if (await claimantPage.getByText('Sign in with Google').isVisible()) {
      await claimantPage.getByRole('button', { name: /Add Account/i }).click();
    }

    // Wait for the page to settle after sign-in
    await claimantPage.waitForTimeout(2000);

    // Click Claim AGAIN (now that we are signed in)
    if (await claimantPage.getByTestId('claim-button').isVisible()) {
      await claimantPage.getByTestId('claim-button').click();
    }

    // Wait for the banner to disappear
    await expect(claimantPage.getByTestId('claim-banner')).not.toBeVisible({ timeout: 30000 });
    await claimantPage.waitForTimeout(1000);

    // Go to dashboard and verify the poll is there
    await claimantPage.goto('/dashboard');
    await expect(claimantPage.locator('h2', { hasText: pollTitle })).toBeVisible({ timeout: 15000 });

    await claimantContext.close();
  });

  test.skip('shows claim banner on results page for token holders', async ({ browser }) => {
    // ---------------------------------------------------------
    // Session 1: The Creator
    // ---------------------------------------------------------
    const creatorContext = await browser.newContext();
    await setupWebAuthn(creatorContext, test.info());
    const creatorPage = await creatorContext.newPage();

    await creatorPage.goto('/create');
    await creatorPage.waitForTimeout(2000);
    await creatorPage.getByTestId('organizer-name-input').fill('Temp Creator');
    const pollTitle = `Results Claim Test ${Date.now()}`;
    await creatorPage.getByTestId('poll-title-input').fill(pollTitle);

    await creatorPage.getByTestId('add-slot-btn').click();
    await creatorPage.getByTestId('create-submit-btn').click();
    await creatorPage.waitForURL(url => url.pathname.startsWith('/poll/'), { timeout: 60000 });

    const currentUrl = creatorPage.url();
    const pollId = currentUrl.split('/').pop()?.split('?')[0];
    const adminToken = new URL(currentUrl).searchParams.get('adminToken');
    const resultsUrl = `/poll/${pollId}/results${adminToken ? `?adminToken=${adminToken}` : ''}#${new URL(currentUrl).hash.substring(1)}`;

    await creatorContext.close();

    // ---------------------------------------------------------
    // Session 2: The Claimant
    // ---------------------------------------------------------
    const claimantContext = await browser.newContext();
    await setupWebAuthn(claimantContext, test.info());
    const claimantPage = await claimantContext.newPage();

    // Go to results page with the admin token
    await claimantPage.goto(resultsUrl);

    // Wait for the poll title to appear
    await expect(claimantPage.locator('h1', { hasText: pollTitle })).toBeVisible({ timeout: 15000 });

    // Verify banner and claim
    await expect(claimantPage.getByTestId('claim-banner')).toBeVisible({ timeout: 15000 });
    await claimantPage.getByTestId('claim-button').click();

    // Handle Google Sign-In
    await claimantPage.waitForTimeout(2000);
    if (await claimantPage.getByText('Sign in with Google').isVisible()) {
      await claimantPage.getByRole('button', { name: /Add Account/i }).click();
    }

    // Wait for the page to settle after sign-in
    await claimantPage.waitForTimeout(2000);

    // Click Claim AGAIN (now that we are signed in)
    if (await claimantPage.getByTestId('claim-button').isVisible()) {
      await claimantPage.getByTestId('claim-button').click();
    }

    // Banner should disappear
    await expect(claimantPage.getByTestId('claim-banner')).not.toBeVisible({ timeout: 30000 });

    await claimantContext.close();
  });
});
