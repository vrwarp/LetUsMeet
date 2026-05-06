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
    await expect(page.getByText(/Poll not found/i)).toBeVisible();
  });

  test('displays error state for non-existent poll results (G2)', async ({ page }) => {
    await page.goto('/poll/invalid-poll-id-123/results');
    await expect(page.getByText(/Poll not found/i)).toBeVisible();
  });

  test('prevents voting without name (G3)', async ({ page }) => {
    await page.goto('/');
    // Navigate to create and create one quickly
    await page.getByTestId('create-poll-btn').click();
    await page.getByTestId('poll-title-input').fill('Edge Case Poll');
    await page.getByTestId('create-submit-btn').click();
    
    await page.waitForURL(/\/poll\/[^/]+$/);

    // Ensure we are on the vote page
    await expect(page.getByTestId('vote-submit-btn')).toBeVisible();

    // Do NOT fill the name
    await page.getByTestId('vote-submit-btn').click();

    // Check for validation error (e.g., native required message or custom)
    const nameInput = page.getByTestId('participant-name-input');
    
    // If it uses required attribute, the browser handles it, or we show an error
    await expect(page.getByText(/Please enter your name/i)).toBeVisible();
  });
});
