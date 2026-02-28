import React, { useState, useEffect } from 'react';
import { Folder, Film, Lock, Unlock, Plus, Play, MoreVertical, X, Shield, HardDrive, FileText, Trash2 } from 'lucide-react';

export default function MediaGallery() {
    const [folders, setFolders] = useState([]);
    const [selectedFolder, setSelectedFolder] = useState(null); // null = root
    const [media, setMedia] = useState([]);
    const [unlockedFolders, setUnlockedFolders] = useState([]); // IDs of unlocked folders in this session
    const [playingMedia, setPlayingMedia] = useState(null);
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);

    // New Folder Form
    const [newFolderName, setNewFolderName] = useState('');
    const [newFolderPass, setNewFolderPass] = useState('');

    useEffect(() => {
        loadFolders();
        loadMedia();
    }, [selectedFolder]);

    const loadFolders = async () => {
        const res = await window.wvault.getFolders();
        if (res.success) setFolders(res.folders);
    };

    const loadMedia = async () => {
        if (selectedFolder === 'trash') {
            const res = await window.wvault.getDeletedAttachments();
            if (res.success) setMedia(res.files);
            return;
        }

        // If folder is locked and not unlocked, don't load
        if (selectedFolder && !unlockedFolders.includes(selectedFolder)) {
            // Find folder info to check lock status, if we didn't store it
            const f = folders.find(x => x.id === selectedFolder);
            if (f?.locked) {
                setMedia([]);
                return;
            }
        }

        const res = await window.wvault.getFolderFiles(selectedFolder);
        if (res.success) setMedia(res.files);
    };

    const handleCreateFolder = async (e) => {
        e.preventDefault();
        const res = await window.wvault.createFolder(newFolderName, newFolderPass);
        if (res.success) {
            setIsCreatingFolder(false);
            setNewFolderName('');
            setNewFolderPass('');
            loadFolders();
        } else {
            alert(res.error);
        }
    };

    const handleUnlock = async (id) => {
        const password = prompt("Enter Folder Password:");
        if (!password) return;

        const res = await window.wvault.unlockFolder(id, password);
        if (res.success) {
            setUnlockedFolders([...unlockedFolders, id]);
            setSelectedFolder(id);
        } else {
            alert("Incorrect Password");
        }
    };

    const handleFileAction = async (file) => {
        if (['.mp4', '.mov', '.avi', '.mkv'].includes(file.type)) {
            setPlayingMedia(file);
        } else if (['.png', '.jpg', '.jpeg', '.gif'].includes(file.type)) {
            setPlayingMedia(file);
        } else {
            if (confirm(`Download/Open "${file.name}"?`)) {
                await window.wvault.saveAttachment(file.id);
            }
        }
    };

    const handleImport = async () => {
        const fileRes = await window.wvault.selectFile();
        if (!fileRes.success) return;

        // If selectedFolder is set, pass it. credentialId is null to trigger "Secure Drive" container.
        const res = await window.wvault.addAttachment(null, fileRes.filePath, selectedFolder);
        if (res.success) {
            loadMedia();
        } else {
            alert(res.error);
        }
    };

    const handleImportFolder = async () => {
        const folderRes = await window.wvault.selectFolder();
        if (!folderRes.success) return;
        await processFolderImport(folderRes.folderPath);
    };

    const processFolderImport = async (path) => {
        const confirmImport = confirm(`Import and encrypt all files in "${path}"? This make take a moment.`);
        if (!confirmImport) return;

        const res = await window.wvault.importFolder(path);
        if (res.success) {
            alert(`Successfully imported folder "${res.folderName}" with ${res.count} encrypted files.`);
            loadFolders();
        } else {
            alert(res.error);
        }
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const items = [...e.dataTransfer.files];
        if (items.length === 0) return;

        // Simple heuristic: if no extension and size is 0 or mod count, might be folder, 
        // but Electron's File object has .path. We can check fs in main, but here we guess.
        // Actually, for now, let's treat them as files unless the user explicitly used the "Import Folder" button,
        // OR we try to detect.
        // Better: Just loop and import them as files. If it's a folder, `importFile` might fail or we need `importFolder`.
        // Limitation: HTML5 Drop API doesn't easily distinguish folders without `webkitGetAsEntry`.

        // Let's use `webkitGetAsEntry` if available for folder support
        const entries = [...e.dataTransfer.items].map(item => item.webkitGetAsEntry());

        for (const entry of entries) {
            if (entry.isFile) {
                const file = items.find(f => f.name === entry.name); // Match file
                if (file) await window.wvault.addAttachment(null, file.path, selectedFolder);
            } else if (entry.isDirectory) {
                // It's a folder!
                // We need the full path. `File` object for folder usually has path.
                const file = items.find(f => f.name === entry.name); // In Electron, File.path is full path
                if (file) await processFolderImport(file.path);
            }
        }
        loadMedia();
    };

    const [isDragging, setIsDragging] = useState(false);

    return (
        <div
            className={`flex h-full relative ${isDragging ? 'bg-accent/10' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
        >
            {/* Sidebar */}
            <div className="w-64 border-r border-white/5 p-4 flex flex-col">
                <h2 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <HardDrive className="w-4 h-4" /> Secure Drive
                </h2>

                <div className="space-y-1 flex-1">
                    <button
                        onClick={() => setSelectedFolder(null)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${!selectedFolder ? 'bg-accent text-white' : 'text-white/70 hover:bg-white/5'}`}
                    >
                        <HardDrive className="w-4 h-4" /> Root
                    </button>

                    {folders.map(folder => (
                        <button
                            key={folder.id}
                            onClick={() => {
                                if (folder.locked && !unlockedFolders.includes(folder.id)) {
                                    handleUnlock(folder.id);
                                } else {
                                    setSelectedFolder(folder.id);
                                }
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between group ${selectedFolder === folder.id ? 'bg-accent text-white' : 'text-white/70 hover:bg-white/5'}`}
                        >
                            <span className="flex items-center gap-2 truncate">
                                {folder.locked ? (unlockedFolders.includes(folder.id) ? <Unlock className="w-3 h-3 text-emerald-400" /> : <Lock className="w-3 h-3 text-amber-400" />) : <Folder className="w-3 h-3" />}
                                {folder.name}
                            </span>
                        </button>
                    ))}
                </div>

                <button
                    onClick={handleImport}
                    className="mt-2 w-full py-2 bg-accent/20 hover:bg-accent/30 border border-accent/30 rounded-lg text-xs text-accent hover:text-white transition-colors flex items-center justify-center gap-2 font-bold"
                >
                    <Plus className="w-3 h-3" /> Import File
                </button>

                <button
                    onClick={handleImportFolder}
                    className="mt-2 w-full py-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-lg text-xs text-indigo-300 hover:text-white transition-colors flex items-center justify-center gap-2 font-bold"
                >
                    <Folder className="w-3 h-3" /> Import Folder
                </button>

                <button
                    onClick={() => setIsCreatingFolder(true)}
                    className="mt-2 w-full py-2 border border-white/10 rounded-lg text-xs text-white/50 hover:text-white hover:border-white/30 transition-colors flex items-center justify-center gap-2"
                >
                    <Folder className="w-3 h-3" /> New Folder
                </button>

                <div className="mt-4 pt-4 border-t border-white/5">
                    <button
                        onClick={() => setSelectedFolder('trash')}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${selectedFolder === 'trash' ? 'bg-red-500/20 text-red-300' : 'text-white/50 hover:text-red-300 hover:bg-white/5'}`}
                    >
                        <Trash2 className="w-4 h-4" /> Trash
                    </button>
                </div>
            </div>

            {/* Main Grid */}
            <div className="flex-1 p-6 overflow-y-auto">
                {isCreatingFolder && (
                    <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl animate-fade-in">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-white">Create Secure Folder</h3>
                            <button onClick={() => setIsCreatingFolder(false)}><X className="w-4 h-4 text-white/50" /></button>
                        </div>
                        <form onSubmit={handleCreateFolder} className="space-y-3">
                            <input
                                type="text"
                                placeholder="Folder Name"
                                value={newFolderName}
                                onChange={e => setNewFolderName(e.target.value)}
                                className="w-full glass-input"
                                required
                            />
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                                <input
                                    type="password"
                                    placeholder="Lock Password (Optional)"
                                    value={newFolderPass}
                                    onChange={e => setNewFolderPass(e.target.value)}
                                    className="w-full glass-input pl-10"
                                />
                            </div>
                            <button type="submit" className="w-full glass-button bg-accent hover:bg-accent-light">Create Folder</button>
                        </form>
                    </div>
                )}

                {/* Trash View / Main Grid */}
                {selectedFolder === 'trash' ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                            <div className="flex items-center gap-3">
                                <Trash2 className="w-6 h-6 text-red-400" />
                                <div>
                                    <h3 className="font-bold text-red-200">Trash Bin</h3>
                                    <p className="text-xs text-red-200/60">Items here are deleted forever after 30 days (Manual empty required for now).</p>
                                </div>
                            </div>
                            {media.length > 0 && (
                                <button
                                    onClick={async () => {
                                        if (confirm("Permanently delete ALL items in Trash? This cannot be undone.")) {
                                            for (const file of media) {
                                                await window.wvault.deleteAttachmentForever(file.id);
                                            }
                                            loadMedia();
                                        }
                                    }}
                                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm font-bold border border-red-500/30 transition-colors"
                                >
                                    Empty Trash
                                </button>
                            )}
                        </div>

                        {media.length === 0 ? (
                            <div className="text-center mt-20 text-white/30">
                                <Trash2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                <p>Trash is empty.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {media.map(file => (
                                    <div key={file.id} className="relative group bg-red-900/10 rounded-xl border border-red-500/10 p-2">
                                        <div className="aspect-video bg-black/40 rounded-lg overflow-hidden flex items-center justify-center opacity-50 grayscale group-hover:grayscale-0 transition-all">
                                            {/* Thumbnail Preview */}
                                            {['.mp4', '.mov'].includes(file.type) ? (
                                                <video src={`glass-media://${file.file_id}`} className="w-full h-full object-cover" />
                                            ) : ['.png', '.jpg', '.jpeg', '.gif'].includes(file.type) ? (
                                                <img src={`glass-media://${file.file_id}`} className="w-full h-full object-cover" />
                                            ) : (
                                                <FileText className="w-8 h-8 text-white/30" />
                                            )}
                                        </div>
                                        <div className="mt-2 px-1">
                                            <div className="text-sm font-bold text-red-200 truncate">{file.name}</div>
                                            <div className="text-[10px] text-red-200/50">Deleted: {file.deleted_at?.split(' ')[0]}</div>
                                        </div>

                                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 rounded-xl">
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    await window.wvault.restoreAttachment(file.id);
                                                    loadMedia();
                                                }}
                                                className="px-4 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs font-bold border border-emerald-500/30 hover:bg-emerald-500/30 w-32"
                                            >
                                                Restore
                                            </button>
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (confirm("Permanently delete this file?")) {
                                                        await window.wvault.deleteAttachmentForever(file.id);
                                                        loadMedia();
                                                    }
                                                }}
                                                className="px-4 py-1.5 bg-red-500/20 text-red-300 rounded-lg text-xs font-bold border border-red-500/30 hover:bg-red-500/30 w-32"
                                            >
                                                Delete Forever
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {media.map(file => (
                                <div key={file.id} className="relative group cursor-pointer" onClick={() => handleFileAction(file)}>
                                    <div className="aspect-video bg-black/40 rounded-xl border border-white/5 overflow-hidden flex items-center justify-center relative">
                                        {/* Thumbnail Preview if possible, else Icon */}
                                        {['.mp4', '.mov'].includes(file.type) ? (
                                            <video src={`glass-media://${file.file_id}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                        ) : ['.png', '.jpg', '.jpeg', '.gif'].includes(file.type) ? (
                                            <img src={`glass-media://${file.file_id}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center text-white/30 group-hover:text-white/60 transition-colors">
                                                <FileText className="w-12 h-12 mb-2" />
                                                <span className="text-xs uppercase font-bold">{file.type.replace('.', '')}</span>
                                            </div>
                                        )}

                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 backdrop-blur-[1px]">
                                            {['.mp4', '.mov', '.avi'].includes(file.type) ? <Play className="w-12 h-12 text-white drop-shadow-lg" /> : <HardDrive className="w-8 h-8 text-white drop-shadow-lg" />}
                                        </div>

                                        {/* Soft Delete Action */}
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (confirm(`Move "${file.name}" to Trash?`)) {
                                                    await window.wvault.trashAttachment(file.id);
                                                    loadMedia();
                                                }
                                            }}
                                            className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500/80 rounded-full text-white/70 hover:text-white transition-all opacity-0 group-hover:opacity-100 scale-90 hover:scale-110"
                                            title="Move to Trash"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="mt-2 text-sm text-white/80 truncate px-1">{file.name}</div>
                                    <div className="text-[10px] text-white/40 px-1 uppercase tracking-wide">
                                        {(file.size / 1024 / 1024).toFixed(1)} MB
                                    </div>
                                </div>
                            ))}
                        </div>

                        {media.length === 0 && (
                            <div className="text-center mt-20 text-white/30">
                                <HardDrive className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                <p>No files found.</p>
                                <button onClick={handleImport} className="mt-4 text-accent text-sm hover:underline">How to add files?</button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Media/File Viewer Modal */}
            {playingMedia && (
                <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col animate-fade-in">
                    <div className="flex items-center justify-between p-4 z-50 bg-gradient-to-b from-black/80 to-transparent">
                        <h3 className="text-white font-bold">{playingMedia.name}</h3>
                        <button onClick={() => setPlayingMedia(null)} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-4">
                        {['.mp4', '.mov', '.avi'].includes(playingMedia.type) ? (
                            <video
                                src={`glass-media://${playingMedia.file_id}`}
                                controls
                                autoPlay
                                className="max-h-full max-w-full rounded-lg shadow-2xl"
                            />
                        ) : (
                            <img
                                src={`glass-media://${playingMedia.file_id}`}
                                className="max-h-full max-w-full rounded-lg shadow-2xl"
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
