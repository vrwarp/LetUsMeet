# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase1.spec.ts >> Phase 1 Critical User Journeys >> Create a poll, vote on it, and view results
- Location: e2e/phase1.spec.ts:7:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('h2').filter({ hasText: 'Vote Submitted!' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('h2').filter({ hasText: 'Vote Submitted!' })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - link "LetUsMeet" [ref=e6] [cursor=pointer]:
          - /url: /
          - img [ref=e8]
          - generic [ref=e13]: LetUsMeet
        - navigation [ref=e14]:
          - link "Create Poll" [ref=e15] [cursor=pointer]:
            - /url: /create
    - main [ref=e16]:
      - generic [ref=e17]:
        - generic [ref=e18]:
          - generic [ref=e19]:
            - heading "Playwright E2E Poll" [level=1] [ref=e20]
            - generic [ref=e21]:
              - generic [ref=e22]:
                - img [ref=e23]
                - text: E2E Test Location
              - generic [ref=e26]:
                - img [ref=e27]
                - text: Organizer Invites You
          - button "Share Poll" [ref=e30]:
            - img [ref=e31]
            - text: Share Poll
        - generic [ref=e37]:
          - generic [ref=e38]:
            - generic [ref=e39]:
              - heading "1. Mark your availability" [level=2] [ref=e40]
              - paragraph [ref=e41]: "Click each slot to cycle: Yes → If-need-be → No"
            - generic [ref=e42]:
              - button "Sun, May 3 9:00 AM – 10:00 AM" [ref=e43] [cursor=pointer]:
                - generic [ref=e44]: Sun, May 3
                - generic [ref=e45]: 9:00 AM – 10:00 AM
                - img [ref=e47]
              - button "Sun, May 3 9:00 AM – 10:00 AM" [ref=e48] [cursor=pointer]:
                - generic [ref=e49]: Sun, May 3
                - generic [ref=e50]: 9:00 AM – 10:00 AM
                - img [ref=e52]
          - generic [ref=e54]:
            - generic [ref=e55]:
              - heading "2. Finalize your response" [level=2] [ref=e56]
              - paragraph [ref=e57]: Enter your name to complete the vote.
            - generic [ref=e58]:
              - generic [ref=e59]:
                - generic [ref=e60]: Your Name
                - textbox "First and last name" [ref=e61]: E2E Tester
              - generic [ref=e62]:
                - generic [ref=e63]: Email Address (Optional)
                - textbox "To receive the final invite" [ref=e64]
            - generic [ref=e65]: INTERNAL
            - button "Submit my vote" [ref=e66]:
              - img [ref=e67]
              - text: Submit my vote
    - contentinfo [ref=e70]:
      - paragraph [ref=e72]: © 2026 LetUsMeet — Simple, frictionless group scheduling.
  - paragraph [ref=e73]: Running in emulator mode. Do not use with production credentials.
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Phase 1 Critical User Journeys', () => {
  4  |   // We use a single test to preserve the state (the created poll ID) across the flow,
  5  |   // or we could split them and pass the ID, but a single e2e journey test is often simpler.
  6  |   
  7  |   test('Create a poll, vote on it, and view results', async ({ page }) => {
  8  |     // --- 1. Home Page ---
  9  |     await page.goto('/');
  10 |     await expect(page).toHaveTitle(/LetUsMeet/);
  11 |     
  12 |     // Navigate to create page
  13 |     await page.getByTestId('create-poll-btn').click();
  14 |     await expect(page).toHaveURL(/\/create/);
  15 | 
  16 |     // --- 2. Create Poll Page ---
  17 |     await page.getByTestId('poll-title-input').fill('Playwright E2E Poll');
  18 |     await page.getByTestId('poll-location-input').fill('E2E Test Location');
  19 |     
  20 |     // Fill first slot
  21 |     await page.getByTestId('add-slot-btn').click();
  22 |     
  23 |     // Submit the form
  24 |     await page.getByTestId('create-submit-btn').click();
  25 | 
  26 |     // Wait for navigation to the poll page
  27 |     await page.waitForURL(/\/poll\/[^/]+$/);
  28 |     const pollUrl = page.url();
  29 |     expect(pollUrl).toMatch(/\/poll\/[a-zA-Z0-9_-]+$/);
  30 | 
  31 |     // --- 3. Vote Poll Page ---
  32 |     await expect(page.getByTestId('poll-title')).toContainText('Playwright E2E Poll');
  33 |     
  34 |     // Cycle vote on the first slot (clicks from NO -> YES)
  35 |     const slotCards = page.getByTestId('slot-card');
  36 |     await expect(slotCards).toHaveCount(2); // we added one
  37 |     
  38 |     await slotCards.nth(0).click(); // NO -> YES
  39 |     await slotCards.nth(0).click(); // YES -> IF_NEED_BE
  40 | 
  41 |     await slotCards.nth(1).click(); // NO -> YES
  42 | 
  43 |     // Fill name
  44 |     await page.getByTestId('participant-name-input').fill('E2E Tester');
  45 |     
  46 |     // Submit vote
  47 |     await page.getByTestId('vote-submit-btn').click();
  48 | 
  49 |     // Wait for success screen
> 50 |     await expect(page.locator('h2', { hasText: 'Vote Submitted!' })).toBeVisible();
     |                                                                      ^ Error: expect(locator).toBeVisible() failed
  51 | 
  52 |     // --- 4. View Results Page ---
  53 |     await page.getByTestId('view-results-btn').click();
  54 |     await page.waitForURL(/\/poll\/[^/]+\/results$/);
  55 | 
  56 |     // Check results table
  57 |     await expect(page.getByTestId('consensus-grid')).toBeVisible();
  58 |     await expect(page.getByTestId('participant-name').first()).toHaveText('E2E Tester');
  59 |   });
  60 | });
  61 | 
```