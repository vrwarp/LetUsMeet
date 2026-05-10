import { test, expect } from '@playwright/test';

test.describe('Claim Poll Flow', () => {
  test('allows a signed-in user to claim an anonymous poll', async ({ page }) => {
    // 1. Create a poll as an anonymous user
    await page.goto('/create');
    await page.waitForTimeout(2000);

    await page.getByTestId('organizer-name-input').fill('Anonymous Creator');
    await page.getByTestId('organizer-email-input').fill('anon@example.com');
    const pollTitle = `Unclaimed Poll ${Date.now()}`;
    await page.getByTestId('poll-title-input').fill(pollTitle);
    
    const addSlotBtn = page.getByTestId('add-slot-btn');
    await expect(addSlotBtn).toBeEnabled();
    await addSlotBtn.click();

    const submitBtn = page.getByTestId('create-submit-btn');
    await submitBtn.click();

    // Wait for navigation
    await page.waitForURL(/\/poll\/[^/]+$/, { timeout: 60000 });
    await page.waitForTimeout(1000);
    const pollId = page.url().split('/').pop()?.split('?')[0];
    
    // 2. Simulate "Signing in" as a real user
    // We set the testUser in localStorage and reload
    await page.evaluate(() => {
      localStorage.setItem('testUser', JSON.stringify({
        uid: 'real-user-123',
        isAnonymous: false,
        email: 'real@example.com',
        displayName: 'Real User'
      }));
    });
    
    await page.reload();
    await page.waitForTimeout(2000);
    await expect(page.locator('text=Loading poll details...')).not.toBeVisible();

    // 3. Verify "Claim this Poll" banner appears
    await expect(page.getByText(/Claim this Poll/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Add to My Dashboard/i })).toBeVisible();

    // 4. Click Claim
    await page.getByRole('button', { name: /Add to My Dashboard/i }).click();

    // 5. Banner should disappear after claiming
    await expect(page.getByText(/Claim this Poll/i)).not.toBeVisible();
    await page.waitForTimeout(2000);

    // 6. Go to dashboard and verify the poll is there
    await page.goto('/dashboard');
    await expect(page.locator('h2', { hasText: pollTitle })).toBeVisible({ timeout: 15000 });
  });

  test('shows claim banner on results page too', async ({ page }) => {
    // 1. Create a poll
    await page.goto('/create');
    await page.waitForTimeout(2000);
    await page.getByTestId('organizer-name-input').fill('Temp Creator');
    await page.getByTestId('organizer-email-input').fill('temp@example.com');
    const pollTitle = `Results Claim Test ${Date.now()}`;
    await page.getByTestId('poll-title-input').fill(pollTitle);
    
    await page.getByTestId('add-slot-btn').click();
    
    await page.getByTestId('create-submit-btn').click();
    await page.waitForURL(/\/poll\/[^/]+$/, { timeout: 60000 });
    
    const pollId = page.url().split('/').pop()?.split('?')[0];
    const resultsUrl = `/poll/${pollId}/results`;

    // 2. "Sign in"
    await page.evaluate(() => {
      localStorage.setItem('testUser', JSON.stringify({
        uid: 'claimant-456',
        isAnonymous: false,
        email: 'claimant@example.com',
        displayName: 'Claimant'
      }));
    });

    // 3. Go to results page
    await page.goto(resultsUrl);
    await page.waitForTimeout(2000);
    await expect(page.locator('text=Calculating consensus...')).not.toBeVisible();

    // 4. Verify banner and claim
    await expect(page.getByText(/Claim this Poll/i)).toBeVisible();
    await page.getByRole('button', { name: /Add to My Dashboard/i }).click();

    // 5. Banner should disappear
    await expect(page.getByText(/Claim this Poll/i)).not.toBeVisible();
  });
});
