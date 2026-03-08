import React, { useState, useEffect } from 'react';
import {
    LayoutGrid, CreditCard, StickyNote, Trash2,
    ShieldCheck, KeyRound, Settings, LogOut, RefreshCw, HardDrive, User, Gamepad2, Upload, FolderLock
} from 'lucide-react';

// WVAULT Constellation Logo Component
const WVaultLogo = () => (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Orbital rings */}
        <circle cx="20" cy="20" r="16" stroke="url(#orbital-gradient)" strokeWidth="0.5" opacity="0.4" />
        <circle cx="20" cy="20" r="12" stroke="url(#orbital-gradient)" strokeWidth="0.5" opacity="0.3" strokeDasharray="4 4" />
        {/* Constellation lines forming W */}
        <path d="M8 28 L14 16 L20 24 L26 16 L32 28" stroke="url(#star-gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
        {/* Three stars */}
        <circle cx="8" cy="28" r="3" fill="url(#star-gradient)" />
        <circle cx="20" cy="24" r="3.5" fill="url(#star-gradient)" />
        <circle cx="32" cy="28" r="3" fill="url(#star-gradient)" />
        {/* Star glows */}
        <circle cx="8" cy="28" r="5" fill="url(#glow-gradient)" opacity="0.5" />
        <circle cx="20" cy="24" r="6" fill="url(#glow-gradient)" opacity="0.5" />
        <circle cx="32" cy="28" r="5" fill="url(#glow-gradient)" opacity="0.5" />
        <defs>
            <linearGradient id="star-gradient" x1="8" y1="16" x2="32" y2="28" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FA93FA" />
                <stop offset="0.5" stopColor="#983AD6" />
                <stop offset="1" stopColor="#FA93FA" />
            </linearGradient>
            <linearGradient id="orbital-gradient" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FA93FA" stopOpacity="0.5" />
                <stop offset="1" stopColor="#983AD6" stopOpacity="0.3" />
            </linearGradient>
            <radialGradient id="glow-gradient" cx="0.5" cy="0.5" r="0.5">
                <stop stopColor="#FA93FA" stopOpacity="0.8" />
                <stop offset="1" stopColor="#983AD6" stopOpacity="0" />
            </radialGradient>
        </defs>
    </svg>
);

export default function Sidebar({ activeView, onViewChange, stats }) {
    const [userName, setUserName] = useState('');

    // WVAULT: Section visibility state - Load from localStorage first
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

    useEffect(() => {
        // SECURITY: User name is fetched from encrypted vault only (not localStorage)
        // This prevents information leakage through localStorage
        window.wvault.authGetName().then(res => {
            if (res.success && res.name) {
                setUserName(res.name);
            }
        });

        // WVAULT: Load section visibility preferences
        loadSectionSettings();

        // Listen for settings changes - Update immediately from localStorage ONLY (no backend sync)
        const handleSettingsChange = () => {
            // Update from localStorage for instant UI feedback only
            // Don't sync with backend to avoid stale data overwriting user toggles
            const saved = localStorage.getItem('wvault-sections');
            if (saved) {
                try {
                    setSectionSettings(JSON.parse(saved));
                } catch (e) {
                    console.error('Failed to parse section settings:', e);
                }
            }
        };
        window.addEventListener('wvault-sections-changed', handleSettingsChange);
        window.addEventListener('storage', handleSettingsChange);
        return () => {
            window.removeEventListener('wvault-sections-changed', handleSettingsChange);
            window.removeEventListener('storage', handleSettingsChange);
        };
    }, []);

    // Load section settings - from localStorage first (fast), then backend (background sync)
    const loadSectionSettings = (syncWithBackend = true) => {
        // Always read from localStorage for immediate display
        const saved = localStorage.getItem('wvault-sections');
        if (saved) {
            try {
                setSectionSettings(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse section settings:', e);
            }
        }

        // Backend sync is optional - don't overwrite UI when event triggered
        if (syncWithBackend) {
            window.wvault.settingsSectionsGet().then(res => {
                if (res.success) {
                    // Only update localStorage, don't overwrite current UI state
                    // This prevents backend stale data from overriding user toggles
                    const current = localStorage.getItem('wvault-sections');
                    const currentParsed = current ? JSON.parse(current) : {};
                    // Merge: prefer localStorage values over backend for toggleable items
                    const merged = { ...res.settings, ...currentParsed };
                    localStorage.setItem('wvault-sections', JSON.stringify(merged));
                }
            });
        }
    };

    // WVAULT: Build sidebar menu - Home and All Items always visible
    const MENU = [
        { id: 'home', label: 'Home', icon: LayoutGrid },
        { id: 'vault', label: 'All Items', icon: ShieldCheck },
        { id: 'logins', label: 'Logins', icon: KeyRound },
        // Cards is OPTIONAL (can be toggled)
        ...(sectionSettings.cards !== false ? [{ id: 'cards', label: 'Cards', icon: CreditCard }] : []),
        // Notes is OPTIONAL
        ...(sectionSettings.notes ? [{ id: 'notes', label: 'Notes', icon: StickyNote }] : []),
        // Games is OPTIONAL
        ...(sectionSettings.games !== false ? [{ id: 'games', label: 'Games', icon: Gamepad2 }] : []),
        { id: 'media', label: 'Secure Drive', icon: HardDrive },
        { id: 'fileVault', label: 'File Vault', icon: FolderLock },
        { type: 'divider' },
        // Optional sections based on settings
        ...(sectionSettings.generator ? [{ id: 'generator', label: 'Generator', icon: RefreshCw }] : []),
        ...(sectionSettings.audit ? [{ id: 'audit', label: 'Security Audit', icon: ShieldCheck, alert: (stats.weak > 0 || stats.reused > 0) }] : []),
        ...(sectionSettings.trash ? [{ id: 'trash', label: 'Trash', icon: Trash2, count: stats.trash, alert: stats.trash > 0 }] : []),
        { type: 'spacer' },
        // Import is always available
        { id: 'import', label: 'Import', icon: Upload },
        // Settings is ALWAYS visible at bottom (core feature)
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    return (
        <div className="w-64 flex flex-col border-r border-white/5 bg-black/20 backdrop-blur-xl pt-2 pb-4">
            {/* Logo Area with User */}
            <div className="px-6 py-4">
                <div className="flex items-center gap-3 select-none">
                    <div className="relative">
                        <WVaultLogo />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-primary tracking-wide uppercase">WVault</h1>
                        <p className="text-[10px] text-muted">Where Your World is Secured</p>
                    </div>
                </div>

                {/* User Name Display */}
                {userName && (
                    <div className="mt-4 flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-fuchsia-500/30 to-violet-600/30 flex items-center justify-center ring-1 ring-purple-400/20">
                            <User className="w-3.5 h-3.5 text-pink-300" />
                        </div>
                        <span className="text-[13px] text-white/60 truncate flex-1 font-medium">{userName}</span>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
                {MENU.map((item, i) => {
                    if (item.type === 'divider') return <div key={i} className="h-px bg-white/[0.04] my-2 mx-3" />;
                    if (item.type === 'spacer') return <div key={i} className="flex-1" />;

                    const Icon = item.icon;
                    const isActive = activeView === item.id;

                    return (
                        <button
                            key={item.id}
                            onClick={() => onViewChange(item.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150 group relative ${isActive
                                    ? 'bg-white/[0.06] text-white'
                                    : 'text-white/60 hover:text-white/70 hover:bg-white/[0.03]'
                                }`}
                        >
                            {/* Active accent bar */}
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-gradient-to-b from-pink-400 to-purple-600" />
                            )}
                            <Icon className={`w-[18px] h-[18px] transition-colors flex-shrink-0 ${isActive ? 'text-purple-400' : 'group-hover:text-white/50'}`} strokeWidth={isActive ? 2 : 1.75} />
                            <span className={`text-[13px] flex-1 text-left ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>

                            {/* Counter / Alert */}
                            {(item.count > 0 || item.alert) && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${item.alert
                                    ? 'bg-red-500/15 text-red-400'
                                    : 'bg-white/[0.06] text-white/60'
                                    }`}>
                                    {item.count || '!'}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Developer Signature */}
            <div className="px-4 py-3 border-t border-white/[0.04]">
                <div className="text-center">
                    <p className="text-[8px] text-white/60 tracking-widest uppercase">
                        Made by <span className="text-purple-400/40">Tony Walteur</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
