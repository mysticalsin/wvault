import React, { useState, useEffect } from 'react';
import {
    Download, ShieldAlert, Key, Palette, Trash2,
    HardDrive, Info, Check, ShieldCheck, Eye, EyeOff, StickyNote, Gamepad2,
    LayoutGrid, RefreshCw, Settings as SettingsIcon, CreditCard
} from 'lucide-react';

// BUG FIX 1: Added themes configuration with RGB colors for CSS variables
const THEMES = [
    { id: 'indigo', name: 'Indigo', color: '99 102 241', hex: '#6366f1' },
    { id: 'cyan', name: 'Ocean', color: '6 182 212', hex: '#06b6d4' },
    { id: 'emerald', name: 'Emerald', color: '16 185 129', hex: '#10b981' },
    { id: 'rose', name: 'Rose', color: '244 63 94', hex: '#f43f5e' },
    { id: 'amber', name: 'Amber', color: '245 158 11', hex: '#f59e0b' },
    { id: 'violet', name: 'Violet', color: '139 92 246', hex: '#8b5cf6' },
];

export default function SettingsView({ onExport, onDeleteAll, onEmptyTrash, onSetPin, stats }) {
    // BUG FIX 1: Load saved theme from localStorage on mount - WVAULT MIGRATION
    const [theme, setTheme] = useState(() => {
        const savedTheme = localStorage.getItem('wvault-theme-id') || localStorage.getItem('glassvault-theme-id');
        return savedTheme || 'indigo';
    });
    const [pin, setPin] = useState('');
    const [resetConfirm, setResetConfirm] = useState(0);
    const [vaultStats, setVaultStats] = useState(null);
    const [isSettingPin, setIsSettingPin] = useState(false);

    // WVAULT 5.0: Section Toggles State - Load from localStorage first for immediate sync
    const [sectionSettings, setSectionSettings] = useState(() => {
        const saved = localStorage.getItem('wvault-sections');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to parse section settings:', e);
            }
        }
        return {
            generator: true,
            audit: true,
            trash: true,
            settings: true,
            games: true,
            notes: true,
            cards: true
        };
    });

    // Load section settings on mount - from localStorage first, then backend
    useEffect(() => {
        // First try localStorage for immediate display
        const saved = localStorage.getItem('wvault-sections');
        if (saved) {
            try {
                setSectionSettings(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse section settings:', e);
            }
        }
        // Then sync with backend
        window.wvault.settingsSectionsGet().then(res => {
            if (res.success) {
                setSectionSettings(res.settings);
                localStorage.setItem('wvault-sections', JSON.stringify(res.settings));
            }
        });
    }, []);

    // Toggle section setting - Save to both localStorage and backend
    const toggleSection = async (section) => {
        const newSettings = { ...sectionSettings, [section]: !sectionSettings[section] };
        setSectionSettings(newSettings);
        // Save to localStorage immediately for instant sync
        localStorage.setItem('wvault-sections', JSON.stringify(newSettings));
        // Also save to backend
        try {
            await window.wvault.settingsSectionsSave(newSettings);
        } catch (err) {
            console.error('Failed to save settings to backend:', err);
        }
        // Dispatch event to notify Sidebar
        window.dispatchEvent(new Event('wvault-sections-changed'));
    };

    // BUG FIX 1: Apply theme on mount to sync with saved preference - WVAULT MIGRATION
    useEffect(() => {
        const savedThemeId = localStorage.getItem('wvault-theme-id') || localStorage.getItem('glassvault-theme-id');
        if (savedThemeId) {
            const themeConfig = THEMES.find(t => t.id === savedThemeId);
            if (themeConfig) {
                applyThemeToDOM(themeConfig);
            }
        }
    }, []);

    // BUG FIX 1: Extract theme application logic for reusability
    const applyThemeToDOM = (t) => {
        document.documentElement.style.setProperty('--accent', t.color);
        document.documentElement.style.setProperty('--accent-glow', `rgba(${t.color}, 0.25)`);
        // Also set CSS rgb variables if used elsewhere
        document.documentElement.style.setProperty('--accent-rgb', t.color);
    };

    // BUG FIX 1: Apply theme and persist to localStorage - WVAULT MIGRATION
    const applyTheme = (t) => {
        setTheme(t.id);
        applyThemeToDOM(t);
        localStorage.setItem('wvault-theme-id', t.id);
        localStorage.setItem('wvault-theme', t.color);
    };

    // BUG FIX 5: Added loading state and error handling for PIN setting
    const handleSetPin = async (e) => {
        e.preventDefault();
        if (pin.length !== 4) {
            alert("PIN must be 4 digits");
            return;
        }

        // Validate PIN contains only digits
        if (!/^\d{4}$/.test(pin)) {
            alert("PIN must contain only numbers 0-9");
            return;
        }

        setIsSettingPin(true);
        try {
            await onSetPin(pin);
            setPin('');
        } catch (err) {
            console.error('Failed to set PIN:', err);
            alert('Failed to set PIN. Please try again.');
        } finally {
            setIsSettingPin(false);
        }
    };

    // BUG FIX 5: Added proper input validation for PIN - only allow digits
    const handlePinChange = (e) => {
        const value = e.target.value;
        // Only allow digits
        if (/^\d*$/.test(value) && value.length <= 4) {
            setPin(value);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto space-y-8">
            <header className="mb-2">
                <h2 className="text-[28px] font-bold text-white/90" style={{ letterSpacing: '-0.03em' }}>Settings</h2>
                <p className="text-[13px] text-white/60 mt-1">Manage themes, data, and security.</p>
            </header>

            {/* Appearance - BUG FIX 1: Theme settings now persist */}
            <section className="space-y-4">
                <h3 className="text-[11px] font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
                    <Palette className="w-3.5 h-3.5 text-fuchsia-400/60" /> Appearance
                </h3>

                {/* Accent Color */}
                <div className="glass-panel p-6">
                    <h4 className="text-[12px] font-semibold text-white/60 uppercase tracking-widest mb-4">Accent Color</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                        {THEMES.map(t => (
                            <button
                                key={t.id}
                                onClick={() => applyTheme(t)}
                                className={`group relative p-4 rounded-2xl border transition-all duration-200 ${theme === t.id
                                        ? 'bg-white/[0.08] border-white/[0.15] ring-1 ring-white/15'
                                        : 'bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.06] hover:border-white/[0.1]'
                                    }`}
                            >
                                <div
                                    className="w-7 h-7 rounded-full mx-auto mb-2 shadow-lg"
                                    style={{ backgroundColor: t.hex }}
                                />
                                <span className={`block text-center text-[12px] font-medium ${theme === t.id ? 'text-white/90' : 'text-white/60'
                                    }`}>
                                    {t.name}
                                </span>
                                {theme === t.id && (
                                    <div className="absolute top-2 right-2 text-white/70">
                                        <Check className="w-3 h-3" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* WVAULT: Privacy & Section Toggles */}
            <section className="space-y-4">
                <h3 className="text-[11px] font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-fuchsia-400/60" /> Sidebar Sections
                </h3>
                <div className="glass-panel p-6 space-y-3">
                    <p className="text-[13px] text-white/60 mb-4">
                        Customize which sections appear in the sidebar. Home and All Items are always visible.
                    </p>

                    {/* Sidebar section toggle rows - consolidated styling */}
                    {[
                        { key: 'cards', label: 'Cards', sub: 'Credit & debit card storage', icon: CreditCard, color: 'text-emerald-400', bg: 'bg-emerald-500/10', active: sectionSettings.cards !== false },
                        { key: 'notes', label: 'Notes', sub: 'Obsidian-style notes with pop-out windows', icon: StickyNote, color: 'text-yellow-400', bg: 'bg-yellow-500/10', active: sectionSettings.notes },
                        { key: 'games', label: 'Games Galaxy', sub: 'Gaming credentials vault', icon: Gamepad2, color: 'text-purple-400', bg: 'bg-purple-500/10', active: sectionSettings.games !== false },
                        { key: 'generator', label: 'Generator', sub: 'Password generator tool', icon: RefreshCw, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', active: sectionSettings.generator },
                        { key: 'audit', label: 'Security Audit', sub: 'Check password strength and breaches', icon: ShieldCheck, color: 'text-amber-400', bg: 'bg-amber-500/10', active: sectionSettings.audit },
                        { key: 'trash', label: 'Trash', sub: 'Deleted items recovery', icon: Trash2, color: 'text-red-400', bg: 'bg-red-500/10', active: sectionSettings.trash },
                    ].map(({ key, label, sub, icon: Icon, color, bg, active }) => (
                        <div key={key} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                            <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
                                    <Icon className={`w-4 h-4 ${color}`} strokeWidth={1.75} />
                                </div>
                                <div>
                                    <h4 className="text-[13px] font-semibold text-white/80">{label}</h4>
                                    <p className="text-[11px] text-white/60">{sub}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => toggleSection(key)}
                                className={`wvault-toggle ${active ? 'active' : ''}`}
                                title={active ? `Hide ${label}` : `Show ${label}`}
                            >
                                <div className="wvault-toggle-thumb" />
                            </button>
                        </div>
                    ))}

                    {/* Settings — always on */}
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                                <SettingsIcon className="w-4 h-4 text-white/60" strokeWidth={1.75} />
                            </div>
                            <div>
                                <h4 className="text-[13px] font-semibold text-white/50">Settings</h4>
                                <p className="text-[11px] text-white/60">Core feature — always accessible via Ctrl+,</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-fuchsia-400/70 font-medium">Always on</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Security */}
            <section className="space-y-4">
                <h3 className="text-[11px] font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-fuchsia-400/60" /> Security
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Session PIN - BUG FIX 5: Improved PIN input with validation */}
                    <div className="glass-panel p-6 space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                                <Key className="w-5 h-5 text-accent" />
                            </div>
                            <div>
                                <h4 className="font-medium text-primary">Session PIN</h4>
                                <p className="text-xs text-tertiary">Quick access after auto-lock.</p>
                            </div>
                        </div>

                        <form onSubmit={handleSetPin} className="space-y-3">
                            <input
                                type="password"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength="4"
                                value={pin}
                                onChange={handlePinChange}
                                placeholder="Set 4-digit PIN"
                                className="w-full bg-black/20 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-accent text-center tracking-widest font-mono"
                            />
                            <button
                                type="submit"
                                disabled={isSettingPin || pin.length !== 4}
                                className="glass-button w-full py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSettingPin ? 'Setting...' : 'Enable / Update PIN'}
                            </button>
                        </form>
                    </div>

                    <div className="glass-panel p-6 space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-red-400/10 flex items-center justify-center">
                                <ShieldAlert className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <h4 className="font-medium text-primary">Master Password</h4>
                                <p className="text-xs text-tertiary">Change your main encryption key.</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {/* Warning */}
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-2">
                                <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                                <p className="text-[10px] text-red-200/80 leading-relaxed">
                                    <strong>Warning:</strong> If you lose this new password, you lose all data.
                                    There is no recovery.
                                </p>
                            </div>

                            <button
                                onClick={() => {
                                    alert("To change your password, please backup your data (Export), then Reset the vault and set it up again with a new password. Direct password changing is disabled for security in this version.");
                                }}
                                className="glass-button w-full py-2 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-300"
                            >
                                Change Password
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Data Management */}
            <section className="space-y-4">
                <h3 className="text-[11px] font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
                    <HardDrive className="w-3.5 h-3.5 text-fuchsia-400/60" /> Data Management
                </h3>
                <div className="glass-panel p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium text-primary">Export Vault</h4>
                            <p className="text-sm text-muted mt-1">Save a backup of your data.</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => onExport('json')} className="glass-button glass-button-primary px-4 py-2">
                                <Download className="w-4 h-4" /> JSON
                            </button>
                            <button onClick={() => onExport('csv')} className="glass-button px-4 py-2">
                                <Download className="w-4 h-4" /> CSV
                            </button>
                        </div>
                    </div>

                    <div className="h-px bg-white/[0.04]" />

                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium text-primary">Storage Location</h4>
                            <p className="text-sm text-muted mt-1">Move your Secure Drive to another drive/SSD.</p>
                        </div>
                        <button
                            onClick={async () => {
                                try {
                                    const res = await window.wvault.moveStorage();
                                    if (res.success) alert("Vault moved successfully! The app will now restart.");
                                    else if (res.error !== 'Cancelled') alert("Error: " + res.error);
                                } catch (err) {
                                    console.error('Move storage error:', err);
                                    alert("Failed to move storage. Please try again.");
                                }
                            }}
                            className="glass-button px-4 py-2 border-accent/20 hover:bg-accent/10 text-accent"
                        >
                            <HardDrive className="w-4 h-4 mr-2" /> Move Vault
                        </button>
                    </div>

                    <div className="h-px bg-white/[0.04]" />

                    <button
                        onClick={onEmptyTrash}
                        disabled={!stats?.trash || stats.trash === 0}
                        className="glass-button text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/20 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Trash2 className="w-4 h-4" /> Empty Trash
                    </button>
                </div>

                <div className="h-px bg-black/5 dark:bg-white/5" />

                {/* Danger Zone */}
                <div className="pt-2">
                    <h4 className="font-medium text-red-400/90 mb-2">Danger Zone</h4>
                    {resetConfirm > 0 && vaultStats && (
                        <div className="text-xs text-left bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-red-300 space-y-1 mb-2">
                            <p className="font-bold border-b border-red-500/20 pb-1 mb-1">
                                {resetConfirm === 2 ? 'Data to be erased:' : 'FINAL WARNING:'}
                            </p>
                            <div className="grid grid-cols-2 gap-x-4">
                                <span>Logins: {vaultStats.logins}</span>
                                <span>Secure Files: {vaultStats.driveFiles}</span>
                                <span>Notes: {vaultStats.notes}</span>
                                <span>Trash: {vaultStats.trash}</span>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={async () => {
                            if (resetConfirm === 0) {
                                setResetConfirm(1);
                            } else if (resetConfirm === 1) {
                                try {
                                    const res = await window.wvault.getStats();
                                    if (res.success) setVaultStats(res.stats);
                                    setResetConfirm(2);
                                } catch (err) {
                                    console.error('Get stats error:', err);
                                }
                            } else if (resetConfirm === 2) {
                                setResetConfirm(3);
                            } else {
                                try {
                                    await window.wvault.authReset();
                                    window.location.reload();
                                } catch (err) {
                                    console.error('Reset error:', err);
                                    alert('Failed to reset vault. Please try again.');
                                }
                            }
                        }}
                        className={`w-full text-sm py-3 rounded-lg transition-all duration-200 border flex items-center justify-center gap-2 ${resetConfirm > 0
                            ? 'bg-red-600 text-white border-red-500 font-bold animate-pulse'
                            : 'text-red-400/80 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 border-red-500/20'
                            }`}
                    >
                        <ShieldAlert className="w-4 h-4" />
                        {resetConfirm === 0 && 'Delete Entire Vault'}
                        {resetConfirm === 1 && 'Are you sure? (Click to scan data)'}
                        {resetConfirm === 2 && 'Confirm Deletion (Check counts above)'}
                        {resetConfirm === 3 && 'DESTROY ALL DATA (NO UNDO)'}
                    </button>
                    {resetConfirm > 0 && (
                        <button
                            onClick={() => { setResetConfirm(0); setVaultStats(null); }}
                            className="block w-full text-center text-xs text-muted hover:text-secondary py-2"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </section>

            {/* WVAULT: About - Minimal, no version badge in main UI */}
            <section className="text-center pt-8 pb-4">
                <div className="text-[10px] text-white/60 tracking-widest uppercase">
                    WVault — Where Your World is Secured
                </div>
            </section>
        </div>
    );
}
