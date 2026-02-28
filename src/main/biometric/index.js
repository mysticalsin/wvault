/**
 * ============================================================================
 * WVAULT BIOMETRIC AUTHENTICATION MODULE
 * ============================================================================
 * Cross-platform biometric authentication support
 * - Windows: Windows Hello (Windows 10+)
 * - macOS: Touch ID / Face ID (macOS 10.12.2+)
 * - Linux: fprintd (via dbus)
 * 
 * @module biometric
 * @version 5.1.0
 */

const { app } = require('electron');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Platform detection
const PLATFORM = {
    isWindows: process.platform === 'win32',
    isMacOS: process.platform === 'darwin',
    isLinux: process.platform === 'linux'
};

class BiometricAuth {
    constructor() {
        this.initialized = false;
        this.available = false;
        this.method = null;
        this.biometricDataPath = path.join(app.getPath('userData'), 'biometric-auth.json');
        this.biometricKey = null;
    }

    /**
     * Initialize biometric authentication
     * @returns {Promise<Object>} Initialization result
     */
    async initialize() {
        try {
            if (PLATFORM.isWindows) {
                await this.initializeWindowsHello();
            } else if (PLATFORM.isMacOS) {
                await this.initializeTouchID();
            } else if (PLATFORM.isLinux) {
                await this.initializeLinuxFingerprint();
            }
            
            this.initialized = true;
            return {
                success: true,
                available: this.available,
                method: this.method
            };
        } catch (error) {
            console.error('[Biometric] Initialization failed:', error);
            return {
                success: false,
                error: error.message,
                available: false
            };
        }
    }

    /**
     * Initialize Windows Hello
     */
    async initializeWindowsHello() {
        try {
            // Use node-windows-security for Windows Hello
            const WindowsSecurity = require('./windows-hello');
            const result = await WindowsSecurity.initialize();
            
            this.available = result.available;
            this.method = result.available ? 'windows-hello' : null;
            
            if (result.available) {
                console.log('[Biometric] Windows Hello initialized');
            }
        } catch (error) {
            console.log('[Biometric] Windows Hello not available:', error.message);
            this.available = false;
        }
    }

    /**
     * Initialize macOS Touch ID
     */
    async initializeTouchID() {
        try {
            const TouchID = require('./touch-id');
            const result = await TouchID.initialize();
            
            this.available = result.available;
            this.method = result.available ? 'touch-id' : null;
            
            if (result.available) {
                console.log('[Biometric] Touch ID initialized');
            }
        } catch (error) {
            console.log('[Biometric] Touch ID not available:', error.message);
            this.available = false;
        }
    }

    /**
     * Initialize Linux fingerprint (fprintd)
     */
    async initializeLinuxFingerprint() {
        try {
            const LinuxFingerprint = require('./linux-fingerprint');
            const result = await LinuxFingerprint.initialize();
            
            this.available = result.available;
            this.method = result.available ? 'fingerprint' : null;
            
            if (result.available) {
                console.log('[Biometric] Linux fingerprint initialized');
            }
        } catch (error) {
            console.log('[Biometric] Linux fingerprint not available:', error.message);
            this.available = false;
        }
    }

    /**
     * Check if biometric authentication is available
     * @returns {Object} Availability status
     */
    getStatus() {
        return {
            available: this.available,
            method: this.method,
            initialized: this.initialized,
            platform: process.platform
        };
    }

    /**
     * Register biometric authentication for vault
     * @param {string} masterPassword - Master password to protect with biometric
     * @returns {Promise<Object>} Registration result
     */
    async register(masterPassword) {
        if (!this.available) {
            return { success: false, error: 'Biometric authentication not available' };
        }

        try {
            // Generate a random biometric key
            this.biometricKey = crypto.randomBytes(32);
            
            // Encrypt master password with biometric key
            const encryptedPassword = this.encryptWithBiometricKey(masterPassword);
            
            // Perform biometric authentication to confirm
            const authResult = await this.authenticate();
            if (!authResult.success) {
                return { success: false, error: 'Biometric authentication failed' };
            }

            // Store encrypted password with biometric binding
            const biometricData = {
                enabled: true,
                method: this.method,
                encryptedPassword: encryptedPassword,
                createdAt: new Date().toISOString(),
                platform: process.platform
            };

            // Securely store biometric data
            await this.saveBiometricData(biometricData);

            return { success: true };
        } catch (error) {
            console.error('[Biometric] Registration failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Authenticate using biometrics and retrieve master password
     * @returns {Promise<Object>} Authentication result with password if successful
     */
    async authenticate() {
        if (!this.available) {
            return { success: false, error: 'Biometric authentication not available' };
        }

        try {
            let result;
            
            if (PLATFORM.isWindows) {
                const WindowsSecurity = require('./windows-hello');
                result = await WindowsSecurity.authenticate('Unlock WVault');
            } else if (PLATFORM.isMacOS) {
                const TouchID = require('./touch-id');
                result = await TouchID.authenticate('Unlock WVault');
            } else if (PLATFORM.isLinux) {
                const LinuxFingerprint = require('./linux-fingerprint');
                result = await LinuxFingerprint.authenticate();
            }

            if (result.success) {
                // Load and decrypt stored password
                const biometricData = await this.loadBiometricData();
                if (biometricData && biometricData.encryptedPassword) {
                    const password = this.decryptWithBiometricKey(biometricData.encryptedPassword);
                    return { success: true, password };
                }
            }

            return result;
        } catch (error) {
            console.error('[Biometric] Authentication failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if biometric auth is enrolled
     * @returns {Promise<boolean>} True if enrolled
     */
    async isEnrolled() {
        try {
            const data = await this.loadBiometricData();
            return data && data.enabled === true;
        } catch {
            return false;
        }
    }

    /**
     * Unregister biometric authentication
     * @returns {Promise<Object>} Unregistration result
     */
    async unregister() {
        try {
            if (fs.existsSync(this.biometricDataPath)) {
                fs.unlinkSync(this.biometricDataPath);
            }
            this.biometricKey = null;
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Encrypt data with biometric key
     * @private
     */
    encryptWithBiometricKey(data) {
        if (!this.biometricKey) {
            throw new Error('Biometric key not initialized');
        }
        
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.biometricKey, iv);
        
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return {
            data: encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    }

    /**
     * Decrypt data with biometric key
     * @private
     */
    decryptWithBiometricKey(encryptedObj) {
        if (!this.biometricKey) {
            throw new Error('Biometric key not initialized');
        }
        
        const iv = Buffer.from(encryptedObj.iv, 'hex');
        const authTag = Buffer.from(encryptedObj.authTag, 'hex');
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', this.biometricKey, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedObj.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    /**
     * Save biometric data securely
     * @private
     */
    async saveBiometricData(data) {
        // Use electron's safeStorage if available
        if (safeStorage && safeStorage.isEncryptionAvailable()) {
            const encrypted = safeStorage.encryptString(JSON.stringify(data));
            fs.writeFileSync(this.biometricDataPath, encrypted);
        } else {
            // Fallback: encrypt with OS-specific key
            const encrypted = this.encryptWithOSKey(JSON.stringify(data));
            fs.writeFileSync(this.biometricDataPath, encrypted);
        }
    }

    /**
     * Load biometric data securely
     * @private
     */
    async loadBiometricData() {
        if (!fs.existsSync(this.biometricDataPath)) {
            return null;
        }
        
        const encrypted = fs.readFileSync(this.biometricDataPath);
        
        if (safeStorage && safeStorage.isEncryptionAvailable()) {
            const decrypted = safeStorage.decryptString(encrypted);
            return JSON.parse(decrypted);
        } else {
            const decrypted = this.decryptWithOSKey(encrypted);
            return JSON.parse(decrypted);
        }
    }
}

// Singleton instance
const biometricAuth = new BiometricAuth();

module.exports = {
    biometricAuth,
    PLATFORM
};
