import { 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  deleteDoc,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { db, auth } from "../firebase";
import type { Poll, Vote } from "../types/index";

/**
 * Fallback for crypto.randomUUID() if not available in non-secure contexts.
 */
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Creates a new poll in Firestore.
 * Generates an adminToken for client-side authorization of edits.
 */
export async function createPoll(data: Omit<Poll, "id" | "pollId" | "status" | "createdAt" | "organizerUid">) {
  const organizerUid = auth.currentUser?.uid || null;
  const adminToken = generateId();
  
  const pollRef = collection(db, "polls");
  const slotsWithIds = data.timeSlots.map(slot => ({
    ...slot,
    id: (slot as any).id || generateId()
  }));

  const docRef = await addDoc(pollRef, {
    ...data,
    timeSlots: slotsWithIds,
    organizerUid,
    adminToken, // Used for later edits if not signed in
    status: "OPEN",
    createdAt: new Date().toISOString(),
  });

  return { pollId: docRef.id, adminToken };
}

/**
 * Submits or updates a vote for a specific poll.
 */
export async function submitVote(pollId: string, voteData: Omit<Vote, "participantUid" | "updatedAt" | "voteId" | "createdAt">, existingVoteId?: string | null) {
  if (!auth.currentUser) throw new Error("Must be signed in to vote");

  const id = existingVoteId || generateId();
  const voteRef = doc(db, "polls", pollId, "votes", id);
  
  await setDoc(voteRef, {
    ...voteData,
    voteId: id,
    participantUid: auth.currentUser.uid,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

/**
 * Finalizes a poll with a selected time slot.
 */
export async function finalizePoll(pollId: string, selectedTimeSlotId: string, _adminToken?: string) {
  const pollRef = doc(db, "polls", pollId);
  
  // Security rules will verify adminToken or organizerUid
  await updateDoc(pollRef, {
    status: "FINALIZED",
    finalizedSlotId: selectedTimeSlotId,
  });
}

/**
 * Updates an existing poll in Firestore.
 */
export async function updatePoll(pollId: string, data: Partial<Poll>) {
  const pollRef = doc(db, "polls", pollId);
  
  const updateData = { ...data, updatedAt: new Date().toISOString() };
  if (updateData.timeSlots) {
    updateData.timeSlots = updateData.timeSlots.map(slot => ({
      ...slot,
      id: (slot as any).id || generateId()
    }));
  }

  await updateDoc(pollRef, updateData as any);
}

/**
 * Deletes a vote for a specific poll.
 */
export async function deleteVote(pollId: string, voteId: string) {
  const voteRef = doc(db, "polls", pollId, "votes", voteId);
  await deleteDoc(voteRef);
}

/**
 * Hook-ready function to listen to poll updates and votes.
 */
export function subscribeToPoll(
  pollId: string, 
  onUpdate: (data: { poll: Poll | null, votes: Vote[], voteCounts: Record<string, any> }) => void
) {
  const pollRef = doc(db, "polls", pollId);
  const votesRef = collection(db, "polls", pollId, "votes");

  let currentPoll: Poll | null = null;
  let currentVotes: Vote[] = [];
  let hasPollFired = false;
  let hasVotesFired = false;

  const emit = () => {
    // Only emit if we have something or both listeners have at least fired once
    if (!hasPollFired && !hasVotesFired) return;

    const voteCounts: Record<string, any> = {};
    if (currentPoll) {
      currentPoll.timeSlots.forEach(slot => {
        voteCounts[slot.id] = { YES: 0, NO: 0, IF_NEED_BE: 0 };
      });
    }

    currentVotes.forEach(vote => {
      Object.entries(vote.selections).forEach(([slotId, value]) => {
        if (voteCounts[slotId]) {
          voteCounts[slotId][value]++;
        } else if (!currentPoll) {
          // If poll isn't loaded yet, still track counts if possible
          if (!voteCounts[slotId]) voteCounts[slotId] = { YES: 0, NO: 0, IF_NEED_BE: 0 };
          voteCounts[slotId][value]++;
        }
      });
    });

    onUpdate({ poll: currentPoll, votes: currentVotes, voteCounts });
  };

  const unsubPoll = onSnapshot(pollRef, (doc) => {
    hasPollFired = true;
    if (doc.exists()) {
      currentPoll = { id: doc.id, pollId: doc.id, ...doc.data() } as unknown as Poll;
    } else {
      currentPoll = null;
    }
    emit();
  }, (err) => {
    console.error("subscribeToPoll: Poll sub error", err);
    hasPollFired = true;
    emit();
  });

  const unsubVotes = onSnapshot(votesRef, (snapshot) => {
    hasVotesFired = true;
    currentVotes = snapshot.docs.map(doc => ({ voteId: doc.id, ...doc.data() }) as Vote);
    emit();
  }, (err) => {
    console.error("subscribeToPoll: Votes sub error", err);
    hasVotesFired = true;
    emit();
  });

  return () => {
    unsubPoll();
    unsubVotes();
  };
}

/**
 * Listens to polls created by the current user.
 */
export function subscribeToUserPolls(
  uid: string,
  onUpdate: (polls: Poll[]) => void
) {
  const pollsRef = collection(db, "polls");
  const q = query(
    pollsRef,
    where("organizerUid", "==", uid),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const polls = snapshot.docs.map(doc => ({ pollId: doc.id, ...doc.data() } as Poll));
    onUpdate(polls);
  });
}
