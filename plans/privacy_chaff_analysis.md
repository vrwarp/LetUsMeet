# Cryptographic & Privacy Analysis: Keystore Writes vs. The Chaffing System

This report investigates whether the current **Join-on-Load** model compromises the **Chaffing Privacy System**, evaluates the side-channel implications of transitioning to a **Lazy Joining (Join-on-Vote)** model, and proposes countermeasures to guarantee complete zero-knowledge anonymity.

---

## 1. Executive Summary

Our investigation confirms that:
1. **Join-on-Load does NOT write to the public poll database.** Simply loading/viewing a poll is a pure read operation on the poll's ledger. Therefore, it does *not* leak viewing activity to the public or trigger any unchaffed writes on the poll itself.
2. **Join-on-Load DOES write to the user's private Firestore keystore.** The credentials are immediately saved to `users/{uid}/keystore/{blindedLedgerId}`. While this write is encrypted and blinded, it is **not chaffed**, meaning a database observer knows User X viewed *some* poll at Time T.
3. **Lazy Joining (Join-on-Vote) introduces a dangerous timing side-channel (The "Double-Write" Correlation).** If we sync the keystore at the exact moment of voting, the unchaffed keystore write and the chaffed vote write occur simultaneously. A traffic observer can instantly correlate these two writes to deanonymize the voter.

---

## 2. Deep-Dive: Write Triggers in the Current System

Let's trace exactly what is written to the database during a **Join-on-Load** sequence:

| Step | Action | Destination | Encryption / Privacy |
| :--- | :--- | :--- | :--- |
| **1** | Decrypting & Reading Poll | `polls/{pollId}/events` (READ ONLY) | None. Pure read. |
| **2** | Saving Identity Locally | IndexedDB `identities` store (LOCAL ONLY) | Kept inside the browser sandbox. |
| **3** | Syncing Keystore (If logged in) | `users/{uid}/keystore/{blindedId}` (WRITE) | **Blinded document ID** (SHA-256 of poll key) & **Encrypted credentials payload**. |

### Key Vulnerability Assessment:
* **Poll-Level Privacy**: Safe. No observer can tell that a new participant has viewed `polls/{pollId}` because no writes occurred in the public `/polls` collection.
* **User-Level Privacy**: Partially Leaked. The write to `users/{uid}/keystore/{blindedId}` is a single, unchaffed transaction. An observer knows that **User X** added *some* ledger to their dashboard, but because the document ID is cryptographically blinded and the payload is encrypted, they cannot determine *which* poll was joined.

---

## 3. The Threat Model of the Chaffing System

The chaffing system protects user voting activity against **traffic side-channel analysis**. 

When a user votes in **Poll A**:
1. The client writes the encrypted vote to `polls/PollA/events`.
2. Simultaneously, the client fetches the active `chaff_pool` and writes fake decoy events containing random bytes of identical size to 3 other polls (e.g., **Poll B**, **Poll C**, **Poll D**).
3. These 4 writes are committed in a single **atomic transaction batch**.

```
[User Vote Transaction]
 ├── Write 1: polls/PollA/events/vote1  (Real Vote)
 ├── Write 2: polls/PollB/events/decoy1 (Chaff Decoy)
 ├── Write 3: polls/PollC/events/decoy2 (Chaff Decoy)
 └── Write 4: polls/PollD/events/decoy3 (Chaff Decoy)
```

To an observer (including a malicious Firebase administrator or network eavesdropper), a transaction occurred touching 4 polls. They cannot distinguish the real vote from the chaff decoys.

---

## 4. The Lazy Joining Side-Channel: "Double-Write" Correlation

If we transition to **Lazy Joining (Join-on-Vote)**, the client must write both the vote *and* the keystore credentials when the user clicks "Submit Vote".

This creates a severe **timing correlation vulnerability**:

```
At Time T:
 ├── [Transaction 1 (Chaffed)]: Decoy batch write to 4 polls (A, B, C, D)
 └── [Transaction 2 (Unchaffed)]: Write to users/UserX/keystore/blindedId
```

### The Deanonymization Vector:
1. The observer monitors Firestore writes in real-time.
2. At `Time T`, they see a chaffed transaction touch **Polls A, B, C, and D**.
3. At the exact same millisecond `Time T`, they see **User X** write to their private `/keystore` subcollection.
4. **Conclusion**: The observer immediately deduces that **User X was the voter** in one of those 4 polls. The chaffing system's core guarantee—that you cannot link a specific user's identity to a specific vote transaction—is completely shattered.

---

## 5. Architectural Recommendations

To preserve the zero-knowledge guarantees of the platform, we must choose one of the following architectural strategies:

### Option A: Retain Join-on-Load with Blinded Identifiers (Current System)
By writing the keystore credentials on **load**, we completely decouple the identity sync from the voting transaction. 
* **Pros**: When the user eventually votes, only the chaffed batch transaction occurs. There is no simultaneous keystore write, keeping the voter's identity 100% disconnected from the vote.
* **Cons**: Dashboard clutter (shows viewed but unvoted polls).

### Option B: Lazy Joining with Randomly Delayed Keystore Sync
If we implement Lazy Joining, we must **break the timing correlation** between the vote write and the keystore write.
* **Implementation**: When the user votes, the vote is submitted immediately via the chaffed batch. The keystore write is **queued** and executed with a random jitter/delay (e.g., randomly between `30 seconds` and `5 minutes` later, or silently during the next page transition or background task).
* **Pros**: Clean dashboard + perfect anonymity. The observer cannot correlate the keystore write with the vote transaction.

### Option C: On-Demand Keystore Sync (Dashboard-Driven)
We do not sync the keystore during viewing *or* voting. Instead:
* The user's votes are saved only in local IndexedDB.
* When the user opens their **Dashboard**, the client scans the local IndexedDB, finds voted polls that are not in the cloud keystore, and syncs them.
* **Pros**: Completely eliminates write-correlation during the voting flow. Highly elegant and keeps the voting process clean.
* **Cons**: If the user switches devices immediately after voting without opening their dashboard on the first device, the poll won't be synced to the cloud yet.

---

## 6. Conclusion & Recommendation

The current **Join-on-Load** system does *not* defeat the chaff system; in fact, **it cryptographically insulates it** by ensuring that keystore writes and voting writes never occur at the same time. 

However, if we want to support a **Lazy Joining** model to keep the dashboard clean, we **cannot** simply write to the keystore inside the vote submission handler. We must adopt **Option C (Dashboard-Driven Keystore Sync)** or **Option B (Randomly Delayed Sync)** to protect our users against timing-correlation side-channels.
