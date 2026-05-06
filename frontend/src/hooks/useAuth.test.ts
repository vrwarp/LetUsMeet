import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth } from './useAuth';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// Mock firebase/auth
vi.mock('firebase/auth', () => ({
  signInAnonymously: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

// Mock @/firebase
vi.mock('@/firebase', () => ({
  auth: { currentUser: null },
}));

// Unmock the hook itself since setup.ts mocks it globally
vi.unmock('@/hooks/useAuth');
vi.unmock('../hooks/useAuth');
vi.unmock('./useAuth');

describe('useAuth hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signs in anonymously if no user is present', async () => {
    // Mock onAuthStateChanged to call back with null initially
    (onAuthStateChanged as any).mockImplementation((auth: any, callback: any) => {
      callback(null);
      return vi.fn(); // unsubscribe
    });

    (signInAnonymously as any).mockResolvedValue({ user: { uid: 'anon-123' } });

    renderHook(() => useAuth());

    await waitFor(() => {
      expect(signInAnonymously).toHaveBeenCalled();
    });
  });

  it('returns user if already signed in', async () => {
    const mockUser = { uid: 'user-123' };
    (onAuthStateChanged as any).mockImplementation((auth: any, callback: any) => {
      callback(mockUser);
      return vi.fn();
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it('sets loading to false after auth is initialized', async () => {
    (onAuthStateChanged as any).mockImplementation((auth: any, callback: any) => {
      // Delay the callback to simulate async initialization
      setTimeout(() => callback({ uid: 'user-123' }), 10);
      return vi.fn();
    });

    const { result } = renderHook(() => useAuth());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('handles anonymous auth errors gracefully', async () => {
    (onAuthStateChanged as any).mockImplementation((auth: any, callback: any) => {
      callback(null);
      return vi.fn();
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (signInAnonymously as any).mockRejectedValue(new Error('Auth failed'));

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(consoleSpy).toHaveBeenCalledWith("Anonymous auth failed", expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('unsubscribes on unmount', () => {
    const unsubscribeMock = vi.fn();
    (onAuthStateChanged as any).mockImplementation(() => unsubscribeMock);

    const { unmount } = renderHook(() => useAuth());
    unmount();

    expect(unsubscribeMock).toHaveBeenCalled();
  });
});
