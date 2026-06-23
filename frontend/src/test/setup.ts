import '@testing-library/jest-dom';
import 'whatwg-fetch';
import { webcrypto } from 'node:crypto';

declare global {
  // `var` is required here: it is the only declaration form that augments globalThis.
  var IS_VITEST: boolean;
}

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
  });
}
globalThis.IS_VITEST = true;

import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Global mock for useAuth hook - cover both alias and relative paths
const mockUseAuth = vi.fn(() => ({
  user: { uid: 'user123', email: 'test@example.com', displayName: 'Test User' },
  loading: false,
  keyMismatchError: null,
  pendingRequests: [],
  isDeviceRegistered: true,
  enrollDevice: vi.fn(),
  signInWithGoogle: vi.fn(),
  signOutUser: vi.fn(),
  resetAccount: vi.fn(),
  deleteAccount: vi.fn(),
  recoverWithPhrase: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: mockUseAuth,
}));

// Global mock for pollService
const mockSession = {
  appendEvent: vi.fn(() => Promise.resolve()),
  subscribe: vi.fn((cb) => {
    cb([]);
    return () => {};
  }),
  getGenesisEvent: vi.fn(() => Promise.resolve({
    signerPublicKey: 'mock-admin-pubkey',
    action: {
      type: 'POLL_CREATED',
      payload: {
        title: 'Mock ZK Meeting',
        location: 'Virtual',
        organizerName: 'Test User',
        schedulingMode: 'EXACT',
        timeSlots: [],
      }
    }
  })),
  exportSessionKey: vi.fn(() => 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE='),
  getSignerPublicKey: vi.fn(() => 'mock-admin-pubkey'),
};

const pollServiceMock = {
  createBlindPoll: vi.fn(() => Promise.resolve({ pollId: 'mock-poll-id-123', key: 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=', adminToken: 'mock-admin-token' })),
  subscribeToLedger: vi.fn((_session: unknown, callback: (state: unknown, status: string) => void) => {
    callback({
      adminPublicKey: 'mock-admin-pubkey',
      metadata: {
        title: 'Mock ZK Meeting',
        location: 'Virtual',
        organizerName: 'Test User',
        schedulingMode: 'EXACT',
        timeSlots: [
          { id: 't1', startTime: '2026-10-10T10:00:00Z', endTime: '2026-10-10T11:00:00Z' },
        ],
      },
      votes: new Map(),
      isFinalized: false,
    }, 'Synced');
    return () => {};
  }),
  extractKeyFromFragment: vi.fn(() => 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE='),
  friendlyStatus: vi.fn((status: string) => {
    switch (status) {
      case 'Initializing...':
      case 'Decrypting ledger...':
        return 'Loading this poll…';
      case 'No valid events found.':
        return 'Getting the latest responses…';
      case 'Synced':
        return 'Up to date';
      case 'Network connection lost.':
        return "Trouble connecting — we'll keep trying…";
      default:
        return status;
    }
  }),
  getShareableUrl: vi.fn((url = '') => {
    try {
      const u = new URL(url || 'http://localhost');
      u.searchParams.delete("adminToken");
      return u.toString();
    } catch {
      return url;
    }
  }),
  getLedgerSession: vi.fn(() => Promise.resolve(mockSession)),
  createLedgerSession: vi.fn(() => Promise.resolve({ session: mockSession, ownershipToken: 'mock-token', ledgerId: 'mock-poll-id-123' })),
  loadFromKeystore: vi.fn(() => Promise.resolve({ 
    symmetricKey: 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=',
    signingPrivateKey: 'priv',
    signingPublicKey: 'pub'
  })),
  subscribeToUserKeystore: vi.fn((_uid: string, callback: (entries: unknown) => void) => {
    callback([{ 
      ledgerId: 'mock-poll-id-123',
      amkId: 'amk_v1',
      wrappedPayload: 'ciphertext',
      iv: 'iv',
      updatedAt: Date.now()
    }]);
    return () => {};
  }),
  verifyAmk: vi.fn(() => Promise.resolve(true)),
  resetKeystore: vi.fn(() => Promise.resolve()),
};

vi.mock('@/lib/pollService', () => pollServiceMock);
vi.mock('../lib/pollService', () => pollServiceMock);


// Mock Firebase SDKs
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  connectAuthEmulator: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    if (typeof callback === 'function') {
      callback({ uid: 'user123', email: 'test@example.com', displayName: 'Test User' });
    }
    return () => {};
  }),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signOut: vi.fn(),
  signInAnonymously: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  initializeFirestore: vi.fn(() => ({})),
  connectFirestoreEmulator: vi.fn(),
  doc: vi.fn(() => ({})),
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  onSnapshot: vi.fn((_ref, callback) => {
    if (typeof callback === 'function') {
      // Mock a snapshot with some data if needed, or just an empty one
      callback({
        exists: () => false,
        docs: [],
        data: () => ({})
      });
    }
    return () => {};
  }),
  setDoc: vi.fn(() => Promise.resolve()),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false })),
  deleteDoc: vi.fn(() => Promise.resolve()),
  runTransaction: vi.fn((_db, updateFn) => updateFn({
    get: vi.fn(() => Promise.resolve({ exists: () => false })),
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  })),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  connectFunctionsEmulator: vi.fn(),
  httpsCallable: vi.fn(() => vi.fn(() => Promise.resolve({ data: {} }))),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value?.toString() || '';
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    get length() {
      return Object.keys(store).length;
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});
