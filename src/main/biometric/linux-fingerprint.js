/**
 * Linux Fingerprint Authentication Implementation
 * Uses fprintd via dbus-send or fprintd-verify
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class LinuxFingerprint {
    constructor() {
        this.available = false;
        this.method = null; // 'fprintd' or 'libfprint'
    }

    /**
     * Initialize Linux fingerprint support
     */
    async initialize() {
        try {
            // Check if fprintd is installed
            const fprintdAvailable = await this.checkFprintd();
            
            if (fprintdAvailable) {
                this.available = true;
                this.method = 'fprintd';
                console.log('[LinuxFingerprint] fprintd detected');
            } else {
                // Check for alternative methods
                const libfprintAvailable = await this.checkLibfprint();
                if (libfprintAvailable) {
                    this.available = true;
                    this.method = 'libfprint';
                }
            }

            return { 
                available: this.available, 
                method: this.method 
            };
        } catch (error) {
            console.error('[LinuxFingerprint] Initialization error:', error);
            return { available: false, error: error.message };
        }
    }

    /**
     * Check if fprintd is available
     */
    checkFprintd() {
        return new Promise((resolve) => {
            const which = spawn('which', ['fprintd-verify'], { timeout: 5000 });
            
            which.on('close', (code) => {
                resolve(code === 0);
            });

            which.on('error', () => {
                resolve(false);
            });
        });
    }

    /**
     * Check if libfprint is available
     */
    checkLibfprint() {
        return new Promise((resolve) => {
            // Check for libfprint tools
            const check = spawn('which', ['fprint-list'], { timeout: 5000 });
            
            check.on('close', (code) => {
                resolve(code === 0);
            });

            check.on('error', () => {
                resolve(false);
            });
        });
    }

    /**
     * List available fingerprint devices
     */
    async listDevices() {
        return new Promise((resolve) => {
            const fprintd = spawn('fprintd-list', [process.env.USER || ''], { timeout: 5000 });
            
            let output = '';
            fprintd.stdout.on('data', (data) => {
                output += data.toString();
            });

            fprintd.on('close', () => {
                const devices = output.split('\n')
                    .filter(line => line.includes('device'))
                    .map(line => line.trim());
                resolve({ devices, count: devices.length });
            });

            fprintd.on('error', () => {
                resolve({ devices: [], count: 0 });
            });
        });
    }

    /**
     * Authenticate using fingerprint
     * @returns {Promise<Object>} Authentication result
     */
    async authenticate() {
        if (!this.available) {
            return { success: false, error: 'Fingerprint authentication not available' };
        }

        if (this.method === 'fprintd') {
            return this.authenticateFprintd();
        } else if (this.method === 'libfprint') {
            return this.authenticateLibfprint();
        }

        return { success: false, error: 'No fingerprint method available' };
    }

    /**
     * Authenticate using fprintd
     */
    authenticateFprintd() {
        return new Promise((resolve) => {
            // Use fprintd-verify for authentication
            const verify = spawn('fprintd-verify', [], { timeout: 60000 });
            
            let output = '';
            let errorOutput = '';
            
            verify.stdout.on('data', (data) => {
                output += data.toString();
            });

            verify.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            verify.on('close', (code) => {
                // fprintd-verify returns 0 on success
                if (code === 0 || output.includes('verify-match')) {
                    resolve({ success: true });
                } else {
                    resolve({ 
                        success: false, 
                        error: 'Fingerprint verification failed',
                        details: errorOutput || output
                    });
                }
            });

            verify.on('error', (error) => {
                resolve({ success: false, error: error.message });
            });
        });
    }

    /**
     * Authenticate using libfprint (fallback)
     */
    authenticateLibfprint() {
        return new Promise((resolve) => {
            // Try to use simple-verify if available
            const verify = spawn('simple-verify', [], { timeout: 60000 });
            
            let output = '';
            verify.stdout.on('data', (data) => {
                output += data.toString();
            });

            verify.on('close', (code) => {
                if (code === 0) {
                    resolve({ success: true });
                } else {
                    resolve({ success: false, error: 'Verification failed' });
                }
            });

            verify.on('error', () => {
                resolve({ success: false, error: 'simple-verify not available' });
            });
        });
    }

    /**
     * Check if user has enrolled fingerprints
     */
    async isEnrolled() {
        return new Promise((resolve) => {
            const fprintd = spawn('fprintd-list', [process.env.USER || ''], { timeout: 5000 });
            
            let output = '';
            fprintd.stdout.on('data', (data) => {
                output += data.toString();
            });

            fprintd.on('close', () => {
                // Check if any fingerprints are listed
                const hasPrints = output.includes('Finger') || 
                                  output.includes('finger') ||
                                  output.includes(' enrolled');
                resolve({ enrolled: hasPrints });
            });

            fprintd.on('error', () => {
                resolve({ enrolled: false });
            });
        });
    }

    /**
     * Get enrollment status
     */
    async getEnrollmentStatus() {
        return new Promise((resolve) => {
            const fprintd = spawn('fprintd-list', [process.env.USER || ''], { timeout: 5000 });
            
            let output = '';
            fprintd.stdout.on('data', (data) => {
                output += data.toString();
            });

            fprintd.on('close', () => {
                const lines = output.split('\n');
                const fingerprints = [];
                
                lines.forEach(line => {
                    if (line.includes('Finger')) {
                        const match = line.match(/Finger (\d+)/);
                        if (match) {
                            fingerprints.push(`finger-${match[1]}`);
                        }
                    }
                });

                resolve({
                    enrolled: fingerprints.length > 0,
                    fingerprints: fingerprints,
                    count: fingerprints.length
                });
            });

            fprintd.on('error', () => {
                resolve({ enrolled: false, fingerprints: [], count: 0 });
            });
        });
    }
}

// Export singleton
module.exports = new LinuxFingerprint();
