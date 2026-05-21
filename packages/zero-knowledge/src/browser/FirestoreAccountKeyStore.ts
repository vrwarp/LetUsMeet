import {
  doc,
  getDoc,
  setDoc,
  runTransaction
} from "firebase/firestore";
import { getDb, getAuth } from "../config";
import type { AccountKeyStore } from "../core/interfaces";
import type { AccountKeysDocument, KeystoreEntry, PendingDevice } from "../core/types";

export class FirestoreAccountKeyStore implements AccountKeyStore {
  private getUid(): string {
    const user = getAuth().currentUser;
    if (!user) {
      throw new Error("Must be signed in to perform this operation.");
    }
    return user.uid;
  }

  async getAccountKeys(): Promise<AccountKeysDocument | null> {
    const uid = this.getUid();
    const ref = doc(getDb(), "users", uid, "account_keys", "default");
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as AccountKeysDocument;
  }

  async transactAccountKeys(
    updater: (current: AccountKeysDocument) => AccountKeysDocument | Promise<AccountKeysDocument>
  ): Promise<void> {
    const uid = this.getUid();
    const ref = doc(getDb(), "users", uid, "account_keys", "default");
    await runTransaction(getDb(), async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) {
        throw new Error("Account keys document missing.");
      }
      const current = snap.data() as AccountKeysDocument;
      const updated = await updater(current);
      transaction.set(ref, updated);
    });
  }

  async setAccountKeys(docVal: AccountKeysDocument): Promise<void> {
    const uid = this.getUid();
    const ref = doc(getDb(), "users", uid, "account_keys", "default");
    await setDoc(ref, docVal);
  }

  async getKeystoreEntry(ledgerId: string): Promise<KeystoreEntry | null> {
    const uid = this.getUid();
    const ref = doc(getDb(), "users", uid, "keystore", ledgerId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as KeystoreEntry;
  }

  async setKeystoreEntry(ledgerId: string, entry: KeystoreEntry): Promise<void> {
    const uid = this.getUid();
    const ref = doc(getDb(), "users", uid, "keystore", ledgerId);
    await setDoc(ref, entry);
  }

  async getPendingDevice(deviceId: string): Promise<PendingDevice | null> {
    const uid = this.getUid();
    const ref = doc(getDb(), "users", uid, "pending_devices", deviceId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as PendingDevice;
  }

  async setPendingDevice(deviceId: string, data: PendingDevice): Promise<void> {
    const uid = this.getUid();
    const ref = doc(getDb(), "users", uid, "pending_devices", deviceId);
    await setDoc(ref, data);
  }

  async transactApproveDevice(
    accountUpdater: (current: AccountKeysDocument) => AccountKeysDocument | Promise<AccountKeysDocument>,
    pendingDeviceId: string,
    pendingUpdate: Partial<PendingDevice>
  ): Promise<void> {
    const uid = this.getUid();
    const accountKeysRef = doc(getDb(), "users", uid, "account_keys", "default");
    const pendingRef = doc(getDb(), "users", uid, "pending_devices", pendingDeviceId);

    await runTransaction(getDb(), async (transaction) => {
      const snap = await transaction.get(accountKeysRef);
      if (!snap.exists()) {
        throw new Error("Account keys missing.");
      }
      const current = snap.data() as AccountKeysDocument;
      const updated = await accountUpdater(current);
      
      transaction.set(accountKeysRef, updated);
      transaction.update(pendingRef, pendingUpdate as any);
    });
  }
}
