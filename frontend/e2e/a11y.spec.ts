import { test, expect } from './helpers/base-test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Audits', () => {
  test('Home page should not have any automatically detectable accessibility issues', async ({ page }) => {
    await page.goto('/');
    const accessibilityScanResults = await new AxeBuilder({ page }).exclude('.firebase-emulator-warning').analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Create Poll page should not have any automatically detectable accessibility issues', async ({ page }) => {
    await page.goto('/create');
    await page.waitForSelector('h1');
    const accessibilityScanResults = await new AxeBuilder({ page }).exclude('.firebase-emulator-warning').analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Vote Poll page should not have any automatically detectable accessibility issues', async ({ page }) => {
    // Navigate to create and create one quickly to get a valid poll page
    await page.goto('/create');
    await page.waitForTimeout(2000);
    await page.getByTestId('organizer-name-input').fill('Test Organizer');
    await page.getByTestId('poll-title-input').fill(`A11y Poll ${Date.now()}`);
    await page.getByTestId('add-slot-btn').click();

    const submitBtn = page.getByTestId('create-submit-btn');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await page.waitForURL(/\/poll\/[^/]+(\?.*)?#key=.+/);
    await page.waitForTimeout(2000);

    await page.waitForSelector('h1');
    const accessibilityScanResults = await new AxeBuilder({ page }).exclude('.firebase-emulator-warning').analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test.skip('Results page should not have any automatically detectable accessibility issues', async ({ page }) => {
    // Navigate to create and create one quickly
    await page.goto('/create');
    await page.waitForTimeout(2000);
    await page.getByTestId('organizer-name-input').fill('Test Organizer');
    await page.getByTestId('poll-title-input').fill(`A11y Poll Results ${Date.now()}`);
    await page.getByTestId('add-slot-btn').click();

    const submitBtn = page.getByTestId('create-submit-btn');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await page.waitForURL(/\/poll\/[^/]+(\?.*)?#key=.+/);
    await page.waitForTimeout(2000);
    const pollUrl = page.url();

    // Go to results
    const resultsUrl = pollUrl.replace(/\/poll\/([^#]+)/, '/poll/$1/results');
    await page.goto(resultsUrl);
    await page.waitForSelector('h1');
    const accessibilityScanResults = await new AxeBuilder({ page }).exclude('.firebase-emulator-warning').analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
