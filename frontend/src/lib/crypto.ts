/**
 * Zero-Knowledge Cryptographic Primitives
 * Uses browser-native window.crypto.subtle only.
 */

// === SYMMETRIC KEY (AES-GCM) ===

export async function generateSymmetricKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 128 },
    true, // extractable
    ["encrypt", "decrypt"]
  );
}

export async function exportSymmetricKey(key: CryptoKey): Promise<string> {
  const raw = await window.crypto.subtle.exportKey("raw", key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function importSymmetricKey(b64url: string): Promise<CryptoKey> {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  
  return await window.crypto.subtle.importKey(
    "raw",
    buf,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(key: CryptoKey, plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv))
  };
}

export async function decrypt(key: CryptoKey, ciphertext: string, iv: string): Promise<string> {
  const binCipher = atob(ciphertext);
  const bufCipher = new Uint8Array(binCipher.length);
  for (let i = 0; i < binCipher.length; i++) bufCipher[i] = binCipher.charCodeAt(i);
  
  const binIv = atob(iv);
  const bufIv = new Uint8Array(binIv.length);
  for (let i = 0; i < binIv.length; i++) bufIv[i] = binIv.charCodeAt(i);
  
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bufIv },
    key,
    bufCipher
  );
  
  return new TextDecoder().decode(decrypted);
}

// === IDENTITY KEYS (ECDSA) ===

export async function generateIdentityKeyPair(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
  const pair = await window.crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256"
    },
    true,
    ["sign", "verify"]
  );
  return pair as { publicKey: CryptoKey; privateKey: CryptoKey };
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("pkcs8", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function importPublicKey(b64: string): Promise<CryptoKey> {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  
  return await window.crypto.subtle.importKey(
    "spki",
    buf,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"]
  );
}

export async function importPrivateKey(b64: string): Promise<CryptoKey> {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  
  return await window.crypto.subtle.importKey(
    "pkcs8",
    buf,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );
}

// === SIGNING ===

export async function signAction(privateKey: CryptoKey, action: any): Promise<string> {
  const json = canonicalStringify(action);
  const encoded = new TextEncoder().encode(json);
  
  const signature = await window.crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: { name: "SHA-256" }
    },
    privateKey,
    encoded
  );
  
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export async function verifySignature(publicKeyB64: string, signatureB64: string, action: any): Promise<boolean> {
  try {
    const publicKey = await importPublicKey(publicKeyB64);
    
    const binSig = atob(signatureB64);
    const bufSig = new Uint8Array(binSig.length);
    for (let i = 0; i < binSig.length; i++) bufSig[i] = binSig.charCodeAt(i);
    
    const json = canonicalStringify(action);
    const encoded = new TextEncoder().encode(json);
    
    return await window.crypto.subtle.verify(
      {
        name: "ECDSA",
        hash: { name: "SHA-256" }
      },
      publicKey,
      bufSig,
      encoded
    );
  } catch (e) {
    console.error("Signature verification error:", e);
    return false;
  }
}

// === UTILS ===

/**
 * Deterministic JSON stringify with recursive key sorting.
 */
export function canonicalStringify(obj: any): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  
  if (Array.isArray(obj)) {
    return "[" + obj.map(item => canonicalStringify(item)).join(",") + "]";
  }
  
  const keys = Object.keys(obj).sort();
  return "{" + keys.map(key => {
    return JSON.stringify(key) + ":" + canonicalStringify(obj[key]);
  }).join(",") + "}";
}
