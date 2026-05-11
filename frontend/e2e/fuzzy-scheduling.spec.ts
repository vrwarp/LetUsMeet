import { test, expect } from '@playwright/test';

test.describe('Fuzzy Scheduling', () => {
  test('should create a poll with general blocks and allow voting', async ({ page }) => {
    // 1. Create a poll with General blocks
    await page.goto('/create');
    
    await page.fill('[data-testid="organizer-name-input"]', 'Test Organizer');
    await page.fill('[data-testid="organizer-email-input"]', 'organizer@example.com');
    const pollTitle = `Fuzzy Meeting ${Date.now()}`;
    await page.fill('[data-testid="poll-title-input"]', pollTitle);
    
    // Select "Flexible Windows" mode
    await page.click('text=Flexible Windows');
    
    // Add first slot
    await page.click('[data-testid="add-slot-btn"]');
    
    // Enter custom label for first slot
    await page.fill('[data-testid="slot-label-0"]', 'Brunch');
    await page.fill('[data-testid="slot-time-0"]', '11:00');
    
    // Add another slot
    await page.click('[data-testid="add-slot-btn"]');
    
    // Enter custom label for second slot
    await page.fill('[data-testid="slot-label-1"]', 'Dinner');
    await page.fill('[data-testid="slot-time-1"]', '19:00');
    
    await page.click('[data-testid="create-submit-btn"]');
    
    // Wait for navigation to poll page
    await expect(page).toHaveURL(/\/poll\/[a-zA-Z0-9]+/);
    await expect(page.locator('[data-testid="poll-title"]')).toHaveText(pollTitle);
    
    // 2. Vote on the poll
    await page.fill('[data-testid="participant-name-input"]', 'Test Participant');
    
    // Click a fuzzy slot card to vote YES
    const slotCards = page.locator('[data-testid="slot-card"]');
    await expect(slotCards).toHaveCount(2);
    
    await expect(slotCards.first()).toContainText('Brunch');
    await expect(slotCards.first()).toContainText('11:00 AM');
    await expect(slotCards.nth(1)).toContainText('Dinner');
    await expect(slotCards.nth(1)).toContainText('7:00 PM');
    
    // Click first card to vote YES (Green)
    await slotCards.first().click();
    
    // Submit vote
    await page.click('[data-testid="vote-submit-btn"]');
    
    // Check success state
    await expect(page.locator('text=Vote Cast!')).toBeVisible();
    
    // 3. View Results
    await page.click('[data-testid="view-results-link"]');
    await expect(page).toHaveURL(/\/poll\/[a-zA-Z0-9]+\/results/);
    
    // Check matrix for the vote
    const matrix = page.locator('[data-testid="results-matrix"]');
    await expect(matrix).toContainText('Test Participant');
    await expect(page.locator('[data-testid^="total-yes-"]').first()).toHaveText('1');
  });
});
