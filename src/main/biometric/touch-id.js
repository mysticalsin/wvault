/**
 * macOS Touch ID / Face ID Authentication Implementation
 * Uses LocalAuthentication framework
 */

const { spawn } = require('child_process');

class TouchID {
    constructor() {
        this.available = false;
    }

    /**
     * Initialize Touch ID
     */
    async initialize() {
        try {
            // Check macOS version (Touch ID requires 10.12.2+)
            const os = require('os');
            const release = os.release();
            
            // macOS version detection
            const darwinVersion = parseFloat(release);
            if (darwinVersion < 16.3) { // macOS 10.12.2 = Darwin 16.3
                return { available: false, error: 'macOS 10.12.2 or later required' };
            }

            // Check if Touch ID is available
            const checkResult = await this.checkAvailability();
            this.available = checkResult.available;
            
            return { 
                available: this.available, 
                method: this.available ? 'touch-id' : 'password-only'
            };
        } catch (error) {
            console.error('[TouchID] Initialization error:', error);
            return { available: false, error: error.message };
        }
    }

    /**
     * Check Touch ID availability using osascript
     */
    checkAvailability() {
        return new Promise((resolve) => {
            // Use AppleScript to check if Touch ID is available
            const script = `
                try
                    tell application "System Events"
                        set touchIDAvailable to (do shell script "bioutil -r | grep -c 'Touch ID' || echo 0") as integer
                        if touchIDAvailable > 0 then
                            return true
                        else
                            return false
                        end if
                    end tell
                on error
                    return false
                end try
            `;

            const osa = spawn('osascript', ['-e', script], {
                timeout: 5000
            });

            let output = '';
            osa.stdout.on('data', (data) => {
                output += data.toString().trim();
            });

            osa.stderr.on('data', (data) => {
                // Silent fail - Touch ID might not be available
            });

            osa.on('close', () => {
                resolve({ available: output === 'true' });
            });

            osa.on('error', () => {
                resolve({ available: false });
            });
        });
    }

    /**
     * Authenticate user with Touch ID
     * @param {string} reason - Reason for authentication
     * @returns {Promise<Object>} Authentication result
     */
    async authenticate(reason = 'Unlock WVault') {
        if (!this.available) {
            return { success: false, error: 'Touch ID not available' };
        }

        return new Promise((resolve) => {
            // Escape reason for AppleScript
            const safeReason = reason.replace(/"/g, '\\"');
            
            // Use LocalAuthentication framework via Objective-C bridge
            // This is the most reliable method
            const script = `
                use framework "LocalAuthentication"
                use scripting additions
                
                set context to current application's LAContext's alloc()'s init()
                set reason to "${safeReason}"
                
                try
                    set {success, error} to context's evaluatePolicy:1 localizedReason:reason replyHandler:(missing value)
                    if success then
                        return "SUCCESS"
                    else
                        return "FAILED:" & (error's localizedDescription() as string)
                    end if
                on error errMsg
                    return "ERROR:" & errMsg
                end try
            `;

            // Alternative: Use bioutil command for simpler checks
            const bioutilScript = `
                do shell script "bioutil -s" 
                return "SUCCESS"
            `;

            const osa = spawn('osascript', ['-e', script], {
                timeout: 60000
            });

            let output = '';
            osa.stdout.on('data', (data) => {
                output += data.toString();
            });

            osa.stderr.on('data', (data) => {
                console.error('[TouchID] Auth stderr:', data.toString());
            });

            osa.on('close', (code) => {
                const result = output.trim();
                if (result === 'SUCCESS') {
                    resolve({ success: true });
                } else if (result.startsWith('FAILED:')) {
                    resolve({ 
                        success: false, 
                        error: result.replace('FAILED:', '').trim()
                    });
                } else if (result.startsWith('ERROR:')) {
                    resolve({ 
                        success: false, 
                        error: result.replace('ERROR:', '').trim()
                    });
                } else {
                    // Fallback to bioutil
                    resolve({ 
                        success: false, 
                        error: 'Authentication cancelled or failed'
                    });
                }
            });

            osa.on('error', (error) => {
                resolve({ success: false, error: error.message });
            });
        });
    }

    /**
     * Alternative authentication using CocoaDialog or similar
     * This is a fallback method
     */
    async authenticateFallback(reason = 'Unlock WVault') {
        return new Promise((resolve) => {
            // Create a simple dialog using osascript
            const script = `
                display dialog "${reason}" buttons {"Cancel", "Authenticate"} default button "Authenticate" with icon caution
            `;

            const osa = spawn('osascript', ['-e', script], {
                timeout: 60000
            });

            let output = '';
            osa.stdout.on('data', (data) => {
                output += data.toString();
            });

            osa.on('close', () => {
                if (output.includes('Authenticate')) {
                    resolve({ success: true });
                } else {
                    resolve({ success: false, error: 'User cancelled' });
                }
            });

            osa.on('error', (error) => {
                resolve({ success: false, error: error.message });
            });
        });
    }

    /**
     * Get enrolled fingerprints info
     */
    async getEnrolledFingerprints() {
        return new Promise((resolve) => {
            const bioutil = spawn('bioutil', ['-r'], { timeout: 5000 });
            
            let output = '';
            bioutil.stdout.on('data', (data) => {
                output += data.toString();
            });

            bioutil.on('close', () => {
                const lines = output.split('\n');
                const fingerprints = lines.filter(line => line.includes('Finger'));
                resolve({ 
                    enrolled: fingerprints.length > 0,
                    count: fingerprints.length,
                    details: fingerprints
                });
            });

            bioutil.on('error', () => {
                resolve({ enrolled: false, count: 0 });
            });
        });
    }
}

// Export singleton
module.exports = new TouchID();
