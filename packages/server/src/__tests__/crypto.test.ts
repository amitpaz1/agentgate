import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, isEncrypted, deriveKey } from '../lib/crypto.js';

describe('crypto module', () => {
  const key = deriveKey('test-encryption-key');

  describe('deriveKey', () => {
    it('returns a 32-byte buffer', () => {
      expect(key.length).toBe(32);
    });

    it('is deterministic', () => {
      expect(deriveKey('same').equals(deriveKey('same'))).toBe(true);
    });

    it('differs for different inputs', () => {
      expect(deriveKey('a').equals(deriveKey('b'))).toBe(false);
    });
  });

  describe('isEncrypted', () => {
    it('returns true for enc: prefix', () => {
      expect(isEncrypted('enc:abc.def.ghi')).toBe(true);
    });

    it('returns false for plaintext', () => {
      expect(isEncrypted('plaintext-secret')).toBe(false);
    });
  });

  describe('encrypt / decrypt round-trip', () => {
    it('round-trips correctly', () => {
      const plaintext = 'my-webhook-secret-1234567890abcdef';
      const encrypted = encrypt(plaintext, key);
      expect(isEncrypted(encrypted)).toBe(true);
      expect(encrypted).not.toContain(plaintext); // ciphertext ≠ plaintext
      expect(decrypt(encrypted, key)).toBe(plaintext);
    });

    it('produces different ciphertexts for same plaintext (random IV)', () => {
      const plaintext = 'same-secret';
      const a = encrypt(plaintext, key);
      const b = encrypt(plaintext, key);
      expect(a).not.toBe(b);
      expect(decrypt(a, key)).toBe(plaintext);
      expect(decrypt(b, key)).toBe(plaintext);
    });

    it('handles empty string', () => {
      const encrypted = encrypt('', key);
      expect(decrypt(encrypted, key)).toBe('');
    });

    it('handles unicode', () => {
      const plaintext = '秘密🔐';
      expect(decrypt(encrypt(plaintext, key), key)).toBe(plaintext);
    });
  });

  describe('decrypt plaintext fallback', () => {
    it('returns plaintext as-is if no enc: prefix', () => {
      expect(decrypt('plain-secret', key)).toBe('plain-secret');
    });
  });

  describe('decrypt with wrong key', () => {
    it('throws on wrong key', () => {
      const encrypted = encrypt('secret', key);
      const wrongKey = deriveKey('wrong-key');
      expect(() => decrypt(encrypted, wrongKey)).toThrow();
    });
  });

  describe('decrypt invalid format', () => {
    it('throws on malformed encrypted string', () => {
      expect(() => decrypt('enc:invalid', key)).toThrow('Invalid encrypted format');
    });
  });
});
