import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    Plus, X, Save, Trash2, Folder, Tag, MoreVertical, 
    Maximize2, Minimize2, ExternalLink, Search, ChevronDown,
    FileText, Edit3, Clock, FolderPlus, FolderX
} from 'lucide-react';

// Note Window Title Bar for pop-out mode
const NoteTitleBar = ({ title, onClose, onMinimize, onMaximize, isMaximized }) => (
    <div className="h-10 bg-black/40 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 select-none drag-region">
        <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-accent" />
            <span className="text-sm text-primary font-medium truncate max-w-[200px]">{title || 'Untitled Note'}</span>
        </div>
        <div className="flex items-center gap-2 no-drag">
            <button onClick={onMinimize} className="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center text-muted hover:text-primary transition-colors">
                <Minimize2 className="w-3 h-3" />
            </button>
            <button onClick={onMaximize} className="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center text-muted hover:text-primary transition-colors">
                <Maximize2 className="w-3 h-3" />
            </button>
            <button onClick={onClose} className="w-6 h-6 rounded hover:bg-red-500/20 flex items-center justify-center text-muted hover:text-red-400 transition-colors">
                <X className="w-3 h-3" />
            </button>
        </div>
    </div>
);

// Folder Selector Dropdown
const FolderSelector = ({ folders, selected, onSelect, onCreateFolder, onDeleteFolder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [showCreateInput, setShowCreateInput] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCreateFolder = () => {
        if (newFolderName.trim()) {
            onCreateFolder(newFolderName.trim());
            setNewFolderName('');
            setShowCreateInput(false);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-secondary transition-colors"
            >
                <Folder className="w-4 h-4 text-accent" />
                <span>{selected || 'Default'}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 glass-panel py-1 z-50 animate-slide-down">
                    {folders.map(folder => (
                        <div key={folder} className="flex items-center justify-between group">
                            <button
                                onClick={() => { onSelect(folder); setIsOpen(false); }}
                                className={`flex-1 flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                                    selected === folder ? 'bg-accent/10 text-accent' : 'text-secondary hover:bg-white/5'
                                }`}
                            >
                                <Folder className="w-3.5 h-3.5" />
                                {folder}
                            </button>
                            {folder !== 'Default' && (
                                <button
                                    onClick={() => onDeleteFolder(folder)}
                                    className="px-2 py-2 text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Delete folder"
                                >
                                    <FolderX className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    ))}
                    
                    {showCreateInput ? (
                        <div className="px-3 py-2 border-t border-white/5">
                            <div className="flex gap-1">
                                <input
                                    type="text"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    placeholder="Folder name"
                                    className="flex-1 bg-black/20 border border-white/10 rounded px-2 py-1 text-xs text-primary focus:outline-none focus:border-accent"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCreateFolder();
                                        if (e.key === 'Escape') setShowCreateInput(false);
                                    }}
                                />
                                <button
                                    onClick={handleCreateFolder}
                                    className="p-1 rounded bg-accent/20 text-accent hover:bg-accent/30"
                                >
                                    <Plus className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowCreateInput(true)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-primary hover:bg-white/5 border-t border-white/5 transition-colors"
                        >
                            <FolderPlus className="w-3.5 h-3.5" />
                            New Folder
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

// Tag Input Component
const TagInput = ({ tags, onChange }) => {
    const [input, setInput] = useState('');

    const addTag = () => {
        if (input.trim() && !tags.includes(input.trim())) {
            onChange([...tags, input.trim()]);
            setInput('');
        }
    };

    const removeTag = (tagToRemove) => {
        onChange(tags.filter(tag => tag !== tagToRemove));
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            {tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs">
                    <Tag className="w-3 h-3" />
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-red-400">
                        <X className="w-3 h-3" />
                    </button>
                </span>
            ))}
            <div className="flex items-center gap-1">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            addTag();
                        }
                    }}
                    placeholder="+ tag"
                    className="w-16 bg-transparent border-none text-xs text-secondary placeholder:text-muted/50 focus:outline-none focus:ring-0"
                />
            </div>
        </div>
    );
};

// Main Note Editor Component
export default function NoteEditor({ 
    noteId = null, 
    isPopup = false,
    onClose,
    onSave,
    onDelete
}) {
    const [note, setNote] = useState({
        id: null,
        title: '',
        content: '',
        folder: 'Default',
        tags: [],
        createdAt: null,
        updatedAt: null
    });
    const [folders, setFolders] = useState(['Default', 'Work', 'Personal', 'Ideas']);
    const [allNotes, setAllNotes] = useState([]);
    const [selectedNoteId, setSelectedNoteId] = useState(noteId);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const textareaRef = useRef(null);

    // Load note data
    useEffect(() => {
        loadNotes();
        if (noteId) {
            loadNote(noteId);
        }
    }, [noteId]);

    // Listen for note updates from main process (for popup windows)
    useEffect(() => {
        if (isPopup && window.wvault) {
            const unsubscribe = window.wvault.onNoteLoad((loadedNote) => {
                setNote(loadedNote);
            });
            return () => unsubscribe();
        }
    }, [isPopup]);

    const loadNotes = async () => {
        const res = await window.wvault.notesGetAll();
        if (res.success) {
            setAllNotes(res.notes);
            if (res.folders) setFolders(res.folders);
        }
    };

    const loadNote = async (id) => {
        if (!id || id === 'new') {
            setNote({
                id: null,
                title: '',
                content: '',
                folder: 'Default',
                tags: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            return;
        }
        const res = await window.wvault.notesGet(id);
        if (res.success && res.note) {
            setNote(res.note);
        }
    };

    const handleSave = async () => {
        if (!note.title.trim() && !note.content.trim()) return;
        
        setIsSaving(true);
        const res = await window.wvault.notesSave({
            id: note.id,
            title: note.title || 'Untitled Note',
            content: note.content,
            folder: note.folder,
            tags: note.tags
        });
        
        if (res.success) {
            setNote(prev => ({ ...prev, id: res.note.id, updatedAt: res.note.updatedAt }));
            loadNotes();
            onSave?.(res.note);
        }
        setIsSaving(false);
    };

    const handleDelete = async () => {
        if (!note.id) {
            onClose?.();
            return;
        }
        if (confirm('Delete this note?')) {
            const res = await window.wvault.notesDelete(note.id);
            if (res.success) {
                onDelete?.(note.id);
                onClose?.();
            }
        }
    };

    const handleCreateFolder = async (name) => {
        const res = await window.wvault.notesCreateFolder(name);
        if (res.success) {
            setFolders(res.folders);
        }
    };

    const handleDeleteFolder = async (name) => {
        if (confirm(`Delete folder "${name}"? Notes will be moved to Default.`)) {
            const res = await window.wvault.notesDeleteFolder(name);
            if (res.success) {
                setFolders(res.folders);
                if (note.folder === name) {
                    setNote(prev => ({ ...prev, folder: 'Default' }));
                }
            }
        }
    };

    const openInNewWindow = () => {
        window.wvault.notesOpenWindow(note.id || 'new');
    };

    // Auto-save debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (note.title || note.content) {
                handleSave();
            }
        }, 3000);
        return () => clearTimeout(timer);
    }, [note.title, note.content, note.folder, note.tags]);

    const filteredNotes = allNotes.filter(n => 
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Group notes by folder
    const notesByFolder = filteredNotes.reduce((acc, n) => {
        const folder = n.folder || 'Default';
        if (!acc[folder]) acc[folder] = [];
        acc[folder].push(n);
        return acc;
    }, {});

    return (
        <div className={`flex flex-col ${isPopup ? 'h-screen bg-bg-primary' : 'h-full'}`}>
            {/* Title Bar for popup mode */}
            {isPopup && (
                <NoteTitleBar
                    title={note.title}
                    onClose={() => window.wvault.notesCloseWindow()}
                    onMinimize={() => {}}
                    onMaximize={() => {}}
                    isMaximized={false}
                />
            )}

            <div className="flex-1 flex min-h-0">
                {/* Sidebar - Notes List */}
                <div className="w-64 border-r border-white/5 flex flex-col bg-black/10">
                    {/* Search */}
                    <div className="p-3 border-b border-white/5">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search notes..."
                                className="w-full bg-black/20 border border-white/5 rounded-lg pl-9 pr-3 py-2 text-sm text-primary placeholder:text-muted/50 focus:outline-none focus:border-accent/50"
                            />
                        </div>
                    </div>

                    {/* New Note Button */}
                    <div className="p-3 border-b border-white/5">
                        <button
                            onClick={() => {
                                setSelectedNoteId(null);
                                setNote({
                                    id: null,
                                    title: '',
                                    content: '',
                                    folder: 'Default',
                                    tags: [],
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString()
                                });
                            }}
                            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-sm font-medium"
                        >
                            <Plus className="w-4 h-4" />
                            New Note
                        </button>
                    </div>

                    {/* Notes List */}
                    <div className="flex-1 overflow-y-auto">
                        {Object.entries(notesByFolder).map(([folderName, folderNotes]) => (
                            <div key={folderName} className="mb-2">
                                <div className="px-3 py-1.5 text-xs font-medium text-muted/70 uppercase tracking-wider flex items-center gap-1">
                                    <Folder className="w-3 h-3" />
                                    {folderName}
                                </div>
                                {folderNotes.map(n => (
                                    <button
                                        key={n.id}
                                        onClick={() => {
                                            setSelectedNoteId(n.id);
                                            setNote(n);
                                        }}
                                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                            selectedNoteId === n.id 
                                                ? 'bg-accent/10 text-accent border-l-2 border-accent' 
                                                : 'text-secondary hover:bg-white/5 border-l-2 border-transparent'
                                        }`}
                                    >
                                        <div className="truncate font-medium">{n.title || 'Untitled'}</div>
                                        <div className="text-xs text-muted/60 truncate">
                                            {new Date(n.updatedAt).toLocaleDateString()}
                                            {n.tags.length > 0 && (
                                                <span className="ml-2">• {n.tags.length} tags</span>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ))}
                        
                        {filteredNotes.length === 0 && (
                            <div className="p-4 text-center text-muted text-sm">
                                {searchQuery ? 'No notes found' : 'No notes yet'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Editor Area */}
                <div className="flex-1 flex flex-col min-w-0 bg-bg-primary/50">
                    {/* Toolbar */}
                    <div className="h-14 border-b border-white/5 flex items-center justify-between px-4">
                        <div className="flex items-center gap-3">
                            <FolderSelector
                                folders={folders}
                                selected={note.folder}
                                onSelect={(folder) => setNote(prev => ({ ...prev, folder }))}
                                onCreateFolder={handleCreateFolder}
                                onDeleteFolder={handleDeleteFolder}
                            />
                            <TagInput
                                tags={note.tags}
                                onChange={(tags) => setNote(prev => ({ ...prev, tags }))}
                            />
                        </div>
                        
                        <div className="flex items-center gap-2">
                            {!isPopup && (
                                <button
                                    onClick={openInNewWindow}
                                    className="p-2 rounded-lg hover:bg-white/5 text-muted hover:text-primary transition-colors"
                                    title="Open in new window"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </button>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-sm font-medium disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                            {note.id && (
                                <button
                                    onClick={handleDelete}
                                    className="p-2 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-400 transition-colors"
                                    title="Delete note"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                            {!isPopup && onClose && (
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-lg hover:bg-white/5 text-muted hover:text-primary transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Title Input */}
                    <div className="px-6 pt-4">
                        <input
                            type="text"
                            value={note.title}
                            onChange={(e) => setNote(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Note title..."
                            className="w-full bg-transparent border-none text-2xl font-semibold text-primary placeholder:text-muted/30 focus:outline-none focus:ring-0"
                        />
                    </div>

                    {/* Content Textarea */}
                    <div className="flex-1 px-6 py-4 min-h-0">
                        <textarea
                            ref={textareaRef}
                            value={note.content}
                            onChange={(e) => setNote(prev => ({ ...prev, content: e.target.value }))}
                            placeholder="Start writing..."
                            className="w-full h-full bg-transparent border-none resize-none text-primary placeholder:text-muted/30 focus:outline-none focus:ring-0 leading-relaxed"
                            style={{ minHeight: '200px' }}
                        />
                    </div>

                    {/* Footer */}
                    <div className="h-8 border-t border-white/5 flex items-center justify-between px-4 text-xs text-muted/60">
                        <div className="flex items-center gap-4">
                            <span>{note.content.length} characters</span>
                            <span>{note.content.split(/\s+/).filter(Boolean).length} words</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {note.updatedAt && (
                                <>
                                    <Clock className="w-3 h-3" />
                                    <span>
                                        {note.id ? `Updated ${new Date(note.updatedAt).toLocaleString()}` : 'Not saved'}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
