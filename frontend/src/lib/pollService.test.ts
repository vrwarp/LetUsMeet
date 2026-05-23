import { describe, it, expect, vi } from 'vitest';

// Unmock pollService before importing
vi.unmock('./pollService');
vi.unmock('@/lib/pollService');
vi.unmock('../lib/pollService');

import { getShareableUrl } from './pollService';

describe('getShareableUrl', () => {
  it('removes adminToken from URL with only adminToken', () => {
    const url = 'http://example.com/poll/123?adminToken=abc12345';
    expect(getShareableUrl(url)).toBe('http://example.com/poll/123');
  });

  it('removes adminToken but keeps other query parameters', () => {
    const url = 'http://example.com/poll/123?otherParam=true&adminToken=abc12345&foo=bar';
    expect(getShareableUrl(url)).toBe('http://example.com/poll/123?otherParam=true&foo=bar');
  });

  it('leaves URL unchanged if adminToken is not present', () => {
    const url = 'http://example.com/poll/123?foo=bar';
    expect(getShareableUrl(url)).toBe('http://example.com/poll/123?foo=bar');
  });

  it('preserves hash fragments while removing adminToken', () => {
    const url = 'http://example.com/poll/123?adminToken=abc12345#key=secret';
    expect(getShareableUrl(url)).toBe('http://example.com/poll/123#key=secret');
  });

  it('returns original string if URL is invalid', () => {
    const invalidUrl = 'not-a-valid-url';
    expect(getShareableUrl(invalidUrl)).toBe(invalidUrl);
  });

  it('uses window.location.href when no URL is provided', () => {
    // In JSDOM, window.location.href is 'http://localhost:3000/'
    const originalHref = window.location.href;
    expect(getShareableUrl()).toBe(originalHref);
  });
});
