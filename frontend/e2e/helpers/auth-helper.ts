import { Page, expect } from '@playwright/test';

/**
 * Mock Google Sign-In for the Firebase Emulator.
 * Handles the popup window opened by signInWithPopup.
 */
export async function mockGoogleSignIn(page: Page, email: string) {
  console.log(`[mockGoogleSignIn] Starting for ${email}`);

  const signInBtn = page.getByTestId('google-signin-btn');
  await expect(signInBtn).toBeVisible({ timeout: 15000 });

  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 30000 }),
    signInBtn.click(),
  ]);

  console.log(`[mockGoogleSignIn] Popup opened: ${popup.url()}`);
  await popup.waitForLoadState('networkidle').catch(() => { });

  // 1. Race to click "Add Account" or an existing account in a list
  const initialAction = popup.locator('#add-account-button, ul div, button:has-text("Add account")').first();
  if (await initialAction.isVisible({ timeout: 5000 })) {
    console.log(`[mockGoogleSignIn] Performing initial action (Add Account or Select Account)`);
    await initialAction.click();
    await popup.waitForTimeout(500);
  }

  // 2. Fill the email if the form is shown
  const emailInput = popup.locator('input[type="email"], #email-input').first();
  let emailFilled = false;
  if (await emailInput.isVisible({ timeout: 3000 })) {
    await emailInput.fill(email);
    console.log(`[mockGoogleSignIn] Filled email: ${email}`);
    emailFilled = true;
    await popup.waitForTimeout(500);
  }
  const finalSignInBtn = popup.locator('#sign-in > span, #sign-in, button:has-text("Sign in")').first();
  const autogenBtn = popup.locator('#autogen-button > div, #autogen-button').first();

  if (await finalSignInBtn.isVisible({ timeout: 2000 })) {
    console.log(`[mockGoogleSignIn] Clicking final sign-in button`);
    await finalSignInBtn.click();
  } else if (!emailFilled && await autogenBtn.isVisible({ timeout: 2000 })) {
    console.log(`[mockGoogleSignIn] No email filled and no sign-in button found. Clicking autogen.`);
    await autogenBtn.click();
  } else if (await autogenBtn.isVisible({ timeout: 2000 })) {
    // Fallback: click autogen if sign-in is missing even if email was filled (last resort)
    console.log(`[mockGoogleSignIn] Sign-in button missing. Clicking autogen as fallback.`);
    await autogenBtn.click();
  }

  console.log(`[mockGoogleSignIn] Waiting for popup to close...`);
  await popup.waitForEvent('close', { timeout: 30000 }).catch(async () => {
    console.log(`[mockGoogleSignIn] Popup didn't close automatically.`);
    await page.waitForTimeout(3000);
    const loggedIn = await page.getByTestId('user-profile-btn').isVisible();
    if (loggedIn) {
      console.log(`[mockGoogleSignIn] Main page is logged in. Closing popup.`);
      await popup.close().catch(() => { });
    } else {
      console.log(`[mockGoogleSignIn] Not logged in on main page. URL: ${popup.url()}`);
      await popup.close().catch(() => { });
      throw new Error("Login failed: User profile button not found.");
    }
  });

  await expect(page.getByTestId('user-profile-btn')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(500);
  console.log(`[mockGoogleSignIn] Login successful for ${email}`);
}

export async function clickSetupSecureAccess(page: Page) {
  console.log(`[clickSetupSecureAccess] Clicking "Set up secure acceess"`);
  try {
    await expect(page.getByRole('heading', { name: 'Secure your account' })).toBeVisible({ timeout: 10000 });
    const setupBtn = page.getByRole('button', { name: 'Set up my passkey' });
    await expect(setupBtn).toBeVisible({ timeout: 5000 });
    await setupBtn.click();
    // Wait a moment for WebAuthn prompt to resolve (virtual authenticator handles it instantly, but still good to wait)
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: 'Secure your account' })).not.toBeVisible({ timeout: 60000 });
    // Give webkit time to process the WebAuthn registration
    const name = page.context().browser()?.browserType()?.name();
    if (name == 'webkit') {
      await page.waitForTimeout(500);
    }
  } catch (error) {
    console.log(`[clickSetupSecureAccess] Interstitial not found or didn't complete, this might be expected depending on state.`, error);
    throw error;
  }
}
