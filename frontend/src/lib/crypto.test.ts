import { describe, it, expect } from 'vitest';
import {
  generateSymmetricKey,
  exportSymmetricKey,
  importSymmetricKey,
  encrypt,
  decrypt,
  generateIdentityKeyPair,
  exportPublicKey,
  exportPrivateKey,
  importPublicKey,
  importPrivateKey,
  signAction,
  verifySignature,
  canonicalStringify
} from './crypto';

describe('Crypto Primitives', () => {
  describe('AES-GCM Symmetric Keys', () => {
    it('should generate, export, and import a symmetric key', async () => {
      const key = await generateSymmetricKey();
      const exported = await exportSymmetricKey(key);
      expect(typeof exported).toBe('string');
      expect(exported.length).toBeGreaterThan(20);

      const imported = await importSymmetricKey(exported);
      expect(imported.type).toBe('secret');
      expect(imported.algorithm.name).toBe('AES-GCM');
    });

    it('should encrypt and decrypt a message', async () => {
      const key = await generateSymmetricKey();
      const message = "Hello, Zero-Knowledge!";
      
      const { ciphertext, iv } = await encrypt(key, message);
      expect(ciphertext).not.toBe(message);
      
      const decrypted = await decrypt(key, ciphertext, iv);
      expect(decrypted).toBe(message);
    });

    it('should fail to decrypt with the wrong key', async () => {
      const key1 = await generateSymmetricKey();
      const key2 = await generateSymmetricKey();
      const message = "Secret data";
      
      const { ciphertext, iv } = await encrypt(key1, message);
      
      await expect(decrypt(key2, ciphertext, iv)).rejects.toThrow();
    });

    it('should produce different ivs for same message', async () => {
      const key = await generateSymmetricKey();
      const message = "Same message";
      
      const res1 = await encrypt(key, message);
      const res2 = await encrypt(key, message);
      
      expect(res1.iv).not.toBe(res2.iv);
      expect(res1.ciphertext).not.toBe(res2.ciphertext);
    });
  });

  describe('ECDSA Identity Keys', () => {
    it('should generate, export, and import identity keys', async () => {
      const { publicKey, privateKey } = await generateIdentityKeyPair();
      
      const pubB64 = await exportPublicKey(publicKey);
      const privB64 = await exportPrivateKey(privateKey);
      
      const importedPub = await importPublicKey(pubB64);
      const importedPriv = await importPrivateKey(privB64);
      
      expect(importedPub.type).toBe('public');
      expect(importedPriv.type).toBe('private');
    });

    it('should sign and verify an action', async () => {
      const { publicKey, privateKey } = await generateIdentityKeyPair();
      const action = { type: 'VOTE', payload: { choices: [1, 2] } };
      
      const signature = await signAction(privateKey, action);
      const pubB64 = await exportPublicKey(publicKey);
      
      const isValid = await verifySignature(pubB64, signature, action);
      expect(isValid).toBe(true);
    });

    it('should fail verification if payload is tampered', async () => {
      const { publicKey, privateKey } = await generateIdentityKeyPair();
      const action = { type: 'VOTE', payload: { choices: [1, 2] } };
      
      const signature = await signAction(privateKey, action);
      const pubB64 = await exportPublicKey(publicKey);
      
      const tamperedAction = { ...action, payload: { choices: [1, 3] } };
      const isValid = await verifySignature(pubB64, signature, tamperedAction);
      expect(isValid).toBe(false);
    });

    it('should fail verification with wrong public key', async () => {
      const pair1 = await generateIdentityKeyPair();
      const pair2 = await generateIdentityKeyPair();
      const action = { type: 'VOTE' };
      
      const signature = await signAction(pair1.privateKey, action);
      const pubB64_2 = await exportPublicKey(pair2.publicKey);
      
      const isValid = await verifySignature(pubB64_2, signature, action);
      expect(isValid).toBe(false);
    });
  });

  describe('Canonical JSON', () => {
    it('should sort keys recursively', () => {
      const obj1 = { b: 2, a: 1, c: { e: 5, d: 4 } };
      const obj2 = { a: 1, c: { d: 4, e: 5 }, b: 2 };
      
      const str1 = canonicalStringify(obj1);
      const str2 = canonicalStringify(obj2);
      
      expect(str1).toBe(str2);
      expect(str1).toBe('{"a":1,"b":2,"c":{"d":4,"e":5}}');
    });

    it('should handle arrays correctly', () => {
      const obj = { z: [3, 2, 1], a: 1 };
      const str = canonicalStringify(obj);
      expect(str).toBe('{"a":1,"z":[3,2,1]}');
    });

    it('should handle null and primitives', () => {
      expect(canonicalStringify(null)).toBe('null');
      expect(canonicalStringify(123)).toBe('123');
      expect(canonicalStringify("test")).toBe('"test"');
    });
  });
});
