/**
 * Encrypted-Vault IPC Handlers
 * Registers all IPC channels for the encrypted vault feature
 *
 * @module encrypted-vault/ipc
 */

const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const ops = require('./ops');
const { isArgon2Available } = require('./crypto');

function registerEncryptedVaultHandlers() {
    ipcMain.handle('ev:checkArgon2', () => {
        return { available: isArgon2Available() };
    });

    ipcMain.handle('ev:isOpen', () => {
        return { isOpen: ops.isOpen(), vaultDir: ops.getVaultDir() };
    });

    ipcMain.handle('ev:init', async (_, { vaultDir, passphrase }) => {
        try {
            return await ops.initVault(vaultDir, passphrase);
        } catch (e) {
            console.error('[EV:init] Error:', e.message, '\n', e.stack);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('ev:open', async (_, { vaultDir, passphrase }) => {
        try {
            return await ops.openVault(vaultDir, passphrase);
        } catch (e) {
            console.error('[EV:open] Error:', e.message, '\n', e.stack);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('ev:lock', () => {
        try {
            return ops.lockVault();
        } catch (_) {
            return { success: true }; // lock must never fail from UI perspective
        }
    });

    ipcMain.handle('ev:list', () => {
        try {
            return { success: true, files: ops.listFiles() };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('ev:addFile', async (_, { filePath }) => {
        try {
            return await ops.addFile(filePath);
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('ev:addFolder', async (_, { folderPath }) => {
        try {
            return await ops.addFolder(folderPath);
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // Extract: show save dialog FIRST, only decrypt if user picks a location
    ipcMain.handle('ev:extract', async (_, { fileId }) => {
        try {
            // Get file info without decrypting
            const info = ops.getFileInfo(fileId);

            // Ask user where to save before decrypting
            const result = await dialog.showSaveDialog({
                defaultPath: info.name,
                title: 'Extract File',
            });
            if (result.canceled) return { success: false, error: 'Canceled' };

            // Now decrypt
            const { data } = ops.extractFile(fileId);
            fs.writeFileSync(result.filePath, data);
            return { success: true, path: result.filePath };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('ev:remove', async (_, { fileIds }) => {
        try {
            return await ops.removeFiles(fileIds);
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('ev:rename', async (_, { fileId, newName }) => {
        try {
            return await ops.renameFile(fileId, newName);
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('ev:rotateKey', async (_, { oldPass, newPass }) => {
        try {
            return await ops.rotateKey(oldPass, newPass);
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('ev:selectVaultDir', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'Select Encrypted Vault Directory',
        });
        if (result.canceled) return { canceled: true };

        const vaultFile = path.join(result.filePaths[0], 'vault.enc');
        const hasVault = fs.existsSync(vaultFile);
        return { canceled: false, path: result.filePaths[0], hasVault };
    });

    ipcMain.handle('ev:selectNewVaultDir', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'Choose Location for New Vault',
        });
        if (result.canceled) return { canceled: true };
        return { canceled: false, path: result.filePaths[0] };
    });

    ipcMain.handle('ev:selectFiles', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            title: 'Select Files to Add to Vault',
        });
        if (result.canceled) return { canceled: true };
        return { canceled: false, paths: result.filePaths };
    });

    ipcMain.handle('ev:selectFolderToAdd', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'Select Folder to Add to Vault',
        });
        if (result.canceled) return { canceled: true };
        return { canceled: false, path: result.filePaths[0] };
    });
}

module.exports = { registerEncryptedVaultHandlers };
