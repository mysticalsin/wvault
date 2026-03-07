import React, { useState, useEffect, useRef } from 'react';
import {
    FolderLock, Lock, Unlock, Plus, FileDown, Trash2,
    File, Folder, Search, RotateCw, FolderPlus, FilePlus,
    Shield, AlertCircle, X, Check, Archive, Edit3
} from 'lucide-react';

export default function EncryptedVaultView() {
    const [isOpen, setIsOpen] = useState(false);
    const [vaultDir, setVaultDir] = useState('');
    const [files, setFiles] = useState([]);
    const [mode, setMode] = useState('closed'); // closed, create, login, open
    const [passphrase, setPassphrase] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFiles, setSelectedFiles] = useState(new Set());
    const [showRotateKey, setShowRotateKey] = useState(false);
    const [rotateError, setRotateError] = useState('');
    const [oldPass, setOldPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [newPassConfirm, setNewPassConfirm] = useState('');
    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        checkVaultState();
        return () => { mountedRef.current = false; };
    }, []);

    const checkVaultState = async () => {
        try {
            const res = await window.wvault.ev.isOpen();
            if (!mountedRef.current) return;
            if (res.isOpen) {
                setIsOpen(true);
                setVaultDir(res.vaultDir);
                setMode('open');
                loadFiles();
            }
        } catch (_) {}
    };

    const loadFiles = async () => {
        try {
            const res = await window.wvault.ev.list();
            if (!mountedRef.current) return;
            if (res.success) setFiles(res.files);
        } catch (_) {}
    };

    const handleCreate = async () => {
        if (!vaultDir) { setError('Select a location first'); return; }
        if (!passphrase || passphrase.length < 8) { setError('Passphrase must be at least 8 characters'); return; }
        if (passphrase !== confirmPass) { setError('Passphrases do not match'); return; }

        setLoading(true);
        setError('');
        try {
            const res = await window.wvault.ev.init(vaultDir, passphrase);
            if (res.success) {
                setIsOpen(true);
                setMode('open');
                setPassphrase('');
                setConfirmPass('');
                loadFiles();
                if (window.showToast) window.showToast('Encrypted vault created');
            } else {
                setError(res.error || 'Failed to create vault');
            }
        } catch (e) {
            setError(e.message);
        }
        setLoading(false);
    };

    const handleOpen = async () => {
        if (!vaultDir) { setError('Select a vault directory first'); return; }
        if (!passphrase) { setError('Enter your passphrase'); return; }

        setLoading(true);
        setError('');
        try {
            const res = await window.wvault.ev.open(vaultDir, passphrase);
            if (res.success) {
                setIsOpen(true);
                setMode('open');
                setPassphrase('');
                loadFiles();
                if (window.showToast) window.showToast(`Vault unlocked (${res.fileCount} files)`);
            } else {
                setError(res.error || 'Failed to open vault');
            }
        } catch (e) {
            setError(e.message);
        }
        setLoading(false);
    };

    const handleLock = async () => {
        try {
            await window.wvault.ev.lock();
        } catch (_) {}
        setIsOpen(false);
        setMode('closed');
        setFiles([]);
        setVaultDir('');
        setSelectedFiles(new Set());
        setSearchQuery('');
        setShowRotateKey(false);
        setConfirmDelete(false);
        if (window.showToast) window.showToast('Vault locked');
    };

    const handleSelectDir = async (isNew) => {
        const res = isNew
            ? await window.wvault.ev.selectNewVaultDir()
            : await window.wvault.ev.selectVaultDir();
        if (!res.canceled) {
            setVaultDir(res.path);
            setError('');
            if (!isNew && res.hasVault) {
                setMode('login');
            } else if (!isNew && !res.hasVault) {
                setError('No vault found in that directory. Create a new one or choose a different folder.');
            }
        }
    };

    const handleAddFiles = async () => {
        const res = await window.wvault.ev.selectFiles();
        if (res.canceled) return;

        setLoading(true);
        let added = 0;
        const errors = [];
        const addedPaths = [];
        for (const filePath of res.paths) {
            const result = await window.wvault.ev.addFile(filePath);
            if (result.success) {
                added++;
                addedPaths.push(filePath);
            } else {
                errors.push(result.error);
            }
        }
        await loadFiles();
        setLoading(false);

        if (errors.length > 0) {
            if (window.showToast) window.showToast(`${added} added, ${errors.length} failed: ${errors[0]}`);
        } else if (added > 0) {
            if (window.showToast) window.showToast(`${added} file(s) added`);
        }

        // Ask if user wants to delete the source files
        if (addedPaths.length > 0 && confirm(`${addedPaths.length} file(s) encrypted and added.\n\nDelete the original files?`)) {
            await window.wvault.deleteSourceFiles(addedPaths);
            if (window.showToast) window.showToast('Original files deleted');
        }
    };

    const handleAddFolder = async () => {
        const res = await window.wvault.ev.selectFolderToAdd();
        if (res.canceled) return;

        setLoading(true);
        const result = await window.wvault.ev.addFolder(res.path);
        await loadFiles();
        setLoading(false);
        if (result.success) {
            let msg = `${result.count} file(s) imported`;
            if (result.errors && result.errors.length > 0) {
                msg += ` (${result.errors.length} skipped)`;
            }
            if (window.showToast) window.showToast(msg);

            // Ask if user wants to delete the source folder
            if (result.count > 0 && confirm(`${result.count} file(s) encrypted and imported.\n\nDelete the original folder?`)) {
                await window.wvault.deleteSourceFolder(res.path);
                if (window.showToast) window.showToast('Original folder deleted');
            }
        } else {
            if (window.showToast) window.showToast('Import failed: ' + (result.error || 'Unknown error'));
        }
    };

    const handleExtract = async (fileId) => {
        const res = await window.wvault.ev.extract(fileId);
        if (res.success) {
            if (window.showToast) window.showToast('File extracted');
        } else if (res.error && res.error !== 'Canceled') {
            if (window.showToast) window.showToast('Extract failed: ' + res.error);
        }
    };

    const handleRemoveSelected = async () => {
        if (selectedFiles.size === 0) return;
        setLoading(true);
        const res = await window.wvault.ev.remove(Array.from(selectedFiles));
        setSelectedFiles(new Set());
        setConfirmDelete(false);
        await loadFiles();
        setLoading(false);
        if (res.success) {
            if (window.showToast) window.showToast('Files securely removed');
        } else {
            if (window.showToast) window.showToast('Remove failed: ' + (res.error || 'Unknown error'));
        }
    };

    const handleRename = async (fileId) => {
        if (!renameValue.trim()) {
            setRenamingId(null);
            setRenameValue('');
            return;
        }
        // Don't save if name unchanged
        const file = files.find(f => f.id === fileId);
        if (file && file.name === renameValue.trim()) {
            setRenamingId(null);
            setRenameValue('');
            return;
        }
        const res = await window.wvault.ev.rename(fileId, renameValue.trim());
        if (res.success) {
            setRenamingId(null);
            setRenameValue('');
            await loadFiles();
        }
    };

    const handleRotateKey = async () => {
        if (!oldPass || !newPass) { setRotateError('Fill in all fields'); return; }
        if (newPass !== newPassConfirm) { setRotateError('New passphrases do not match'); return; }
        if (newPass.length < 8) { setRotateError('New passphrase must be at least 8 characters'); return; }

        setLoading(true);
        setRotateError('');
        const res = await window.wvault.ev.rotateKey(oldPass, newPass);
        if (res.success) {
            setShowRotateKey(false);
            setOldPass('');
            setNewPass('');
            setNewPassConfirm('');
            setRotateError('');
            if (window.showToast) window.showToast('Master passphrase changed');
        } else {
            setRotateError(res.error || 'Failed to change passphrase');
        }
        setLoading(false);
    };

    const toggleSelect = (fileId) => {
        setSelectedFiles(prev => {
            const next = new Set(prev);
            if (next.has(fileId)) next.delete(fileId);
            else next.add(fileId);
            return next;
        });
    };

    const filteredFiles = files.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    };

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    // ── Closed State ──
    if (!isOpen && mode === 'closed') {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="max-w-md w-full space-y-6 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-fuchsia-500/20 flex items-center justify-center mx-auto ring-1 ring-emerald-400/20">
                        <FolderLock className="w-10 h-10 text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Encrypted File Vault</h2>
                        <p className="text-sm text-white/60 mt-1">
                            AES-256-GCM + Argon2id encrypted file containers
                        </p>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={() => setMode('create')}
                            className="w-full px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2 font-medium"
                        >
                            <Plus className="w-4 h-4" />
                            Create New Vault
                        </button>
                        <button
                            onClick={() => handleSelectDir(false)}
                            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/60 hover:bg-white/[0.08] transition-all flex items-center justify-center gap-2 font-medium"
                        >
                            <Unlock className="w-4 h-4" />
                            Open Existing Vault
                        </button>
                    </div>

                    <p className="text-[11px] text-white/60">
                        Compatible with Encrypted-Vault (Python) containers
                    </p>
                </div>
            </div>
        );
    }

    // ── Create / Login State ──
    if (!isOpen && (mode === 'create' || mode === 'login')) {
        const isCreate = mode === 'create';
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="max-w-md w-full space-y-5">
                    <button
                        onClick={() => { setMode('closed'); setError(''); setPassphrase(''); setConfirmPass(''); setVaultDir(''); }}
                        className="text-white/60 hover:text-white/60 text-sm flex items-center gap-1"
                    >
                        <X className="w-3 h-3" /> Back
                    </button>

                    <div className="text-center">
                        <Shield className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                        <h2 className="text-lg font-bold text-white">
                            {isCreate ? 'Create Encrypted Vault' : 'Unlock Vault'}
                        </h2>
                    </div>

                    {/* Vault Location */}
                    <div>
                        <label className="text-xs text-white/60 mb-1 block">Vault Location</label>
                        <div className="flex gap-2">
                            <div className="flex-1 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white/50 truncate">
                                {vaultDir || 'No location selected'}
                            </div>
                            <button
                                onClick={() => handleSelectDir(isCreate)}
                                className="px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/60 hover:bg-white/[0.1] text-sm"
                            >
                                Browse
                            </button>
                        </div>
                    </div>

                    {/* Passphrase */}
                    <div>
                        <label className="text-xs text-white/60 mb-1 block">
                            {isCreate ? 'Master Passphrase' : 'Passphrase'}
                        </label>
                        <input
                            type="password"
                            value={passphrase}
                            onChange={(e) => setPassphrase(e.target.value)}
                            placeholder="Enter passphrase..."
                            className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white text-sm focus:outline-none focus:border-emerald-400/40"
                            onKeyDown={(e) => e.key === 'Enter' && (isCreate ? handleCreate() : handleOpen())}
                            autoFocus
                        />
                    </div>

                    {/* Confirm (create only) */}
                    {isCreate && (
                        <div>
                            <label className="text-xs text-white/60 mb-1 block">Confirm Passphrase</label>
                            <input
                                type="password"
                                value={confirmPass}
                                onChange={(e) => setConfirmPass(e.target.value)}
                                placeholder="Confirm passphrase..."
                                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white text-sm focus:outline-none focus:border-emerald-400/40"
                                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            />
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <button
                        onClick={isCreate ? handleCreate : handleOpen}
                        disabled={loading}
                        className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500/80 to-fuchsia-500/80 text-white font-medium hover:from-emerald-500 hover:to-fuchsia-500 transition-all disabled:opacity-50"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                {isCreate ? 'Creating vault...' : 'Deriving key...'}
                            </span>
                        ) : (
                            isCreate ? 'Create Vault' : 'Unlock'
                        )}
                    </button>

                    {isCreate && (
                        <p className="text-[11px] text-white/60 text-center">
                            SHA3-512 + Argon2id (256 MiB) key derivation with AES-256-GCM per-file encryption
                        </p>
                    )}
                </div>
            </div>
        );
    }

    // ── Open Vault ──
    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/[0.04] flex items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FolderLock className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-white">File Vault</h2>
                        <p className="text-[11px] text-white/60 truncate">{vaultDir}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium flex-shrink-0">
                        {files.length} files
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-white/60 font-medium flex-shrink-0">
                        {formatSize(totalSize)}
                    </span>
                </div>

                <div className="flex items-center gap-1.5">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 text-white/60 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search..."
                            className="pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white text-xs w-44 focus:outline-none focus:border-emerald-400/30"
                        />
                    </div>
                    <button onClick={handleAddFiles} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-emerald-400 transition-colors" title="Add Files">
                        <FilePlus className="w-4 h-4" />
                    </button>
                    <button onClick={handleAddFolder} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-emerald-400 transition-colors" title="Add Folder">
                        <FolderPlus className="w-4 h-4" />
                    </button>
                    {selectedFiles.size > 0 && (
                        <button onClick={() => setConfirmDelete(true)} className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors" title="Remove Selected">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                    <button onClick={() => { setShowRotateKey(!showRotateKey); setRotateError(''); }} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-yellow-400 transition-colors" title="Change Passphrase">
                        <RotateCw className="w-4 h-4" />
                    </button>
                    <button onClick={handleLock} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-red-400 transition-colors" title="Lock Vault">
                        <Lock className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Delete Confirmation Banner */}
            {confirmDelete && (
                <div className="px-6 py-3 border-b border-white/[0.04] bg-red-500/[0.05] flex items-center gap-3">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-400 flex-1">
                        Permanently remove {selectedFiles.size} file(s)? Blob data will be securely overwritten. This cannot be undone.
                    </p>
                    <button onClick={handleRemoveSelected} disabled={loading}
                        className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 disabled:opacity-50">
                        {loading ? 'Removing...' : 'Remove'}
                    </button>
                    <button onClick={() => setConfirmDelete(false)}
                        className="p-1.5 rounded-lg text-white/60 hover:text-white/60">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Rotate Key Panel */}
            {showRotateKey && (
                <div className="px-6 py-3 border-b border-white/[0.04] bg-yellow-500/[0.03]">
                    <div className="flex items-end gap-3">
                        <div className="flex-1 space-y-2">
                            <p className="text-xs text-yellow-400 font-medium">Change Master Passphrase</p>
                            <div className="flex gap-2">
                                <input type="password" value={oldPass} onChange={e => setOldPass(e.target.value)}
                                    placeholder="Current passphrase"
                                    className="flex-1 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white text-xs focus:outline-none focus:border-yellow-400/30" />
                                <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
                                    placeholder="New passphrase"
                                    className="flex-1 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white text-xs focus:outline-none focus:border-yellow-400/30" />
                                <input type="password" value={newPassConfirm} onChange={e => setNewPassConfirm(e.target.value)}
                                    placeholder="Confirm new"
                                    className="flex-1 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white text-xs focus:outline-none focus:border-yellow-400/30" />
                            </div>
                        </div>
                        <button onClick={handleRotateKey} disabled={loading}
                            className="px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 text-xs font-medium hover:bg-yellow-500/30 disabled:opacity-50">
                            {loading ? 'Changing...' : 'Change'}
                        </button>
                        <button onClick={() => { setShowRotateKey(false); setRotateError(''); }}
                            className="p-1.5 rounded-lg text-white/60 hover:text-white/60">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    {rotateError && <p className="text-red-400 text-xs mt-2">{rotateError}</p>}
                </div>
            )}

            {/* File List */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading && (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                    </div>
                )}

                {!loading && filteredFiles.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-white/60">
                        <Archive className="w-12 h-12 mb-3" />
                        <p className="text-sm">{files.length === 0 ? 'Vault is empty' : 'No files match your search'}</p>
                        {files.length === 0 && (
                            <button onClick={handleAddFiles}
                                className="mt-3 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm hover:bg-emerald-500/20 transition-colors">
                                Add your first file
                            </button>
                        )}
                    </div>
                )}

                <div className="space-y-1">
                    {filteredFiles.map(file => (
                        <div
                            key={file.id}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer group ${
                                selectedFiles.has(file.id)
                                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                                    : 'hover:bg-white/[0.03] border border-transparent'
                            }`}
                            onClick={() => toggleSelect(file.id)}
                        >
                            {/* Checkbox */}
                            <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                selectedFiles.has(file.id)
                                    ? 'bg-emerald-500/30 border-emerald-400/50'
                                    : 'border-white/10 group-hover:border-white/20'
                            }`}>
                                {selectedFiles.has(file.id) && <Check className="w-3 h-3 text-emerald-400" />}
                            </div>

                            {/* Icon */}
                            {file.relpath
                                ? <Folder className="w-4 h-4 text-yellow-400/40 flex-shrink-0" />
                                : <File className="w-4 h-4 text-white/60 flex-shrink-0" />
                            }

                            {/* Name */}
                            <div className="flex-1 min-w-0">
                                {renamingId === file.id ? (
                                    <input
                                        type="text"
                                        value={renameValue}
                                        onChange={e => setRenameValue(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleRename(file.id);
                                            if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                                        }}
                                        onBlur={() => { setRenamingId(null); setRenameValue(''); }}
                                        onClick={e => e.stopPropagation()}
                                        className="bg-white/[0.06] border border-emerald-400/30 rounded px-2 py-0.5 text-sm text-white w-full focus:outline-none"
                                        autoFocus
                                    />
                                ) : (
                                    <>
                                        <p className="text-sm text-white/80 truncate">{file.name}</p>
                                        {file.relpath && (
                                            <p className="text-[10px] text-white/60 truncate">{file.relpath}</p>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Size */}
                            <span className="text-[10px] text-white/60 flex-shrink-0">{formatSize(file.size)}</span>

                            {/* Actions */}
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setRenamingId(file.id); setRenameValue(file.name); }}
                                    className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/60 hover:text-white/70 transition-all"
                                    title="Rename"
                                >
                                    <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleExtract(file.id); }}
                                    className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/60 hover:text-fuchsia-400 transition-all"
                                    title="Extract"
                                >
                                    <FileDown className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Status Bar */}
            <div className="px-6 py-2 border-t border-white/[0.04] flex items-center justify-between text-[10px] text-white/60">
                <span>
                    {selectedFiles.size > 0
                        ? `${selectedFiles.size} selected`
                        : `${files.length} files in vault`}
                </span>
                <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    AES-256-GCM + Argon2id
                </span>
            </div>
        </div>
    );
}
