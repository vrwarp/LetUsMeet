import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { setupRulesTestEnv, getAuthenticatedContext, getUnauthenticatedContext } from "./test/rules.setup.js";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { setDoc, getDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";

describe("Firestore Security Rules", () => {
  beforeAll(async () => {
    await setupRulesTestEnv();
  });

  afterAll(async () => {
    const testEnv = (await import("./test/rules.setup.js")).getTestEnv();
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    const testEnv = (await import("./test/rules.setup.js")).getTestEnv();
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  describe("Polls Collection", () => {
    it("should allow anyone to read a poll", async () => {
      const db = getUnauthenticatedContext().firestore();
      await assertSucceeds(getDoc(doc(db, "polls/p1")));
    });

    it("should allow authenticated users to create a poll", async () => {
      const db = getAuthenticatedContext("user123").firestore();
      await assertSucceeds(setDoc(doc(db, "polls/p1"), {
        organizerUid: "user123",
        title: "Test"
      }));
    });

    it("should deny unauthenticated users from creating a poll", async () => {
      const db = getUnauthenticatedContext().firestore();
      await assertFails(setDoc(doc(db, "polls/p1"), {
        organizerUid: "user123"
      }));
    });

    it("should allow organizer to update their own poll", async () => {
      const db = getAuthenticatedContext("user123").firestore();
      const pollRef = doc(db, "polls/p1");
      
      // Setup: Create poll as admin or same user (rules-unit-testing allows creating via admin context if needed, 
      // but here we just use the same user to create then update)
      await assertSucceeds(setDoc(pollRef, { organizerUid: "user123", title: "Old" }));
      await assertSucceeds(updateDoc(pollRef, { title: "New" }));
    });

    it("should deny non-organizer from updating a poll", async () => {
      const adminDb = getAuthenticatedContext("user123").firestore();
      await setDoc(doc(adminDb, "polls/p1"), { organizerUid: "user123", title: "Old" });

      const otherDb = getAuthenticatedContext("other").firestore();
      await assertFails(updateDoc(doc(otherDb, "polls/p1"), { title: "New" }));
    });

    it("should allow organizer to delete their own poll (Stream C6)", async () => {
      const db = getAuthenticatedContext("user123").firestore();
      const pollRef = doc(db, "polls/p1");
      await setDoc(pollRef, { organizerUid: "user123" });
      await assertSucceeds(deleteDoc(pollRef));
    });

    it("should deny non-organizer from deleting a poll (Stream C7)", async () => {
      const adminDb = getAuthenticatedContext("user123").firestore();
      await setDoc(doc(adminDb, "polls/p1"), { organizerUid: "user123" });

      const otherDb = getAuthenticatedContext("other").firestore();
      await assertFails(deleteDoc(doc(otherDb, "polls/p1")));
    });
  });

  describe("Votes Subcollection", () => {
    it("should allow anyone to read votes", async () => {
      const db = getUnauthenticatedContext().firestore();
      await assertSucceeds(getDoc(doc(db, "polls/p1/votes/v1")));
    });

    it("should allow authenticated users to vote if poll is OPEN", async () => {
      const organizerDb = getAuthenticatedContext("org").firestore();
      await setDoc(doc(organizerDb, "polls/p1"), { status: "OPEN" });

      const voterDb = getAuthenticatedContext("voter1").firestore();
      await assertSucceeds(setDoc(doc(voterDb, "polls/p1/votes/voter1"), {
        participantUid: "voter1",
        selections: {}
      }));
    });

    it("should deny voting if poll is FINALIZED", async () => {
      const organizerDb = getAuthenticatedContext("org").firestore();
      await setDoc(doc(organizerDb, "polls/p1"), { status: "FINALIZED" });

      const voterDb = getAuthenticatedContext("voter1").firestore();
      await assertFails(setDoc(doc(voterDb, "polls/p1/votes/voter1"), {
        participantUid: "voter1"
      }));
    });

    it("should deny unauthenticated users from creating a vote (Stream C11)", async () => {
      const db = getUnauthenticatedContext().firestore();
      await assertFails(setDoc(doc(db, "polls/p1/votes/v1"), { participantUid: "v1" }));
    });

    it("should allow voter to update their own vote", async () => {
      const organizerDb = getAuthenticatedContext("org").firestore();
      await setDoc(doc(organizerDb, "polls/p1"), { status: "OPEN" });

      const voterDb = getAuthenticatedContext("voter1").firestore();
      const voteRef = doc(voterDb, "polls/p1/votes/voter1");
      await setDoc(voteRef, { participantUid: "voter1", selections: { t1: "YES" } });
      await assertSucceeds(updateDoc(voteRef, { selections: { t1: "NO" } }));
    });

    it("should deny non-author from updating a vote", async () => {
      const organizerDb = getAuthenticatedContext("org").firestore();
      await setDoc(doc(organizerDb, "polls/p1"), { status: "OPEN" });

      const voter1Db = getAuthenticatedContext("voter1").firestore();
      await setDoc(doc(voter1Db, "polls/p1/votes/voter1"), { participantUid: "voter1" });

      const voter2Db = getAuthenticatedContext("voter2").firestore();
      await assertFails(updateDoc(doc(voter2Db, "polls/p1/votes/voter1"), { participantUid: "voter2" }));
    });

    it("should deny everyone from deleting a vote (Stream C14)", async () => {
      const adminDb = getAuthenticatedContext("org").firestore();
      await setDoc(doc(adminDb, "polls/p1"), { status: "OPEN" });

      const voterDb = getAuthenticatedContext("v1").firestore();
      const voteRef = doc(voterDb, "polls/p1/votes/v1");
      await setDoc(voteRef, { participantUid: "v1" });
      await assertFails(deleteDoc(voteRef));
    });
  });

  describe("Users Collection", () => {
    it("should allow user to read their own doc", async () => {
      const db = getAuthenticatedContext("u1").firestore();
      await assertSucceeds(getDoc(doc(db, "users/u1")));
    });

    it("should allow user to write their own doc (Stream C16)", async () => {
      const db = getAuthenticatedContext("u1").firestore();
      await assertSucceeds(setDoc(doc(db, "users/u1"), { name: "U1" }));
    });

    it("should deny user from reading another user's doc", async () => {
      const db = getAuthenticatedContext("u1").firestore();
      await assertFails(getDoc(doc(db, "users/u2")));
    });

    it("should deny user from writing another user's doc (Stream C18)", async () => {
      const db = getAuthenticatedContext("u1").firestore();
      await assertFails(setDoc(doc(db, "users/u2"), { name: "U2" }));
    });
  });
});
