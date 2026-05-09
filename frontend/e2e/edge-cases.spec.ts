import { test, expect } from '@playwright/test';

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

  test('displays error for non-existent poll (G1)', async ({ page }) => {
    await page.goto('/poll/invalid-poll-id-123');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
    await expect(page.getByTestId('error-message')).toContainText(/Poll not found/i);
  });

  test('displays error state for non-existent poll results (G2)', async ({ page }) => {
    await page.goto('/poll/invalid-poll-id-123/results');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
    await expect(page.getByTestId('error-message')).toContainText(/Poll not found/i);
  });

  test('prevents voting without name (G3)', async ({ page }) => {
    await page.goto('/');
    // Navigate to create and create one quickly
    await page.getByTestId('create-poll-btn').click();
    await page.getByTestId('organizer-name-input').fill('Test Organizer');
    await page.getByTestId('organizer-email-input').fill('organizer@example.com');
    await page.getByTestId('poll-title-input').fill('Edge Case Poll');
    await page.getByTestId('create-submit-btn').click();
    
    await page.waitForURL(/\/poll\/[^/]+$/);

    // Ensure we are on the vote page
    const submitBtn = page.getByTestId('vote-submit-btn');
    await expect(submitBtn).toBeVisible();

    // Do NOT fill the name - button should be disabled
    await expect(submitBtn).toBeDisabled();

    // Fill the name and it should be enabled
    await page.getByTestId('participant-name-input').fill('Alice');
    await expect(submitBtn).toBeEnabled();
  });
});
