import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { useAuth } from './useAuth';
import { signInAnonymously, onAuthStateChanged, signInWithPopup } from 'firebase/auth';

// Mock firebase/auth
vi.mock('firebase/auth', () => ({
  signInAnonymously: vi.fn(),
  onAuthStateChanged: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

// Mock the confirm dialog. useAuth now calls useConfirm() to show an in-app
// browser interstitial before Google sign-in; `mockConfirm` lets tests drive
// whether the user picks "Try anyway" (resolve true) or "Cancel" (false).
const { mockConfirm } = vi.hoisted(() => ({ mockConfirm: vi.fn() }));
vi.mock('@/components/confirm/confirmContext', () => ({
  useConfirm: () => mockConfirm,
}));

const NORMAL_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
const INSTAGRAM_UA = 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Instagram 300.0.0.0';

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

// Mock charproof
vi.mock('charproof', () => ({
  initializeZK: vi.fn(),
  verifyAmk: vi.fn().mockResolvedValue(true),
  getDeviceId: vi.fn().mockReturnValue('test-device-id'),
  clearAmkSessionCache: vi.fn(),
  derivePrfMasterKey: vi.fn(),
  clearPrfSessionCache: vi.fn(),
  registerCurrentDevice: vi.fn(),
  loadDeviceKeysFromIndexedDB: vi.fn(),
  importDevicePrivateKey: vi.fn(),
  decryptHybrid: vi.fn(),
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
    (onAuthStateChanged as unknown as Mock).mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
      callback(null);
      return vi.fn();
    });

    (signInAnonymously as unknown as Mock).mockResolvedValue({ user: { uid: 'anon-123' } });

    renderHook(() => useAuth());

    await waitFor(() => {
      expect(signInAnonymously).toHaveBeenCalled();
    });
  });

  it('returns user if already signed in', async () => {
    const mockUser = { uid: 'user-123', isAnonymous: true };
    (onAuthStateChanged as unknown as Mock).mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
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
    (onAuthStateChanged as unknown as Mock).mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
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
    (onAuthStateChanged as unknown as Mock).mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
      callback(null);
      return vi.fn();
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (signInAnonymously as unknown as Mock).mockRejectedValue(new Error('Auth failed'));

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(consoleSpy).toHaveBeenCalledWith("Anonymous auth failed", expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('unsubscribes on unmount', () => {
    const unsubscribeMock = vi.fn();
    (onAuthStateChanged as unknown as Mock).mockImplementation(() => unsubscribeMock);

    const { unmount } = renderHook(() => useAuth());
    unmount();

    expect(unsubscribeMock).toHaveBeenCalled();
  });
});

describe('signInWithGoogle in-app browser interstitial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Don't drive auth state in these tests — just register and return.
    (onAuthStateChanged as unknown as Mock).mockImplementation(() => vi.fn());
    (signInWithPopup as unknown as Mock).mockResolvedValue({ user: { uid: 'g-1', email: 'a@b.c', displayName: 'A' } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips the interstitial and signs in directly in a normal browser', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(NORMAL_UA);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(signInWithPopup).toHaveBeenCalledTimes(1);
  });

  it('shows the interstitial and aborts when the user declines in an in-app browser', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(INSTAGRAM_UA);
    mockConfirm.mockResolvedValue(false);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(signInWithPopup).not.toHaveBeenCalled();
  });

  it('proceeds with sign-in when the user chooses "Try anyway"', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(INSTAGRAM_UA);
    mockConfirm.mockResolvedValue(true);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(signInWithPopup).toHaveBeenCalledTimes(1);
  });
});
