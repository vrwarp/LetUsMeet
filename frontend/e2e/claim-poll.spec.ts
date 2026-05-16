import { test, expect } from './helpers/base-test';

test.describe('Claim Poll Flow', () => {
  test.skip('allows a user to claim an anonymous poll from another session', async ({ browser }) => {
    // ---------------------------------------------------------
    // Session 1: The Creator
    // ---------------------------------------------------------
    const creatorContext = await browser.newContext();
    const creatorPage = await creatorContext.newPage();
    
    await creatorPage.goto('/create');
    await creatorPage.waitForTimeout(2000);

    await creatorPage.getByTestId('organizer-name-input').fill('Anonymous Creator');
    await creatorPage.getByTestId('organizer-email-input').fill('anon@example.com');
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
    await claimantPage.getByRole('button', { name: /Add to My Dashboard/i }).click();

    // Banner should disappear after claiming
    await expect(claimantPage.getByTestId('claim-banner')).not.toBeVisible();
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
    const creatorPage = await creatorContext.newPage();
    
    await creatorPage.goto('/create');
    await creatorPage.waitForTimeout(2000);
    await creatorPage.getByTestId('organizer-name-input').fill('Temp Creator');
    await creatorPage.getByTestId('organizer-email-input').fill('temp@example.com');
    const pollTitle = `Results Claim Test ${Date.now()}`;
    await creatorPage.getByTestId('poll-title-input').fill(pollTitle);
    
    await creatorPage.getByTestId('add-slot-btn').click();
    await creatorPage.getByTestId('create-submit-btn').click();
    await creatorPage.waitForURL(url => url.pathname.startsWith('/poll/'), { timeout: 60000 });
    
    const pollId = creatorPage.url().split('/').pop()?.split('?')[0];
    const adminToken = new URL(creatorPage.url()).searchParams.get('adminToken');
    const resultsUrl = `/poll/${pollId}/results${adminToken ? `?adminToken=${adminToken}` : ''}`;
    
    await creatorContext.close();

    // ---------------------------------------------------------
    // Session 2: The Claimant
    // ---------------------------------------------------------
    const claimantContext = await browser.newContext();
    const claimantPage = await claimantContext.newPage();

    // Go to results page with the admin token
    await claimantPage.goto(resultsUrl);
    
    // Wait for the poll title to appear
    await expect(claimantPage.locator('h1', { hasText: pollTitle })).toBeVisible({ timeout: 15000 });

    // Verify banner and claim
    await expect(claimantPage.getByTestId('claim-banner')).toBeVisible({ timeout: 15000 });
    await claimantPage.getByRole('button', { name: /Add to My Dashboard/i }).click();

    // Banner should disappear
    await expect(claimantPage.getByText(/Claim this Poll/i)).not.toBeVisible();

    await claimantContext.close();
  });
});
