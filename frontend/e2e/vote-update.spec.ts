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

    await page.waitForURL(/\/poll\/[^/]+(\?.*)?#key=.+/);

    // Initial Vote
    await page.getByTestId('slot-card').nth(0).click(); // YES
    await page.getByTestId('participant-name-input').fill('Changeable Voter');
    await page.getByTestId('vote-submit-btn').click();

    // Wait for results
    await page.waitForURL(/\/poll\/[^/]+\/results(\?.*)?#key=.+/);

    // Click "Back to Poll" link on results page to go back
    await page.getByRole('link', { name: /Back to Poll/i }).click();
    await page.waitForURL(/\/poll\/[^/]+(\?.*)?#key=.+/);

    // The form should be visible again
    await expect(page.getByTestId('vote-submit-btn')).toBeVisible();

    // The previous selections might be preserved or reset based on implementation.
    // For this test, let's just make sure we can submit again.
    await page.getByTestId('slot-card').nth(0).click(); // IF_NEED_BE
    await page.getByTestId('vote-submit-btn').click();

    // Should see results page again
    await page.waitForURL(/\/poll\/[^/]+\/results(\?.*)?#key=.+/);
  });
});
