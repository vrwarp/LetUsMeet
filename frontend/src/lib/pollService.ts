import {
  createLedgerSession,
  subscribeToUserKeystore as zkSubscribeToUserKeystore,
  resetLocalStorage,
  resetUserAccountRemote,
  archiveKeystoreEntry,
  unarchiveKeystoreEntry
} from "@letusmeet/zero-knowledge";
import { calculatePollState } from "./pollReducer";
import type { PollState, PollMetadata } from "../types";
import type { DecryptedLedgerEvent, DecryptedKeystoreEntry, LedgerSession } from "@letusmeet/zero-knowledge";

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
    // Attempt parsing as an absolute URL first
    const url = new URL(urlStr);
    url.searchParams.delete("adminToken");
    return url.toString();
  } catch {
    try {
      // If it fails, try parsing it as a relative URL using a dummy base
      const dummyBase = 'http://dummy.local';
      const url = new URL(urlStr, dummyBase);
      url.searchParams.delete("adminToken");

      // Check if it resolved to a different origin (e.g., protocol-relative URL)
      if (url.origin !== dummyBase) {
        throw new Error("Origin mismatch, fallback to regex");
      }

      const absoluteResult = url.toString();
      const relativeResult = absoluteResult.substring(dummyBase.length);

      // Keep the original starting format (whether it started with '/' or not)
      if (!urlStr.startsWith('/') && relativeResult.startsWith('/')) {
        return relativeResult.substring(1);
      }
      return relativeResult;
    } catch {
      // Safe fallback if URL parsing still fails or for protocol-relative URLs
      return urlStr
        .replace(/([?&])adminToken=[^&#]*/gi, (_, prefix) => prefix === '?' ? '?' : '')
        .replace(/\?&/, '?')
        .replace(/\?($|#)/, '$1');
    }
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
  onUpdate: (entries: DecryptedKeystoreEntry[]) => void
) {
  return zkSubscribeToUserKeystore(onUpdate);
}

// === ACCOUNT RESET ===

export async function resetKeystore() {
  await resetUserAccountRemote();
  await resetLocalStorage();
}

export { archiveKeystoreEntry, unarchiveKeystoreEntry };
