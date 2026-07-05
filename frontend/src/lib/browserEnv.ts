/**
 * Browser-environment heuristics for the Google sign-in flow.
 *
 * Google's OAuth endpoint rejects sign-in from embedded web views with
 * `disallowed_useragent`, and the WebAuthn/passkey enrollment behind our
 * zero-knowledge keystore is unavailable or unreliable in most of them. Neither
 * is fixable from the client, so the best we can do is recognise the situation
 * and point the user at a real browser. Detection is best-effort: treat it as
 * advisory and never hard-disable functionality on the basis of it.
 */

// Facebook / Instagram / Messenger (FBAN, FBAV), LINE, WeChat (MicroMessenger),
// the Google Search app (GSA), and the generic Android WebView marker `; wv)`.
const EMBEDDED_BROWSER_RE = /\bFBAN|\bFBAV|Instagram|Messenger|Line\/|MicroMessenger|; ?wv\)|\bGSA\//;

export function isEmbeddedBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return EMBEDDED_BROWSER_RE.test(navigator.userAgent || "");
}

const OPEN_IN_BROWSER_HINT =
  "If you opened this from another app (like Instagram or Messenger), reopen it in Safari or Chrome and try again.";

function getAuthErrorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

/**
 * Turn a raw Google sign-in error into copy we can show a user, or `null` when
 * the user simply dismissed the popup (nothing worth surfacing).
 */
export function friendlySignInError(error: unknown): string | null {
  const code = getAuthErrorCode(error);

  // Benign: the user closed the popup or double-triggered sign-in. Don't nag.
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
    return null;
  }

  if (code === "auth/popup-blocked") {
    const base = "Your browser blocked the sign-in window. Tap sign in again to allow it.";
    return isEmbeddedBrowser() ? `${base} ${OPEN_IN_BROWSER_HINT}` : base;
  }

  // Embedded web views get `disallowed_useragent` (or a generic failure) from
  // Google, and passkey enrollment can't run there either — steer to a browser.
  if (isEmbeddedBrowser()) {
    return `We couldn't sign you in here. ${OPEN_IN_BROWSER_HINT}`;
  }

  if (code === "auth/network-request-failed") {
    return "We couldn't reach Google to sign you in. Check your connection and try again.";
  }

  return "We couldn't sign you in. Please try again.";
}
