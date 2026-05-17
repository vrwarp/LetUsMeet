import '@testing-library/jest-dom';
import 'whatwg-fetch';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
  });
}
(globalThis as any).IS_VITEST = true;

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

// Generate real keys for mocks to avoid ERR_INVALID_ARG_TYPE
const mockSymmetricKey = await webcrypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 },
  true,
  ['encrypt', 'decrypt']
);

const mockIdentityPair = await webcrypto.subtle.generateKey(
  {
    name: 'ECDSA',
    namedCurve: 'P-256',
  },
  true,
  ['sign', 'verify']
);

// Global mock for pollService
vi.mock('@/lib/pollService', () => {
  return {
    createBlindPoll: vi.fn(() => Promise.resolve({ pollId: 'mock-poll-id-123', key: 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=' })),
    subscribeToLedger: vi.fn((pollId: string, _key: any, callback: any) => {
      callback({
        pollId: pollId,
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
        adminPublicKey: 'mock-admin-pubkey'
      }, 'Synced');
      return () => {};
    }),
    extractKeyFromFragment: vi.fn(() => 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE='),
    getShareableUrl: vi.fn((url = '') => {
      try {
        const u = new URL(url || 'http://localhost');
        u.searchParams.delete("adminToken");
        return u.toString();
      } catch {
        return url;
      }
    }),
    appendSignedEvent: vi.fn(() => Promise.resolve()),
    loadIdentity: vi.fn(() => Promise.resolve({
      privateKey: mockIdentityPair.privateKey,
      publicKey: mockIdentityPair.publicKey
    })),
    saveToIndexedDB: vi.fn(() => Promise.resolve()),
    saveToKeystore: vi.fn(() => Promise.resolve()),
    derivePrfMasterKey: vi.fn(() => Promise.resolve(mockSymmetricKey)),
    loadFromKeystore: vi.fn(() => Promise.resolve({ 
      symmetricPollKey: 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=',
      ecdsaPrivateKey: 'priv',
      ecdsaPublicKey: 'pub'
    })),
    subscribeToUserKeystore: vi.fn((_uid: string, callback: any) => {
      callback([{ 
        pollId: 'mock-poll-id-123',
        amkId: 'amk_v1',
        wrappedPayload: 'ciphertext',
        iv: 'iv',
        updatedAt: Date.now()
      }]);
      return () => {};
    }),
    getGenesisEvent: vi.fn(() => Promise.resolve({
      title: 'Mock ZK Meeting',
      location: 'Virtual',
      organizerName: 'Test User',
      schedulingMode: 'EXACT',
      timeSlots: [],
    })),
    verifyAmk: vi.fn(() => Promise.resolve(true)),
    // Legacy support
    createPoll: vi.fn(() => Promise.resolve({ pollId: 'mock-poll-id-123', adminToken: 'mock-admin-token' })),
    subscribeToPoll: vi.fn(() => () => {}),
    submitVote: vi.fn(() => Promise.resolve()),
    finalizePoll: vi.fn(() => Promise.resolve()),
    updatePoll: vi.fn(() => Promise.resolve()),
    deleteVote: vi.fn(() => Promise.resolve()),
    claimPoll: vi.fn(() => Promise.resolve()),
    ensureAdminGrant: vi.fn(() => Promise.resolve(true)),
  };
});

vi.mock('../lib/pollService', () => {
  return {
    createBlindPoll: vi.fn(() => Promise.resolve({ pollId: 'mock-poll-id-123', key: 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=' })),
    subscribeToLedger: vi.fn((pollId: string, _key: any, callback: any) => {
      callback({
        pollId: pollId,
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
        adminPublicKey: 'mock-admin-pubkey'
      }, 'Synced');
      return () => {};
    }),
    extractKeyFromFragment: vi.fn(() => 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE='),
    getShareableUrl: vi.fn((url = '') => {
      try {
        const u = new URL(url || 'http://localhost');
        u.searchParams.delete("adminToken");
        return u.toString();
      } catch {
        return url;
      }
    }),
    appendSignedEvent: vi.fn(() => Promise.resolve()),
    loadIdentity: vi.fn(() => Promise.resolve({
      privateKey: mockIdentityPair.privateKey,
      publicKey: mockIdentityPair.publicKey
    })),
    saveToIndexedDB: vi.fn(() => Promise.resolve()),
    saveToKeystore: vi.fn(() => Promise.resolve()),
    derivePrfMasterKey: vi.fn(() => Promise.resolve(mockSymmetricKey)),
    loadFromKeystore: vi.fn(() => Promise.resolve({ 
      symmetricPollKey: 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=',
      ecdsaPrivateKey: 'priv',
      ecdsaPublicKey: 'pub'
    })),
    subscribeToUserKeystore: vi.fn((_uid: string, callback: any) => {
      callback([{ 
        pollId: 'mock-poll-id-123',
        amkId: 'amk_v1',
        wrappedPayload: 'ciphertext',
        iv: 'iv',
        updatedAt: Date.now()
      }]);
      return () => {};
    }),
    getGenesisEvent: vi.fn(() => Promise.resolve({
      title: 'Mock ZK Meeting',
      location: 'Virtual',
      organizerName: 'Test User',
      schedulingMode: 'EXACT',
      timeSlots: [],
    })),
    verifyAmk: vi.fn(() => Promise.resolve(true)),
    // Legacy support
    createPoll: vi.fn(() => Promise.resolve({ pollId: 'mock-poll-id-123', adminToken: 'mock-admin-token' })),
    subscribeToPoll: vi.fn(() => () => {}),
    submitVote: vi.fn(() => Promise.resolve()),
    finalizePoll: vi.fn(() => Promise.resolve()),
    updatePoll: vi.fn(() => Promise.resolve()),
    deleteVote: vi.fn(() => Promise.resolve()),
    claimPoll: vi.fn(() => Promise.resolve()),
    ensureAdminGrant: vi.fn(() => Promise.resolve(true)),
  };
});


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
