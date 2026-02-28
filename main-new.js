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

const { app, BrowserWindow, ipcMain, dialog, Menu, shell, clipboard, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

// Import modular components
const { 
    SECURITY, 
    SecureBuffer, 
    secureMasterPassword,
    deriveKey, 
    derivePinHash,
    encryptVault, 
    decryptVault,
    validatePasswordStrength,
    generateVaultId,
    timingSafeEqual
} = require('./src/main/security/crypto');

const { biometricAuth } = require('./src/main/biometric');
const { LIMITS, DEFAULT_SECTION_SETTINGS, THEMES } = require('./src/main/utils/constants');
const {
    sanitizeFileId,
    validateCredentialId,
    validateFolderId,
    validateUrl,
    sanitizeDomain,
    validateFileSize,
    safeJsonParse
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
    // SECURITY: Clear all sensitive data
    secureMasterPassword.clear();
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
    return await init();
}

function saveVault() {
    if (!state.db || !secureMasterPassword.isSet()) {
        console.error('[Save] Cannot save: db or password not set');
        return;
    }

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
            if (!item || typeof item !== 'object') {
                return { success: false, error: 'Invalid item data' };
            }

            const { id, service, username, password, notes, url, totp, fields, card, category, type } = item;

            if (!service || typeof service !== 'string' || !service.trim()) {
                return { success: false, error: 'Service name is required' };
            }

            const safeUrl = validateUrl(url) || '';
            const domain = sanitizeDomain(safeUrl || service);
            const iconUrl = domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : '';

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

    // Content Security Policy - offline only
    state.mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self'; " +
                    "script-src 'self'; " +
                    "style-src 'self' 'unsafe-inline'; " +
                    "img-src 'self' data:; " +  // No external images
                    "font-src 'self'; " +
                    "connect-src 'self'; " +  // No external connections
                    "media-src 'self'; " +
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
        createWindow();

        // Register global shortcuts
        globalShortcut.register('CommandOrControl+Shift+L', () => {
            if (state.mainWindow) {
                state.mainWindow.webContents.send('vault:auto-lock', { type: 'manual' });
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
