import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  limit,
  serverTimestamp
} from "firebase/firestore";
import { getDb } from "../config";
import type { LedgerEventStore } from "../core/interfaces";

export class FirestoreLedgerEventStore implements LedgerEventStore {
  async appendEvent(ledgerId: string, eventId: string, data: { encryptedData: string; iv: string }): Promise<void> {
    const ref = doc(getDb(), "polls", ledgerId, "events", eventId);
    await setDoc(ref, {
      eventId,
      createdAt: serverTimestamp(),
      encryptedData: data.encryptedData,
      iv: data.iv
    });
  }

  subscribe(
    ledgerId: string,
    onUpdate: (events: Array<{ encryptedData: string; iv: string; id: string }>) => void
  ): () => void {
    const eventsRef = collection(getDb(), "polls", ledgerId, "events");
    const q = query(eventsRef, orderBy("createdAt", "asc"));
    return onSnapshot(q, (snapshot) => {
      const events = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          encryptedData: data.encryptedData,
          iv: data.iv
        };
      });
      onUpdate(events);
    });
  }

  async getGenesisEvent(ledgerId: string): Promise<{ encryptedData: string; iv: string } | null> {
    const eventsRef = collection(getDb(), "polls", ledgerId, "events");
    const q = query(eventsRef, orderBy("createdAt", "asc"), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const data = snapshot.docs[0].data();
    return {
      encryptedData: data.encryptedData,
      iv: data.iv
    };
  }

  async createLedger(ledgerId: string): Promise<void> {
    const ref = doc(getDb(), "polls", ledgerId);
    await setDoc(ref, { pollId: ledgerId });
  }
}
