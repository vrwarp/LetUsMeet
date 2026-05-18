import type { EncryptedData } from "../types";

/**
 * Generates a random AES-GCM symmetric key.
 */
export async function generateSymmetricKey(length: 128 | 256 = 256): Promise<CryptoKey> {
  return window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length,
    },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Imports a base64 encoded symmetric key.
 */
export async function importSymmetricKey(b64: string): Promise<CryptoKey> {
  const buf = Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  return window.crypto.subtle.importKey(
    "raw",
    buf,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Exports a symmetric key to base64.
 */
export async function exportSymmetricKey(key: CryptoKey): Promise<string> {
  const buf = await window.crypto.subtle.exportKey("raw", key);
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Encrypts data using AES-GCM.
 */
export async function encrypt(key: CryptoKey, plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encoded = encoder.encode(plaintext);
  
  const ciphertextBuf = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encoded
  );
  
  const ciphertext = btoa(String.fromCharCode(...new Uint8Array(ciphertextBuf)));
  const ivB64 = btoa(String.fromCharCode(...iv));
  
  return { ciphertext, iv: ivB64 };
}

/**
 * Decrypts data using AES-GCM.
 */
export async function decrypt(key: CryptoKey, ciphertext: string, iv: string): Promise<string> {
  const ciphertextBuf = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const ivBuf = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
  
  const plaintextBuf = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBuf,
    },
    key,
    ciphertextBuf
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(plaintextBuf);
}

// === ASYMMETRIC (ECDSA) ===

/**
 * Generates an ECDSA key pair for identity signing.
 */
export async function generateIdentityKeyPair(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
  return window.crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign", "verify"]
  );
}

/**
 * Exports an ECDSA private key to base64.
 */
export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const buf = await window.crypto.subtle.exportKey("pkcs8", key);
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

/**
 * Exports an ECDSA public key to base64.
 */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const buf = await window.crypto.subtle.exportKey("spki", key);
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

/**
 * Imports an ECDSA private key from base64.
 */
export async function importPrivateKey(b64: string): Promise<CryptoKey> {
  const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return window.crypto.subtle.importKey(
    "pkcs8",
    buf,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );
}

/**
 * Imports an ECDSA public key from base64.
 */
export async function importPublicKey(b64: string): Promise<CryptoKey> {
  const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return window.crypto.subtle.importKey(
    "spki",
    buf,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"]
  );
}

/**
 * Signs an action using an ECDSA private key.
 */
export async function signAction(privateKey: CryptoKey, action: any): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalStringify(action));
  const signature = await window.crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: { name: "SHA-256" },
    },
    privateKey,
    data
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Verifies an action's signature using an ECDSA public key or Base64 string.
 */
export async function verifySignature(publicKey: CryptoKey | string, signature: string, action: any): Promise<boolean> {
  const pubKey = typeof publicKey === 'string' ? await importPublicKey(publicKey) : publicKey;
  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalStringify(action));
  const signatureBuf = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
  return window.crypto.subtle.verify(
    {
      name: "ECDSA",
      hash: { name: "SHA-256" },
    },
    pubKey,
    signatureBuf,
    data
  );
}

/**
 * Deterministically generates an ECDSA key pair from a seed string.
 * This is used for "admin tokens" that can be shared via URL.
 */
export async function generateIdentityKeyPairFromSeed(_seed: string): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
  // TODO: Implement deterministic key generation. 
  // For now, we generate a random one to satisfy the interface.
  return generateIdentityKeyPair();
}

/**
 * Canonical JSON stringification to ensure stable signatures.
 */
export function canonicalStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(item => canonicalStringify(item)).join(',') + ']';
  }
  const keys = Object.keys(obj)
    .filter(key => obj[key] !== undefined)
    .sort();
  return '{' + keys.map(key => `"${key}":${canonicalStringify(obj[key])}`).join(',') + '}';
}

// === RSA-OAEP (Device Keys) ===

export async function generateDeviceKeyPair(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
  return window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    } as any,
    true,
    ["wrapKey", "unwrapKey"]
  );
}

export async function exportDevicePublicKey(key: CryptoKey): Promise<string> {
  const buf = await window.crypto.subtle.exportKey("spki", key);
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export async function exportDevicePrivateKey(key: CryptoKey): Promise<string> {
  const buf = await window.crypto.subtle.exportKey("pkcs8", key);
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export async function importDevicePublicKey(b64: string): Promise<CryptoKey> {
  const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return window.crypto.subtle.importKey(
    "spki",
    buf,
    { name: "RSA-OAEP", hash: "SHA-256" } as any,
    true,
    ["wrapKey"]
  );
}

export async function importDevicePrivateKey(b64: string): Promise<CryptoKey> {
  const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return window.crypto.subtle.importKey(
    "pkcs8",
    buf,
    { name: "RSA-OAEP", hash: "SHA-256" } as any,
    true,
    ["unwrapKey"]
  );
}

export async function wrapAmk(publicKey: CryptoKey, amkRaw: ArrayBuffer): Promise<string> {
  // To wrap a key, it must be a CryptoKey object
  const amk = await window.crypto.subtle.importKey(
    "raw",
    amkRaw,
    { name: "AES-GCM" } as any,
    true,
    ["encrypt", "decrypt"]
  );
  
  const wrapped = await window.crypto.subtle.wrapKey(
    "raw",
    amk,
    publicKey,
    "RSA-OAEP"
  );
  return btoa(String.fromCharCode(...new Uint8Array(wrapped)));
}

export async function unwrapAmk(privateKey: CryptoKey, wrappedB64: string): Promise<ArrayBuffer> {
  const wrappedBuf = Uint8Array.from(atob(wrappedB64), (c) => c.charCodeAt(0));
  const unwrapped = await window.crypto.subtle.unwrapKey(
    "raw",
    wrappedBuf,
    privateKey,
    { name: "RSA-OAEP", hash: "SHA-256" } as any,
    { name: "AES-GCM" } as any,
    true,
    ["encrypt", "decrypt"]
  );
  return window.crypto.subtle.exportKey("raw", unwrapped);
}

/**
 * Standard utility to symmetrically encrypt a plaintext string into an EncryptedData envelope.
 */
export async function encryptPayload(key: CryptoKey, plaintext: string): Promise<EncryptedData> {
  const { ciphertext, iv } = await encrypt(key, plaintext);
  return { encryptedData: ciphertext, iv };
}

/**
 * Standard utility to symmetrically decrypt an EncryptedData envelope into a plaintext string.
 */
export async function decryptPayload(key: CryptoKey, payload: EncryptedData): Promise<string> {
  return await decrypt(key, payload.encryptedData, payload.iv);
}

/**
 * Asymmetrically encrypts a string using a hybrid scheme (RSA-OAEP + AES-GCM).
 */
export async function encryptHybrid(
  recipientPublicKeyB64: string,
  plaintext: string
): Promise<EncryptedData & { wrappedKey: string }> {
  const aesKey = await generateSymmetricKey(256);
  const encrypted = await encryptPayload(aesKey, plaintext);
  
  const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
  const recipientPubKey = await importDevicePublicKey(recipientPublicKeyB64);
  const wrappedKey = await wrapAmk(recipientPubKey, rawAesKey);
  
  return { ...encrypted, wrappedKey };
}

/**
 * Asymmetrically decrypts a hybrid envelope using a local device private key.
 */
export async function decryptHybrid(
  privateKey: CryptoKey,
  payload: EncryptedData,
  wrappedKeyB64: string
): Promise<string> {
  const rawAesKey = await unwrapAmk(privateKey, wrappedKeyB64);
  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    rawAesKey,
    { name: "AES-GCM" },
    true,
    ["decrypt"]
  );
  return await decryptPayload(aesKey, payload);
}

// === PBKDF2 (for Token derivation) ===

export async function deriveKeyFromPassword(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuf = encoder.encode(password);
  
  // Base key from password
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    passwordBuf,
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  
  // Use a fixed salt for token-based derivation (since tokens are ephemeral and random enough)
  const salt = encoder.encode("letusmeet-admin-token-salt");
  
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Generates a short verification code from a public key.
 */
export async function generateVerificationCode(publicKeyB64: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(publicKeyB64);
  const hash = await window.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hash));
  
  // Take last 6 digits of the first few bytes
  const num = (hashArray[0] << 16) | (hashArray[1] << 8) | hashArray[2];
  return (num % 1000000).toString().padStart(6, '0');
}
