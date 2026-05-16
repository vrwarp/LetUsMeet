import { test, expect } from './helpers/base-test';

test.describe('Error & Edge Cases', () => {
  test('displays validation errors on empty form submission', async ({ page }) => {
    await page.goto('/create');

    // Clear any default values if necessary
    await page.getByTestId('poll-title-input').fill('');

    // Attempt to submit
    const submitBtn = page.getByTestId('create-submit-btn');
    await expect(submitBtn).toBeDisabled();

    // It should not allow submission without title
  });

  test('displays privacy protection for non-existent poll or missing key', async ({ page }) => {
    await page.goto('/poll/invalid-poll-id-123');
    await expect(page.getByText(/Privacy Protected/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/requires a secret key/i)).toBeVisible();
  });

  test('displays privacy protection for non-existent poll results or missing key', async ({ page }) => {
    await page.goto('/poll/invalid-poll-id-123/results');
    await expect(page.getByText(/Privacy Protected/i)).toBeVisible({ timeout: 15000 });
  });

  test('prevents voting without name', async ({ page }) => {
    await page.goto('/');

    // Navigate to create and create one quickly
    await page.locator('header').getByTestId('create-poll-btn').click();
    await page.getByTestId('organizer-name-input').fill('Test Organizer');
    const pollTitle = `Edge Case Poll ${Date.now()}`;
    await page.getByTestId('poll-title-input').fill(pollTitle);
    await page.getByTestId('add-slot-btn').click();
    const createBtn = page.getByTestId('create-submit-btn');
    await expect(createBtn).toBeEnabled();
    await createBtn.click();

    await page.waitForURL(/\/poll\/[^/]+#key=.+/);

    // Ensure we are on the vote page
    const submitBtn = page.getByTestId('vote-submit-btn');
    await expect(submitBtn).toBeVisible();

    // Ensure name is required - button should be disabled if name is empty
    await page.getByTestId('participant-name-input').fill('');
    await expect(submitBtn).toBeDisabled();
    
    // It should not be possible to click successfully
    await expect(page.locator('h2', { hasText: 'Vote Recorded!' })).not.toBeVisible();
    
    // Fill the name and it should work
    await page.getByTestId('participant-name-input').fill('Alice');
    await submitBtn.click();
    await expect(page.locator('h2', { hasText: 'Vote Recorded!' })).toBeVisible();
  });
});
