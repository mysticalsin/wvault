/**
 * WVault Preload Script
 * Secure bridge between renderer and main process
 * @version 5.1.0
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose secure API to renderer
contextBridge.exposeInMainWorld('wvault', {
    // Window Controls
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),

    // Auth
    authCheck: () => ipcRenderer.invoke('auth:check'),
    authSetup: (password, name) => ipcRenderer.invoke('auth:setup', { password, name }),
    authLogin: (password) => ipcRenderer.invoke('auth:login', { password }),
    authLock: () => ipcRenderer.invoke('auth:lock'),
    authLogout: () => ipcRenderer.invoke('auth:logout'),
    authReset: () => ipcRenderer.invoke('auth:reset'),
    authGetName: () => ipcRenderer.invoke('auth:getName'),

    // Biometric Authentication
    biometricGetStatus: () => ipcRenderer.invoke('biometric:getStatus'),
    biometricRegister: () => ipcRenderer.invoke('biometric:register'),
    biometricAuthenticate: () => ipcRenderer.invoke('biometric:authenticate'),
    biometricIsEnrolled: () => ipcRenderer.invoke('biometric:isEnrolled'),
    biometricUnregister: () => ipcRenderer.invoke('biometric:unregister'),

    // PIN
    authSetPin: (pin) => ipcRenderer.invoke('auth:setPin', { pin }),
    authUnlockWithPin: (pin) => ipcRenderer.invoke('auth:unlockWithPin', { pin }),

    // Vault Operations
    getAll: (opts) => ipcRenderer.invoke('vault:getAll', opts),
    save: (item) => ipcRenderer.invoke('vault:save', item),
    trash: (id) => ipcRenderer.invoke('vault:trash', { id }),
    restore: (id) => ipcRenderer.invoke('vault:restore', { id }),
    deleteForever: (id) => ipcRenderer.invoke('vault:deleteForever', { id }),
    emptyTrash: () => ipcRenderer.invoke('vault:emptyTrash'),
    toggleFavorite: (id) => ipcRenderer.invoke('vault:toggleFavorite', { id }),
    getStats: () => ipcRenderer.invoke('vault:getStats'),
    getTotp: (secret) => ipcRenderer.invoke('vault:getTotp', { secret }),
    activity: () => ipcRenderer.invoke('vault:activity'),

    // Password History & Attachments
    getHistory: (id) => ipcRenderer.invoke('vault:getHistory', { id }),
    getAttachments: (id) => ipcRenderer.invoke('vault:getAttachments', { id }),
    deleteAttachment: (id) => ipcRenderer.invoke('vault:deleteAttachment', { id }),
    restoreVersion: (credentialId, historyId) => ipcRenderer.invoke('vault:restoreVersion', { credentialId, historyId }),

    // QR scan stub — returns graceful error (no native camera API in Electron sandbox)
    scanQr: () => Promise.resolve({ success: false, error: 'QR scan not supported. Please enter the secret key manually.' }),

    // Settings
    settingsSectionsGet: () => ipcRenderer.invoke('settings:sections:get'),
    settingsSectionsSave: (settings) => ipcRenderer.invoke('settings:sections:save', settings),

    // Secure Drive / Attachments
    getFolders: () => ipcRenderer.invoke('vault:getFolders'),
    createFolder: (name, password) => ipcRenderer.invoke('vault:createFolder', { name, password }),
    unlockFolder: (id, password) => ipcRenderer.invoke('vault:unlockFolder', { id, password }),
    getFolderFiles: (folderId) => ipcRenderer.invoke('vault:getFolderFiles', folderId),
    getDeletedAttachments: () => ipcRenderer.invoke('vault:getDeletedAttachments'),
    trashAttachment: (id) => ipcRenderer.invoke('vault:trashAttachment', id),
    restoreAttachment: (id) => ipcRenderer.invoke('vault:restoreAttachment', id),
    deleteAttachmentForever: (id) => ipcRenderer.invoke('vault:deleteAttachmentForever', id),
    selectFile: () => ipcRenderer.invoke('dialog:selectFile'),
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
    addAttachment: (credentialId, filePath, folderId) => ipcRenderer.invoke('vault:addAttachment', { credentialId, filePath, folderId }),
    saveAttachment: (fileId) => ipcRenderer.invoke('vault:saveAttachment', fileId),
    importFolder: (folderPath) => ipcRenderer.invoke('vault:importFolder', folderPath),

    // Export
    exportVault: (format) => ipcRenderer.invoke('vault:export', { format }),

    // Audit
    getAuditLog: () => ipcRenderer.invoke('wv:getAuditLog'),
    verifyAuditChain: () => ipcRenderer.invoke('wv:verifyAuditChain'),
    logCopy: (service) => ipcRenderer.invoke('vault:logCopy', { service }),

    // Events
    onAutoLocked: (callback) => {
        const handler = (_event, data) => callback(data);
        ipcRenderer.on('vault:auto-locked', handler);
        return () => ipcRenderer.removeListener('vault:auto-locked', handler);
    },
    onAuditEvent: (callback) => {
        const handler = (_event, data) => callback(data);
        ipcRenderer.on('wv:audit-event', handler);
        return () => ipcRenderer.removeListener('wv:audit-event', handler);
    },
    onBruteForceAlert: (callback) => {
        const handler = (_event, data) => callback(data);
        ipcRenderer.on('wv:brute-force-alert', handler);
        return () => ipcRenderer.removeListener('wv:brute-force-alert', handler);
    }
});

// Security: Disable eval and other dangerous APIs
delete window.eval;
