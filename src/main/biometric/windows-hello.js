/**
 * Windows Hello Authentication Implementation
 * Uses Windows.Security.Credentials.UI API
 */

const { spawn } = require('child_process');
const path = require('path');

class WindowsHello {
    constructor() {
        this.available = false;
        this.userConsentVerifier = null;
    }

    /**
     * Initialize Windows Hello
     */
    async initialize() {
        try {
            // Check Windows version (Windows Hello requires Windows 10+)
            const os = require('os');
            const release = os.release();
            const majorVersion = parseInt(release.split('.')[0]);
            
            if (majorVersion < 10) {
                return { available: false, error: 'Windows 10 or later required' };
            }

            // Check if Windows Hello is available using PowerShell
            const checkResult = await this.checkAvailability();
            this.available = checkResult.available;
            
            return { available: this.available, method: 'windows-hello' };
        } catch (error) {
            console.error('[WindowsHello] Initialization error:', error);
            return { available: false, error: error.message };
        }
    }

    /**
     * Check Windows Hello availability using PowerShell
     */
    checkAvailability() {
        return new Promise((resolve) => {
            const psScript = `
                try {
                    $capable = [Windows.Security.Credentials.UI.UserConsentVerifier]::CheckAvailabilityAsync().AsTask().Result
                    if ($capable -eq 'Available' -or $capable -eq 'DeviceBusy') {
                        Write-Output 'AVAILABLE'
                    } else {
                        Write-Output 'NOT_AVAILABLE:' + $capable
                    }
                } catch {
                    Write-Output 'ERROR:' + $_.Exception.Message
                }
            `;

            const ps = spawn('powershell.exe', [
                '-NoProfile',
                '-ExecutionPolicy', 'Bypass',
                '-Command', psScript
            ], {
                windowsHide: true,
                timeout: 10000
            });

            let output = '';
            ps.stdout.on('data', (data) => {
                output += data.toString();
            });

            ps.stderr.on('data', (data) => {
                console.error('[WindowsHello] PowerShell error:', data.toString());
            });

            ps.on('close', (code) => {
                const result = output.trim();
                if (result === 'AVAILABLE') {
                    resolve({ available: true });
                } else {
                    resolve({ available: false, reason: result });
                }
            });

            ps.on('error', (error) => {
                console.error('[WindowsHello] Process error:', error);
                resolve({ available: false, error: error.message });
            });
        });
    }

    /**
     * Authenticate user with Windows Hello
     * @param {string} message - Message to display to user
     * @returns {Promise<Object>} Authentication result
     */
    async authenticate(message = 'Verify your identity') {
        if (!this.available) {
            return { success: false, error: 'Windows Hello not available' };
        }

        return new Promise((resolve) => {
            // Escape message for PowerShell
            const safeMessage = message.replace(/'/g, "''");
            
            const psScript = `
                Add-Type -AssemblyName System.Runtime.WindowsRuntime
                $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation$1' })[0]
                
                Function Await($WinRtTask, $ResultType) {
                    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
                    $netTask = $asTask.Invoke($null, @($WinRtTask))
                    $netTask.Wait(-1) | Out-Null
                    $netTask.Result
                }
                
                [Windows.Security.Credentials.UI.UserConsentVerifier, Windows.Security.Credentials.UI, ContentType = WindowsRuntime] | Out-Null
                
                try {
                    $consentResult = Await ([Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync('${safeMessage}')) ([Windows.Security.Credentials.UI.UserConsentVerificationResult])
                    
                    if ($consentResult -eq 'Verified') {
                        Write-Output 'SUCCESS'
                    } else {
                        Write-Output 'FAILED:' + $consentResult
                    }
                } catch {
                    Write-Output 'ERROR:' + $_.Exception.Message
                }
            `;

            const ps = spawn('powershell.exe', [
                '-NoProfile',
                '-ExecutionPolicy', 'Bypass',
                '-Command', psScript
            ], {
                windowsHide: true,
                timeout: 60000 // 1 minute timeout for user interaction
            });

            let output = '';
            ps.stdout.on('data', (data) => {
                output += data.toString();
            });

            ps.stderr.on('data', (data) => {
                console.error('[WindowsHello] Auth error:', data.toString());
            });

            ps.on('close', (code) => {
                const result = output.trim();
                if (result === 'SUCCESS') {
                    resolve({ success: true });
                } else if (result.startsWith('FAILED:')) {
                    resolve({ 
                        success: false, 
                        error: 'Authentication failed',
                        reason: result.replace('FAILED:', '')
                    });
                } else if (result.startsWith('ERROR:')) {
                    resolve({ 
                        success: false, 
                        error: result.replace('ERROR:', '')
                    });
                } else {
                    resolve({ success: false, error: 'Unknown error' });
                }
            });

            ps.on('error', (error) => {
                resolve({ success: false, error: error.message });
            });
        });
    }

    /**
     * Get Windows Hello capability info
     */
    async getCapabilityInfo() {
        return new Promise((resolve) => {
            const psScript = `
                try {
                    $capable = [Windows.Security.Credentials.UI.UserConsentVerifier]::CheckAvailabilityAsync().AsTask().Result
                    Write-Output $capable
                } catch {
                    Write-Output 'Error: ' + $_.Exception.Message
                }
            `;

            const ps = spawn('powershell.exe', [
                '-NoProfile',
                '-Command', psScript
            ], { windowsHide: true });

            let output = '';
            ps.stdout.on('data', (data) => {
                output += data.toString();
            });

            ps.on('close', () => {
                resolve({ capability: output.trim() });
            });
        });
    }
}

// Export singleton
module.exports = new WindowsHello();
