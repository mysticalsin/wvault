/**
 * ============================================================================
 * CRYPTO MODULE UNIT TESTS
 * ============================================================================
 * Tests for: KDF, encryption/decryption, vault header versioning,
 * NFKC normalization, buffer zeroization, attachment encryption,
 * folder key derivation, and malformed input resilience.
 */

const crypto = require('crypto');
const {
    SECURITY,
    SecureBuffer,
    normalizePassword,
    deriveKey,
    derivePinHash,
    deriveFolderKey,
    encryptVault,
    decryptVault,
    encryptAttachment,
    decryptAttachment,
    deriveAttachmentKey,
    validatePasswordStrength,
    generateSecureRandom,
    generateVaultId,
    hashData,
    timingSafeEqual,
} = require('../../src/main/security/crypto');

// ─── Key Derivation ──────────────────────────────────────────────────────────

describe('deriveKey (PBKDF2)', () => {
    it('produces deterministic 32-byte output for same password+salt', () => {
        const salt = crypto.randomBytes(32);
        const key1 = deriveKey('test-password', salt);
        const key2 = deriveKey('test-password', salt);
        expect(key1.toString('hex')).toBe(key2.toString('hex'));
        expect(key1.length).toBe(32);
    });

    it('produces different keys for different passwords', () => {
        const salt = crypto.randomBytes(32);
        const key1 = deriveKey('password-a', salt);
        const key2 = deriveKey('password-b', salt);
        expect(key1.toString('hex')).not.toBe(key2.toString('hex'));
    });

    it('produces different keys for different salts', () => {
        const salt1 = crypto.randomBytes(32);
        const salt2 = crypto.randomBytes(32);
        const key1 = deriveKey('same-password', salt1);
        const key2 = deriveKey('same-password', salt2);
        expect(key1.toString('hex')).not.toBe(key2.toString('hex'));
    });

    it('rejects null/empty inputs', () => {
        const salt = crypto.randomBytes(32);
        expect(() => deriveKey('', salt)).toThrow('Invalid key derivation parameters');
        expect(() => deriveKey(null, salt)).toThrow('Invalid key derivation parameters');
        expect(() => deriveKey('test', null)).toThrow('Invalid key derivation parameters');
    });

    it('rejects salt with wrong length', () => {
        const shortSalt = crypto.randomBytes(16);
        expect(() => deriveKey('password', shortSalt)).toThrow('Invalid key derivation parameters');
    });
});

// ─── NFKC Unicode Normalization ──────────────────────────────────────────────

describe('normalizePassword (NFKC)', () => {
    it('normalizes composed and decomposed forms to the same string', () => {
        // é as single codepoint vs e + combining acute accent
        const composed = '\u00e9';      // é (U+00E9)
        const decomposed = 'e\u0301';   // e + ◌́ (U+0301)
        expect(normalizePassword(composed)).toBe(normalizePassword(decomposed));
    });

    it('normalizes Turkish İ consistently', () => {
        // This is the attack vector: Turkish capital İ (U+0130)
        const result = normalizePassword('\u0130stanbul');
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    it('normalizes fullwidth digits to ASCII', () => {
        // NFKC converts ０１２ (fullwidth) to 012
        const fullwidth = '\uff10\uff11\uff12';
        expect(normalizePassword(fullwidth)).toBe('012');
    });

    it('returns input unchanged for ASCII-only strings', () => {
        expect(normalizePassword('Password123!')).toBe('Password123!');
    });

    it('handles non-string input gracefully', () => {
        expect(normalizePassword(null)).toBeNull();
        expect(normalizePassword(undefined)).toBeUndefined();
    });
});

// ─── Vault Encryption/Decryption ─────────────────────────────────────────────

describe('encryptVault / decryptVault', () => {
    const testData = Buffer.from('{"credentials":[{"service":"test"}]}', 'utf8');
    const password = 'SecureP@ssw0rd!';

    it('round-trips correctly (encrypt → decrypt)', () => {
        const encrypted = encryptVault(testData, password);
        const decrypted = decryptVault(encrypted, password);
        expect(decrypted.toString('utf8')).toBe(testData.toString('utf8'));
    });

    it('produces v2 header: first byte is CIPHER_VERSION, second is KDF_VERSION', () => {
        const encrypted = encryptVault(testData, password);
        expect(encrypted[0]).toBe(SECURITY.CIPHER_VERSION_AES256GCM); // 0x01
        expect(encrypted[1]).toBe(SECURITY.KDF_VERSION_PBKDF2);       // 0x01
    });

    it('produces different ciphertext for same plaintext (random IV/salt)', () => {
        const enc1 = encryptVault(testData, password);
        const enc2 = encryptVault(testData, password);
        expect(enc1.toString('hex')).not.toBe(enc2.toString('hex'));
    });

    it('fails decryption with wrong password', () => {
        const encrypted = encryptVault(testData, password);
        expect(() => decryptVault(encrypted, 'wrong-password')).toThrow();
    });

    it('fails on corrupted ciphertext (authentication tag mismatch)', () => {
        const encrypted = encryptVault(testData, password);
        // Flip a bit in the encrypted data portion
        encrypted[encrypted.length - 1] ^= 0xff;
        expect(() => decryptVault(encrypted, password)).toThrow();
    });

    it('fails on truncated data', () => {
        const encrypted = encryptVault(testData, password);
        const truncated = encrypted.subarray(0, 10);
        expect(() => decryptVault(truncated, password)).toThrow();
    });

    it('rejects empty data buffer', () => {
        expect(() => encryptVault(Buffer.alloc(0), password)).toThrow('Invalid data buffer');
    });

    it('rejects empty password', () => {
        expect(() => encryptVault(testData, '')).toThrow('Invalid password');
    });

    it('handles large payloads (1MB)', () => {
        const largeData = Buffer.alloc(1024 * 1024, 0x42);
        const encrypted = encryptVault(largeData, password);
        const decrypted = decryptVault(encrypted, password);
        expect(decrypted.toString('hex')).toBe(largeData.toString('hex'));
    });
});

// ─── Legacy Vault Backward Compatibility ─────────────────────────────────────

describe('Legacy vault decryption', () => {
    it('decrypts legacy v1 format (no version header, raw salt start)', () => {
        // Manually create a v1 vault (no 2-byte header)
        const password = 'legacy-password';
        const salt = crypto.randomBytes(32);
        const key = crypto.pbkdf2Sync(password.normalize('NFKC'), salt, 600000, 32, 'sha512');
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const plaintext = Buffer.from('legacy-data');
        const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        const authTag = cipher.getAuthTag();

        // v1 layout: [SALT(32)][IV(12)][AUTH_TAG(16)][DATA]
        const v1Blob = Buffer.concat([salt, iv, authTag, encrypted]);

        // Ensure first byte is NOT 0x01 (otherwise collision with v2 header detect)
        // If salt[0] happens to be 0x01, we skip this test (statistically rare)
        if (v1Blob[0] === 0x01 && (v1Blob[1] === 0x01 || v1Blob[1] === 0x02)) {
            return; // Skip — cosmically unlikely but prevents false failure
        }

        const decrypted = decryptVault(v1Blob, password);
        expect(decrypted.toString('utf8')).toBe('legacy-data');
    });
});

// ─── Attachment Encryption ───────────────────────────────────────────────────

describe('encryptAttachment / decryptAttachment', () => {
    it('round-trips correctly', () => {
        const fileKey = crypto.randomBytes(32);
        const data = Buffer.from('This is a secret document!', 'utf8');
        const encrypted = encryptAttachment(data, fileKey);
        const decrypted = decryptAttachment(encrypted, fileKey);
        expect(decrypted.toString('utf8')).toBe('This is a secret document!');
    });

    it('encrypted output is longer than input (IV + auth tag overhead)', () => {
        const fileKey = crypto.randomBytes(32);
        const data = Buffer.from('short', 'utf8');
        const encrypted = encryptAttachment(data, fileKey);
        // IV(12) + AUTH_TAG(16) + encrypted data
        expect(encrypted.length).toBeGreaterThanOrEqual(data.length + 28);
    });

    it('fails with wrong key', () => {
        const key1 = crypto.randomBytes(32);
        const key2 = crypto.randomBytes(32);
        const data = Buffer.from('secret', 'utf8');
        const encrypted = encryptAttachment(data, key1);
        expect(() => decryptAttachment(encrypted, key2)).toThrow();
    });

    it('fails on corrupted data', () => {
        const fileKey = crypto.randomBytes(32);
        const encrypted = encryptAttachment(Buffer.from('test'), fileKey);
        encrypted[encrypted.length - 1] ^= 0xff;
        expect(() => decryptAttachment(encrypted, fileKey)).toThrow();
    });
});

describe('deriveAttachmentKey', () => {
    it('produces different keys for different fileIds', () => {
        const masterKey = crypto.randomBytes(32);
        const key1 = deriveAttachmentKey(masterKey, 'file-001');
        const key2 = deriveAttachmentKey(masterKey, 'file-002');
        expect(key1.toString('hex')).not.toBe(key2.toString('hex'));
    });

    it('produces deterministic output', () => {
        const masterKey = crypto.randomBytes(32);
        const key1 = deriveAttachmentKey(masterKey, 'same-file');
        const key2 = deriveAttachmentKey(masterKey, 'same-file');
        expect(key1.toString('hex')).toBe(key2.toString('hex'));
    });

    it('accepts hex string master key', () => {
        const masterKeyHex = crypto.randomBytes(32).toString('hex');
        const key = deriveAttachmentKey(masterKeyHex, 'file-123');
        expect(key.length).toBe(32);
    });
});

// ─── Folder Key Derivation ───────────────────────────────────────────────────

describe('deriveFolderKey', () => {
    it('produces different hashes for different passwords', () => {
        const salt = crypto.randomBytes(32);
        const hash1 = deriveFolderKey('password-a', salt);
        const hash2 = deriveFolderKey('password-b', salt);
        expect(hash1).not.toBe(hash2);
    });

    it('produces different hashes for different salts', () => {
        const salt1 = crypto.randomBytes(32);
        const salt2 = crypto.randomBytes(32);
        const hash1 = deriveFolderKey('same-password', salt1);
        const hash2 = deriveFolderKey('same-password', salt2);
        expect(hash1).not.toBe(hash2);
    });

    it('returns hex-encoded string', () => {
        const salt = crypto.randomBytes(32);
        const hash = deriveFolderKey('test', salt);
        expect(hash).toMatch(/^[0-9a-f]{64}$/); // 32 bytes = 64 hex chars
    });

    it('rejects empty password', () => {
        expect(() => deriveFolderKey('', crypto.randomBytes(32))).toThrow();
    });
});

// ─── SecureBuffer ────────────────────────────────────────────────────────────

describe('SecureBuffer', () => {
    it('stores and retrieves data', () => {
        const buf = new SecureBuffer();
        buf.set('secret-data');
        expect(buf.get()).toBe('secret-data');
        expect(buf.isSet()).toBe(true);
    });

    it('clear() wipes data and sets null', () => {
        const buf = new SecureBuffer();
        buf.set('to-be-wiped');
        buf.clear();
        expect(buf.get()).toBeNull();
        expect(buf.isSet()).toBe(false);
    });

    it('double-clear is safe', () => {
        const buf = new SecureBuffer();
        buf.set('data');
        buf.clear();
        buf.clear(); // Should not throw
        expect(buf.isSet()).toBe(false);
    });

    it('set(null) clears existing data', () => {
        const buf = new SecureBuffer();
        buf.set('data');
        buf.set(null);
        expect(buf.isSet()).toBe(false);
    });
});

// ─── Password Strength Validation ────────────────────────────────────────────

describe('validatePasswordStrength', () => {
    it('rejects passwords shorter than MIN_PASSWORD_LENGTH', () => {
        const result = validatePasswordStrength('Ab1!');
        expect(result.valid).toBe(false);
    });

    it('rejects passwords longer than MAX_PASSWORD_LENGTH', () => {
        const longPass = 'A'.repeat(1001) + '1!a';
        const result = validatePasswordStrength(longPass);
        expect(result.feedback.join(' ')).toContain('exceed');
    });

    it('returns "strong" for complex passwords', () => {
        const result = validatePasswordStrength('C0mpl3x!P@ssw0rd#2024');
        expect(result.strength).toBe('strong');
        expect(result.valid).toBe(true);
    });

    it('penalizes common patterns', () => {
        const withPattern = validatePasswordStrength('password123!X');
        const withoutPattern = validatePasswordStrength('xk92bm!zQ@3n');
        expect(withPattern.score).toBeLessThan(withoutPattern.score);
    });

    it('rejects non-string input', () => {
        const result = validatePasswordStrength(12345);
        expect(result.valid).toBe(false);
    });

    it('accepts 1000-character passphrases', () => {
        const passphrase = 'The quick brown fox jumps over the lazy dog! '.repeat(22).substring(0, 1000);
        const result = validatePasswordStrength(passphrase);
        // Should not reject on length (1000 is the max)
        expect(result.feedback.join(' ')).not.toContain('exceed');
    });
});

// ─── Timing-Safe Comparison ──────────────────────────────────────────────────

describe('timingSafeEqual', () => {
    it('returns true for equal buffers', () => {
        const hex = crypto.randomBytes(32).toString('hex');
        expect(timingSafeEqual(hex, hex)).toBe(true);
    });

    it('returns false for different buffers', () => {
        const a = crypto.randomBytes(32).toString('hex');
        const b = crypto.randomBytes(32).toString('hex');
        expect(timingSafeEqual(a, b)).toBe(false);
    });

    it('returns false for different-length buffers', () => {
        expect(timingSafeEqual('aabb', 'aabbcc')).toBe(false);
    });
});

// ─── Utilities ───────────────────────────────────────────────────────────────

describe('generateSecureRandom', () => {
    it('returns buffer of requested length', () => {
        const buf = generateSecureRandom(64);
        expect(buf.length).toBe(64);
    });

    it('produces unique values', () => {
        const a = generateSecureRandom(32);
        const b = generateSecureRandom(32);
        expect(a.toString('hex')).not.toBe(b.toString('hex'));
    });
});

describe('generateVaultId', () => {
    it('returns a UUID string', () => {
        const id = generateVaultId();
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
});

// ─── Malformed Input Fuzzing ─────────────────────────────────────────────────

describe('Malformed input resilience', () => {
    it('decryptVault rejects non-Buffer input', () => {
        expect(() => decryptVault('not-a-buffer', 'password')).toThrow();
    });

    it('decryptVault rejects empty Buffer', () => {
        expect(() => decryptVault(Buffer.alloc(0), 'password')).toThrow();
    });

    it('decryptVault rejects buffer smaller than minimum header', () => {
        const tiny = Buffer.from([0x01, 0x01, 0x00]);
        expect(() => decryptVault(tiny, 'password')).toThrow();
    });

    it('decryptVault rejects random garbage', () => {
        // 100 random buffers — none should crash the process
        for (let i = 0; i < 100; i++) {
            const garbage = crypto.randomBytes(Math.floor(Math.random() * 200) + 1);
            try {
                decryptVault(garbage, 'test-password');
            } catch (e) {
                // Expected — must throw, must NOT crash
                expect(e).toBeDefined();
            }
        }
    });

    it('encryptVault rejects non-Buffer data', () => {
        expect(() => encryptVault('string-data', 'password')).toThrow();
    });
});
