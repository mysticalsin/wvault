const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

console.log("Starting Vault Reset...");

// 1. Kill processes
try {
    console.log("Closing WVault...");
    execSync('taskkill /F /IM "WVault.exe" /T', { stdio: 'ignore' });
    execSync('taskkill /F /IM "electron.exe" /T', { stdio: 'ignore' });
} catch (e) {
    // Ignore errors if process wasn't running
}

// 2. Find paths
const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const vaultDir = path.join(appData, 'WVault');
const vaultFile = path.join(vaultDir, 'wvault.vault');
const dbFile = path.join(vaultDir, 'wvault.db');

// 3. Delete files
try {
    if (fs.existsSync(vaultFile)) {
        fs.unlinkSync(vaultFile);
        console.log(`Deleted: ${vaultFile}`);
    } else {
        console.log("Vault file not found (already deleted?)");
    }

    if (fs.existsSync(dbFile)) {
        fs.unlinkSync(dbFile);
        console.log(`Deleted: ${dbFile}`);
    }
} catch (e) {
    console.error("Error deleting files:", e.message);
}

console.log("Reset Complete. Please restart the app to create a new password.");
