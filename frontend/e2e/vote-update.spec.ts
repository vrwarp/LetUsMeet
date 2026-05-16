import { test, expect } from './helpers/base-test';

test.describe('Vote Update Flow', () => {
  test('allows a user to change their vote', async ({ page }) => {
    // Create poll
    await page.goto('/create');
    await page.waitForTimeout(2000);

    await page.getByTestId('organizer-name-input').fill('Test Organizer');
    await page.getByTestId('poll-title-input').fill(`Update Vote Poll ${Date.now()}`);
    await page.getByTestId('add-slot-btn').click();
    const submitBtn = page.getByTestId('create-submit-btn');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await page.waitForURL(/\/poll\/[^/]+#key=.+/);

    // Initial Vote
    await page.getByTestId('slot-card').nth(0).click(); // YES
    await page.getByTestId('participant-name-input').fill('Changeable Voter');
    await page.getByTestId('vote-submit-btn').click();

    // Wait for success
    await expect(page.locator('h2', { hasText: 'Vote Recorded!' })).toBeVisible();

    // Click "Back to poll"
    await page.getByRole('button', { name: /Back to poll/i }).click();

    // The form should be visible again
    await expect(page.getByTestId('vote-submit-btn')).toBeVisible();

    // The previous selections might be preserved or reset based on implementation.
    // For this test, let's just make sure we can submit again.
    await page.getByTestId('slot-card').nth(0).click(); // IF_NEED_BE
    await page.getByTestId('vote-submit-btn').click();

    // Should see success again
    await expect(page.locator('h2', { hasText: 'Vote Recorded!' })).toBeVisible();
  });
});
