import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle, ArrowRight, Loader2, RefreshCw, Telescope } from 'lucide-react';
import Observatory from './Observatory';

export default function AuditView({ items, onEdit }) {
    const [activeTab, setActiveTab] = useState('doctor'); // 'doctor' | 'observatory'
    const [breachCounts, setBreachCounts] = useState({});
    const [isChecking, setIsChecking] = useState(false);
    const [abortController, setAbortController] = useState(null);

    // BUG FIX 6: Memoized analysis computation
    const analysis = useMemo(() => {
        const weak = [];
        const reused = [];
        const strong = [];
        const compromised = [];
        const passwordMap = {};

        items.forEach(item => {
            if (item.type !== 'login' || !item.password) return;

            // Strength check
            if (item.strength === 'weak') weak.push(item);
            else strong.push(item);

            // Reuse check
            if (passwordMap[item.password]) {
                reused.push(item);
                if (!reused.includes(passwordMap[item.password])) reused.push(passwordMap[item.password]);
            } else {
                passwordMap[item.password] = item;
            }

            // Breach Check
            if (breachCounts[item.id] > 0) {
                compromised.push({ ...item, breachCount: breachCounts[item.id] });
            }
        });

        const uniqueReused = [...new Set(reused)];
        return { weak, reused: uniqueReused, strong, compromised };
    }, [items, breachCounts]);

    // BUG FIX 6: Added abort controller for breach check to prevent memory leaks
    const runBreachCheck = useCallback(async () => {
        // Cancel any existing check
        if (abortController) {
            abortController.abort();
        }

        const controller = new AbortController();
        setAbortController(controller);
        setIsChecking(true);

        try {
            const newCounts = {};
            for (const item of items) {
                // Check if aborted
                if (controller.signal.aborted) break;

                if (item.type === 'login' && item.password) {
                    // Throttle requests slightly to be nice to API
                    await new Promise(r => setTimeout(r, 100));

                    if (controller.signal.aborted) break;

                    try {
                        const count = await window.wvault.checkBreach(item.password);
                        if (count > 0) newCounts[item.id] = count;
                    } catch (err) {
                        console.error('Breach check error for item:', item.id, err);
                    }
                }
            }

            if (!controller.signal.aborted) {
                setBreachCounts(newCounts);
            }
        } catch (err) {
            console.error('Breach check error:', err);
        } finally {
            setIsChecking(false);
            setAbortController(null);
        }
    }, [items, abortController]);

    // Cleanup abort controller on unmount
    useEffect(() => {
        return () => {
            if (abortController) {
                abortController.abort();
            }
        };
    }, [abortController]);

    const healthScore = useMemo(() => {
        const loginItems = items.filter(i => i.type === 'login');
        if (loginItems.length === 0) return 100;
        const score = Math.round(
            ((analysis.strong.length - analysis.compromised.length) / (loginItems.length || 1)) * 100
        );
        return Math.max(0, score);
    }, [analysis.strong.length, analysis.compromised.length, items]);

    const finalScore = Math.max(0, healthScore);

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

    return (
        <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
            {/* WVAULT: Security Audit Tabs */}
            <header>
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <div className="flex items-center gap-3 mb-1.5">
                            <ShieldCheck className="w-7 h-7 text-cyan-400" strokeWidth={1.75} />
                            <h2 className="text-[28px] font-bold text-white/90" style={{ letterSpacing: '-0.03em' }}>Security Audit</h2>
                        </div>
                        <p className="text-[13px] text-white/30">Defense Command Center — monitor threats and audit activity.</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b border-white/[0.06] pb-4">
                    <button
                        onClick={() => setActiveTab('doctor')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-150 ${activeTab === 'doctor'
                                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-400/20'
                                : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04] border border-transparent'
                            }`}
                    >
                        <ShieldCheck className="w-4 h-4" strokeWidth={1.75} />
                        Vault Doctor
                    </button>
                    <button
                        onClick={() => setActiveTab('observatory')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-150 ${activeTab === 'observatory'
                                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-400/20'
                                : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04] border border-transparent'
                            }`}
                    >
                        <Telescope className="w-4 h-4" strokeWidth={1.75} />
                        Observatory
                    </button>
                </div>
            </header>

            {/* Tab Content */}
            {activeTab === 'observatory' ? (
                <Observatory />
            ) : (
                <>
                    {/* Vault Doctor Header */}
                    <div className="flex items-center justify-between">
                        <h3 className="text-[11px] font-bold text-white/35 uppercase tracking-widest">Vault Health Analysis</h3>
                        <button
                            onClick={runBreachCheck}
                            disabled={isChecking}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold border transition-all duration-200 ${isChecking
                                    ? 'opacity-50 cursor-not-allowed border-white/[0.06] text-white/30'
                                    : 'border-white/[0.08] text-white/60 hover:bg-white/[0.05] hover:text-white/80'
                                }`}
                        >
                            {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            {isChecking ? 'Scanning Dark Web...' : 'Scan for Breaches'}
                        </button>
                    </div>

                    {/* Score Card */}
                    <div className="glass-panel p-8 flex items-center justify-between">
                        <div>
                            <h3 className="text-[13px] font-semibold text-white/50 uppercase tracking-widest">Vault Health Score</h3>
                            <p className="text-[13px] text-white/25 mt-1">Based on strength, reuse, and breach exposure.</p>
                        </div>
                        <div className="relative w-24 h-24 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                                <circle cx="50" cy="50" r="42" fill="none"
                                    stroke={finalScore > 79 ? '#22d3ee' : finalScore > 49 ? '#f59e0b' : '#f87171'}
                                    strokeWidth="7"
                                    strokeLinecap="round"
                                    strokeDasharray={2 * Math.PI * 42}
                                    strokeDashoffset={2 * Math.PI * 42 * (1 - finalScore / 100)}
                                    style={{ transition: 'stroke-dashoffset 1s ease-out, stroke 0.5s' }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl font-bold text-white" style={{ letterSpacing: '-0.03em' }}>{finalScore}</span>
                                <span className="text-[9px] text-white/30 uppercase tracking-wider">score</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* COMPROMISED - High Priority */}
                        <div className="glass-panel p-0 overflow-hidden border-red-500/20 shadow-lg shadow-red-900/10 md:col-span-2 lg:col-span-3 rounded-2xl">
                            <div className="px-5 py-4 border-b border-white/[0.06] bg-red-500/10 flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4 text-red-300 animate-pulse" />
                                <h3 className="font-bold text-red-200 uppercase tracking-widest text-[11px]">Action Required: Compromised Passwords</h3>
                                <span className="ml-auto bg-red-500/20 px-2 py-0.5 rounded-lg text-[11px] text-red-300 font-bold">{analysis.compromised.length}</span>
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                                {analysis.compromised.length === 0 ? (
                                    <div className="p-8 text-center text-white/25 text-[13px] flex flex-col items-center gap-2">
                                        <CheckCircle className="w-7 h-7 text-emerald-500/40" />
                                        No compromises detected. Run a scan to be sure.
                                    </div>
                                ) : (
                                    analysis.compromised.map(item => (
                                        <div key={item.id} onClick={() => onEdit(item)} className="px-5 py-4 hover:bg-white/[0.04] flex items-center gap-4 cursor-pointer border-b border-white/[0.04] last:border-0 transition-colors group">
                                            <div className="w-9 h-9 rounded-xl bg-white/[0.04] p-1.5 flex-shrink-0">
                                                {item.icon_url ? (
                                                    <img src={item.icon_url} className="w-full h-full object-contain" alt="" />
                                                ) : (
                                                    <div className="w-full h-full bg-white/10 rounded-lg" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[13px] font-bold text-red-300 truncate">{sanitizeText(item.service)}</div>
                                                <div className="text-[11px] text-red-200/50 truncate">Found in {item.breachCount} data breaches</div>
                                            </div>
                                            <button className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-300 border border-red-500/20 text-[11px] font-semibold hover:bg-red-500/25 transition-colors">Change Now</button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Weak Passwords */}
                        <div className="glass-panel p-0 overflow-hidden border-orange-500/15 rounded-2xl">
                            <div className="px-5 py-4 border-b border-white/[0.06] bg-amber-500/10 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-400" strokeWidth={1.75} />
                                <h3 className="font-semibold text-amber-200 text-[12px] uppercase tracking-widest">Weak Passwords</h3>
                                <span className="ml-auto bg-amber-500/15 px-2 py-0.5 rounded-lg text-[11px] text-amber-300 font-bold">{analysis.weak.length}</span>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                {analysis.weak.length === 0 ? (
                                    <div className="p-8 text-center text-white/25 text-[13px]">All passwords are strong.</div>
                                ) : (
                                    analysis.weak.map(item => (
                                        <div key={item.id} onClick={() => onEdit(item)} className="px-4 py-3 hover:bg-white/[0.04] flex items-center gap-3 cursor-pointer border-b border-white/[0.04] last:border-0 transition-colors">
                                            <div className="w-8 h-8 rounded-xl bg-white/[0.04] p-1 flex-shrink-0">
                                                {item.icon_url ? (
                                                    <img src={item.icon_url} className="w-full h-full object-contain" alt="" />
                                                ) : (
                                                    <div className="w-full h-full bg-white/10 rounded-lg" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[13px] font-medium text-white/85 truncate">{sanitizeText(item.service)}</div>
                                                <div className="text-[11px] text-white/35 truncate">{sanitizeText(item.username)}</div>
                                            </div>
                                            <ArrowRight className="w-3.5 h-3.5 text-white/20" />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Reused Passwords */}
                        <div className="glass-panel p-0 overflow-hidden border-yellow-500/15 rounded-2xl">
                            <div className="px-5 py-4 border-b border-white/[0.06] bg-yellow-500/10 flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 text-yellow-400" strokeWidth={1.75} />
                                <h3 className="font-semibold text-yellow-200 text-[12px] uppercase tracking-widest">Reused Passwords</h3>
                                <span className="ml-auto bg-yellow-500/15 px-2 py-0.5 rounded-lg text-[11px] text-yellow-300 font-bold">{analysis.reused.length}</span>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                {analysis.reused.length === 0 ? (
                                    <div className="p-8 text-center text-white/25 text-[13px]">No password reuse detected.</div>
                                ) : (
                                    analysis.reused.map(item => (
                                        <div key={item.id} onClick={() => onEdit(item)} className="px-4 py-3 hover:bg-white/[0.04] flex items-center gap-3 cursor-pointer border-b border-white/[0.04] last:border-0 transition-colors">
                                            <div className="w-8 h-8 rounded-xl bg-white/[0.04] p-1 flex-shrink-0">
                                                {item.icon_url ? (
                                                    <img src={item.icon_url} className="w-full h-full object-contain" alt="" />
                                                ) : (
                                                    <div className="w-full h-full bg-white/10 rounded-lg" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[13px] font-medium text-white/85 truncate">{sanitizeText(item.service)}</div>
                                                <div className="text-[11px] text-white/35 truncate">{sanitizeText(item.username)}</div>
                                            </div>
                                            <ArrowRight className="w-3.5 h-3.5 text-white/20" />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
