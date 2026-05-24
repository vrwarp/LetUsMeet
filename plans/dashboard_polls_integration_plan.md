# Possibility and Implementation Plan: Listing Created vs. Voted Polls on the Dashboard

Yes, **it is absolutely possible** to list both the polls the user created and the polls they voted/participated in! In fact, the application's underlying cryptographic architecture is perfectly positioned for this feature.

---

## 1. How the Cryptographic Architecture Supports This

Under the Zero-Knowledge & Blind Keystore design:
1. **When a user creates a poll**, a new cryptographic ledger is generated. The creator's ledger credentials (symmetric encryption key and ECDSA signing key pair) are saved to their blind Firestore Keystore.
2. **When a user votes in or views a poll**, the client runs `getLedgerSession(pollId, { shareableKey })`. Since they are authenticated, the SDK generates a new participant key pair and uploads those credentials to their keystore using `saveToKeystore`.

As a result, **both the polls the user created and the polls they participated in are stored in their keystore** and loaded via the `subscribeToUserKeystore` facade on the dashboard.

---

## 2. How to Differentiate "Created" vs. "Voted In"

We can cryptographically determine whether the user is the **Organizer (Creator)** or a **Participant (Voter)** of any decrypted poll on the dashboard:
* **Organizer Check**: The user's public signing key for that poll matches the `signerPublicKey` in the poll's very first (genesis) event.
* **Participant Check**: The user's public signing key is different from the genesis event's signer.

In TypeScript, this looks like:
```typescript
const isOrganizer = session.getSignerPublicKey() === genesis.signerPublicKey;
```

---

## 3. Recommended Implementation Plan

Below is the step-by-step implementation plan to update the dashboard with two beautifully structured lists: **"Polls You Organize"** and **"Joined Polls"**.

### Step 1: Update State Interfaces
We extend `DecryptedDashboardEntry` in `DashboardPage.tsx` to include an `isOrganizer` flag:

```typescript
interface DecryptedDashboardEntry {
  pollId: string;
  symmetricKey: string;
  metadata: PollMetadata;
  isOrganizer: boolean; // <-- Added flag
}
```

### Step 2: Set the Flag during Keystore Decryption
In the `useEffect` hook of `DashboardPage.tsx`, update the mapping logic:

```typescript
const unsubscribe = subscribeToUserKeystore(async (keystoreEntries) => {
  const decryptedResults = await Promise.all(
    keystoreEntries.map(async (entry) => {
      try {
        if (!entry.ledgerId) return null;
        const session = await getLedgerSession(entry.ledgerId);
        const genesis = await session.getGenesisEvent();
        if (genesis?.action?.type === "POLL_CREATED") {
          // Compare current signing key with genesis signer key
          const isOrganizer = session.getSignerPublicKey() === genesis.signerPublicKey;
          return {
            pollId: entry.ledgerId,
            symmetricKey: session.exportSessionKey(),
            metadata: genesis.action.payload,
            isOrganizer
          } as DecryptedDashboardEntry;
        }
      } catch (e) {
        console.warn("Failed to decrypt dashboard entry", entry.ledgerId, e);
      }
      return null;
    })
  );

  const decryptedEntries = decryptedResults.filter(
    (entry): entry is DecryptedDashboardEntry => entry !== null
  );

  setEntries(decryptedEntries);
  setFetching(false);
});
```

### Step 3: Implement the Tabbed Dashboard UI
We can introduce an elegant tabbed layout to filter and group the polls. The dashboard can display:
* A tab for **Organized by Me**
* A tab for **Joined / Voted**

Here is a preview of the proposed UI updates in `DashboardPage.tsx`:

```tsx
const [activeTab, setActiveTab] = useState<"organizer" | "participant">("organizer");

const organizedPolls = entries.filter(e => e.isOrganizer);
const joinedPolls = entries.filter(e => !e.isOrganizer);
const activeEntries = activeTab === "organizer" ? organizedPolls : joinedPolls;
```

#### Styled Premium Tab Controls (Data Garden Aesthetic):
```tsx
<div className="flex border-b border-neutral-100 mb-8 gap-6">
  <button
    onClick={() => setActiveTab("organizer")}
    className={`pb-4 font-black text-lg transition-all border-b-2 relative ${
      activeTab === "organizer"
        ? "text-brand-green border-brand-green"
        : "text-neutral-400 border-transparent hover:text-neutral-600"
    }`}
  >
    Organized by Me
    <span className="ml-2 text-xs bg-brand-green/10 text-brand-green px-2 py-0.5 rounded-full">
      {organizedPolls.length}
    </span>
  </button>
  <button
    onClick={() => setActiveTab("participant")}
    className={`pb-4 font-black text-lg transition-all border-b-2 relative ${
      activeTab === "participant"
        ? "text-brand-green border-brand-green"
        : "text-neutral-400 border-transparent hover:text-neutral-600"
    }`}
  >
    Joined & Voted
    <span className="ml-2 text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
      {joinedPolls.length}
    </span>
  </button>
</div>
```

#### Role Badges in Poll Cards:
Within the active entries loop, we can render a gorgeous badge specifying the user's role:
```tsx
{entry.isOrganizer ? (
  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-green/10 text-brand-green-dark">
    Organizer
  </span>
) : (
  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">
    Participant
  </span>
)}
```

---

## 4. Next Steps
Would you like me to go ahead and implement these UI updates and group the polls on the dashboard for you? 
All underlying logic is fully operational, so this change will not affect the cryptographic security, and I can update both the page and the corresponding test cases cleanly!
