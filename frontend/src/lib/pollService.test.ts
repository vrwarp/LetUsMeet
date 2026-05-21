import { vi, describe, it, expect, afterEach } from 'vitest';

// The pollService is globally mocked in setup.ts, so we must unmock it
// to actually test its implementation.
vi.unmock('@/lib/pollService');
vi.unmock('./pollService');
vi.unmock('../lib/pollService');

import { getShareableUrl, extractKeyFromFragment, setKeyInFragment } from './pollService';

describe('pollService URL utilities', () => {
  describe('getShareableUrl', () => {
    it('should remove adminToken from a valid URL', () => {
      const result = getShareableUrl('https://example.com/poll/123?adminToken=abc&other=123#key=123');
      expect(result).toBe('https://example.com/poll/123?other=123#key=123');
    });

    it('should return the original URL if it does not have an adminToken', () => {
      const result = getShareableUrl('https://example.com/poll/123?other=123#key=123');
      expect(result).toBe('https://example.com/poll/123?other=123#key=123');
    });

    it('should catch an error with an invalid URL and return the original string', () => {
      const invalidUrl = 'not-a-valid-url';
      const result = getShareableUrl(invalidUrl);
      expect(result).toBe(invalidUrl);
    });

    it('should use window.location.href if no URL is provided', () => {
      const originalLocation = window.location;
      // @ts-ignore
      delete window.location;
      // @ts-ignore
      window.location = { ...originalLocation, href: 'https://example.com/poll/123?adminToken=abc#key=123' } as any;

      const result = getShareableUrl();
      expect(result).toBe('https://example.com/poll/123#key=123');

      // @ts-ignore
      window.location = originalLocation;
    });
  });

  describe('extractKeyFromFragment', () => {
    afterEach(() => {
        window.location.hash = '';
    });

    it('should extract the key from the fragment', () => {
      window.location.hash = '#key=abcdef123456';
      expect(extractKeyFromFragment()).toBe('abcdef123456');
    });

    it('should return null if no key is present', () => {
      window.location.hash = '#other=abcdef123456';
      expect(extractKeyFromFragment()).toBeNull();
    });

    it('should return null if there is no fragment', () => {
      window.location.hash = '';
      expect(extractKeyFromFragment()).toBeNull();
    });
  });

  describe('setKeyInFragment', () => {
    afterEach(() => {
        window.location.hash = '';
    });

    it('should set the key in the fragment', () => {
      setKeyInFragment('abcdef123456');
      expect(window.location.hash).toBe('#key=abcdef123456');
    });
  });
});
