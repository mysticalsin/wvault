import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import LoginScreen from './components/LoginScreen';
import PinScreen from './components/PinScreen';
import AddEditModal from './components/AddEditModal';
import ImportModal from './components/ImportModal';
import ConfirmDialog from './components/ConfirmDialog';
import GlassOverlay from './components/GlassOverlay';

// OPTIMIZATION: Lazy load heavy components for better initial load time
const VaultView = lazy(() => import('./components/VaultView'));
const GeneratorView = lazy(() => import('./components/GeneratorView'));
const SettingsView = lazy(() => import('./components/SettingsView'));
const AuditView = lazy(() => import('./components/AuditView'));
const MediaGallery = lazy(() => import('./components/MediaGallery.jsx'));
const NoteEditor = lazy(() => import('./components/NoteEditor'));

// Loading fallback component
const PageLoader = () => (
    <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
    </div>
);

export default function App() {
    // ── ALL hooks must be declared before any conditional return (React Rules of Hooks) ──

    // Overlay / Note popup routing
    const [isOverlay, setIsOverlay] = useState(window.location.hash === '#overlay');
    const [isNoteMode, setIsNoteMode] = useState(window.location.hash === '#note');

    // Auth / vault state
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const [isSetup, setIsSetup] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [stats, setStats] = useState({ total: 0, weak: 0, reused: 0, strong: 0, trash: 0 });
    const [view, setView] = useState('home');
    const [modals, setModals] = useState({ add: false, import: false, confirm: null });
    const [editItem, setEditItem] = useState(null);
    const [userName, setUserName] = useState('');

    // ─── Hash change → overlay/note routing ───
    useEffect(() => {
        const handleHashChange = () => {
            setIsOverlay(window.location.hash === '#overlay');
            setIsNoteMode(window.location.hash === '#note');
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // ─── Clipboard Security ───
    const secureCopy = useCallback((text, label = 'Content') => {
        navigator.clipboard.writeText(text).catch(() => { });
        // AUDIT: record copy event (service/label only, never the value)
        window.wvault.logCopy?.(label);
        if (window.showToast) {
            window.showToast(`${label} copied (clears in 30s)`);
        }
        // Clear after 30s
        setTimeout(() => {
            navigator.clipboard.readText().then(current => {
                if (current === text) navigator.clipboard.writeText('');
            }).catch(() => { });
        }, 30000);
    }, []);

    // ─── Load User Name ───
    // SECURITY: Not cached in localStorage to prevent information leakage
    const loadUserName = useCallback(async () => {
        try {
            const res = await window.wvault.authGetName();
            if (res.success && res.name) {
                setUserName(res.name);
                return res.name;
            }
        } catch (e) {
            console.error('Failed to load user name:', e);
        }
        return '';
    }, []);

    // ─── Keyboard Shortcuts ───
    useEffect(() => {
        // SECURITY: Clean up old user name entries from localStorage
        localStorage.removeItem('wvault-user-name');
        localStorage.removeItem('glassvault-user-name');

        // Restore Theme
        const savedTheme = localStorage.getItem('wvault-theme') || localStorage.getItem('glassvault-theme');
        if (savedTheme) {
            document.documentElement.style.setProperty('--accent', savedTheme);
            document.documentElement.style.setProperty('--accent-glow', `rgba(${savedTheme}, 0.25)`);
        }

        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                window.wvault.authLock().then(() => setIsAuthenticated(false));
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                setEditItem(null);
                setModals(m => ({ ...m, add: true }));
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                document.querySelector('input[type="text"]')?.focus();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === ',') {
                e.preventDefault();
                setView('settings');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // ─── Data Loading ───
    const loadVault = useCallback(async () => {
        const trashMode = view === 'trash';
        const res = await window.wvault.getAll({ includeTrash: trashMode });
        if (res.success) setItems(res.credentials);

        const s = await window.wvault.getStats();
        if (s.success) setStats(s.stats);
    }, [view]);

    useEffect(() => {
        const checkAuth = async () => {
            const { isSetup: setup, isPinned: pinned } = await window.wvault.authCheck();
            setIsSetup(setup);
            if (pinned) setIsPinned(true);
            setIsLoading(false);
        };
        checkAuth();

        const cleanup = window.wvault.onAutoLocked((data) => {
            if (data?.type === 'pin') {
                setIsAuthenticated(false);
                setIsPinned(true);
            } else {
                setIsAuthenticated(false);
                setIsPinned(false);
            }
            if (window.showToast) window.showToast('Vault auto-locked');
        });

        const ping = () => window.wvault.activity();
        window.addEventListener('mousemove', ping);
        window.addEventListener('keydown', ping);

        return () => {
            cleanup();
            window.removeEventListener('mousemove', ping);
            window.removeEventListener('keydown', ping);
        };
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            loadVault();
            loadUserName();
        }
    }, [isAuthenticated, view, loadVault, loadUserName]);

    // ─── Handlers ───
    const handleSave = async (data) => {
        console.log('Saving item:', data);
        const res = await window.wvault.save(data);
        if (res.success) {
            setModals(m => ({ ...m, add: false }));
            setEditItem(null);
            loadVault();
            if (window.showToast) window.showToast(data.id ? 'Item updated' : 'Password saved successfully');
        } else {
            console.error('Save failed:', res.error);
            if (window.showToast) window.showToast('Error: ' + (res.error || 'Failed to save'));
            else alert('Error: ' + (res.error || 'Failed to save password'));
        }
    };

    const handleDelete = async (id) => {
        if (view === 'trash') {
            await window.wvault.deleteForever(id);
            if (window.showToast) window.showToast('Permanently deleted');
        } else {
            await window.wvault.trash(id);
            if (window.showToast) window.showToast('Moved to Trash');
        }
        setModals(m => ({ ...m, confirm: null }));
        loadVault();
    };

    const handleRestore = async (id) => {
        await window.wvault.restore(id);
        if (window.showToast) window.showToast('Item restored');
        loadVault();
    };

    const handleEmptyTrash = async () => {
        await window.wvault.emptyTrash();
        if (window.showToast) window.showToast('Trash emptied');
        loadVault();
    };

    const handleSetup = async (name) => {
        setUserName(name);
        setIsSetup(true);
        setIsAuthenticated(true);
        if (window.showToast) window.showToast(`Welcome to WVault, ${name}! Your world is secured.`);
    };

    const handleLogin = async () => {
        setIsAuthenticated(true);
        await loadUserName();
    };

    // ─── Conditional renders — SAFE: all hooks are already declared above ───
    if (isOverlay) return <GlassOverlay />;
    if (isNoteMode) return (
        <Suspense fallback={<PageLoader />}>
            <NoteEditor isPopup={true} />
        </Suspense>
    );

    if (isLoading) return <div className="h-full w-full bg-bg-primary" />;

    if (isPinned) {
        return (
            <PinScreen
                onUnlock={() => { setIsPinned(false); setIsAuthenticated(true); }}
                onLogout={() => { window.wvault.authLock(); setIsPinned(false); setIsAuthenticated(false); }}
            />
        );
    }

    if (!isAuthenticated) {
        return (
            <LoginScreen
                isFirstRun={!isSetup}
                onLogin={handleLogin}
                onSetup={handleSetup}
            />
        );
    }

    let content;
    switch (view) {
        case 'home':
            content = (
                <Dashboard
                    items={items}
                    stats={stats}
                    userName={userName}
                    onNavigate={setView}
                    onAdd={() => { setEditItem(null); setModals(m => ({ ...m, add: true })); }}
                    onLock={async () => {
                        try {
                            const result = await window.wvault.authLock();
                            console.log('[Lock] Result:', result);
                            const authCheck = await window.wvault.authCheck();
                            if (authCheck.isPinned) {
                                setIsPinned(true);
                                setIsAuthenticated(false);
                            } else {
                                setIsAuthenticated(false);
                                setIsPinned(false);
                            }
                            if (window.showToast) window.showToast('Vault locked');
                        } catch (err) {
                            console.error('[Lock] Failed:', err);
                            if (window.showToast) window.showToast('Failed to lock vault');
                        }
                    }}
                />
            );
            break;
        case 'generator':
            content = (
                <Suspense fallback={<PageLoader />}>
                    <GeneratorView />
                </Suspense>
            );
            break;
        case 'settings':
            content = (
                <Suspense fallback={<PageLoader />}>
                    <SettingsView
                        stats={stats}
                        onExport={(fmt) => window.wvault.exportVault(fmt)}
                        onEmptyTrash={handleEmptyTrash}
                        onDeleteAll={() => { }}
                        onSetPin={async (pin) => {
                            await window.wvault.authSetPin(pin);
                            if (window.showToast) window.showToast('Session PIN set');
                        }}
                    />
                </Suspense>
            );
            break;
        case 'audit':
            content = (
                <Suspense fallback={<PageLoader />}>
                    <AuditView
                        items={items}
                        onEdit={(item) => { setEditItem(item); setModals(m => ({ ...m, add: true })); }}
                    />
                </Suspense>
            );
            break;
        case 'media':
            content = (
                <Suspense fallback={<PageLoader />}>
                    <MediaGallery />
                </Suspense>
            );
            break;
        case 'notes':
            content = (
                <Suspense fallback={<PageLoader />}>
                    <NoteEditor
                        onSave={(note) => {
                            if (window.showToast) window.showToast(`Note "${note.title}" saved`);
                        }}
                        onClose={() => setView('home')}
                    />
                </Suspense>
            );
            break;
        case 'trash':
            content = (
                <Suspense fallback={<PageLoader />}>
                    <VaultView
                        items={items}
                        typeFilter="all"
                        onAdd={() => { }}
                        onEdit={(item) => setModals({ ...modals, confirm: { type: 'restore', item } })}
                        onDelete={(item) => setModals({ ...modals, confirm: { type: 'delete', item } })}
                        onToggleFavorite={() => { }}
                        showToast={window.showToast}
                        onCopy={secureCopy}
                        isTrashView={true}
                    />
                </Suspense>
            );
            break;
        default: {
            const typeFilter = view === 'vault' ? 'all' : view === 'logins' ? 'login' : view === 'cards' ? 'card' : 'all';
            content = (
                <Suspense fallback={<PageLoader />}>
                    <VaultView
                        items={items}
                        typeFilter={typeFilter}
                        onAdd={() => { setEditItem(null); setModals(m => ({ ...m, add: true })); }}
                        onEdit={(item) => { setEditItem(item); setModals(m => ({ ...m, add: true })); }}
                        onDelete={(item) => setModals(m => ({ ...m, confirm: { type: 'trash', item } }))}
                        onToggleFavorite={async (id) => { await window.wvault.toggleFavorite(id); loadVault(); }}
                        showToast={window.showToast}
                        onCopy={secureCopy}
                    />
                </Suspense>
            );
        }
    }

    return (
        <Layout
            activeView={view}
            onViewChange={(newView) => {
                if (newView === 'import') {
                    setModals(m => ({ ...m, import: true }));
                } else {
                    setView(newView);
                }
            }}
            stats={stats}
            onLock={async () => {
                try {
                    const result = await window.wvault.authLock();
                    console.log('[Layout Lock] Result:', result);
                    const authCheck = await window.wvault.authCheck();
                    if (authCheck.isPinned) {
                        setIsPinned(true);
                        setIsAuthenticated(false);
                    } else {
                        setIsAuthenticated(false);
                        setIsPinned(false);
                    }
                    if (window.showToast) window.showToast('Vault locked');
                } catch (err) {
                    console.error('[Layout Lock] Failed:', err);
                    if (window.showToast) window.showToast('Failed to lock vault');
                }
            }}
            onSettings={() => setView('settings')}
        >
            {content}

            {modals.add && (
                <AddEditModal
                    isOpen={modals.add}
                    onClose={() => { setModals(m => ({ ...m, add: false })); setEditItem(null); }}
                    onSave={handleSave}
                    initialData={editItem}
                    defaultType={view === 'cards' ? 'card' : view === 'notes' ? 'note' : 'login'}
                />
            )}

            {modals.confirm && (
                <ConfirmDialog
                    isOpen={!!modals.confirm}
                    title={modals.confirm.type === 'trash' ? 'Move to Trash?' : modals.confirm.type === 'restore' ? 'Restore Item?' : 'Delete Forever?'}
                    message={`Are you sure you want to ${modals.confirm.type === 'trash' ? 'trash' : modals.confirm.type === 'restore' ? 'restore' : 'permanently delete'} "${modals.confirm.item.service}"?`}
                    confirmLabel={modals.confirm.type === 'trash' ? 'Trash' : modals.confirm.type === 'restore' ? 'Restore' : 'Delete'}
                    isDanger={modals.confirm.type !== 'restore'}
                    onConfirm={() => {
                        if (modals.confirm.type === 'restore') handleRestore(modals.confirm.item.id);
                        else handleDelete(modals.confirm.item.id);
                        setModals(m => ({ ...m, confirm: null }));
                    }}
                    onClose={() => setModals(m => ({ ...m, confirm: null }))}
                />
            )}

            <ImportModal
                isOpen={modals.import}
                onClose={() => setModals(m => ({ ...m, import: false }))}
                onImport={async (credential) => {
                    const res = await window.wvault.save(credential);
                    if (res.success) {
                        loadVault();
                        return true;
                    }
                    return false;
                }}
            />
        </Layout>
    );
}
