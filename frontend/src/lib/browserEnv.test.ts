import { describe, it, expect, afterEach, vi } from 'vitest';
import { isEmbeddedBrowser, friendlySignInError } from './browserEnv';

function setUserAgent(ua: string) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
}

const REAL_BROWSER_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

describe('isEmbeddedBrowser', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false for a normal mobile Safari user agent', () => {
    setUserAgent(REAL_BROWSER_UA);
    expect(isEmbeddedBrowser()).toBe(false);
  });

  it.each([
    ['Instagram', 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Instagram 300.0.0.0'],
    ['Facebook (FBAN/FBAV)', 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/400.0.0]'],
    ['Messenger', 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Messenger'],
    ['LINE', 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Line/13.0.0'],
    ['WeChat', 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 MicroMessenger/8.0'],
    ['Android WebView', 'Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36'],
  ])('detects the %s in-app browser', (_label, ua) => {
    setUserAgent(ua);
    expect(isEmbeddedBrowser()).toBe(true);
  });
});

describe('friendlySignInError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null for a user-dismissed popup (no nag)', () => {
    setUserAgent(REAL_BROWSER_UA);
    expect(friendlySignInError({ code: 'auth/popup-closed-by-user' })).toBeNull();
    expect(friendlySignInError({ code: 'auth/cancelled-popup-request' })).toBeNull();
  });

  it('explains a blocked popup and how to retry', () => {
    setUserAgent(REAL_BROWSER_UA);
    const msg = friendlySignInError({ code: 'auth/popup-blocked' });
    expect(msg).toMatch(/blocked the sign-in window/i);
  });

  it('adds an open-in-browser hint when a popup is blocked inside an in-app browser', () => {
    setUserAgent('Mozilla/5.0 (iPhone) Instagram 300.0.0.0');
    const msg = friendlySignInError({ code: 'auth/popup-blocked' });
    expect(msg).toMatch(/Safari or Chrome/i);
  });

  it('steers embedded-browser users to a real browser on any failure', () => {
    setUserAgent('Mozilla/5.0 (iPhone) Instagram 300.0.0.0');
    const msg = friendlySignInError(new Error('disallowed_useragent'));
    expect(msg).toMatch(/Safari or Chrome/i);
  });

  it('handles a network failure with a connection-specific message', () => {
    setUserAgent(REAL_BROWSER_UA);
    const msg = friendlySignInError({ code: 'auth/network-request-failed' });
    expect(msg).toMatch(/connection/i);
  });

  it('falls back to a generic message for unknown errors', () => {
    setUserAgent(REAL_BROWSER_UA);
    const msg = friendlySignInError(new Error('something weird'));
    expect(msg).toBe("We couldn't sign you in. Please try again.");
  });
});
