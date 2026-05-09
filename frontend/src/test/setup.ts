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
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { uid: 'user123', email: 'test@example.com', displayName: 'Test User' },
    loading: false,
  })),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { uid: 'user123', email: 'test@example.com', displayName: 'Test User' },
    loading: false,
  })),
}));

// Global mock for pollService
vi.mock('@/lib/pollService', () => {
  const mockSubscribe = vi.fn((pollId: string, callback: any) => {
    callback({
      poll: {
        id: pollId,
        pollId: pollId,
        organizerUid: 'user123',
        title: 'Mock Meeting',
        location: 'Virtual',
        status: 'OPEN',
        schedulingMode: 'EXACT',
        timeSlots: [
          { id: 't1', startTime: '2026-10-10T10:00:00Z', endTime: '2026-10-10T11:00:00Z' },
        ],
        createdAt: '2026-05-09T00:00:00Z'
      },
      votes: [],
      voteCounts: { t1: { YES: 0, NO: 0, IF_NEED_BE: 0 } }
    });
    return () => {}; // Unsubscribe function
  });

  return {
    createPoll: vi.fn(() => Promise.resolve({ pollId: 'mock-poll-id-123', adminToken: 'mock-admin-token' })),
    subscribeToPoll: mockSubscribe,
    subscribeToUserPolls: vi.fn((uid: string, callback: any) => {
      callback([{
        id: 'mock-poll-id-123',
        pollId: 'mock-poll-id-123',
        organizerUid: uid,
        title: 'Mock User Poll',
        status: 'OPEN',
        createdAt: '2026-05-09T00:00:00Z',
        schedulingMode: 'EXACT',
        timeSlots: []
      }]);
      return () => {};
    }),
    submitVote: vi.fn(() => Promise.resolve()),
    finalizePoll: vi.fn(() => Promise.resolve()),
    updatePoll: vi.fn(() => Promise.resolve()),
    deleteVote: vi.fn(() => Promise.resolve()),
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
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  connectFirestoreEmulator: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  connectFunctionsEmulator: vi.fn(),
  httpsCallable: vi.fn(),
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
