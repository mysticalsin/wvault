import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
    ShieldCheck, ShieldAlert, Plus, CreditCard, KeyRound,
    ArrowRight, Clock, Star, Activity, Lock, HardDrive, User
} from 'lucide-react';
import { motion } from 'framer-motion';

// BUG FIX 3: XSS Protection - Helper function to sanitize display text
const sanitizeText = (text) => {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

export default function Dashboard({ items, stats, onNavigate, onAdd, onLock, userName }) {
    const [displayName, setDisplayName] = useState(userName || 'User');

    // BUG FIX 9: Added cleanup for async operations and proper dependency handling
    useEffect(() => {
        let isMounted = true;

        // SECURITY: User name is fetched from encrypted vault only (not localStorage)
        if (!userName) {
            // Fetch from main process (encrypted vault)
            window.wvault.authGetName().then(res => {
                if (isMounted && res.success && res.name) {
                    setDisplayName(res.name);
                }
            }).catch(err => {
                console.error('Failed to load user name:', err);
            });
        } else {
            setDisplayName(userName);
        }

        return () => {
            isMounted = false;
        };
    }, [userName]);

    const timeOfDay = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 5) return 'Good night';
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        if (hour < 21) return 'Good evening';
        return 'Good night';
    }, []);

    const recentItems = useMemo(() => {
        return [...items]
            .filter(i => i.updated_at || i.created_at)
            .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
            .slice(0, 4);
    }, [items]);

    const favoriteItems = useMemo(() => {
        return items.filter(i => i.favorite).slice(0, 4);
    }, [items]);

    const healthScore = useMemo(() => {
        if (!stats || stats.total === 0) return 100;
        const weakCount = stats.weak || 0;
        const reusedCount = stats.reused || 0;
        const deduction = (weakCount * 15) + (reusedCount * 10);
        return Math.max(0, Math.min(100, 100 - deduction));
    }, [stats]);

    const healthStatus = useMemo(() => {
        if (healthScore >= 90) return { text: 'Excellent', color: 'text-emerald-400', bg: 'bg-emerald-500' };
        if (healthScore >= 70) return { text: 'Good', color: 'text-blue-400', bg: 'bg-blue-500' };
        if (healthScore >= 50) return { text: 'Fair', color: 'text-amber-400', bg: 'bg-amber-500' };
        return { text: 'At Risk', color: 'text-red-400', bg: 'bg-red-500' };
    }, [healthScore]);

    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center border border-cyan-400/15 ring-1 ring-cyan-400/10">
                        <User className="w-6 h-6 text-cyan-300" />
                    </div>
                    <div>
                        <h2 className="text-[28px] font-bold text-white/90" style={{ letterSpacing: '-0.03em' }}>
                            {timeOfDay}, <span className="wvault-gradient-text">{sanitizeText(displayName)}</span>
                        </h2>
                        <p className="text-white/30 text-[13px]">Your vault is secure and up to date.</p>
                    </div>
                </div>
                <button
                    onClick={async () => {
                        console.log('[Dashboard] Lock button clicked');
                        try {
                            await onLock();
                            console.log('[Dashboard] Lock completed');
                        } catch (err) {
                            console.error('[Dashboard] Lock failed:', err);
                        }
                    }}
                    className="glass-button text-xs gap-2 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all duration-200 active:scale-95"
                >
                    <Lock className="w-3.5 h-3.5" /> Lock Vault
                </button>
            </div>

            {/* Widgets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Security Health Widget */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass-panel p-6 relative overflow-hidden group cursor-pointer hover:border-white/10 transition-all"
                    onClick={() => onNavigate('audit')}
                >
                    <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center gap-2 mb-4">
                            <Activity className="w-4 h-4 text-cyan-400" />
                            <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest">Vault Health</span>
                        </div>

                        {/* Circular progress ring */}
                        <div className="flex items-center justify-center flex-1 py-2">
                            <div className="relative w-28 h-28">
                                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                                    <motion.circle
                                        cx="50" cy="50" r="42" fill="none"
                                        stroke="url(#healthGrad)"
                                        strokeWidth="6"
                                        strokeLinecap="round"
                                        strokeDasharray={2 * Math.PI * 42}
                                        initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                                        animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - healthScore / 100) }}
                                        transition={{ duration: 1.5, ease: 'easeOut' }}
                                    />
                                    <defs>
                                        <linearGradient id="healthGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#22d3ee" />
                                            <stop offset="100%" stopColor="#a78bfa" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-bold text-white" style={{ letterSpacing: '-0.03em' }}>{healthScore}</span>
                                    <span className={`text-[10px] font-semibold ${healthStatus.color}`}>{healthStatus.text}</span>
                                </div>
                            </div>
                        </div>

                        <div className="text-center mt-2">
                            <p className="text-[11px] text-white/30">
                                {stats.weak > 0 ? `${stats.weak} weak passwords found` : stats.reused > 0 ? `${stats.reused} reused passwords` : 'All systems nominal'}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Quick Actions */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass-panel p-6 col-span-1 md:col-span-2"
                >
                    <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <ActionButton icon={Plus} label="New Item" onClick={onAdd} color="text-emerald-400" bg="bg-emerald-400/10" border="border-emerald-400/15" />
                        <ActionButton icon={KeyRound} label="Logins" onClick={() => onNavigate('logins')} color="text-cyan-400" bg="bg-cyan-400/10" border="border-cyan-400/15" />
                        <ActionButton icon={CreditCard} label="Cards" onClick={() => onNavigate('cards')} color="text-purple-400" bg="bg-purple-400/10" border="border-purple-400/15" />
                        <ActionButton icon={HardDrive} label="Drive" onClick={() => onNavigate('media')} color="text-cyan-400" bg="bg-cyan-400/10" border="border-cyan-400/15" />
                        <ActionButton icon={ShieldAlert} label="Audit" onClick={() => onNavigate('audit')} color="text-amber-400" bg="bg-amber-400/10" border="border-amber-400/15" />
                    </div>
                </motion.div>
            </div>

            {/* Stats Overview */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-4"
            >
                <StatCard label="Total Items" value={stats.total || items.length} icon={ShieldCheck} delay={0.3} />
                <StatCard label="Favorites" value={favoriteItems.length} icon={Star} delay={0.35} />
                <StatCard label="Weak Passwords" value={stats.weak || 0} icon={ShieldAlert} isAlert={stats.weak > 0} delay={0.4} />
                <StatCard label="In Trash" value={stats.trash || 0} icon={Lock} delay={0.45} />
            </motion.div>

            {/* Recents & Favorites */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent */}
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="space-y-4"
                >
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-lg font-bold text-white/90 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-accent" /> Recently Updated
                        </h3>
                        <button onClick={() => onNavigate('vault')} className="text-xs text-white/40 hover:text-white transition-colors flex items-center gap-1">
                            View All <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {recentItems.length > 0 ? recentItems.map(item => (
                            <MiniRow key={item.id} item={item} onClick={() => onNavigate('vault')} />
                        )) : (
                            <div className="text-center py-8 text-white/20 italic text-sm border border-white/5 rounded-xl bg-white/[0.02]">
                                No recent activity
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Favorites */}
                <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-4"
                >
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-lg font-bold text-white/90 flex items-center gap-2">
                            <Star className="w-4 h-4 text-amber-400" /> Favorites
                        </h3>
                        {favoriteItems.length > 0 && (
                            <button onClick={() => onNavigate('vault')} className="text-xs text-white/40 hover:text-white transition-colors flex items-center gap-1">
                                View All <ArrowRight className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                    {favoriteItems.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                            {favoriteItems.map(item => (
                                <MiniCard key={item.id} item={item} onClick={() => onNavigate('vault')} />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-white/20 border border-white/5 rounded-xl bg-white/[0.02]">
                            <Star className="w-8 h-8 mb-2 opacity-20" />
                            <span className="text-sm italic">Star items to see them here</span>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}

function ActionButton({ icon: Icon, label, onClick, color, bg, border }) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-lg active:scale-95 ${bg} ${border}`}
        >
            <Icon className={`w-5 h-5 ${color}`} strokeWidth={1.75} />
            <span className="text-[11px] font-semibold text-white/70">{label}</span>
        </button>
    );
}

function StatCard({ label, value, icon: Icon, isAlert, delay }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay }}
            className="glass-panel p-4 flex items-center gap-3"
        >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isAlert ? 'bg-red-500/10' : 'bg-white/[0.04]'}`}>
                <Icon className={`w-[18px] h-[18px] ${isAlert ? 'text-red-400' : 'text-white/50'}`} strokeWidth={1.75} />
            </div>
            <div>
                <div className={`text-xl font-bold ${isAlert && value > 0 ? 'text-red-400' : 'text-white/90'}`} style={{ letterSpacing: '-0.02em' }}>{value}</div>
                <div className="text-[11px] text-white/35 font-medium">{label}</div>
            </div>
        </motion.div>
    );
}

function MiniRow({ item, onClick }) {
    return (
        <div onClick={onClick} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.06] hover:border-white/[0.08] transition-all duration-150 cursor-pointer group">
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] p-1.5 flex items-center justify-center">
                {item.icon_url ? <img src={item.icon_url} className="w-full h-full object-contain rounded-sm" onError={e => e.target.style.display = 'none'} alt="" /> : <div className="w-2 h-2 rounded-full bg-white/15" />}
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="text-[13px] font-medium text-white/85 truncate">{sanitizeText(item.service)}</h4>
                <p className="text-[11px] text-white/30 truncate">{sanitizeText(item.username)}</p>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-white/0 group-hover:text-white/30 transition-all duration-200" />
        </div>
    );
}

function MiniCard({ item, onClick }) {
    return (
        <div onClick={onClick} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] transition-colors cursor-pointer flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 p-1.5 flex items-center justify-center flex-shrink-0">
                {item.icon_url ? <img src={item.icon_url} className="w-full h-full object-contain" onError={e => e.target.style.display = 'none'} alt="" /> : <div className="w-2 h-2 rounded-full bg-white/20" />}
            </div>
            <div className="min-w-0">
                {/* BUG FIX 3: Sanitized service and username */}
                <h4 className="text-sm font-medium text-white/90 truncate">{sanitizeText(item.service)}</h4>
                <p className="text-xs text-white/40 truncate">{sanitizeText(item.username)}</p>
            </div>
        </div>
    );
}
