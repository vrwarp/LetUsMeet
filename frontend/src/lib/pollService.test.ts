import { describe, it, expect, vi } from 'vitest';

// Unmock pollService before importing
vi.unmock('./pollService');
vi.unmock('@/lib/pollService');
vi.unmock('../lib/pollService');

import { getShareableUrl, extractKeyFromFragment } from './pollService';

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

  it('strips adminToken from a RELATIVE url while keeping the key fragment', () => {
    expect(getShareableUrl('/poll/123?adminToken=x#key=y')).toBe('/poll/123#key=y');
  });

  it('strips adminToken from a protocol-relative url (regex-fallback path)', () => {
    expect(getShareableUrl('//host/poll/1?adminToken=x')).toBe('//host/poll/1');
  });
});

describe('extractKeyFromFragment', () => {
  it('returns the key token when present in the location hash', () => {
    window.location.hash = '#key=abc-_1';
    expect(extractKeyFromFragment()).toBe('abc-_1');
    window.location.hash = '';
  });

  it('returns null when no key fragment is present', () => {
    window.location.hash = '';
    expect(extractKeyFromFragment()).toBeNull();
  });
});
