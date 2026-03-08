/**
 * Encrypted-Vault Crypto Module
 * Compatible with Python Encrypted-Vault binary format (EFS1)
 * AES-256-GCM + Argon2id (SHA3-512 prehash)
 *
 * @module encrypted-vault/crypto
 */

const crypto = require('crypto');

// Try to load argon2 native module
let argon2;
try {
    argon2 = require('argon2');
} catch (_) {
    argon2 = null;
}

// Default KDF parameters (matching Python Encrypted-Vault defaults)
const DEFAULTS = {
    T_COST: 4,
    M_COST: 262144, // 256 MiB in KiB
    PARALLELISM: 2,
};

const MAGIC = Buffer.from('EFS1', 'ascii');
const HEADER_SIZE = 45; // 4(magic) + 1(version) + 4(t) + 4(m) + 4(p) + 16(salt) + 12(nonce)
const SUPPORTED_VERSION = 1;
const MAX_VAULT_FILE_SIZE = 100 * 1024 * 1024; // 100 MB max vault.enc metadata size
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB max individual file size

function isArgon2Available() {
    return argon2 !== null;
}

/**
 * SHA3-512 prehash (matches Python's sha3_512_bytes).
 * Falls back to SHA-512 if the runtime doesn't support SHA3 (e.g. Electron's BoringSSL).
 * NOTE: fallback produces a different hash than Python Encrypted-Vault.
 * For new vaults created in WVault this is fine — only matters for cross-tool interop.
 */
let _sha3Available = null;
function sha3_512(data) {
    if (_sha3Available === null) {
        try {
            // Must actually hash data to detect support — createHash alone may not throw
            crypto.createHash('sha3-512').update('test').digest();
            _sha3Available = true;
        } catch {
            _sha3Available = false;
            console.warn('[EV/Crypto] sha3-512 not available, using sha-512 fallback');
        }
    }
    const algo = _sha3Available ? 'sha3-512' : 'sha512';
    return crypto.createHash(algo).update(data).digest();
}

/**
 * Derive master key: SHA3-512(passphrase) -> Argon2id -> 32-byte Kmaster
 * Compatible with Python Encrypted-Vault's derive_kmaster()
 */
async function deriveKmaster(passphrase, salt, tCost, mCostKib, parallelism) {
    if (!argon2) {
        throw new Error('argon2 native module required. Install with: npm install argon2');
    }
    if (typeof passphrase !== 'string' || passphrase.length === 0) {
        throw new Error('Passphrase must be a non-empty string');
    }
    if (!Buffer.isBuffer(salt) && !(salt instanceof Uint8Array)) {
        throw new Error('Salt must be a Buffer');
    }
    const prehash = sha3_512(Buffer.from(passphrase, 'utf-8'));
    return argon2.hash(prehash, {
        salt: Buffer.from(salt),
        type: argon2.argon2id,
        timeCost: tCost,
        memoryCost: mCostKib,
        parallelism,
        hashLength: 32,
        raw: true,
    });
}

/**
 * AES-256-GCM authenticated encryption.
 * Output format matches Python cryptography library's AESGCM:
 * ciphertext = encrypted_data || auth_tag(16)
 */
function aeadEncrypt(key, plaintext) {
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { nonce, ct: Buffer.concat([encrypted, tag]) };
}

/**
 * AES-256-GCM authenticated decryption.
 * Expects ciphertext format: encrypted_data || auth_tag(16)
 */
function aeadDecrypt(key, nonce, ct) {
    if (!Buffer.isBuffer(ct) || ct.length < 16) {
        throw new Error('Ciphertext too short (must be at least 16 bytes for auth tag)');
    }
    const tagStart = ct.length - 16;
    const encrypted = ct.subarray(0, tagStart);
    const tag = ct.subarray(tagStart);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/**
 * Pack vault header (45 bytes).
 * Format: >4sBIII16s12s (big-endian, matches Python struct.pack)
 */
function packHeader(tCost, mCost, parallel, salt, nonce) {
    const buf = Buffer.alloc(HEADER_SIZE);
    MAGIC.copy(buf, 0);
    buf.writeUInt8(SUPPORTED_VERSION, 4);
    buf.writeUInt32BE(tCost, 5);
    buf.writeUInt32BE(mCost, 9);
    buf.writeUInt32BE(parallel, 13);
    Buffer.from(salt).copy(buf, 17);
    Buffer.from(nonce).copy(buf, 33);
    return buf;
}

/**
 * Unpack vault header from buffer.
 */
function unpackHeader(buf) {
    if (buf.length < HEADER_SIZE) {
        throw new Error('Vault file too small');
    }
    const magic = buf.subarray(0, 4);
    if (!magic.equals(MAGIC)) {
        throw new Error('Invalid vault file (bad magic bytes)');
    }
    const version = buf.readUInt8(4);
    if (version !== SUPPORTED_VERSION) {
        throw new Error(`Unsupported vault version: ${version} (expected ${SUPPORTED_VERSION})`);
    }
    return {
        version,
        tCost: buf.readUInt32BE(5),
        mCost: buf.readUInt32BE(9),
        parallel: buf.readUInt32BE(13),
        salt: Buffer.from(buf.subarray(17, 33)), // copy, not view
        nonce: Buffer.from(buf.subarray(33, 45)), // copy, not view
    };
}

module.exports = {
    DEFAULTS,
    MAGIC,
    HEADER_SIZE,
    SUPPORTED_VERSION,
    MAX_VAULT_FILE_SIZE,
    MAX_FILE_SIZE,
    isArgon2Available,
    sha3_512,
    deriveKmaster,
    aeadEncrypt,
    aeadDecrypt,
    packHeader,
    unpackHeader,
};
