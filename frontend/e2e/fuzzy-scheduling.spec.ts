import { test, expect } from './helpers/base-test';

test.describe('Fuzzy Scheduling', () => {
  test('should create a poll with flexible windows and allow voting', async ({ page }) => {
    // 1. Create a poll with Flexible Windows
    await page.goto('/create');
    
    await page.getByTestId('organizer-name-input').fill('Test Organizer');
    const pollTitle = `Fuzzy Meeting ${Date.now()}`;
    await page.getByTestId('poll-title-input').fill(pollTitle);
    
    // Select "Flexible Windows" mode
    await page.getByText('Flexible Windows').click();
    
    // Add first slot
    await page.getByTestId('add-slot-btn').click();
    
    // Enter custom label for first slot
    await page.getByTestId('slot-label-0').fill('Brunch');
    await page.getByTestId('slot-time-0').fill('11:00');
    
    // Add another slot
    await page.getByTestId('add-slot-btn').click();
    
    // Enter custom label for second slot
    await page.getByTestId('slot-label-1').fill('Dinner');
    await page.getByTestId('slot-time-1').fill('19:00');
    
    await page.getByTestId('create-submit-btn').click();
    
    // Wait for navigation to poll page
    await page.waitForURL(/\/poll\/[^/]+(\?.*)?#key=.+/);
    await expect(page.getByTestId('poll-title')).toHaveText(pollTitle);
    
    // 2. Vote on the poll
    await page.getByTestId('participant-name-input').fill('Test Participant');
    
    // Click a fuzzy slot card to vote YES
    const slotCards = page.getByTestId('slot-card');
    await expect(slotCards).toHaveCount(2);
    
    await expect(slotCards.first()).toContainText('Brunch');
    await expect(slotCards.first()).toContainText('11:00 AM');
    await expect(slotCards.nth(1)).toContainText('Dinner');
    await expect(slotCards.nth(1)).toContainText('7:00 PM');
    
    // Click first card to vote YES (Green)
    await slotCards.first().click();
    
    // Submit vote
    await page.getByTestId('vote-submit-btn').click();
    
    // Check success state
    await expect(page.locator('h2', { hasText: 'Vote Recorded!' })).toBeVisible();
    
    // 3. View Results
    await page.getByTestId('view-results-link').click();
    await page.waitForURL(/\/poll\/[^/]+\/results(\?.*)?#key=.+/);
    
    // Check matrix for the vote
    const matrix = page.getByTestId('results-matrix');
    await expect(matrix).toContainText('Test Participant');
    
    // Check total count for the first slot
    // We don't know the exact ID but we can check for any total- element with text '1'
    await expect(page.locator('[data-testid^="total-"]').first()).toHaveText('1');
  });
});
