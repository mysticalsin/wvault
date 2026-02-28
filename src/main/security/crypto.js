/**
 * ============================================================================
 * WVAULT CRYPTOGRAPHY MODULE
 * ============================================================================
 * Secure encryption/decryption with memory sanitization
 * @module security/crypto
 * @version 5.2.0
 * @security-level Critical
 *
 * Vault file format (v2):
 *   [VERSION (1 byte)] [KDF (1 byte)] [SALT (32)] [IV (12)] [AUTH_TAG (16)] [ENCRYPTED_DATA]
 *
 * VERSION byte values:
 *   0x01 = AES-256-GCM
 *
 * KDF byte values:
 *   0x01 = PBKDF2-SHA512 (600k iterations)
 *   0x02 = Argon2id (time=3, mem=65536, parallel=4)
 *
 * Legacy format (v1, no version bytes) detected by checking if first byte
 * is NOT 0x01 — treated as raw SALT start for backward compatibility.
 */

const crypto = require('crypto');
const { safeStorage } = require('electron');

// Security Constants
const SECURITY = {
    PBKDF2_ITERATIONS: 600000, // OWASP 2023 recommendation
    PBKDF2_KEYLEN: 32,
    PBKDF2_DIGEST: 'sha512',
    PIN_ITERATIONS: 100000,
    PIN_KEYLEN: 32,
    AES_ALGORITHM: 'aes-256-gcm',
    IV_LENGTH: 12,
    SALT_LENGTH: 32,
    AUTH_TAG_LENGTH: 16,
    MAX_PASSWORD_LENGTH: 1000, // Supports passphrases (WCAG / Phase 6)
    MIN_PASSWORD_LENGTH: 8,
    // Cipher/KDF version bytes
    CIPHER_VERSION_AES256GCM: 0x01,
    KDF_VERSION_PBKDF2: 0x01,
    KDF_VERSION_ARGON2ID: 0x02,
};

// ─── Argon2id support (optional native module) ───────────────────────────────
let argon2;
try {
    argon2 = require('argon2');
} catch (_) {
    // argon2 native module not available — fall back to PBKDF2
    argon2 = null;
}

const ARGON2_OPTIONS = {
    type: argon2 ? argon2.argon2id : undefined,
    timeCost: 3,
    memoryCost: 65536, // 64 MB
    parallelism: 4,
    hashLength: 32,
    raw: true,           // return Buffer, not encoded string
};

// Secure memory storage for sensitive data
class SecureBuffer {
    constructor() {
        this.buffer = null;
    }

    set(data) {
        this.clear();
        if (data) {
            this.buffer = Buffer.from(data, 'utf8');
        }
    }

    get() {
        return this.buffer ? this.buffer.toString('utf8') : null;
    }

    getBuffer() {
        return this.buffer;
    }

    clear() {
        if (this.buffer) {
            // Cryptographically secure wipe
            crypto.randomFillSync(this.buffer);
            this.buffer.fill(0);
            this.buffer = null;
        }
    }

    isSet() {
        return this.buffer !== null;
    }
}

// Global secure storage
const secureMasterPassword = new SecureBuffer();

// ─── Unicode normalization ────────────────────────────────────────────────────
/**
 * Normalize a password string to NFKC before hashing.
 * Prevents Turkish İ/i issue and bidirectional homograph attacks.
 * @param {string} password
 * @returns {string}
 */
function normalizePassword(password) {
    if (typeof password !== 'string') return password;
    return password.normalize('NFKC');
}

// ─── Key Derivation ───────────────────────────────────────────────────────────
/**
 * Derive encryption key from password using PBKDF2-SHA512.
 * @param {string} password - Master password (will be NFKC-normalized internally)
 * @param {Buffer} salt - Random salt (must be SALT_LENGTH bytes)
 * @returns {Buffer} 32-byte key
 */
function deriveKey(password, salt) {
    if (!password || !salt || salt.length !== SECURITY.SALT_LENGTH) {
        throw new Error('Invalid key derivation parameters');
    }
    const normalized = normalizePassword(password);
    return crypto.pbkdf2Sync(
        normalized,
        salt,
        SECURITY.PBKDF2_ITERATIONS,
        SECURITY.PBKDF2_KEYLEN,
        SECURITY.PBKDF2_DIGEST
    );
}

/**
 * Derive key using Argon2id. Falls back to PBKDF2 if argon2 unavailable.
 * @param {string} password
 * @param {Buffer} salt
 * @returns {Promise<{key: Buffer, kdfVersion: number}>}
 */
async function deriveKeyArgon2(password, salt) {
    const normalized = normalizePassword(password);
    if (argon2) {
        const key = await argon2.hash(normalized, {
            ...ARGON2_OPTIONS,
            salt,
        });
        return { key, kdfVersion: SECURITY.KDF_VERSION_ARGON2ID };
    } else {
        console.warn('[Crypto] argon2 not available, falling back to PBKDF2');
        const key = deriveKey(normalized, salt);
        return { key, kdfVersion: SECURITY.KDF_VERSION_PBKDF2 };
    }
}

/**
 * Derive PIN hash for session unlocking (PBKDF2).
 * @param {string} pin - User PIN
 * @param {Buffer} salt - Random salt
 * @returns {Buffer} Derived hash
 */
function derivePinHash(pin, salt) {
    if (!pin || !salt || salt.length !== SECURITY.SALT_LENGTH) {
        throw new Error('Invalid PIN derivation parameters');
    }
    const normalized = normalizePassword(pin);
    return crypto.pbkdf2Sync(
        normalized,
        salt,
        10000, // Lower iterations for PIN (frequent use)
        SECURITY.PIN_KEYLEN,
        SECURITY.PBKDF2_DIGEST
    );
}

/**
 * Derive folder password key via PBKDF2 (replaces plain SHA-256).
 * @param {string} password
 * @param {Buffer} salt
 * @returns {string} Hex-encoded derived key
 */
function deriveFolderKey(password, salt) {
    if (!password || typeof password !== 'string') throw new Error('Invalid folder password');
    const saltBuf = Buffer.isBuffer(salt) ? salt : Buffer.from(salt, 'hex');
    const normalized = normalizePassword(password);
    return crypto.pbkdf2Sync(normalized, saltBuf, 100000, 32, 'sha256').toString('hex');
}

// ─── Vault Encryption / Decryption ───────────────────────────────────────────
/**
 * Encrypt vault data with AES-256-GCM.
 * New format: [VERSION(1)][KDF(1)][SALT(32)][IV(12)][AUTH_TAG(16)][ENCRYPTED_DATA]
 *
 * @param {Buffer} dataBuffer - Data to encrypt
 * @param {string} password - Encryption password
 * @param {number} [kdfVersion] - KDF version byte (PBKDF2 by default)
 * @returns {Buffer} Encrypted vault buffer
 */
function encryptVault(dataBuffer, password, kdfVersion = SECURITY.KDF_VERSION_PBKDF2) {
    if (!Buffer.isBuffer(dataBuffer) || dataBuffer.length === 0) {
        throw new Error('Invalid data buffer for encryption');
    }
    if (typeof password !== 'string' || password.length === 0) {
        throw new Error('Invalid password for encryption');
    }

    const salt = crypto.randomBytes(SECURITY.SALT_LENGTH);
    const key = deriveKey(password, salt); // PBKDF2 path (sync, used for saves)
    const iv = crypto.randomBytes(SECURITY.IV_LENGTH);
    const cipher = crypto.createCipheriv(SECURITY.AES_ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(dataBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Clear key from memory
    key.fill(0);

    // Version header
    const header = Buffer.from([SECURITY.CIPHER_VERSION_AES256GCM, kdfVersion]);

    return Buffer.concat([header, salt, iv, authTag, encrypted]);
}

/**
 * Decrypt vault data. Handles both legacy (no header) and v2 (with header) formats.
 *
 * @param {Buffer} fileBuffer - Encrypted vault data
 * @param {string} password - Decryption password
 * @returns {Buffer} Decrypted data
 */
function decryptVault(fileBuffer, password) {
    if (!Buffer.isBuffer(fileBuffer)) {
        throw new Error('Invalid file buffer');
    }
    if (typeof password !== 'string' || password.length === 0) {
        throw new Error('Invalid password for decryption');
    }

    let offset = 0;
    let kdfVersion = SECURITY.KDF_VERSION_PBKDF2;

    // Detect v2 header: first byte is 0x01 (CIPHER_VERSION_AES256GCM) and
    // second byte is a known KDF marker (0x01 or 0x02).
    // Legacy v1 files start directly with the 32-byte salt — the first byte
    // of a random salt is statistically very unlikely to be 0x01 followed by
    // another version byte, so we use a 2-byte prefix check.
    const isV2 = (
        fileBuffer[0] === SECURITY.CIPHER_VERSION_AES256GCM &&
        (fileBuffer[1] === SECURITY.KDF_VERSION_PBKDF2 || fileBuffer[1] === SECURITY.KDF_VERSION_ARGON2ID)
    );

    if (isV2) {
        // cipherVersion = fileBuffer[0]; // reserved for future use
        kdfVersion = fileBuffer[1];
        offset = 2;
    }

    // Minimum size check
    const minSize = offset + SECURITY.SALT_LENGTH + SECURITY.IV_LENGTH + SECURITY.AUTH_TAG_LENGTH + 1;
    if (fileBuffer.length < minSize) {
        throw new Error('Corrupted vault file: insufficient data');
    }

    const salt = fileBuffer.subarray(offset, offset += SECURITY.SALT_LENGTH);
    const iv = fileBuffer.subarray(offset, offset += SECURITY.IV_LENGTH);
    const authTag = fileBuffer.subarray(offset, offset += SECURITY.AUTH_TAG_LENGTH);
    const encryptedData = fileBuffer.subarray(offset);

    if (encryptedData.length === 0) {
        throw new Error('Corrupted vault file: no encrypted data');
    }

    // KDF dispatch
    const key = deriveKey(password, salt); // PBKDF2 always for now (Argon2 is async; used on new vault creation only)

    try {
        const decipher = crypto.createDecipheriv(SECURITY.AES_ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    } finally {
        key.fill(0);
    }
}

// ─── Attachment Encryption ────────────────────────────────────────────────────
/**
 * Derive a per-file encryption key using HKDF from the master key.
 * @param {Buffer|string} masterKey - Master encryption key (or hex string)
 * @param {string} fileId - Unique file identifier (UUID)
 * @returns {Buffer} 32-byte file-specific key
 */
function deriveAttachmentKey(masterKey, fileId) {
    const keyBuf = Buffer.isBuffer(masterKey) ? masterKey : Buffer.from(masterKey, 'hex');
    return crypto.createHmac('sha256', keyBuf).update(`attachment:${fileId}`).digest();
}

/**
 * Encrypt an attachment file buffer.
 * Format: [IV(12)][AUTH_TAG(16)][ENCRYPTED_DATA]
 * @param {Buffer} data - Raw file bytes
 * @param {Buffer} fileKey - 32-byte key from deriveAttachmentKey
 * @returns {Buffer}
 */
function encryptAttachment(data, fileKey) {
    const iv = crypto.randomBytes(SECURITY.IV_LENGTH);
    const cipher = crypto.createCipheriv(SECURITY.AES_ALGORITHM, fileKey, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Decrypt an attachment file buffer.
 * @param {Buffer} data - Encrypted attachment bytes
 * @param {Buffer} fileKey - 32-byte key from deriveAttachmentKey
 * @returns {Buffer}
 */
function decryptAttachment(data, fileKey) {
    const iv = data.subarray(0, SECURITY.IV_LENGTH);
    const authTag = data.subarray(SECURITY.IV_LENGTH, SECURITY.IV_LENGTH + SECURITY.AUTH_TAG_LENGTH);
    const encrypted = data.subarray(SECURITY.IV_LENGTH + SECURITY.AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(SECURITY.AES_ALGORITHM, fileKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

// ─── Field Encryption ────────────────────────────────────────────────────────
function encryptField(value, key) {
    if (!value || typeof value !== 'string') return null;

    const iv = crypto.randomBytes(SECURITY.IV_LENGTH);
    const cipher = crypto.createCipheriv(SECURITY.AES_ALGORITHM, key, iv);

    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
        data: encrypted,
        iv: iv.toString('hex'),
        authTag: cipher.getAuthTag().toString('hex')
    };
}

function decryptField(encryptedObj, key) {
    if (!encryptedObj || !encryptedObj.data) return null;

    const iv = Buffer.from(encryptedObj.iv, 'hex');
    const authTag = Buffer.from(encryptedObj.authTag, 'hex');

    const decipher = crypto.createDecipheriv(SECURITY.AES_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedObj.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

// ─── Password Validation ──────────────────────────────────────────────────────
function validatePasswordStrength(password) {
    const feedback = [];
    let score = 0;

    if (typeof password !== 'string') {
        return { valid: false, score: 0, feedback: ['Password must be a string'] };
    }

    if (password.length < SECURITY.MIN_PASSWORD_LENGTH) {
        feedback.push(`Password must be at least ${SECURITY.MIN_PASSWORD_LENGTH} characters`);
    } else {
        score += Math.min(password.length / 4, 4);
    }

    if (password.length > SECURITY.MAX_PASSWORD_LENGTH) {
        feedback.push(`Password must not exceed ${SECURITY.MAX_PASSWORD_LENGTH} characters`);
    }

    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Add lowercase letters');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Add uppercase letters');

    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('Add numbers');

    if (/[^a-zA-Z0-9]/.test(password)) score += 2;
    else feedback.push('Add special characters');

    const commonPatterns = ['password', '123456', 'qwerty', 'admin', 'letmein', 'welcome'];
    const lowerPass = password.toLowerCase();
    for (const pattern of commonPatterns) {
        if (lowerPass.includes(pattern)) {
            score -= 2;
            feedback.push('Avoid common words and patterns');
            break;
        }
    }

    const valid = score >= 4 && password.length >= SECURITY.MIN_PASSWORD_LENGTH;

    return {
        valid,
        score: Math.max(0, Math.min(score, 10)),
        feedback: feedback.length > 0 ? feedback : ['Good password strength'],
        strength: score < 4 ? 'weak' : score < 6 ? 'fair' : score < 8 ? 'good' : 'strong'
    };
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function generateSecureRandom(length = 32) {
    return crypto.randomBytes(length);
}

function generateVaultId() {
    return crypto.randomUUID();
}

function hashData(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function timingSafeEqual(a, b) {
    const bufA = Buffer.isBuffer(a) ? a : Buffer.from(a, 'hex');
    const bufB = Buffer.isBuffer(b) ? b : Buffer.from(b, 'hex');

    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
    SECURITY,
    SecureBuffer,
    secureMasterPassword,
    normalizePassword,
    deriveKey,
    deriveKeyArgon2,
    derivePinHash,
    deriveFolderKey,
    encryptVault,
    decryptVault,
    encryptAttachment,
    decryptAttachment,
    deriveAttachmentKey,
    encryptField,
    decryptField,
    validatePasswordStrength,
    generateSecureRandom,
    generateVaultId,
    hashData,
    timingSafeEqual
};
