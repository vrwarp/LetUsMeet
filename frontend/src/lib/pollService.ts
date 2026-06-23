import {
  createLedgerSession,
  subscribeToUserKeystore as zkSubscribeToUserKeystore,
  resetLocalStorage,
  resetUserAccountRemote,
  archiveKeystoreEntry,
  unarchiveKeystoreEntry
} from "charproof";
import { calculatePollState } from "./pollReducer";
import type { PollState, PollMetadata } from "../types";
import type { DecryptedLedgerEvent, DecryptedKeystoreEntry, LedgerSession } from "charproof";

// Re-export for pages
export { createLedgerSession, getLedgerSession } from "charproof";

// === URL UTILITIES ===

export function extractKeyFromFragment(): string | null {
  const match = window.location.hash.match(/key=([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export function setKeyInFragment(key: string) {
  window.location.hash = `key=${key}`;
}

// The organizer ownership token rides in the URL *fragment* (never the query
// string) so it is never sent to the server, written to access logs, or leaked
// via the Referer header. The decryption key lives in the same fragment.
export function extractAdminTokenFromFragment(
  hash: string = window.location.hash
): string | null {
  const match = hash.match(/adminToken=([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// Append the ownership token to a fragment that already carries the key, e.g.
// "#key=ABC" -> "#key=ABC&adminToken=XYZ".
export function appendAdminTokenToFragment(hash: string, token: string): string {
  const base = hash && hash !== "#" ? hash : "#";
  const sep = base.endsWith("#") ? "" : "&";
  return `${base}${sep}adminToken=${token}`;
}

// Remove the ownership token from a fragment while preserving the key.
export function stripAdminTokenFromFragment(hash: string): string {
  if (!hash) return "";
  const cleaned = hash
    .replace(/([#&])adminToken=[^&]*/gi, (_, prefix) => (prefix === "#" ? "#" : ""))
    .replace(/#&/, "#")
    .replace(/&&/g, "&")
    .replace(/&$/, "");
  return cleaned === "#" ? "" : cleaned;
}

// Map internal ledger sync/status strings to friendly, user-facing copy.
export function friendlyStatus(status: string): string {
  switch (status) {
    case "Initializing...":
    case "Decrypting ledger...":
      return "Loading this poll…";
    case "No valid events found.":
      return "Getting the latest responses…";
    case "Synced":
      return "Up to date";
    case "Network connection lost.":
      return "Trouble connecting — we'll keep trying…";
    default:
      return status;
  }
}

export function getShareableUrl(urlStr: string = window.location.href): string {
  try {
    // Attempt parsing as an absolute URL first
    const url = new URL(urlStr);
    url.searchParams.delete("adminToken");
    url.hash = stripAdminTokenFromFragment(url.hash);
    return url.toString();
  } catch {
    try {
      // If it fails, try parsing it as a relative URL using a dummy base
      const dummyBase = 'http://dummy.local';
      const url = new URL(urlStr, dummyBase);
      url.searchParams.delete("adminToken");
      url.hash = stripAdminTokenFromFragment(url.hash);

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
      // Safe fallback if URL parsing still fails or for protocol-relative URLs.
      // Strip adminToken from both the query string and the fragment.
      return urlStr
        .replace(/([?&])adminToken=[^&#]*/gi, (_, prefix) => prefix === '?' ? '?' : '')
        .replace(/([#&])adminToken=[^&]*/gi, (_, prefix) => prefix === '#' ? '#' : '')
        .replace(/\?&/, '?')
        .replace(/#&/, '#')
        .replace(/\?($|#)/, '$1')
        .replace(/#$/, '');
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
  onUpdate: (state: PollState | null, status: string) => void,
  onError?: (error: Error) => void
): () => void {
  onUpdate(null, "Decrypting ledger...");
  return session.subscribe(
    (events: DecryptedLedgerEvent[]) => {
      if (events.length === 0) {
        onUpdate(null, "No valid events found.");
        return;
      }
      const state = calculatePollState(events);
      onUpdate(state, "Synced");
    },
    (error) => {
      onUpdate(null, "Network connection lost.");
      onError?.(error);
    }
  );
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
