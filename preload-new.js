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

    // Export (Offline only)
    export: (format) => ipcRenderer.invoke('vault:export', { format }),

    // Settings
    settingsSectionsGet: () => ipcRenderer.invoke('settings:sections:get'),
    settingsSectionsSave: (settings) => ipcRenderer.invoke('settings:sections:save', settings),

    // Audit
    getAuditLog: () => ipcRenderer.invoke('wv:getAuditLog'),
    verifyAuditChain: () => ipcRenderer.invoke('wv:verifyAuditChain'),

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
