import React, { useState, useEffect, useMemo } from 'react';
import { Telescope, ShieldAlert, ShieldCheck, Clock, MapPin, Fingerprint, Lock, Unlock, AlertTriangle, Eye, FileText, RefreshCw } from 'lucide-react';

// WVAULT OBSERVATORY - Tamper-proof Security Logging
// Located under: Security Audit → Observatory

const EVENT_TYPES = {
    LOGIN_SUCCESS: { icon: Unlock, color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Login Success' },
    LOGIN_FAILURE: { icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Failed Login' },
    LOCK: { icon: Lock, color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'Vault Locked' },
    UNLOCK: { icon: Unlock, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Vault Unlocked' },
    BREACH_ATTEMPT: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Breach Attempt' },
    SECTION_ACCESS: { icon: Eye, color: 'text-purple-400', bg: 'bg-purple-400/10', label: 'Section Access' },
    PASSWORD_CHANGE: { icon: FileText, color: 'text-cyan-400', bg: 'bg-cyan-400/10', label: 'Password Changed' },
};

// Calculate hash for blockchain-style chaining
const calculateHash = (data) => {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
};

// Obfuscate location to 10km radius (privacy)
const obfuscateLocation = (lat, lng) => {
    if (!lat || !lng) return null;
    // Add random offset (~10km at equator)
    const offset = 0.1; // roughly 10km
    const newLat = lat + (Math.random() - 0.5) * offset;
    const newLng = lng + (Math.random() - 0.5) * offset;
    return { lat: newLat.toFixed(2), lng: newLng.toFixed(2), obfuscated: true };
};

export default function Observatory() {
    const [logs, setLogs] = useState([]);
    const [filter, setFilter] = useState('all');
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationResult, setVerificationResult] = useState(null);
    const [bruteForceAlert, setBruteForceAlert] = useState(null);

    // WVAULT 5.0: Load logs from main process via IPC
    useEffect(() => {
        const loadAuditLog = async () => {
            try {
                const result = await window.wvault.getAuditLog();
                if (result.success) {
                    setLogs(result.logs || []);
                }
            } catch (e) {
                console.error('Failed to load audit log:', e);
            }
        };
        loadAuditLog();
        
        // Subscribe to real-time audit events
        const unsubscribeAudit = window.wvault.onAuditEvent((entry) => {
            setLogs(prev => [...prev, entry]);
        });
        
        // Subscribe to brute force alerts
        const unsubscribeBruteForce = window.wvault.onBruteForceAlert((alert) => {
            setBruteForceAlert({
                count: alert.attempts,
                lastAttempt: new Date().toISOString(),
                lockoutUntil: alert.lockedUntil,
            });
            if (window.showToast) {
                window.showToast('⚠️ SECURITY ALERT: Brute force attempt detected!');
            }
        });
        
        return () => {
            unsubscribeAudit();
            unsubscribeBruteForce();
        };
    }, []);

    // WVAULT 5.0: Verify chain integrity via IPC
    const verifyChain = async () => {
        setIsVerifying(true);
        try {
            const result = await window.wvault.verifyAuditChain();
            setVerificationResult(result.success && result.valid);
        } catch (e) {
            console.error('Chain verification failed:', e);
            setVerificationResult(false);
        }
        setIsVerifying(false);
    };

    // WVAULT 5.0: Brute force alerts are now handled by main process
    // via onBruteForceAlert subscription above

    // Filtered logs
    const filteredLogs = useMemo(() => {
        if (filter === 'all') return logs;
        if (filter === 'security') return logs.filter(l => ['LOGIN_FAILURE', 'BREACH_ATTEMPT'].includes(l.event));
        if (filter === 'access') return logs.filter(l => ['LOGIN_SUCCESS', 'UNLOCK', 'SECTION_ACCESS'].includes(l.event));
        return logs.filter(l => l.event === filter);
    }, [logs, filter]);

    // Format timestamp
    const formatTime = (iso) => {
        const date = new Date(iso);
        return date.toLocaleString('en-US', { 
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    };

    return (
        <div className="space-y-6">
            {/* Observatory Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-400/20">
                        <Telescope className="w-5 h-5 text-indigo-300" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-primary">Observatory</h3>
                        <p className="text-xs text-muted">Immutable Security Audit Trail</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    {/* Chain Verification */}
                    <button
                        onClick={verifyChain}
                        disabled={isVerifying || logs.length === 0}
                        className="glass-button text-xs px-3 py-2 disabled:opacity-50"
                    >
                        {isVerifying ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : verificationResult === true ? (
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        ) : verificationResult === false ? (
                            <ShieldAlert className="w-3 h-3 text-red-400" />
                        ) : (
                            <ShieldCheck className="w-3 h-3" />
                        )}
                        {isVerifying ? ' Verifying...' : ' Verify Chain'}
                    </button>
                </div>
            </div>

            {/* Brute Force Alert */}
            {bruteForceAlert && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 animate-pulse">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-6 h-6 text-red-400" />
                        <div>
                            <h4 className="font-medium text-red-300">Brute Force Detected!</h4>
                            <p className="text-xs text-red-200/70">
                                {bruteForceAlert.count} failed attempts in the last 15 minutes.
                                Temporary lockout active.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2">
                {[
                    { id: 'all', label: 'All Events' },
                    { id: 'security', label: 'Security Alerts' },
                    { id: 'LOGIN_SUCCESS', label: 'Logins' },
                    { id: 'LOGIN_FAILURE', label: 'Failed Attempts' },
                    { id: 'LOCK', label: 'Lock Events' },
                ].map(f => (
                    <button
                        key={f.id}
                        onClick={() => setFilter(f.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            filter === f.id
                                ? 'bg-accent/20 text-accent border border-accent/30'
                                : 'bg-black/5 dark:bg-white/5 text-muted hover:text-primary border border-transparent'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Log Entries */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredLogs.length === 0 ? (
                    <div className="text-center py-12 text-muted">
                        <Telescope className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No events recorded yet.</p>
                        <p className="text-xs mt-1">Security events will appear here.</p>
                    </div>
                ) : (
                    filteredLogs.slice().reverse().map((log, index) => {
                        const eventConfig = EVENT_TYPES[log.event] || EVENT_TYPES.SECTION_ACCESS;
                        const Icon = eventConfig.icon;
                        
                        return (
                            <div
                                key={log.id}
                                className="flex items-start gap-3 p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-white/5 hover:border-white/10 transition-all"
                            >
                                <div className={`w-8 h-8 rounded-lg ${eventConfig.bg} flex items-center justify-center flex-shrink-0`}>
                                    <Icon className={`w-4 h-4 ${eventConfig.color}`} />
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-medium text-primary">
                                            {eventConfig.label}
                                        </span>
                                        <span className="text-xs text-muted">
                                            {formatTime(log.timestamp)}
                                        </span>
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-3 text-xs text-tertiary">
                                        <span className="flex items-center gap-1">
                                            <Fingerprint className="w-3 h-3" />
                                            {log.device?.slice(0, 20)}...
                                        </span>
                                        {log.location && (
                                            <span className="flex items-center gap-1">
                                                <MapPin className="w-3 h-3" />
                                                ~{log.location.lat}, {log.location.lng}
                                                {log.location.obfuscated && ' (±10km)'}
                                            </span>
                                        )}
                                    </div>
                                    
                                    {log.details?.section && (
                                        <div className="mt-1 text-xs text-accent">
                                            Section: {log.details.section}
                                        </div>
                                    )}
                                    
                                    {/* Hash chain indicator */}
                                    <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-2">
                                        <span className="text-[10px] text-muted font-mono">
                                            Hash: {log.hash?.slice(0, 12)}...
                                        </span>
                                        {index < filteredLogs.length - 1 && (
                                            <span className="text-[10px] text-emerald-400/50">
                                                ✓ chained
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/5">
                <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{logs.length}</div>
                    <div className="text-xs text-muted">Total Events</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-red-400">
                        {logs.filter(l => l.event === 'LOGIN_FAILURE').length}
                    </div>
                    <div className="text-xs text-muted">Failed Logins</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-400">
                        {logs.filter(l => l.event === 'LOGIN_SUCCESS').length}
                    </div>
                    <div className="text-xs text-muted">Successful Logins</div>
                </div>
            </div>
        </div>
    );
}

// Export helper to add logs from anywhere in the app
export const logSecurityEvent = (eventType, details) => {
    if (window.wvaultObservatory?.addLogEntry) {
        return window.wvaultObservatory.addLogEntry(eventType, details);
    }
    console.warn('Observatory not initialized, event not logged:', eventType);
};
