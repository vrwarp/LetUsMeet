import { test, expect } from '@playwright/test';

test.describe('Vote Editing and Multiple Responses', () => {
  test('allows a user to edit their vote and submit a second one', async ({ page }) => {
    // 1. Create a poll
    await page.goto('/create');
    await page.getByTestId('organizer-name-input').fill('E2E Organizer');
    await page.getByTestId('organizer-email-input').fill('organizer@e2e.com');
    await page.getByTestId('poll-title-input').fill('E2E Edit Test Poll');
    await page.getByTestId('add-slot-btn').click();
    await page.getByTestId('create-submit-btn').click();
    
    await page.waitForURL(/\/poll\/[^/]+$/);
    const pollUrl = page.url();

    // 2. Initial Vote
    await page.getByTestId('slot-card').nth(0).click(); // NO -> YES
    await page.getByTestId('participant-name-input').fill('E2E Voter');
    await page.getByTestId('vote-submit-btn').click();
    
    // Wait for success screen
    await expect(page.locator('h2', { hasText: 'Vote Cast!' })).toBeVisible();

    // 3. Navigate away and come back (simulate "going directly to the poll")
    await page.goto('/');
    await page.goto(pollUrl);
    
    // Should see the editing banner
    await expect(page.getByText(/Editing your previous response/i)).toBeVisible();
    await expect(page.getByTestId('participant-name-input')).toHaveValue('E2E Voter');
    await expect(page.getByTestId('vote-submit-btn')).toContainText('Update Your Response');

    // 4. Update the vote
    await page.getByTestId('slot-card').nth(1).click(); // NO -> YES
    await page.getByTestId('vote-submit-btn').click();
    
    // Wait for success (should say updated)
    await expect(page.locator('h2', { hasText: 'Vote Updated!' })).toBeVisible();
    
    // Test "Back to poll" button logic
    await page.getByRole('button', { name: /Back to poll/i }).click();
    await expect(page.getByText(/Editing your previous response/i)).toBeVisible();
    await expect(page.getByTestId('vote-submit-btn')).toContainText('Update Your Response');

    // 5. Submit a second response
    await page.getByRole('button', { name: /Submit New Response/i }).click();
    
    // Form should be cleared (except maybe prefilled name)
    await expect(page.getByText(/Submitting a new response/i)).toBeVisible();
    await expect(page.getByTestId('vote-submit-btn')).toContainText('Submit Your Vote');
    
    await page.getByTestId('slot-card').nth(0).click(); // NO -> YES
    await page.getByTestId('participant-name-input').fill('E2E Voter Second');
    await page.getByTestId('vote-submit-btn').click();
    
    await expect(page.locator('h2', { hasText: 'Vote Cast!' })).toBeVisible();
    await page.getByRole('button', { name: /Back to poll/i }).click();

    // 6. Verify switcher appears
    await expect(page.getByText(/You've submitted 2 responses/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /E2E Voter \(/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /E2E Voter Second \(/i })).toBeVisible();

    // 7. Test Deletion
    await page.getByRole('button', { name: /E2E Voter Second \(/i }).click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: /Delete Response/i }).click();

    // Verify it's gone from switcher
    await expect(page.getByText(/You've already submitted a response/i).or(page.getByText(/You've submitted 1 response/i))).toBeVisible();
    await expect(page.getByRole('button', { name: /E2E Voter Second \(/i })).not.toBeVisible();
  });
});
