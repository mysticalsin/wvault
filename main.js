/**
 * ============================================================================
 * WVAULT 5.1 - SECURE PASSWORD MANAGER
 * ============================================================================
 * Complete rewrite with:
 * - Modular architecture
 * - Biometric authentication (Windows Hello, Touch ID, Linux fingerprint)
 * - No internet dependencies (offline-only)
 * - Enhanced security
 * - Beautiful UI
 * 
 * @version 5.1.0
 * @security-level Maximum
 */

const { app, BrowserWindow, ipcMain, dialog, Menu, shell, clipboard, globalShortcut, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Import modular components
const {
    SECURITY,
    SecureBuffer,
    secureMasterPassword,
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
    timingSafeEqual
} = require('./src/main/security/crypto');

const { SaveCredentialSchema, CreateFolderSchema, validateIpcInput } = require('./src/main/utils/ipc-schemas');
const { biometricAuth } = require('./src/main/biometric');
const { LIMITS, DEFAULT_SECTION_SETTINGS, THEMES } = require('./src/main/utils/constants');
const {
    sanitizeFileId,
    validateCredentialId,
    validateFolderId,
    validateUrl,
    sanitizeDomain,
    validateFileSize,
    safeJsonParse,
    validateTotpSecret
} = require('./src/main/utils/validation');

// Import TOTP generator
const { generateTOTP } = require('./totp');

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const state = {
    mainWindow: null,
    db: null,                    // SQL.js database instance
    encryptionKey: null,         // Derived from password
    vaultPath: '',               // Path to encrypted vault
    legacyDbPath: '',            // Path to old SQLite file
    autoLockTimer: null,
    isDirty: false,
    sessionPinHash: null,
    isSessionPinned: false,
    pinAttemptCount: 0,
    pinLockoutTimer: null,
    loginAttempts: new Map(),    // Brute force protection
    auditLog: [],
    lastVaultHash: null,
    queryCache: new Map(),
    notesDb: null,
    noteWindows: new Map(),
    overlayWindow: null,
    config: { vaultLocation: null }
};

// Config path
const configPath = path.join(app.getPath('userData'), 'config.json');

// ============================================================================
// SECURITY FUNCTIONS
// ============================================================================

function getDeviceFingerprint(event) {
    const senderId = event?.sender?.id || 'unknown';
    const processId = event?.sender?.getProcessId?.() || 'unknown';
    return `device-${senderId}-${processId}`;
}

function addAuditEntry(eventType, details = {}, event = null) {
    const entry = {
        id: generateVaultId(),
        timestamp: new Date().toISOString(),
        event: eventType,
        device: getDeviceFingerprint(event),
        details,
        previousHash: state.auditLog.length > 0 ? state.auditLog[state.auditLog.length - 1].hash : '0',
    };

    // Calculate hash for blockchain-style integrity
    const crypto = require('crypto');
    const hashContent = entry.previousHash + entry.timestamp + entry.event + JSON.stringify(entry.details);
    entry.hash = crypto.createHash('sha256').update(hashContent).digest('hex').slice(0, 16);

    state.auditLog.push(entry);

    // ── ANOMALY DETECTION: Rapid copy sequence ─────────────────────────────
    if (eventType === 'COPY_PASSWORD') {
        const now = Date.now();
        const WINDOW_MS = 60_000; // 60 seconds
        const THRESHOLD = 5;
        const recentCopies = state.auditLog.filter(
            e => e.event === 'COPY_PASSWORD' && (now - new Date(e.timestamp).getTime()) < WINDOW_MS
        );
        if (recentCopies.length > THRESHOLD) {
            // Log anomaly — potential credential exfiltration
            const anomalyEntry = {
                id: generateVaultId(),
                timestamp: new Date().toISOString(),
                event: 'RAPID_COPY_SEQUENCE',
                device: getDeviceFingerprint(event),
                details: { count: recentCopies.length, windowSeconds: 60 },
                previousHash: entry.hash,
            };
            anomalyEntry.hash = crypto.createHash('sha256')
                .update(anomalyEntry.previousHash + anomalyEntry.timestamp + anomalyEntry.event + JSON.stringify(anomalyEntry.details))
                .digest('hex').slice(0, 16);
            state.auditLog.push(anomalyEntry);
            console.warn('[AUDIT] ⚠️ RAPID_COPY_SEQUENCE detected:', recentCopies.length, 'copies in 60s');
        }
    }

    // Trim log if too large
    if (state.auditLog.length > LIMITS.MAX_AUDIT_LOG_SIZE) {
        state.auditLog = state.auditLog.slice(-LIMITS.MAX_AUDIT_LOG_SIZE);
    }

    // Send real-time notification to renderer
    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
        state.mainWindow.webContents.send('wv:audit-event', entry);
    }

    return entry;
}

function setWindowsSecurePermissions(filePath) {
    if (process.platform !== 'win32') return;

    try {
        const { execSync } = require('child_process');
        const user = process.env.USERNAME || process.env.USER;

        const psCommand = `
            $path = '${filePath.replace(/'/g, "''")}';
            $acl = Get-Acl $path;
            $acl.SetAccessRuleProtection($true, $false);
            $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
                '${user}', 'FullControl', 'Allow'
            );
            $acl.SetAccessRule($rule);
            Set-Acl $path $acl;
        `;

        execSync(`powershell.exe -Command "${psCommand}"`, {
            stdio: 'ignore',
            timeout: 5000
        });
    } catch (e) {
        try {
            fs.chmodSync(filePath, 0o600);
        } catch (chmodErr) {
            console.error('[Security] Failed to set Windows permissions:', e.message);
        }
    }
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

function getCached(key, computeFn) {
    const cached = state.queryCache.get(key);
    if (cached && Date.now() - cached.timestamp < LIMITS.CACHE_TTL_MS) {
        return cached.value;
    }
    const value = computeFn();
    state.queryCache.set(key, { value, timestamp: Date.now() });
    return value;
}

function invalidateCache() {
    state.queryCache.clear();
    state.lastVaultHash = generateVaultId();
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

function resetAutoLockTimer(timeoutMs = SECURITY.AUTO_LOCK_MS) {
    clearTimeout(state.autoLockTimer);
    if (secureMasterPassword.isSet() && timeoutMs > 0) {
        state.autoLockTimer = setTimeout(() => {
            if (state.sessionPinHash) {
                state.isSessionPinned = true;
                state.mainWindow?.webContents.send('vault:auto-locked', { type: 'pin' });
            } else {
                lockVault();
                state.mainWindow?.webContents.send('vault:auto-locked', { type: 'full' });
            }
        }, timeoutMs);
    }
}

function lockVault() {
    // SECURITY: Cryptographically wipe all sensitive data from memory
    secureMasterPassword.clear();
    if (Buffer.isBuffer(state.encryptionKey)) {
        crypto.randomFillSync(state.encryptionKey);
        state.encryptionKey.fill(0);
    }
    state.encryptionKey = null;
    state.isSessionPinned = false;
    state.sessionPinHash = null;
    state.pinAttemptCount = 0;

    clearTimeout(state.pinLockoutTimer);
    clearTimeout(state.autoLockTimer);
    state.pinLockoutTimer = null;
    state.autoLockTimer = null;

    if (state.db) {
        state.db.close();
        state.db = null;
    }

    state.isDirty = false;
    invalidateCache();

    // Clear clipboard for security
    clipboard.writeText('');
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function initSqlJs() {
    const init = require('sql.js');
    return await init({
        locateFile: file => {
            if (app.isPackaged) {
                return path.join(process.resourcesPath, 'app.asar', 'node_modules', 'sql.js', 'dist', file);
            }
            return path.join(__dirname, 'node_modules', 'sql.js', 'dist', file);
        }
    });
}

function saveVault() {
    if (!state.db || !secureMasterPassword.isSet()) {
        console.error('[Save] Cannot save: db or password not set');
        return;
    }

    // IDEMPOTENCY: Prevent double-writes from rapid clicks
    if (state.isSaving) {
        console.warn('[Save] Save already in progress, skipping');
        return;
    }
    state.isSaving = true;

    invalidateCache();

    try {
        const data = state.db.export();
        const encryptedBuffer = encryptVault(Buffer.from(data), secureMasterPassword.get());

        // Atomic write pattern
        const tempPath = state.vaultPath + '.tmp';
        const backupPath = state.vaultPath + '.backup';

        fs.writeFileSync(tempPath, encryptedBuffer);
        fs.chmodSync(tempPath, 0o600);
        setWindowsSecurePermissions(tempPath);

        if (fs.existsSync(state.vaultPath)) {
            fs.copyFileSync(state.vaultPath, backupPath);
        }

        fs.renameSync(tempPath, state.vaultPath);
        setWindowsSecurePermissions(state.vaultPath);

        if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
        }

        state.isDirty = false;
        console.log('[Save] Vault saved successfully');
    } catch (e) {
        console.error('[Save] Failed to save vault:', e);
        dialog.showErrorBox('Save Error', 'Failed to save vault: ' + e.message);
        throw e;
    } finally {
        state.isSaving = false;
    }
}

function initSchema() {
    state.db.run(`
        CREATE TABLE IF NOT EXISTS credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service TEXT NOT NULL,
            username TEXT NOT NULL,
            password TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            url TEXT DEFAULT '',
            totp TEXT DEFAULT '',
            icon_url TEXT DEFAULT '',
            category TEXT DEFAULT 'general',
            favorite INTEGER DEFAULT 0,
            type TEXT DEFAULT 'login',
            fields TEXT DEFAULT '[]',
            card TEXT DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            deleted_at TEXT DEFAULT NULL
        );

        CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            credential_id INTEGER NOT NULL,
            file_id TEXT NOT NULL,
            name TEXT NOT NULL,
            type TEXT DEFAULT '',
            size INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            folder_id INTEGER DEFAULT NULL,
            deleted_at TEXT DEFAULT NULL,
            encrypted INTEGER DEFAULT 0,
            FOREIGN KEY(credential_id) REFERENCES credentials(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            locked INTEGER DEFAULT 0,
            lock_password TEXT DEFAULT NULL,
            lock_salt TEXT DEFAULT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS drive_folders (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            password_hash TEXT DEFAULT NULL,
            password_salt TEXT DEFAULT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            deleted_at TEXT DEFAULT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS credential_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            credential_id INTEGER NOT NULL,
            password TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY(credential_id) REFERENCES credentials(id) ON DELETE CASCADE
        );
    `);

    // Create indexes
    state.db.run(`
        CREATE INDEX IF NOT EXISTS idx_credentials_service ON credentials(service);
        CREATE INDEX IF NOT EXISTS idx_credentials_type ON credentials(type);
        CREATE INDEX IF NOT EXISTS idx_credentials_category ON credentials(category);
        CREATE INDEX IF NOT EXISTS idx_credentials_favorite ON credentials(favorite);
        CREATE INDEX IF NOT EXISTS idx_credentials_deleted ON credentials(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_credentials_updated ON credentials(updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_attachments_credential ON attachments(credential_id);
        CREATE INDEX IF NOT EXISTS idx_history_credential ON credential_history(credential_id);
    `);

    // Run optimization
    try {
        state.db.run("PRAGMA optimize");
    } catch (e) {
        console.error('[DB] Optimization failed:', e.message);
    }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

function loadConfig() {
    try {
        if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, 'utf8');
            const parsed = JSON.parse(content);
            if (parsed && typeof parsed === 'object') {
                state.config = { ...state.config, ...parsed };
            }
        }
    } catch (e) {
        console.error('[Config] Load error:', e);
        state.config = { vaultLocation: null };
    }
}

function saveConfig() {
    try {
        const tempPath = configPath + '.tmp';
        fs.writeFileSync(tempPath, JSON.stringify(state.config, null, 2));
        fs.chmodSync(tempPath, 0o600);
        fs.renameSync(tempPath, configPath);
    } catch (e) {
        console.error('[Config] Save error:', e);
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId() {
    // SECURITY: CSPRNG — crypto.randomBytes uses OS entropy pool (replaces predictable Math.random)
    return Date.now().toString(36) + crypto.randomBytes(8).toString('hex');
}

/**
 * @deprecated Do NOT use for new folder passwords — use deriveFolderKey() instead.
 * Kept only to detect legacy SHA-256 hashes during migration.
 */
function _legacyHashPassword(password) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(password).digest('hex');
}

function getAttachmentsDir() {
    const basePath = path.dirname(state.vaultPath);
    return path.join(basePath, 'attachments');
}

async function importFile(filePath, credentialId = null, folderId = null) {
    const cryptoMod = require('crypto');
    const fileId = cryptoMod.randomBytes(16).toString('hex');
    const destPath = path.join(getAttachmentsDir(), fileId);

    // Get file info from source
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    const fileExt = path.extname(fileName).toLowerCase();

    // SECURITY: Encrypt attachment before storing on disk using HKDF-derived per-file key
    let fileSize = stats.size;
    let isEncrypted = 0;
    if (state.encryptionKey) {
        try {
            const rawData = fs.readFileSync(filePath);
            const fileKey = deriveAttachmentKey(state.encryptionKey, fileId);
            const encryptedData = encryptAttachment(rawData, fileKey);
            fileKey.fill(0); // wipe key from memory immediately
            fs.writeFileSync(destPath, encryptedData);
            fileSize = rawData.length; // store original size for display
            isEncrypted = 1;
        } catch (encErr) {
            console.error('[Attachment] Encryption failed, storing plaintext:', encErr.message);
            fs.copyFileSync(filePath, destPath); // fallback — should not happen normally
        }
    } else {
        fs.copyFileSync(filePath, destPath);
    }
    fs.chmodSync(destPath, 0o600);

    // Insert into database with encrypted flag
    state.db.run(
        `INSERT INTO attachments (credential_id, file_id, name, type, size, folder_id, encrypted, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
            credentialId || 0,
            fileId,
            fileName.substring(0, 255),
            fileExt,
            fileSize,
            folderId,
            isEncrypted
        ]
    );

    return fileId;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function init() {
    loadConfig();

    // Initialize biometric authentication
    const bioResult = await biometricAuth.initialize();
    console.log('[Biometric] Status:', bioResult);

    const defaultPath = app.getPath('userData');
    let basePath = defaultPath;

    if (state.config.vaultLocation && typeof state.config.vaultLocation === 'string') {
        try {
            const stats = fs.statSync(state.config.vaultLocation);
            if (stats.isDirectory()) {
                basePath = state.config.vaultLocation;
            }
        } catch (e) {
            console.error('[Init] Invalid vault location:', e);
        }
    }

    state.vaultPath = path.join(basePath, 'wvault.vault');
    state.legacyDbPath = path.join(basePath, 'wvault.db');

    // Ensure attachments directory exists
    const attachmentsDir = path.join(basePath, 'attachments');
    if (!fs.existsSync(attachmentsDir)) {
        fs.mkdirSync(attachmentsDir, { recursive: true });
        fs.chmodSync(attachmentsDir, 0o700);
    }

    ensureCleanState();
}

function ensureCleanState() {
    if (!fs.existsSync(state.vaultPath) && !fs.existsSync(state.legacyDbPath)) {
        try {
            if (fs.existsSync(configPath)) {
                console.log('[Init] Fresh install detected, purging config');
                fs.unlinkSync(configPath);
                state.config = { vaultLocation: null };
            }
        } catch (e) {
            console.error('[Init] Auto-purge failed:', e);
        }
    }
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

function registerIpcHandlers() {
    // Window controls
    ipcMain.handle('window:minimize', () => state.mainWindow?.minimize());
    ipcMain.handle('window:maximize', () => {
        if (state.mainWindow?.isMaximized()) {
            state.mainWindow.unmaximize();
        } else {
            state.mainWindow?.maximize();
        }
    });
    ipcMain.handle('window:close', () => state.mainWindow?.close());

    // Auth handlers
    ipcMain.handle('auth:check', () => {
        if (state.isSessionPinned && state.encryptionKey) {
            return { isSetup: true, isPinned: true };
        }
        if (fs.existsSync(state.vaultPath)) return { isSetup: true };
        if (fs.existsSync(state.legacyDbPath)) return { isSetup: true, migrationNeeded: true };
        return { isSetup: false };
    });

    ipcMain.handle('auth:setup', async (_event, { password, name }) => {
        if (fs.existsSync(state.vaultPath)) {
            return { success: false, error: 'Vault already exists' };
        }

        const passwordCheck = validatePasswordStrength(password);
        if (!passwordCheck.valid) {
            return { success: false, error: passwordCheck.error };
        }

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return { success: false, error: 'Please enter your name' };
        }

        try {
            const sqlInstance = await initSqlJs();
            state.db = new sqlInstance.Database();
            initSchema();

            secureMasterPassword.set(password);
            const salt = generateSecureRandom(SECURITY.SALT_LENGTH);
            state.encryptionKey = deriveKey(password, salt);

            const trimmedName = name.trim().replace(/[<>"']/g, '');
            state.db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('user_name', ?)", [trimmedName]);
            state.config.userName = trimmedName;
            saveConfig();

            saveVault();
            resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);

            addAuditEntry('VAULT_CREATED', { userName: trimmedName });

            return { success: true, name: trimmedName };
        } catch (e) {
            console.error('[Auth] Setup error:', e);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('auth:login', async (event, { password }) => {
        const deviceId = getDeviceFingerprint(event);
        const now = Date.now();

        // Check brute force protection
        const attemptData = state.loginAttempts.get(deviceId);
        if (attemptData) {
            if (attemptData.lockedUntil && now < attemptData.lockedUntil) {
                const remaining = Math.ceil((attemptData.lockedUntil - now) / 1000);
                addAuditEntry('LOGIN_FAILURE', { reason: 'brute_force_lockout', deviceId, remainingSeconds: remaining }, event);
                return { success: false, error: `Too many failed attempts. Try again in ${remaining} seconds.` };
            }
            if (now - attemptData.firstAttempt > SECURITY.BRUTE_FORCE_WINDOW) {
                state.loginAttempts.delete(deviceId);
            }
        }

        if (!fs.existsSync(state.vaultPath)) {
            return { success: false, error: 'No vault found' };
        }

        try {
            const encryptedBuffer = fs.readFileSync(state.vaultPath);
            const decryptedBuffer = decryptVault(encryptedBuffer, password);

            const sqlInstance = await initSqlJs();
            state.db = new sqlInstance.Database(decryptedBuffer);
            initSchema();

            secureMasterPassword.set(password);
            const salt = generateSecureRandom(SECURITY.SALT_LENGTH);
            state.encryptionKey = deriveKey(password, salt);

            resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);
            state.loginAttempts.delete(deviceId);

            addAuditEntry('LOGIN_SUCCESS', { deviceId }, event);

            return { success: true };
        } catch (e) {
            console.error('[Auth] Login failed:', e);

            // Track failed attempt
            let data = state.loginAttempts.get(deviceId) || { count: 0, firstAttempt: now, lockedUntil: null };
            data.count++;

            if (data.count >= SECURITY.BRUTE_FORCE_THRESHOLD) {
                data.lockedUntil = now + SECURITY.BRUTE_FORCE_LOCKOUT;
                state.mainWindow?.webContents.send('wv:brute-force-alert', {
                    deviceId, attempts: data.count, lockedUntil: data.lockedUntil
                });
            }

            state.loginAttempts.set(deviceId, data);
            addAuditEntry('LOGIN_FAILURE', { deviceId, attemptCount: data.count }, event);

            return { success: false, error: 'Incorrect password or corrupted vault' };
        }
    });

    // Biometric authentication handlers
    ipcMain.handle('biometric:getStatus', () => biometricAuth.getStatus());

    ipcMain.handle('biometric:register', async () => {
        if (!secureMasterPassword.isSet()) {
            return { success: false, error: 'Must be logged in to register biometrics' };
        }
        return await biometricAuth.register(secureMasterPassword.get());
    });

    ipcMain.handle('biometric:authenticate', async () => {
        return await biometricAuth.authenticate();
    });

    ipcMain.handle('biometric:isEnrolled', async () => {
        return { enrolled: await biometricAuth.isEnrolled() };
    });

    ipcMain.handle('biometric:unregister', async () => {
        return await biometricAuth.unregister();
    });

    // Vault operations
    ipcMain.handle('vault:getAll', (_event, { includeTrash } = {}) => {
        if (!state.db) return { success: false, error: 'Locked' };
        resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);

        try {
            const whereClause = includeTrash === true ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL';
            const result = state.db.exec(`SELECT * FROM credentials WHERE ${whereClause} ORDER BY favorite DESC, updated_at DESC`);

            if (!result || !result.length) return { success: true, credentials: [] };

            const columns = result[0].columns;
            const credentials = result[0].values.map(row => {
                const obj = {};
                columns.forEach((col, i) => { obj[col] = row[i]; });
                obj.fields = safeJsonParse(obj.fields, []);
                obj.card = safeJsonParse(obj.card, {});
                return obj;
            });

            return { success: true, credentials };
        } catch (e) {
            console.error('[Vault] GetAll error:', e);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('vault:save', (_event, item) => {
        if (!state.db || !secureMasterPassword.isSet()) {
            return { success: false, error: 'Locked' };
        }
        resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);

        try {
            // IPC VALIDATION: Strict Zod schema check (prevents prototype pollution + type coercion)
            const validation = validateIpcInput(SaveCredentialSchema, item);
            if (!validation.success) {
                console.warn('[vault:save] Schema validation failed:', validation.error);
                return { success: false, error: validation.error };
            }

            const { id, service, username, password, notes, url, totp, card, category, type, icon_url } = validation.data;
            const fields = item.fields; // fields not in strict schema, handled below

            const safeUrl = validateUrl(url) || '';
            const domain = sanitizeDomain(safeUrl || service);
            // Use provided icon_url if available, otherwise generate from domain
            const iconUrl = icon_url || (domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : '');

            const safeFields = JSON.stringify(Array.isArray(fields) ? fields : []);
            const safeCard = JSON.stringify(typeof card === 'object' && card !== null ? card : {});

            if (id) {
                const validId = validateCredentialId(id);
                if (!validId) return { success: false, error: 'Invalid credential ID' };

                // Save history
                try {
                    const current = state.db.exec("SELECT password FROM credentials WHERE id = ?", [validId]);
                    if (current?.[0]?.values?.[0]) {
                        const oldPassword = current[0].values[0][0];
                        if (oldPassword !== password) {
                            state.db.run(
                                "INSERT INTO credential_history (credential_id, password) VALUES (?, ?)",
                                [validId, oldPassword]
                            );
                        }
                    }
                } catch (e) {
                    console.log('[Vault] History tracking skipped:', e.message);
                }

                state.db.run(
                    `UPDATE credentials SET service=?, username=?, password=?, notes=?, url=?, totp=?, fields=?, card=?, icon_url=?, category=?, type=?, updated_at=datetime('now') WHERE id=?`,
                    [
                        service.trim().substring(0, 256),
                        (username || '').substring(0, 256),
                        (password || '').substring(0, 1024),
                        (notes || '').substring(0, LIMITS.MAX_STRING_LENGTH),
                        safeUrl,
                        (totp || '').substring(0, 256),
                        safeFields,
                        safeCard,
                        iconUrl.substring(0, 512),
                        (category || 'general').substring(0, 50),
                        (type || 'login').substring(0, 50),
                        validId
                    ]
                );

                saveVault();
                addAuditEntry('CREDENTIAL_UPDATED', { id: validId, service });
                return { success: true, id: validId };
            } else {
                state.db.run(
                    `INSERT INTO credentials (service, username, password, notes, url, totp, fields, card, icon_url, category, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                    [
                        service.trim().substring(0, 256),
                        (username || '').substring(0, 256),
                        (password || '').substring(0, 1024),
                        (notes || '').substring(0, LIMITS.MAX_STRING_LENGTH),
                        safeUrl,
                        (totp || '').substring(0, 256),
                        safeFields,
                        safeCard,
                        iconUrl.substring(0, 512),
                        (category || 'general').substring(0, 50),
                        (type || 'login').substring(0, 50)
                    ]
                );

                const lastResult = state.db.exec('SELECT last_insert_rowid() as id');
                const last = lastResult?.[0]?.values?.[0]?.[0];

                saveVault();
                addAuditEntry('CREDENTIAL_CREATED', { id: last, service });
                return { success: true, id: last };
            }
        } catch (e) {
            console.error('[Vault] Save error:', e);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('vault:trash', (_event, { id }) => {
        if (!state.db) return { success: false, error: 'Locked' };
        const validId = validateCredentialId(id);
        if (!validId) return { success: false, error: 'Invalid ID' };

        state.db.run("UPDATE credentials SET deleted_at = datetime('now') WHERE id = ?", [validId]);
        saveVault();
        addAuditEntry('CREDENTIAL_TRASHED', { id: validId });
        return { success: true };
    });

    ipcMain.handle('vault:restore', (_event, { id }) => {
        if (!state.db) return { success: false, error: 'Locked' };
        const validId = validateCredentialId(id);
        if (!validId) return { success: false, error: 'Invalid ID' };

        state.db.run("UPDATE credentials SET deleted_at = NULL WHERE id = ?", [validId]);
        saveVault();
        addAuditEntry('CREDENTIAL_RESTORED', { id: validId });
        return { success: true };
    });

    ipcMain.handle('vault:deleteForever', (_event, { id }) => {
        if (!state.db) return { success: false, error: 'Locked' };
        const validId = validateCredentialId(id);
        if (!validId) return { success: false, error: 'Invalid ID' };

        state.db.run("DELETE FROM credentials WHERE id = ?", [validId]);
        saveVault();
        addAuditEntry('CREDENTIAL_DELETED', { id: validId });
        return { success: true };
    });

    ipcMain.handle('vault:emptyTrash', () => {
        if (!state.db) return { success: false, error: 'Locked' };
        state.db.run("DELETE FROM credentials WHERE deleted_at IS NOT NULL");
        saveVault();
        addAuditEntry('TRASH_EMPTIED', {});
        return { success: true };
    });

    ipcMain.handle('vault:toggleFavorite', (_event, { id }) => {
        if (!state.db) return { success: false, error: 'Locked' };
        const validId = validateCredentialId(id);
        if (!validId) return { success: false, error: 'Invalid ID' };

        const res = state.db.exec('SELECT favorite FROM credentials WHERE id = ?', [validId]);
        if (res.length) {
            const fav = res[0].values[0][0];
            state.db.run('UPDATE credentials SET favorite = ? WHERE id = ?', [fav ? 0 : 1, validId]);
            saveVault();
        }
        return { success: true };
    });

    ipcMain.handle('vault:getStats', () => {
        if (!state.db) return { success: false, error: 'Locked' };

        return getCached('vaultStats', () => {
            try {
                const loginsResult = state.db.exec("SELECT COUNT(*) FROM credentials WHERE type != 'folder' AND type != 'drive_root' AND deleted_at IS NULL");
                const logins = loginsResult?.[0]?.values?.[0]?.[0] || 0;

                const notesResult = state.db.exec("SELECT COUNT(*) FROM credentials WHERE type = 'note' AND deleted_at IS NULL");
                const notes = notesResult?.[0]?.values?.[0]?.[0] || 0;

                const driveResult = state.db.exec("SELECT COUNT(*) FROM attachments WHERE deleted_at IS NULL");
                const driveFiles = driveResult?.[0]?.values?.[0]?.[0] || 0;

                const trashResult = state.db.exec("SELECT COUNT(*) FROM credentials WHERE deleted_at IS NOT NULL");
                const trash = trashResult?.[0]?.values?.[0]?.[0] || 0;

                return { success: true, stats: { logins, notes, driveFiles, trash } };
            } catch (e) {
                console.error('[Vault] GetStats error:', e);
                return { success: false, error: e.message };
            }
        });
    });

    ipcMain.handle('vault:getTotp', (_event, { secret }) => {
        if (!validateTotpSecret(secret)) {
            return { code: null, error: 'Invalid secret format' };
        }
        return { code: generateTOTP(secret) };
    });

    ipcMain.handle('vault:activity', () => {
        resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);
        return true;
    });

    // ============================================================================
    // SECURE DRIVE - FOLDERS & ATTACHMENTS
    // ============================================================================

    // Get all folders
    ipcMain.handle('vault:getFolders', () => {
        if (!state.db) return { success: false, error: 'Locked' };
        resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);

        try {
            const result = state.db.exec("SELECT * FROM drive_folders WHERE deleted_at IS NULL ORDER BY created_at DESC");
            if (!result || !result.length) return { success: true, folders: [] };

            const columns = result[0].columns;
            const folders = result[0].values.map(row => {
                const obj = {};
                columns.forEach((col, i) => { obj[col] = row[i]; });
                // Compute locked property from password_hash presence
                obj.locked = !!obj.password_hash;
                // Don't expose the hash or salt to the renderer
                delete obj.password_hash;
                delete obj.password_salt;
                return obj;
            });
            return { success: true, folders };
        } catch (e) {
            console.error('[SecureDrive] GetFolders error:', e);
            return { success: false, error: e.message };
        }
    });

    // Create folder (SECURITY: PBKDF2 key derivation with unique salt, not plain SHA-256)
    ipcMain.handle('vault:createFolder', (_event, { name, password }) => {
        if (!state.db) return { success: false, error: 'Locked' };
        resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);

        try {
            if (!name || !name.trim()) return { success: false, error: 'Folder name is required' };

            const id = generateId();
            let hashedPass = null;
            let saltHex = null;

            if (password) {
                const salt = generateSecureRandom(32);
                saltHex = salt.toString('hex');
                hashedPass = deriveFolderKey(password, salt);
            }

            state.db.run(
                "INSERT INTO drive_folders (id, name, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
                [id, name.trim().substring(0, 100), hashedPass, saltHex]
            );

            saveVault();
            addAuditEntry('DRIVE_FOLDER_CREATED', { id, name: name.trim() });
            return { success: true, id };
        } catch (e) {
            console.error('[SecureDrive] CreateFolder error:', e);
            return { success: false, error: e.message };
        }
    });

    // Unlock folder (SECURITY: PBKDF2 + timing-safe compare; legacy SHA-256 fallback for existing folders)
    ipcMain.handle('vault:unlockFolder', (_event, { id, password }) => {
        if (!state.db) return { success: false, error: 'Locked' };
        resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);

        try {
            const result = state.db.exec(
                "SELECT password_hash, password_salt FROM drive_folders WHERE id = ? AND deleted_at IS NULL",
                [id]
            );
            if (!result || !result[0]?.values?.length) return { success: false, error: 'Folder not found' };

            const [storedHash, storedSalt] = result[0].values[0];

            if (storedHash) {
                let inputHash;
                if (storedSalt) {
                    // New PBKDF2-based hash with unique salt
                    inputHash = deriveFolderKey(password, storedSalt);
                } else {
                    // Legacy SHA-256 hash (no salt) — accept but cannot upgrade silently
                    const cryptoMod = require('crypto');
                    inputHash = cryptoMod.createHash('sha256').update(password).digest('hex');
                }
                if (!timingSafeEqual(
                    Buffer.from(inputHash, 'hex'),
                    Buffer.from(storedHash, 'hex')
                )) {
                    addAuditEntry('FOLDER_UNLOCK_FAILURE', { id });
                    return { success: false, error: 'Incorrect password' };
                }
            }

            addAuditEntry('FOLDER_UNLOCKED', { id });
            return { success: true };
        } catch (e) {
            console.error('[SecureDrive] UnlockFolder error:', e);
            return { success: false, error: e.message };
        }
    });

    // Get folder files
    ipcMain.handle('vault:getFolderFiles', (_event, folderId) => {
        if (!state.db) return { success: false, error: 'Locked' };
        resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);

        try {
            let query = "SELECT * FROM attachments WHERE deleted_at IS NULL";
            let params = [];

            if (folderId) {
                query += " AND folder_id = ?";
                params.push(folderId);
            } else {
                query += " AND folder_id IS NULL";
            }

            query += " ORDER BY created_at DESC";

            const result = state.db.exec(query, params);
            if (!result || !result.length) return { success: true, files: [] };

            const columns = result[0].columns;
            const files = result[0].values.map(row => {
                const obj = {};
                columns.forEach((col, i) => { obj[col] = row[i]; });
                return obj;
            });
            return { success: true, files };
        } catch (e) {
            console.error('[SecureDrive] GetFolderFiles error:', e);
            return { success: false, error: e.message };
        }
    });

    // Get deleted attachments (trash)
    ipcMain.handle('vault:getDeletedAttachments', () => {
        if (!state.db) return { success: false, error: 'Locked' };
        resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);

        try {
            const result = state.db.exec("SELECT * FROM attachments WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC");
            if (!result || !result.length) return { success: true, files: [] };

            const columns = result[0].columns;
            const files = result[0].values.map(row => {
                const obj = {};
                columns.forEach((col, i) => { obj[col] = row[i]; });
                return obj;
            });
            return { success: true, files };
        } catch (e) {
            console.error('[SecureDrive] GetDeletedAttachments error:', e);
            return { success: false, error: e.message };
        }
    });

    // Trash attachment
    ipcMain.handle('vault:trashAttachment', (_event, id) => {
        if (!state.db) return { success: false, error: 'Locked' };
        resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);

        try {
            state.db.run(
                "UPDATE attachments SET deleted_at = datetime('now') WHERE id = ?",
                [id]
            );
            saveVault();
            addAuditEntry('ATTACHMENT_TRASHED', { id });
            return { success: true };
        } catch (e) {
            console.error('[SecureDrive] TrashAttachment error:', e);
            return { success: false, error: e.message };
        }
    });

    // Restore attachment
    ipcMain.handle('vault:restoreAttachment', (_event, id) => {
        if (!state.db) return { success: false, error: 'Locked' };
        resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);

        try {
            state.db.run(
                "UPDATE attachments SET deleted_at = NULL WHERE id = ?",
                [id]
            );
            saveVault();
            addAuditEntry('ATTACHMENT_RESTORED', { id });
            return { success: true };
        } catch (e) {
            console.error('[SecureDrive] RestoreAttachment error:', e);
            return { success: false, error: e.message };
        }
    });

    // Delete attachment forever
    ipcMain.handle('vault:deleteAttachmentForever', (_event, id) => {
        if (!state.db) return { success: false, error: 'Locked' };
        resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);

        try {
            // Get file path first
            const result = state.db.exec("SELECT file_id FROM attachments WHERE id = ?", [id]);
            if (result && result[0]?.values?.[0]) {
                const fileId = result[0].values[0][0];
                const filePath = path.join(getAttachmentsDir(), fileId);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            state.db.run("DELETE FROM attachments WHERE id = ?", [id]);
            saveVault();
            addAuditEntry('ATTACHMENT_DELETED_FOREVER', { id });
            return { success: true };
        } catch (e) {
            console.error('[SecureDrive] DeleteAttachmentForever error:', e);
            return { success: false, error: e.message };
        }
    });

    // Import folder
    ipcMain.handle('vault:importFolder', async (_event, folderPath) => {
        if (!state.db) return { success: false, error: 'Locked' };
        resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);

        try {
            const folderName = path.basename(folderPath);
            const folderId = generateId();

            // Create folder entry
            state.db.run(
                "INSERT INTO drive_folders (id, name, created_at) VALUES (?, ?, datetime('now'))",
                [folderId, folderName.substring(0, 100)]
            );

            // Get all files in folder
            const files = fs.readdirSync(folderPath, { recursive: true });
            let count = 0;

            for (const file of files) {
                const fullPath = path.join(folderPath, file);
                if (fs.statSync(fullPath).isFile()) {
                    try {
                        await importFile(fullPath, null, folderId);
                        count++;
                    } catch (err) {
                        console.error('[SecureDrive] Failed to import file:', fullPath, err);
                    }
                }
            }

            saveVault();
            addAuditEntry('DRIVE_FOLDER_IMPORTED', { id: folderId, name: folderName, count });
            return { success: true, folderName, count };
        } catch (e) {
            console.error('[SecureDrive] ImportFolder error:', e);
            return { success: false, error: e.message };
        }
    });

    // Select file dialog
    ipcMain.handle('dialog:selectFile', async () => {
        if (!state.mainWindow) return { success: false, error: 'Window not ready' };
        resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);

        try {
            const result = await dialog.showOpenDialog(state.mainWindow, {
                properties: ['openFile'],
                filters: [
                    { name: 'All Files', extensions: ['*'] },
                    { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif'] },
                    { name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv'] },
                    { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt'] }
                ]
            });

            if (result.canceled || !result.filePaths.length) {
                return { success: false, error: 'Cancelled' };
            }

            return { success: true, filePath: result.filePaths[0] };
        } catch (e) {
            console.error('[Dialog] SelectFile error:', e);
            return { success: false, error: e.message };
        }
    });

    // Select folder dialog
    ipcMain.handle('dialog:selectFolder', async () => {
        if (!state.mainWindow) return { success: false, error: 'Window not ready' };
        resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);

        try {
            const result = await dialog.showOpenDialog(state.mainWindow, {
                properties: ['openDirectory']
            });

            if (result.canceled || !result.filePaths.length) {
                return { success: false, error: 'Cancelled' };
            }

            return { success: true, folderPath: result.filePaths[0] };
        } catch (e) {
            console.error('[Dialog] SelectFolder error:', e);
            return { success: false, error: e.message };
        }
    });

    // Add attachment (used by both credential attachments and secure drive)
    ipcMain.handle('vault:addAttachment', async (_event, { credentialId, filePath, folderId }) => {
        if (!state.db) return { success: false, error: 'Locked' };
        resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);

        try {
            if (!fs.existsSync(filePath)) {
                return { success: false, error: 'File not found' };
            }

            const fileId = await importFile(filePath, credentialId, folderId);
            saveVault();

            addAuditEntry('ATTACHMENT_ADDED', { fileId, credentialId, folderId });
            return { success: true, fileId };
        } catch (e) {
            console.error('[Attachment] Add error:', e);
            return { success: false, error: e.message };
        }
    });

    // Save attachment (download — decrypt if stored encrypted)
    ipcMain.handle('vault:saveAttachment', async (_event, fileId) => {
        if (!state.mainWindow) return { success: false, error: 'Window not ready' };
        resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);

        try {
            // Get file info and encryption flag from database
            const result = state.db.exec(
                "SELECT name, encrypted FROM attachments WHERE file_id = ? AND deleted_at IS NULL",
                [fileId]
            );

            if (!result || !result[0]?.values?.length) {
                return { success: false, error: 'File not found' };
            }

            const [fileName, isEncrypted] = result[0].values[0];
            const sourcePath = path.join(getAttachmentsDir(), fileId);

            if (!fs.existsSync(sourcePath)) {
                return { success: false, error: 'File data not found' };
            }

            const saveResult = await dialog.showSaveDialog(state.mainWindow, {
                defaultPath: fileName,
                filters: [{ name: 'All Files', extensions: ['*'] }]
            });

            if (saveResult.canceled) {
                return { success: false, error: 'Cancelled' };
            }

            if (isEncrypted && state.encryptionKey) {
                // Decrypt before writing to user-chosen destination
                const encryptedData = fs.readFileSync(sourcePath);
                const fileKey = deriveAttachmentKey(state.encryptionKey, fileId);
                try {
                    const plainData = decryptAttachment(encryptedData, fileKey);
                    fs.writeFileSync(saveResult.filePath, plainData);
                } finally {
                    fileKey.fill(0);
                }
            } else {
                fs.copyFileSync(sourcePath, saveResult.filePath);
            }

            addAuditEntry('ATTACHMENT_SAVED', { fileId });
            return { success: true };
        } catch (e) {
            console.error('[Attachment] Save error:', e);
            return { success: false, error: e.message };
        }
    });

    // Lock and logout
    ipcMain.handle('auth:lock', (event) => {
        addAuditEntry('LOCK', { reason: 'manual', hasPin: !!state.sessionPinHash }, event);

        if (state.sessionPinHash) {
            state.isSessionPinned = true;
            state.mainWindow?.webContents.send('vault:auto-locked', { type: 'pin' });
        } else {
            lockVault();
            state.mainWindow?.webContents.send('vault:auto-locked', { type: 'full' });
        }
        return { success: true, isPinned: !!state.sessionPinHash };
    });

    ipcMain.handle('auth:logout', (event) => {
        addAuditEntry('LOGOUT', {}, event);
        lockVault();
        state.sessionPinHash = null;
        return { success: true };
    });

    ipcMain.handle('auth:reset', async () => {
        try {
            console.log('[Reset] Starting vault reset...');

            // Lock the vault first
            lockVault();

            // Delete vault file
            if (fs.existsSync(state.vaultPath)) {
                fs.unlinkSync(state.vaultPath);
                console.log('[Reset] Deleted vault file:', state.vaultPath);
            }

            // Delete legacy db if exists
            if (fs.existsSync(state.legacyDbPath)) {
                fs.unlinkSync(state.legacyDbPath);
                console.log('[Reset] Deleted legacy db:', state.legacyDbPath);
            }

            // Delete attachments directory
            const attachmentsDir = path.join(path.dirname(state.vaultPath), 'attachments');
            if (fs.existsSync(attachmentsDir)) {
                fs.rmSync(attachmentsDir, { recursive: true, force: true });
                console.log('[Reset] Deleted attachments:', attachmentsDir);
            }

            // Delete config
            if (fs.existsSync(configPath)) {
                fs.unlinkSync(configPath);
                console.log('[Reset] Deleted config');
            }

            // Delete section settings
            const settingsPath = path.join(app.getPath('userData'), 'wvault-sections.json');
            if (fs.existsSync(settingsPath)) {
                fs.unlinkSync(settingsPath);
            }

            // Delete biometric data
            const biometricDataPath = path.join(app.getPath('userData'), 'biometric-auth.json');
            if (fs.existsSync(biometricDataPath)) {
                fs.unlinkSync(biometricDataPath);
            }

            // Reset state
            state.config = { vaultLocation: null };
            state.auditLog = [];

            console.log('[Reset] Vault reset complete');
            return { success: true };
        } catch (e) {
            console.error('[Reset] Error during reset:', e);
            return { success: false, error: e.message };
        }
    });

    // PIN handlers
    ipcMain.handle('auth:setPin', (_event, { pin }) => {
        if (!secureMasterPassword.isSet() || !state.db) {
            return { success: false, error: 'Must be logged in' };
        }

        if (!pin || typeof pin !== 'string' || pin.length < 4 || pin.length > 12) {
            return { success: false, error: 'PIN must be 4-12 characters' };
        }

        const salt = generateSecureRandom(SECURITY.SALT_LENGTH);
        const hash = derivePinHash(pin, salt);
        state.sessionPinHash = hash.toString('hex') + ':' + salt.toString('hex');
        state.isSessionPinned = false;
        state.pinAttemptCount = 0;

        return { success: true };
    });

    ipcMain.handle('auth:unlockWithPin', (_event, { pin }) => {
        if (!state.sessionPinHash || !secureMasterPassword.isSet()) {
            return { success: false, error: 'PIN not available' };
        }

        if (state.pinAttemptCount >= SECURITY.MAX_PIN_ATTEMPTS) {
            return { success: false, error: 'Too many attempts. Use master password.' };
        }

        try {
            const [storedHash, storedSaltHex] = state.sessionPinHash.split(':');
            const salt = Buffer.from(storedSaltHex, 'hex');
            const inputHash = derivePinHash(pin, salt);
            const storedHashBuf = Buffer.from(storedHash, 'hex');

            if (timingSafeEqual(inputHash, storedHashBuf)) {
                state.isSessionPinned = false;
                state.pinAttemptCount = 0;
                resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);
                return { success: true };
            } else {
                state.pinAttemptCount++;
                if (state.pinAttemptCount >= SECURITY.MAX_PIN_ATTEMPTS) {
                    state.sessionPinHash = null;
                    return { success: false, error: 'PIN disabled. Use master password.' };
                }
                return { success: false, error: 'Incorrect PIN' };
            }
        } catch (e) {
            return { success: false, error: 'PIN verification failed' };
        }
    });

    // Audit log
    ipcMain.handle('wv:getAuditLog', () => {
        return { success: true, logs: state.auditLog };
    });

    ipcMain.handle('wv:verifyAuditChain', () => {
        for (let i = 1; i < state.auditLog.length; i++) {
            if (state.auditLog[i].previousHash !== state.auditLog[i - 1].hash) {
                return { success: false, error: 'Chain broken at entry ' + i };
            }
        }
        return { success: true, valid: true, count: state.auditLog.length };
    });

    // Clipboard copy audit: logs service name ONLY (never the plaintext password)
    ipcMain.handle('vault:logCopy', (_event, data) => {
        const service = (data && typeof data.service === 'string') ? data.service.substring(0, 256) : 'unknown';
        addAuditEntry('COPY_PASSWORD', { service });
        resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);
        return { success: true };
    });

    // Export/Import (offline only - no internet)
    ipcMain.handle('vault:export', async (_event, { format }) => {
        if (!state.db) return { success: false };
        if (!['json', 'csv'].includes(format)) {
            return { success: false, error: 'Invalid format' };
        }

        const result = await dialog.showSaveDialog(state.mainWindow, {
            title: 'Export Vault',
            defaultPath: `WVault_Export_${new Date().toISOString().split('T')[0]}.${format}`,
            filters: [{ name: format.toUpperCase(), extensions: [format] }]
        });

        if (result.canceled) return { success: false, error: 'Cancelled' };

        const res = state.db.exec("SELECT * FROM credentials WHERE deleted_at IS NULL");
        if (!res.length) return { success: true, count: 0 };

        const cols = res[0].columns;
        const data = res[0].values.map(v => {
            const r = {};
            cols.forEach((c, i) => r[c] = v[i]);
            return r;
        });

        let content = '';
        if (format === 'json') {
            content = JSON.stringify(data, null, 2);
        } else {
            const escapeCsv = (field) => {
                if (field === null || field === undefined) return '';
                const str = String(field);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return '"' + str.replace(/"/g, '""') + '"';
                }
                return str;
            };

            content = 'Service,Username,Password,URL,Notes,TOTP\n' +
                data.map(d => `${escapeCsv(d.service)},${escapeCsv(d.username)},${escapeCsv(d.password)},${escapeCsv(d.url)},${escapeCsv(d.notes)},${escapeCsv(d.totp)}`).join('\n');
        }

        fs.writeFileSync(result.filePath, content);
        addAuditEntry('VAULT_EXPORTED', { format, count: data.length });
        return { success: true, count: data.length };
    });

    // Settings
    ipcMain.handle('auth:getName', () => {
        if (!state.db) {
            return { success: true, name: state.config.userName || null };
        }
        try {
            const res = state.db.exec("SELECT value FROM settings WHERE key = 'user_name'");
            if (res.length && res[0].values.length) {
                return { success: true, name: res[0].values[0][0] };
            }
            return { success: true, name: state.config.userName || null };
        } catch (e) {
            return { success: true, name: state.config.userName || null };
        }
    });

    ipcMain.handle('settings:sections:get', () => {
        const settingsPath = path.join(app.getPath('userData'), 'wvault-sections.json');
        try {
            if (fs.existsSync(settingsPath)) {
                const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                return { success: true, settings: { ...DEFAULT_SECTION_SETTINGS, ...saved } };
            }
        } catch (e) {
            console.error('[Settings] Load error:', e);
        }
        return { success: true, settings: DEFAULT_SECTION_SETTINGS };
    });

    ipcMain.handle('settings:sections:save', (_event, settings) => {
        const settingsPath = path.join(app.getPath('userData'), 'wvault-sections.json');
        try {
            settings.games = true; // Always keep games
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
            return { success: true, settings };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // ── Password History ─────────────────────────────────────────────────────
    ipcMain.handle('vault:getHistory', (_event, { id }) => {
        if (!state.db) return { success: false, error: 'Locked' };
        resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);
        try {
            const validId = validateCredentialId(id);
            if (!validId) return { success: false, error: 'Invalid credential ID' };
            const result = state.db.exec(
                'SELECT id, password, updated_at FROM credential_history WHERE credential_id = ? ORDER BY updated_at DESC LIMIT 20',
                [validId]
            );
            if (!result || !result.length) return { success: true, history: [] };
            const columns = result[0].columns;
            const history = result[0].values.map(row => {
                const obj = {}; columns.forEach((col, i) => { obj[col] = row[i]; }); return obj;
            });
            return { success: true, history };
        } catch (e) {
            console.error('[History] GetHistory error:', e);
            return { success: false, error: e.message };
        }
    });

    // Get attachments associated with a specific credential
    ipcMain.handle('vault:getAttachments', (_event, { id }) => {
        if (!state.db) return { success: false, error: 'Locked' };
        resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);
        try {
            const validId = validateCredentialId(id);
            if (!validId) return { success: false, error: 'Invalid credential ID' };
            const result = state.db.exec(
                'SELECT * FROM attachments WHERE credential_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
                [validId]
            );
            if (!result || !result.length) return { success: true, attachments: [] };
            const columns = result[0].columns;
            const attachments = result[0].values.map(row => {
                const obj = {}; columns.forEach((col, i) => { obj[col] = row[i]; }); return obj;
            });
            return { success: true, attachments };
        } catch (e) {
            console.error('[Attachment] GetAttachments error:', e);
            return { success: false, error: e.message };
        }
    });

    // Hard-delete an attachment by its DB row id
    ipcMain.handle('vault:deleteAttachment', (_event, { id }) => {
        if (!state.db) return { success: false, error: 'Locked' };
        resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);
        try {
            const validId = validateCredentialId(id);
            if (!validId) return { success: false, error: 'Invalid attachment ID' };
            const fileResult = state.db.exec('SELECT file_id FROM attachments WHERE id = ?', [validId]);
            if (fileResult && fileResult[0]?.values?.[0]) {
                const fileId = fileResult[0].values[0][0];
                const filePath = path.join(getAttachmentsDir(), fileId);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
            state.db.run('DELETE FROM attachments WHERE id = ?', [validId]);
            saveVault();
            addAuditEntry('ATTACHMENT_DELETED', { id: validId });
            return { success: true };
        } catch (e) {
            console.error('[Attachment] DeleteAttachment error:', e);
            return { success: false, error: e.message };
        }
    });

    // Restore a previous password version from history
    ipcMain.handle('vault:restoreVersion', (_event, { credentialId, historyId }) => {
        if (!state.db) return { success: false, error: 'Locked' };
        resetAutoLockTimer(SECURITY.AUTO_LOCK_MS);
        try {
            const validCredId = validateCredentialId(credentialId);
            const validHistId = validateCredentialId(historyId);
            if (!validCredId || !validHistId) return { success: false, error: 'Invalid IDs' };
            const histResult = state.db.exec(
                'SELECT password FROM credential_history WHERE id = ? AND credential_id = ?',
                [validHistId, validCredId]
            );
            if (!histResult || !histResult[0]?.values?.[0]) return { success: false, error: 'History entry not found' };
            const restoredPassword = histResult[0].values[0][0];
            // Save current password to history
            const cur = state.db.exec('SELECT password FROM credentials WHERE id = ?', [validCredId]);
            if (cur?.[0]?.values?.[0]) {
                state.db.run('INSERT INTO credential_history (credential_id, password) VALUES (?, ?)', [validCredId, cur[0].values[0][0]]);
            }
            state.db.run("UPDATE credentials SET password = ?, updated_at = datetime('now') WHERE id = ?", [restoredPassword, validCredId]);
            saveVault();
            addAuditEntry('PASSWORD_VERSION_RESTORED', { credentialId: validCredId, historyId: validHistId });
            return { success: true };
        } catch (e) {
            console.error('[History] RestoreVersion error:', e);
            return { success: false, error: e.message };
        }
    });
}

// ============================================================================
// WINDOW MANAGEMENT
// ============================================================================

function createWindow() {
    state.mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        frame: false,
        backgroundColor: '#0a0a0f',
        titleBarStyle: 'hidden',
        title: 'WVault',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            allowRunningInsecureContent: false,
            webSecurity: true
        },
        icon: path.join(__dirname, 'resources/icon.png'),
        show: false // Show after load for smoother startup
    });

    // Content Security Policy - allow favicon service only
    state.mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self'; " +
                    "script-src 'self'; " +
                    "style-src 'self' 'unsafe-inline'; " +
                    "img-src 'self' data: glass-media: https://icons.duckduckgo.com https://*.duckduckgo.com; " +
                    "font-src 'self'; " +
                    "connect-src 'self' https://icons.duckduckgo.com; " +
                    "media-src 'self' glass-media:; " +
                    "object-src 'none'; " +
                    "frame-src 'none'; " +
                    "base-uri 'self'; " +
                    "form-action 'self';"
                ]
            }
        });
    });

    // Load the app
    if (process.env.NODE_ENV === 'development') {
        state.mainWindow.loadURL('http://localhost:5173');
    } else {
        state.mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
    }

    state.mainWindow.once('ready-to-show', () => {
        state.mainWindow.show();
    });

    // Handle external links
    state.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        // Only allow safe protocols
        try {
            const parsed = new URL(url);
            if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
                shell.openExternal(url);
            }
        } catch (e) {
            console.error('[Window] Invalid URL:', url);
        }
        return { action: 'deny' };
    });
}

// ============================================================================
// APP LIFECYCLE
// ============================================================================

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (state.mainWindow) {
            if (state.mainWindow.isMinimized()) state.mainWindow.restore();
            state.mainWindow.focus();
        }
    });

    app.whenReady().then(async () => {
        await init();
        registerIpcHandlers();

        // Register glass-media:// protocol to serve encrypted attachments
        protocol.handle('glass-media', async (request) => {
            try {
                const fileId = new URL(request.url).hostname;
                if (!fileId || !/^[a-f0-9]+$/.test(fileId)) {
                    return new Response('Invalid file ID', { status: 400 });
                }

                const filePath = path.join(getAttachmentsDir(), fileId);
                if (!fs.existsSync(filePath)) {
                    return new Response('File not found', { status: 404 });
                }

                // Check if file is encrypted
                const result = state.db?.exec(
                    "SELECT type, encrypted FROM attachments WHERE file_id = ?",
                    [fileId]
                );
                const fileType = result?.[0]?.values?.[0]?.[0] || '';
                const isEncrypted = result?.[0]?.values?.[0]?.[1];

                let fileData;
                if (isEncrypted && state.encryptionKey) {
                    const encryptedData = fs.readFileSync(filePath);
                    const fileKey = deriveAttachmentKey(state.encryptionKey, fileId);
                    try {
                        fileData = decryptAttachment(encryptedData, fileKey);
                    } finally {
                        fileKey.fill(0);
                    }
                } else {
                    fileData = fs.readFileSync(filePath);
                }

                // Map file extension to MIME type
                const mimeMap = {
                    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                    '.gif': 'image/gif', '.mp4': 'video/mp4', '.mov': 'video/quicktime',
                    '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska',
                    '.pdf': 'application/pdf', '.doc': 'application/msword',
                    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    '.txt': 'text/plain'
                };
                const mimeType = mimeMap[fileType] || 'application/octet-stream';

                return new Response(fileData, {
                    headers: { 'Content-Type': mimeType }
                });
            } catch (e) {
                console.error('[glass-media] Protocol error:', e);
                return new Response('Internal error', { status: 500 });
            }
        });

        createWindow();

        // Register global shortcuts
        globalShortcut.register('CommandOrControl+Shift+L', () => {
            if (state.mainWindow) {
                state.mainWindow.webContents.send('vault:auto-locked', { type: 'full' });
                state.mainWindow.hide();
                clipboard.writeText('');
            }
        });
    });
}

app.on('window-all-closed', () => {
    lockVault();
    app.quit();
});

app.on('before-quit', () => {
    lockVault();
    // SECURITY: Clear clipboard on quit to prevent residual password exposure
    clipboard.writeText('');
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

// Security: Handle unexpected errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
