import { setDeviceServiceProviders, setPrfProviders, setSessionProviders } from "charproof";

export function setupMockZkStorage() {
  console.log("⚠️ E2E / ZK Mock Mode detected: Initializing persistent Mock ZK IndexedDB storage.");

  const mockDbGet = async (key: string): Promise<any> => {
    try {
      const serialized = localStorage.getItem("mock_db_" + key);
      if (!serialized) return null;
      return JSON.parse(serialized);
    } catch (e) {
      console.warn("Failed to read from Mock localStorage DB", e);
      return null;
    }
  };

  const mockDbSet = async (key: string, val: any): Promise<void> => {
    try {
      localStorage.setItem("mock_db_" + key, JSON.stringify(val));
    } catch (e) {
      console.error("Failed to write to Mock localStorage DB", e);
    }
  };

  const mockDbClear = async (): Promise<void> => {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith("mock_db_")) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.error("Failed to clear Mock localStorage DB", e);
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
        console.log(`🔑 [MockZK] Generated new Device ID: ${id}`);
      } else {
        console.log(`🔑 [MockZK] Retrieved existing Device ID: ${id}`);
      }
      return id;
    },
    getDeviceName: () => {
      const name = localStorage.getItem("deviceName") || "Unknown Device";
      console.log(`🔑 [MockZK] getDeviceName: ${name}`);
      return name;
    },
    setDeviceName: (name: string) => {
      console.log(`🔑 [MockZK] setDeviceName: ${name}`);
      localStorage.setItem("deviceName", name);
    },
    saveDeviceKeys: async (keys: any) => {
      console.log("🔑 [MockZK] saveDeviceKeys called");
      await mockDbSet("current_device", keys);
    },
    loadDeviceKeys: async () => {
      console.log("🔑 [MockZK] loadDeviceKeys called");
      return await mockDbGet("current_device");
    },
    saveMasterKey: async (uid: string, key: any) => {
      console.log(`🔑 [MockZK] saveMasterKey for UID: ${uid}`);
      await mockDbSet("master_" + uid, key);
    },
    loadMasterKey: async (uid: string) => {
      console.log(`🔑 [MockZK] loadMasterKey for UID: ${uid}`);
      return await mockDbGet("master_" + uid);
    },
    saveIdentityKey: async (uid: string, key: any) => {
      console.log(`🔑 [MockZK] saveIdentityKey for UID: ${uid}`);
      await mockDbSet("identity_" + uid, key);
    },
    loadIdentityKey: async (uid: string) => {
      console.log(`🔑 [MockZK] loadIdentityKey for UID: ${uid}`);
      return await mockDbGet("identity_" + uid);
    },
    saveIdentity: async (ledgerId: string, keys: any) => {
      console.log(`🔑 [MockZK] saveIdentity for Ledger: ${ledgerId}`);
      await mockDbSet("session_identity_" + ledgerId, keys);
    },
    loadIdentity: async (ledgerId: string) => {
      console.log(`🔑 [MockZK] loadIdentity for Ledger: ${ledgerId}`);
      return await mockDbGet("session_identity_" + ledgerId);
    },
    getPrfCredentialId: (uid: string) => {
      const credId = localStorage.getItem("prf_cred_" + uid) || "default_prf";
      console.log(`🔑 [MockZK] getPrfCredentialId for UID ${uid}: ${credId}`);
      return credId;
    },
    setPrfCredentialId: (uid: string, credentialId: string) => {
      console.log(`🔑 [MockZK] setPrfCredentialId for UID ${uid}: ${credentialId}`);
      localStorage.setItem("prf_cred_" + uid, credentialId);
    },
    clearAll: async () => {
      console.log("🔑 [MockZK] clearAll clearing storage state.");
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
