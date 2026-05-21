import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DB_NAME, DB_VERSION, STORE_IDENTITIES, STORE_MASTER_KEYS, STORE_DEVICE_KEYS, openDB } from "./idb";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";

describe("idb", () => {
  beforeEach(() => {
    // Reset indexedDB state before each test
    globalThis.indexedDB = new IDBFactory();
  });

  it("should have correct constants", () => {
    expect(DB_NAME).toBe("LetUsMeet_Keys");
    expect(DB_VERSION).toBe(3);
    expect(STORE_IDENTITIES).toBe("identities");
    expect(STORE_MASTER_KEYS).toBe("master_keys");
    expect(STORE_DEVICE_KEYS).toBe("device_keys");
  });

  it("should open database and create stores on upgradeneeded", async () => {
    const db = await openDB();
    expect(db.name).toBe(DB_NAME);
    expect(db.version).toBe(DB_VERSION);
    expect(db.objectStoreNames.contains(STORE_IDENTITIES)).toBe(true);
    expect(db.objectStoreNames.contains(STORE_MASTER_KEYS)).toBe(true);
    expect(db.objectStoreNames.contains(STORE_DEVICE_KEYS)).toBe(true);
    db.close();
  });

  it("should handle existing database without creating stores again", async () => {
    // First call to create the DB and stores
    const db1 = await openDB();
    db1.close();

    // Second call should succeed and return the existing DB
    const db2 = await openDB();
    expect(db2.name).toBe(DB_NAME);
    expect(db2.version).toBe(DB_VERSION);
    expect(db2.objectStoreNames.contains(STORE_IDENTITIES)).toBe(true);
    expect(db2.objectStoreNames.contains(STORE_MASTER_KEYS)).toBe(true);
    expect(db2.objectStoreNames.contains(STORE_DEVICE_KEYS)).toBe(true);
    db2.close();
  });

  it("should handle indexedDB errors", async () => {
    const originalOpen = globalThis.indexedDB.open;
    globalThis.indexedDB.open = vi.fn().mockImplementation(() => {
      const request = {} as IDBOpenDBRequest;
      setTimeout(() => {
        request.error = new DOMException("Test error");
        if (request.onerror) request.onerror(new Event("error"));
      }, 0);
      return request;
    });

    await expect(openDB()).rejects.toThrow("Test error");

    // Restore original
    globalThis.indexedDB.open = originalOpen;
  });
});
