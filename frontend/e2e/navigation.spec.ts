import { test, expect } from '@playwright/test';

test.describe('Navigation Flows', () => {
  test('navigates through the entire app lifecycle smoothly', async ({ page }) => {
    // Start at Home
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Let everyone meet');

    // Home -> Create
    await page.getByTestId('create-poll-btn').click();
    await expect(page).toHaveURL(/\/create/);
    await expect(page.getByRole('heading', { name: /Create a Meeting Poll/i })).toBeVisible();

    // Create -> Poll (Requires form submission)
    await page.getByTestId('organizer-name-input').fill('Test Organizer');
    await page.getByTestId('organizer-email-input').fill('organizer@example.com');
    await page.getByTestId('poll-title-input').fill('Nav Test Poll');
    await page.getByTestId('create-submit-btn').click();
    
    await page.waitForURL(/\/poll\/[^/]+$/);
    const pollUrl = page.url();
    await expect(page.getByTestId('poll-title')).toContainText('Nav Test Poll');

    // Navigate to Results directly from URL change or after voting
    // Let's vote to get to the success screen
    await page.getByTestId('participant-name-input').fill('Nav Voter');
    await page.getByTestId('vote-submit-btn').click();
    await expect(page.locator('h2', { hasText: 'Vote Cast!' })).toBeVisible();

    // Poll Success -> Results
    await page.getByRole('link', { name: /See Consensus Results/i }).click();
    await page.waitForURL(/\/poll\/[^/]+\/results$/);
    await expect(page.getByRole('heading', { name: /Participation Matrix/i })).toBeVisible();

    // Results -> Poll
    await page.getByRole('link', { name: /Back to Poll/i }).click();
    await page.waitForURL(pollUrl);
  });

  test('Direct URL access to /create works without going through home (G8)', async ({ page }) => {
    await page.goto('/create');
    await expect(page.getByRole('heading', { name: /Create a Meeting Poll/i })).toBeVisible();
  });

  test('Logo link in header navigates back to home (G9)', async ({ page }) => {
    await page.goto('/create');
    // Assuming the header has a link with LetUsMeet or a specific logo
    await page.getByRole('link', { name: /LetUsMeet/i }).first().click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Let everyone meet');
  });
});
