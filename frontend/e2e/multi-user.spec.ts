import { test, expect } from '@playwright/test';

test.describe('Multi-user Flows', () => {
  test('handles multiple participants voting', async ({ browser }) => {
    // 1. Organizer creates the poll
    const organizerContext = await browser.newContext();
    const organizerPage = await organizerContext.newPage();

    await organizerPage.goto('/create');
    await organizerPage.waitForTimeout(2000);

    await organizerPage.getByTestId('organizer-name-input').fill('Test Organizer');
    await organizerPage.getByTestId('organizer-email-input').fill('organizer@example.com');
    const pollTitle = `Multi-user Sync ${Date.now()}`;
    await organizerPage.getByTestId('poll-title-input').fill(pollTitle);

    const addBtn = organizerPage.getByTestId('add-slot-btn');
    await expect(addBtn).toBeEnabled();
    await addBtn.click();
    await addBtn.click();

    const submitBtn = organizerPage.getByTestId('create-submit-btn');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await organizerPage.waitForURL(/\/poll\/[^/]+$/);
    await organizerPage.waitForTimeout(2000);
    await expect(organizerPage.locator('text=Loading poll details...')).not.toBeVisible({ timeout: 30000 });
    const pollUrl = organizerPage.url();

    // Organizer votes
    const slotCards = organizerPage.getByTestId('slot-card');
    await slotCards.nth(0).click(); // YES
    await organizerPage.getByTestId('participant-name-input').fill('Organizer');
    await organizerPage.getByTestId('vote-submit-btn').click();
    await expect(organizerPage.locator('h2', { hasText: 'Vote Cast!' })).toBeVisible();

    // 2. Participant 1 votes
    const p1Context = await browser.newContext();
    const p1Page = await p1Context.newPage();

    await p1Page.goto(pollUrl);
    await p1Page.waitForTimeout(2000);
    await expect(p1Page.locator('text=Loading poll details...')).not.toBeVisible({ timeout: 30000 });
    await expect(p1Page.getByTestId('poll-title')).toContainText(pollTitle);

    const p1SlotCards = p1Page.getByTestId('slot-card');
    await p1SlotCards.nth(0).click(); // YES
    await p1SlotCards.nth(1).click(); // YES
    await p1SlotCards.nth(1).click(); // IF_NEED_BE

    await p1Page.getByTestId('participant-name-input').fill('Participant One');
    await p1Page.getByTestId('vote-submit-btn').click();
    await expect(p1Page.locator('h2', { hasText: 'Vote Cast!' })).toBeVisible();

    // 3. Participant 2 votes
    const p2Context = await browser.newContext();
    const p2Page = await p2Context.newPage();

    await p2Page.goto(pollUrl);
    await p2Page.waitForTimeout(2000);
    await expect(p2Page.locator('text=Loading poll details...')).not.toBeVisible({ timeout: 30000 });
    const p2SlotCards = p2Page.getByTestId('slot-card');
    await p2SlotCards.nth(1).click(); // YES

    await p2Page.getByTestId('participant-name-input').fill('Participant Two');
    await p2Page.getByTestId('vote-submit-btn').click();
    await expect(p2Page.locator('h2', { hasText: 'Vote Cast!' })).toBeVisible();

    // 4. View Results
    await p2Page.getByTestId('view-results-link').click();
    await p2Page.waitForURL(/\/poll\/[^/]+\/results$/);

    // Verify matrix
    await expect(p2Page.getByTestId('results-matrix')).toBeVisible();

    // Check participants listed
    const matrixText = await p2Page.getByTestId('results-matrix').textContent();
    expect(matrixText).toContain('Organizer');
    expect(matrixText).toContain('Participant One');
    expect(matrixText).toContain('Participant Two');
  });
});
