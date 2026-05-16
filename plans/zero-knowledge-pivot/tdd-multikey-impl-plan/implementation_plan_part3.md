# Implementation Plan: Multi-Device Keystore & Envelope Encryption (Part 3/4)

## Phase 3: Firestore Rules

To support the new multi-device paradigm, we need a new collection called `account_keys`. This collection will store the public keys of authorized devices and the wrapped AMKs.

### Task 3.1: Update `firestore.rules`
Secure the `account_keys` collection so only the authenticated user can read and write their own data, and enforce the data schema on writes.

1. Open `firestore.rules`.
2. Locate the section for user profiles/keystore (`match /users/{userId}`).
3. Add the following rule specifically for the new `account_keys` collection:

   ```javascript
   // Add to firestore.rules within match /users/{userId}
   match /account_keys/default {
     allow read: if request.auth != null && request.auth.uid == userId;
     
     // Ensure schema integrity on write
     allow write: if request.auth != null && request.auth.uid == userId
       && request.resource.data.keys().hasAll(['activeAmkId', 'devices', 'keyring']);
   }
   ```

4. Since `amkId` is being added to the `KeystoreEntry` interface, ensure you update the `keystore` write rules if they strictly validate keys. If it checks `hasAll(['pollId', 'wrappedPayload', 'iv', 'updatedAt'])`, you need to add `amkId` to that list.

   ```javascript
   // Example update for keystore entry rule:
   request.resource.data.keys().hasAll(['pollId', 'wrappedPayload', 'iv', 'updatedAt', 'amkId'])
   ```

**Definition of Done (Part 3):**
- `firestore.rules` is updated.
- You can successfully deploy these rules or pass local emulator tests (if available).
