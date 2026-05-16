import * as bip39 from 'bip39';
import { 
  exportDevicePublicKey, 
  encrypt,
  decrypt,
  wrapAmk,
  unwrapAmk
} from './crypto';
import { db, auth } from '../firebase';
import { doc, runTransaction } from 'firebase/firestore';
import { getActiveAmk } from './deviceService';
import type { AccountKeysDocument } from '@/types';

/**
 * # Cryptographic Specification: Asymmetric Recovery Phrase (Symmetric-Wrapped RSA)
 * 
 * To implement asymmetric recovery while ensuring compatibility with the browser's native `Web Crypto API`, we will use a hybrid model where the recovery phrase protects a persistent RSA-OAEP key pair.
 * 
 * ## 1. Key Generation (Setup)
 * 1.  **Mnemonic:** Generate a 24-word BIP39 mnemonic.
 * 2.  **RSA Pair:** Generate a random **RSA-OAEP 2048-bit Key Pair** (The AIRK).
 * 3.  **Symmetric Protector:** Derive a symmetric **AES-GCM 256-bit Key** from the mnemonic using PBKDF2 (100,000 iterations, SHA-256).
 * 4.  **Seal Private Key:** Encrypt the RSA Private Key (exported as PKCS8) with the Symmetric Protector.
 * 5.  **Registration:** Store in `recoveryMethods`:
 *     *   `publicKey`: The RSA Public Key (Base64 SPKI).
 *     *   `encryptedPrivateKey`: The encrypted RSA Private Key + IV (Base64).
 * 
 * ## 2. AMK Wrapping (Rotation)
 * Active devices perform rotations using only the public data:
 * 1.  Fetch `publicKey` from the `recoveryMethods` entry.
 * 2.  Wrap the **new AMK** using RSA-OAEP and the `publicKey`.
 * 3.  Store in `keyring` under the recovery method's ID.
 * 
 * ## 3. Recovery Flow
 * 1.  User enters phrase.
 * 2.  Derive the **Symmetric Protector** (PBKDF2).
 * 3.  Fetch `encryptedPrivateKey` from Firestore.
 * 4.  Decrypt the **RSA Private Key**.
 * 5.  Unwrap the latest **AMK** from the `keyring`.
 * 
 * ## Advantages:
 * *   **Web Crypto Native:** No need for external ECC/RSA math libraries.
 * *   **Asymmetric Rotation:** Active devices never see the private recovery secret or the encrypted private key.
 * *   **Deterministic Recovery:** The user's access to the RSA key is deterministic based on the phrase.
 */
export async function setupPhraseRecovery(): Promise<string> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) throw new Error("Must be signed in.");

  // 1. Generate mnemonic
  const mnemonic = bip39.generateMnemonic(256);
  
  // 2. Generate random RSA-OAEP key pair for recovery
  const rsaPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  // 3. Derive symmetric key from phrase
  const protector = await deriveProtectorFromPhrase(mnemonic);
  
  // 4. Encrypt Private Key with protector
  const privKeyRaw = await window.crypto.subtle.exportKey("pkcs8", rsaPair.privateKey);
  const privKeyB64 = btoa(String.fromCharCode(...new Uint8Array(privKeyRaw)));
  const { ciphertext: encryptedPrivKey, iv } = await encrypt(protector, privKeyB64);
  
  // 5. Wrap AMK with the new RSA Public Key
  const { amk, amkId } = await getActiveAmk();
  const rawAmk = await window.crypto.subtle.exportKey("raw", amk);
  const wrappedAmk = await wrapAmk(rsaPair.publicKey, rawAmk);
  
  const pubKeyB64 = await exportDevicePublicKey(rsaPair.publicKey);

  // 6. Save to Firestore
  const accountKeysRef = doc(db, "users", user.uid, "account_keys", "default");
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(accountKeysRef);
    if (!snap.exists()) throw new Error("Account keys doc missing.");
    
    const data = snap.data() as AccountKeysDocument;
    data.recoveryMethods["__recovery_phrase"] = {
      type: 'phrase',
      label: "Primary Recovery Phrase",
      publicKey: pubKeyB64,
      createdAt: Date.now()
    };
    // Add custom field to recoveryMethods for the encrypted private key
    (data.recoveryMethods["__recovery_phrase"] as any).encryptedPrivateKey = JSON.stringify({ 
      ciphertext: encryptedPrivKey, 
      iv 
    });
    
    data.keyring[amkId]["__recovery_phrase"] = wrappedAmk;
    transaction.set(accountKeysRef, data);
  });

  return mnemonic;
}

/**
 * Recovers the AMK using a recovery phrase.
 */
export async function recoverAmkWithPhrase(mnemonic: string): Promise<{ amk: CryptoKey, amkId: string }> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) throw new Error("Must be signed in.");

  const accountKeysRef = doc(db, "users", user.uid, "account_keys", "default");
  const snap = await (await import('firebase/firestore')).getDoc(accountKeysRef);
  if (!snap.exists()) throw new Error("Account keys not found.");
  
  const data = snap.data() as AccountKeysDocument;
  const method = data.recoveryMethods["__recovery_phrase"];
  if (!method || !method.publicKey) throw new Error("Recovery phrase method not set up.");
  
  const encryptedPrivData = (method as any).encryptedPrivateKey;
  if (!encryptedPrivData) throw new Error("Recovery private key missing from Firestore.");
  
  const { ciphertext, iv } = JSON.parse(encryptedPrivData);

  // 1. Derive protector
  const protector = await deriveProtectorFromPhrase(mnemonic);
  
  // 2. Decrypt RSA Private Key
  const privKeyB64 = await decrypt(protector, ciphertext, iv);
  const privKeyRaw = Uint8Array.from(atob(privKeyB64), c => c.charCodeAt(0));
  
  const privateKey = await window.crypto.subtle.importKey(
    "pkcs8",
    privKeyRaw,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );

  // 3. Unwrap AMK
  const amkId = data.activeAmkId;
  const wrappedAmk = data.keyring[amkId]["__recovery_phrase"];
  if (!wrappedAmk) throw new Error("Recovery wrapper missing from keyring.");
  
  const amkBuffer = await unwrapAmk(privateKey, wrappedAmk);
  const amk = await window.crypto.subtle.importKey(
    "raw",
    amkBuffer,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );

  return { amk, amkId };
}

async function deriveProtectorFromPhrase(mnemonic: string): Promise<CryptoKey> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    seed.slice(0, 32),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("LetUsMeet-Recovery-Salt-v1"),
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}
