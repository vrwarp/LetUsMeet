import { setDeviceServiceProviders, setPrfProviders, setSessionProviders } from "charproof";

export function setupMockZkStorage() {
  console.log("⚠️ E2E / ZK Mock Mode detected: Initializing persistent Mock ZK IndexedDB storage.");
  
  const openMockDb = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("Mock_Storage_DB", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("store");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  const mockDbGet = async (key: string): Promise<any> => {
    try {
      const db = await openMockDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("store", "readonly");
        const req = tx.objectStore("store").get(key);
        tx.oncomplete = () => resolve(req.result || null);
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn("Failed to read from Mock DB", e);
      return null;
    }
  };

  const mockDbSet = async (key: string, val: any): Promise<void> => {
    try {
      const db = await openMockDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("store", "readwrite");
        tx.objectStore("store").put(val, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.error("Failed to write to Mock DB", e);
    }
  };

  const mockDbClear = async (): Promise<void> => {
    try {
      const db = await openMockDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("store", "readwrite");
        tx.objectStore("store").clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.error("Failed to clear Mock DB", e);
    }
  };

  const mockLocalStore = {
    useMemoryFallback: false,
    getDatabase: async () => null,
    getDeviceId: () => {
      let id = localStorage.getItem("deviceId");
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("deviceId", id);
      }
      return id;
    },
    getDeviceName: () => localStorage.getItem("deviceName") || "Unknown Device",
    setDeviceName: (name: string) => localStorage.setItem("deviceName", name),
    saveDeviceKeys: async (keys: any) => {
      await mockDbSet("current_device", keys);
    },
    loadDeviceKeys: async () => {
      return await mockDbGet("current_device");
    },
    saveMasterKey: async (uid: string, key: any) => {
      await mockDbSet("master_" + uid, key);
    },
    loadMasterKey: async (uid: string) => {
      return await mockDbGet("master_" + uid);
    },
    saveIdentityKey: async (uid: string, key: any) => {
      await mockDbSet("identity_" + uid, key);
    },
    loadIdentityKey: async (uid: string) => {
      return await mockDbGet("identity_" + uid);
    },
    saveIdentity: async (ledgerId: string, keys: any) => {
      await mockDbSet("session_identity_" + ledgerId, keys);
    },
    loadIdentity: async (ledgerId: string) => {
      return await mockDbGet("session_identity_" + ledgerId);
    },
    getPrfCredentialId: (uid: string) => {
      return localStorage.getItem("prf_cred_" + uid) || "default_prf";
    },
    setPrfCredentialId: (uid: string, credentialId: string) => {
      localStorage.setItem("prf_cred_" + uid, credentialId);
    },
    clearAll: async () => {
      localStorage.removeItem("deviceId");
      localStorage.removeItem("deviceName");
      await mockDbClear();
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith("prf_cred_")) {
          localStorage.removeItem(key);
        }
      }
    }
  };

  setDeviceServiceProviders({ localDeviceStore: mockLocalStore as any });
  setPrfProviders({ localDeviceStore: mockLocalStore as any });
  setSessionProviders({ localDeviceStore: mockLocalStore as any });
}
