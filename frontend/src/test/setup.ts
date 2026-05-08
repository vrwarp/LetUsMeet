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

// Global mock for pollApi
vi.mock('@/lib/pollApi', () => {
  const mockFetch = vi.fn((data: any) => Promise.resolve({ 
    data: { 
      poll: { 
        pollId: data?.pollId || 'mock-poll-id-123',
        organizerUid: 'user123',
        title: 'Mock Meeting', 
        location: 'Virtual', 
        status: 'OPEN',
        timeSlots: [
          { id: 't1', startTime: '2026-10-10T10:00:00Z', endTime: '2026-10-10T11:00:00Z' },
        ] 
      },
      votes: [],
      voteCounts: { t1: { YES: 0, NO: 0, IF_NEED_BE: 0 } }
    } 
  }));
  
  return {
    createPollAction: vi.fn(() => Promise.resolve({ data: { pollId: 'mock-poll-id-123' } })),
    fetchPollAction: mockFetch,
    submitVoteAction: vi.fn(() => Promise.resolve({ data: { success: true } })),
    getOrganizerCalendarAction: vi.fn(() => Promise.resolve({ data: { busyTimes: [] } })),
    finalizePollAction: vi.fn(() => Promise.resolve({ data: { success: true, eventId: "mock" } })),
    updatePollAction: vi.fn(() => Promise.resolve({ data: { success: true } })),
    deleteVoteAction: vi.fn(() => Promise.resolve({ data: { success: true } })),
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
