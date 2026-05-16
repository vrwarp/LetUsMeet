import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth } from './useAuth';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// Mock firebase/auth
vi.mock('firebase/auth', () => ({
  signInAnonymously: vi.fn(),
  onAuthStateChanged: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()), // return unsubscribe
}));

// Mock firebase/functions
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(),
  httpsCallable: vi.fn(),
}));

// Mock @/firebase
vi.mock('@/firebase', () => ({
  auth: { currentUser: null },
  db: {},
}));

// Mock @/lib/deviceService
vi.mock('@/lib/deviceService', () => ({
  verifyAmk: vi.fn().mockResolvedValue(true),
  getDeviceId: vi.fn().mockReturnValue('test-device-id'),
}));

// Mock @/lib/pollService
vi.mock('@/lib/pollService', () => ({
  resetKeystore: vi.fn().mockResolvedValue(undefined),
}));

// Unmock the hook itself
vi.unmock('@/hooks/useAuth');

describe('useAuth hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signs in anonymously if no user is present', async () => {
    (onAuthStateChanged as any).mockImplementation((_auth: any, callback: any) => {
      callback(null);
      return vi.fn();
    });

    (signInAnonymously as any).mockResolvedValue({ user: { uid: 'anon-123' } });

    renderHook(() => useAuth());

    await waitFor(() => {
      expect(signInAnonymously).toHaveBeenCalled();
    });
  });

  it('returns user if already signed in', async () => {
    const mockUser = { uid: 'user-123', isAnonymous: true };
    (onAuthStateChanged as any).mockImplementation((_auth: any, callback: any) => {
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
    (onAuthStateChanged as any).mockImplementation((_auth: any, callback: any) => {
      setTimeout(() => callback({ uid: 'user-123', isAnonymous: true }), 10);
      return vi.fn();
    });

    const { result } = renderHook(() => useAuth());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('handles anonymous auth errors gracefully', async () => {
    (onAuthStateChanged as any).mockImplementation((_auth: any, callback: any) => {
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
