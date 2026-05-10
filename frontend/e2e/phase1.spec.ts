import { test, expect } from '@playwright/test';

test.describe('Phase 1 Critical User Journeys', () => {
  // We use a single test to preserve the state (the created poll ID) across the flow,
  // or we could split them and pass the ID, but a single e2e journey test is often simpler.
  
  test('Create a poll, vote on it, and view results', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    
    // --- 1. Home Page ---
    await page.goto('/');
    await expect(page).toHaveTitle(/LetUsMeet/);
    
    // Navigate to create page
    await page.getByTestId('create-poll-btn').click();
    await expect(page).toHaveURL(/\/create/);

    // --- 2. Create Poll Page ---
    await page.getByTestId('organizer-name-input').fill('Test Organizer');
    await page.getByTestId('organizer-email-input').fill('organizer@example.com');
    const pollTitle = `Playwright E2E Poll ${Date.now()}`;
    await page.getByTestId('poll-title-input').fill(pollTitle);
    await page.getByTestId('poll-location-input').fill('E2E Test Location');
    
    // Fill first slot
    await page.getByTestId('add-slot-btn').click();
    
    // Submit the form
    await page.getByTestId('create-submit-btn').click();

    // Wait for navigation to the poll page
    await page.waitForURL(/\/poll\/[^/]+$/);
    const pollUrl = page.url();
    expect(pollUrl).toMatch(/\/poll\/[a-zA-Z0-9_-]+$/);

    // --- 3. Vote Poll Page ---
    await expect(page.getByTestId('poll-title')).toContainText(pollTitle);
    
    // Cycle vote on the first slot (clicks from NO -> YES)
    const slotCards = page.getByTestId('slot-card');
    await expect(slotCards).toHaveCount(2); // we added one
    
    await slotCards.nth(0).click(); // NO -> YES
    await slotCards.nth(0).click(); // YES -> IF_NEED_BE

    await slotCards.nth(1).click(); // NO -> YES

    // Fill name
    await page.getByTestId('participant-name-input').fill('E2E Tester');
    
    // Submit vote
    await page.getByTestId('vote-submit-btn').click();

    // Wait for success screen
    await expect(page.locator('h2', { hasText: 'Vote Cast!' })).toBeVisible();

    // --- 4. View Results Page ---
    await page.getByTestId('view-results-link').click();
    await page.waitForURL(/\/poll\/[^/]+\/results$/);

    // Check results table
    await expect(page.getByTestId('results-matrix')).toBeVisible();
    await expect(page.getByTestId('participant-name').first()).toHaveText('E2E Tester');
  });
});
