/**
 * Encrypted-Vault Operations
 * Core vault management compatible with Python Encrypted-Vault format
 *
 * @module encrypted-vault/ops
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const {
    DEFAULTS,
    HEADER_SIZE,
    MAX_VAULT_FILE_SIZE,
    MAX_FILE_SIZE,
    isArgon2Available,
    deriveKmaster,
    aeadEncrypt,
    aeadDecrypt,
    packHeader,
    unpackHeader,
} = require('./crypto');

// ── In-memory state for currently open vault ──
const evState = {
    kmaster: null,
    metadata: null,
    vaultDir: null,
    salt: null,
    tCost: DEFAULTS.T_COST,
    mCost: DEFAULTS.M_COST,
    parallel: DEFAULTS.PARALLELISM,
};

// ── Operation mutex to prevent concurrent vault modifications ──
let opLock = Promise.resolve();

function withLock(fn) {
    const prev = opLock;
    let resolve;
    opLock = new Promise(r => { resolve = r; });
    return prev.then(() => fn()).finally(resolve);
}

function isOpen() {
    return evState.kmaster !== null && evState.metadata !== null;
}

function getVaultDir() {
    return evState.vaultDir;
}

// ── Save vault metadata to disk (atomic write) ──
async function saveVault() {
    if (!isOpen()) throw new Error('Vault not open');

    const metaBytes = Buffer.from(JSON.stringify(evState.metadata), 'utf-8');
    const { nonce, ct } = aeadEncrypt(evState.kmaster, metaBytes);
    const header = packHeader(evState.tCost, evState.mCost, evState.parallel, evState.salt, nonce);

    const vaultFile = path.join(evState.vaultDir, 'vault.enc');
    const tmpFile = vaultFile + '.tmp';
    fs.writeFileSync(tmpFile, Buffer.concat([header, ct]));
    fs.renameSync(tmpFile, vaultFile);
}

// ── Validate passphrase at backend level ──
function validatePassphrase(passphrase, label = 'Passphrase') {
    if (typeof passphrase !== 'string' || passphrase.length === 0) {
        throw new Error(`${label} must be a non-empty string`);
    }
    if (passphrase.length < 8) {
        throw new Error(`${label} must be at least 8 characters`);
    }
    if (passphrase.length > 1000) {
        throw new Error(`${label} exceeds maximum length`);
    }
}

// ── Initialize a new empty vault ──
async function initVault(vaultDir, passphrase) {
    if (!isArgon2Available()) throw new Error('argon2 module required');
    validatePassphrase(passphrase);

    // Prevent silently overwriting an existing vault
    const existingVault = path.join(vaultDir, 'vault.enc');
    if (fs.existsSync(existingVault)) {
        throw new Error('A vault already exists in this directory. Open it instead, or choose an empty directory.');
    }

    const blobsDir = path.join(vaultDir, 'blobs');
    fs.mkdirSync(vaultDir, { recursive: true });
    fs.mkdirSync(blobsDir, { recursive: true });

    const salt = crypto.randomBytes(16);
    const tCost = DEFAULTS.T_COST;
    const mCost = DEFAULTS.M_COST;
    const parallel = DEFAULTS.PARALLELISM;

    const kmaster = await deriveKmaster(passphrase, salt, tCost, mCost, parallel);
    const metadata = { version: 1, files: [] };

    // Store state
    evState.kmaster = kmaster;
    evState.metadata = metadata;
    evState.vaultDir = vaultDir;
    evState.salt = Buffer.from(salt);
    evState.tCost = tCost;
    evState.mCost = mCost;
    evState.parallel = parallel;

    await saveVault();
    return { success: true };
}

// ── Open/unlock an existing vault ──
async function openVault(vaultDir, passphrase) {
    if (typeof passphrase !== 'string' || passphrase.length === 0) {
        throw new Error('Passphrase must be a non-empty string');
    }

    const vaultFile = path.join(vaultDir, 'vault.enc');
    if (!fs.existsSync(vaultFile)) throw new Error('vault.enc not found in selected directory');

    // Check vault file size before loading
    const stat = fs.statSync(vaultFile);
    if (stat.size > MAX_VAULT_FILE_SIZE) {
        throw new Error(`Vault file too large (${(stat.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_VAULT_FILE_SIZE / 1024 / 1024} MB.`);
    }

    const data = fs.readFileSync(vaultFile);
    const { tCost, mCost, parallel, salt, nonce } = unpackHeader(data);
    const ct = data.subarray(HEADER_SIZE);

    const kmaster = await deriveKmaster(passphrase, salt, tCost, mCost, parallel);

    let metaBytes;
    try {
        metaBytes = aeadDecrypt(kmaster, nonce, ct);
    } catch (e) {
        // Wipe the failed key
        try { crypto.randomFillSync(kmaster); } catch (_) {}
        throw new Error('Wrong passphrase or corrupted vault');
    }

    const metadata = JSON.parse(metaBytes.toString('utf-8'));

    evState.kmaster = kmaster;
    evState.metadata = metadata;
    evState.vaultDir = vaultDir;
    evState.salt = Buffer.from(salt);
    evState.tCost = tCost;
    evState.mCost = mCost;
    evState.parallel = parallel;

    return { success: true, fileCount: metadata.files.length };
}

// ── Lock vault (securely wipe key from memory) ──
// This function MUST NEVER throw -- it's called from WVault's main lockVault()
function lockVault() {
    try {
        if (evState.kmaster && Buffer.isBuffer(evState.kmaster)) {
            crypto.randomFillSync(evState.kmaster);
            evState.kmaster.fill(0);
        }
    } catch (_) {
        // Swallow -- lock must always succeed
    }
    evState.kmaster = null;
    evState.metadata = null;
    evState.vaultDir = null;
    evState.salt = null;
    return { success: true };
}

// ── List all files in vault ──
function listFiles() {
    if (!isOpen()) throw new Error('Vault not open');
    return evState.metadata.files.map(f => ({
        id: f.id,
        name: f.name,
        relpath: f.relpath,
        size: f.size,
        created_at: f.created_at,
        modified_at: f.modified_at,
        mimetype: f.mimetype,
    }));
}

// ── Internal: encrypt and add a single file with optional relpath ──
async function addFileInternal(filePath, relpath) {
    if (!isOpen()) throw new Error('Vault not open');

    // Check file size before reading into memory
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_FILE_SIZE) {
        throw new Error(`File too large: ${path.basename(filePath)} (${(stat.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_FILE_SIZE / 1024 / 1024} MB.`);
    }
    if (stat.size === 0) {
        throw new Error(`File is empty: ${path.basename(filePath)}`);
    }

    const plaintext = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const fileId = crypto.randomUUID();
    const fileKey = crypto.randomBytes(32);

    try {
        // Encrypt file content with per-file key
        const fileNonce = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', fileKey, fileNonce);
        const fileCt = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        const fileTag = cipher.getAuthTag();

        // Blob = nonce(12) || ciphertext || tag(16)
        const blobData = Buffer.concat([fileNonce, fileCt, fileTag]);
        const blobsDir = path.join(evState.vaultDir, 'blobs');
        fs.mkdirSync(blobsDir, { recursive: true });
        fs.writeFileSync(path.join(blobsDir, `${fileId}.bin`), blobData);

        // Wrap file key with Kmaster
        const { nonce: wrapNonce, ct: wrapCt } = aeadEncrypt(evState.kmaster, fileKey);

        const now = new Date().toISOString();
        const entry = {
            id: fileId,
            name: fileName,
            relpath: relpath || null,
            blob: `blobs/${fileId}.bin`,
            size: plaintext.length,
            created_at: now,
            modified_at: now,
            mimetype: null,
            file_key_wrap: {
                nonce: wrapNonce.toString('base64'),
                ct: wrapCt.toString('base64'),
            },
        };

        evState.metadata.files.push(entry);
        return { id: fileId, name: fileName, size: plaintext.length };
    } finally {
        // Always wipe file key
        crypto.randomFillSync(fileKey);
    }
}

// ── Add a single file (mutex-protected) ──
async function addFile(filePath) {
    return withLock(async () => {
        const result = await addFileInternal(filePath, null);
        await saveVault();
        return { success: true, file: result };
    });
}

// ── Add a folder recursively (mutex-protected) ──
async function addFolder(folderPath) {
    return withLock(async () => {
        if (!isOpen()) throw new Error('Vault not open');

        const baseName = path.basename(folderPath);
        let count = 0;
        const errors = [];
        const MAX_DEPTH = 20;

        async function walk(dir, relPath, depth) {
            if (depth > MAX_DEPTH) {
                errors.push(`Skipped: directory too deep (>${MAX_DEPTH} levels)`);
                return;
            }
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const rel = relPath ? `${relPath}/${entry.name}` : entry.name;

                // Skip symlinks to prevent infinite loops
                if (entry.isSymbolicLink()) continue;

                if (entry.isDirectory()) {
                    await walk(fullPath, rel, depth + 1);
                } else if (entry.isFile()) {
                    try {
                        await addFileInternal(fullPath, `${baseName}/${rel}`);
                        count++;
                    } catch (e) {
                        errors.push(`${entry.name}: ${e.message}`);
                    }
                }
            }
        }

        await walk(folderPath, '', 0);
        if (count > 0) await saveVault();
        return { success: true, count, errors: errors.length > 0 ? errors : undefined };
    });
}

// ── Extract a file from vault (returns name only; IPC handler does decryption after dialog) ──
function getFileInfo(fileId) {
    if (!isOpen()) throw new Error('Vault not open');
    const entry = evState.metadata.files.find(f => f.id === fileId);
    if (!entry) throw new Error('File not found in vault');
    return { name: entry.name, id: entry.id };
}

function extractFile(fileId) {
    if (!isOpen()) throw new Error('Vault not open');

    const entry = evState.metadata.files.find(f => f.id === fileId);
    if (!entry) throw new Error('File not found in vault');

    // Unwrap per-file key
    const wrapNonce = Buffer.from(entry.file_key_wrap.nonce, 'base64');
    const wrapCt = Buffer.from(entry.file_key_wrap.ct, 'base64');
    const fileKey = aeadDecrypt(evState.kmaster, wrapNonce, wrapCt);

    // Read and decrypt blob
    const blobPath = path.join(evState.vaultDir, entry.blob);
    if (!fs.existsSync(blobPath)) {
        crypto.randomFillSync(fileKey);
        throw new Error(`Blob file missing: ${entry.blob}`);
    }
    const blobData = fs.readFileSync(blobPath);
    if (blobData.length < 12 + 16) {
        crypto.randomFillSync(fileKey);
        throw new Error('Blob file corrupted (too small)');
    }
    const fileNonce = blobData.subarray(0, 12);
    const fileCt = blobData.subarray(12);

    let plaintext;
    try {
        plaintext = aeadDecrypt(fileKey, fileNonce, fileCt);
    } finally {
        crypto.randomFillSync(fileKey);
    }

    return { data: plaintext, name: entry.name };
}

// ── Remove files from vault (mutex-protected) ──
async function removeFiles(fileIds) {
    return withLock(async () => {
        if (!isOpen()) throw new Error('Vault not open');

        // Collect entries to remove first (avoid splice-while-iterate issues)
        const toRemove = [];
        for (const fileId of fileIds) {
            const idx = evState.metadata.files.findIndex(f => f.id === fileId);
            if (idx !== -1) toRemove.push({ idx, entry: evState.metadata.files[idx] });
        }

        // Securely delete blobs
        for (const { entry } of toRemove) {
            const blobPath = path.join(evState.vaultDir, entry.blob);
            if (fs.existsSync(blobPath)) {
                try {
                    const stat = fs.statSync(blobPath);
                    fs.writeFileSync(blobPath, crypto.randomBytes(stat.size));
                    fs.unlinkSync(blobPath);
                } catch (_) {
                    // Best-effort secure delete
                }
            }
        }

        // Remove from metadata (sort indices descending to avoid shift issues)
        const indices = toRemove.map(r => r.idx).sort((a, b) => b - a);
        for (const idx of indices) {
            evState.metadata.files.splice(idx, 1);
        }

        await saveVault();
        return { success: true };
    });
}

// ── Rename a file (mutex-protected) ──
async function renameFile(fileId, newName) {
    return withLock(async () => {
        if (!isOpen()) throw new Error('Vault not open');
        if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
            throw new Error('New name must be a non-empty string');
        }

        const entry = evState.metadata.files.find(f => f.id === fileId);
        if (!entry) throw new Error('File not found');

        entry.name = newName.trim();
        entry.modified_at = new Date().toISOString();
        await saveVault();
        return { success: true };
    });
}

// ── Rotate master passphrase (mutex-protected) ──
async function rotateKey(oldPassphrase, newPassphrase) {
    return withLock(async () => {
        if (!isOpen()) throw new Error('Vault not open');
        validatePassphrase(newPassphrase, 'New passphrase');

        if (typeof oldPassphrase !== 'string' || oldPassphrase.length === 0) {
            throw new Error('Current passphrase must be a non-empty string');
        }

        // Verify old passphrase by re-deriving
        const vaultFile = path.join(evState.vaultDir, 'vault.enc');
        const data = fs.readFileSync(vaultFile);
        const { salt: oldSalt, nonce: oldNonce } = unpackHeader(data);

        const oldKmaster = await deriveKmaster(
            oldPassphrase, oldSalt, evState.tCost, evState.mCost, evState.parallel
        );

        try {
            aeadDecrypt(oldKmaster, oldNonce, data.subarray(HEADER_SIZE));
        } catch {
            crypto.randomFillSync(oldKmaster);
            throw new Error('Current passphrase is incorrect');
        }

        // Derive new key with new salt
        const newSalt = crypto.randomBytes(16);
        const newKmaster = await deriveKmaster(
            newPassphrase, newSalt, evState.tCost, evState.mCost, evState.parallel
        );

        // Re-wrap all per-file keys with new kmaster
        // Build new wraps in a separate array so we don't corrupt state on failure
        const newWraps = [];
        for (const entry of evState.metadata.files) {
            const wrapNonce = Buffer.from(entry.file_key_wrap.nonce, 'base64');
            const wrapCt = Buffer.from(entry.file_key_wrap.ct, 'base64');
            const fileKey = aeadDecrypt(oldKmaster, wrapNonce, wrapCt);

            const { nonce: newWrapNonce, ct: newWrapCt } = aeadEncrypt(newKmaster, fileKey);
            crypto.randomFillSync(fileKey);

            newWraps.push({
                nonce: newWrapNonce.toString('base64'),
                ct: newWrapCt.toString('base64'),
            });
        }

        // Snapshot old wraps before mutating metadata (for rollback)
        const oldWraps = evState.metadata.files.map(f => ({ ...f.file_key_wrap }));

        // Apply new wraps to metadata
        for (let i = 0; i < evState.metadata.files.length; i++) {
            evState.metadata.files[i].file_key_wrap = newWraps[i];
        }

        // Save BEFORE updating in-memory key state (so if save fails, old key still works)
        const prevKmaster = evState.kmaster;
        const prevSalt = evState.salt;
        evState.kmaster = newKmaster;
        evState.salt = newSalt;

        try {
            await saveVault();
        } catch (e) {
            // Rollback: restore old key state AND old metadata wraps
            evState.kmaster = prevKmaster;
            evState.salt = prevSalt;
            for (let i = 0; i < evState.metadata.files.length; i++) {
                evState.metadata.files[i].file_key_wrap = oldWraps[i];
            }
            crypto.randomFillSync(newKmaster);
            crypto.randomFillSync(oldKmaster);
            throw new Error('Failed to save vault after key rotation: ' + e.message);
        }

        // Success: wipe old keys
        crypto.randomFillSync(oldKmaster);
        crypto.randomFillSync(prevKmaster);

        return { success: true };
    });
}

module.exports = {
    isOpen,
    getVaultDir,
    getFileInfo,
    initVault,
    openVault,
    lockVault,
    listFiles,
    addFile,
    addFolder,
    extractFile,
    removeFiles,
    renameFile,
    rotateKey,
};
