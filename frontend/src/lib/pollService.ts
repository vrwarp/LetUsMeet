import { collection, query, orderBy, onSnapshot, writeBatch, getDocs, doc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { createLedgerSession, openDB, STORE_IDENTITIES, STORE_MASTER_KEYS, STORE_DEVICE_KEYS,
  clearAmkSessionCache, clearPrfSessionCache } from "@letusmeet/zero-knowledge";
import { calculatePollState } from "./pollReducer";
import type { PollState, PollMetadata } from "../types";
import type { DecryptedLedgerEvent, KeystoreEntry, LedgerSession } from "@letusmeet/zero-knowledge";

// Re-export for pages
export { createLedgerSession, getLedgerSession } from "@letusmeet/zero-knowledge";

// === URL UTILITIES ===

export function extractKeyFromFragment(): string | null {
  const match = window.location.hash.match(/key=([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export function setKeyInFragment(key: string) {
  window.location.hash = `key=${key}`;
}

export function getShareableUrl(urlStr: string = window.location.href): string {
  try {
    const url = new URL(urlStr);
    url.searchParams.delete("adminToken");
    return url.toString();
  } catch {
    return urlStr;
  }
}

// === POLL CREATION (thin wrapper) ===

export async function createBlindPoll(metadata: PollMetadata) {
  const { session, ownershipToken, ledgerId } = await createLedgerSession();
  const action = {
    type: "POLL_CREATED" as const,
    payload: {
      title: metadata.title,
      description: metadata.description,
      location: metadata.location,
      organizerName: metadata.organizerName,
      schedulingMode: metadata.schedulingMode,
      timeSlots: metadata.timeSlots,
      adminPublicKey: session.getSignerPublicKey()
    }
  };
  await session.appendEvent(action);
  return { pollId: ledgerId, key: session.exportSessionKey(), adminToken: ownershipToken };
}

// === LEDGER SUBSCRIPTION (with domain reducer) ===

export function subscribeToLedger(
  session: LedgerSession,
  onUpdate: (state: PollState | null, status: string) => void
): () => void {
  onUpdate(null, "Decrypting ledger...");
  return session.subscribe((events: DecryptedLedgerEvent[]) => {
    if (events.length === 0) {
      onUpdate(null, "No valid events found.");
      return;
    }
    const state = calculatePollState(events);
    onUpdate(state, "Synced");
  });
}

// === DASHBOARD KEYSTORE SUBSCRIPTION ===

export function subscribeToUserKeystore(
  uid: string,
  onUpdate: (entries: KeystoreEntry[]) => void
) {
  const keystoreRef = collection(db, "users", uid, "keystore");
  const q = query(keystoreRef, orderBy("updatedAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map(d => d.data() as KeystoreEntry);
    onUpdate(entries);
  });
}

// === ACCOUNT RESET ===

export async function resetKeystore() {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  const keystoreRef = collection(db, "users", user.uid, "keystore");
  const snap = await getDocs(keystoreRef);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(doc(db, "users", user.uid, "account_keys", "default"));
  await batch.commit();

  const idb = await openDB();
  const tx = idb.transaction([STORE_IDENTITIES, STORE_MASTER_KEYS, STORE_DEVICE_KEYS], "readwrite");
  tx.objectStore(STORE_IDENTITIES).clear();
  tx.objectStore(STORE_MASTER_KEYS).clear();
  tx.objectStore(STORE_DEVICE_KEYS).clear();
  clearAmkSessionCache();
  clearPrfSessionCache();
}
