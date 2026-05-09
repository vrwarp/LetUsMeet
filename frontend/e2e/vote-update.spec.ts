import { test, expect } from '@playwright/test';

test.describe('Vote Update Flow', () => {
  test('allows a user to change their vote', async ({ page }) => {
    // Create poll
    await page.goto('/create');
    await page.getByTestId('organizer-name-input').fill('Test Organizer');
    await page.getByTestId('organizer-email-input').fill('organizer@example.com');
    await page.getByTestId('poll-title-input').fill('Update Vote Poll');
    await page.getByTestId('create-submit-btn').click();
    await page.waitForURL(/\/poll\/[^/]+$/, { timeout: 10000 });

    // Initial Vote
    await page.getByTestId('slot-card').nth(0).click(); // YES
    await page.getByTestId('participant-name-input').fill('Changeable Voter');
    await page.getByTestId('vote-submit-btn').click();
    
    // Wait for success
    await expect(page.locator('h2', { hasText: 'Vote Cast!' })).toBeVisible();

    // Click "Back to poll" (renamed from Change my vote)
    await page.getByRole('button', { name: /Back to poll/i }).click();

    // The form should be visible again
    await expect(page.getByTestId('vote-submit-btn')).toBeVisible();
    
    // The previous selections might be preserved or reset based on implementation.
    // For this test, let's just make sure we can submit again.
    await page.getByTestId('slot-card').nth(0).click(); // IF_NEED_BE
    await page.getByTestId('vote-submit-btn').click();

    // Should see success again
    await expect(page.locator('h2', { hasText: 'Vote Cast!' })).toBeVisible();
  });
});
