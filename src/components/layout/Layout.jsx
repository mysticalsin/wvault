import React, { useState, useEffect, useCallback, useRef } from 'react';
import TitleBar from './TitleBar';
import Sidebar from './Sidebar';
import Particles from '../3d/Particles';

// Toast Component
const Toast = ({ message, progress }) => (
    <div className="absolute bottom-6 right-6 z-[100] animate-slide-up">
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/[0.08] shadow-2xl" style={{ background: 'rgba(14, 18, 28, 0.97)', backdropFilter: 'blur(24px)' }}>
            <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(to bottom, #FA93FA, #983AD6)' }} />
            <div className="text-[13px] font-medium text-white/85">{message}</div>
            {progress > 0 && (
                <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden ml-1">
                    <div
                        className="h-full rounded-full transition-all duration-100 ease-linear"
                        style={{ width: `${progress}%`, background: 'linear-gradient(to right, #FA93FA, #983AD6)' }}
                    />
                </div>
            )}
        </div>
    </div>
);

export default function Layout({ children, activeView, onViewChange, stats, onLock, onSettings }) {
    const [toast, setToast] = useState(null); // { message, duration, startTime }
    const intervalRef = useRef(null);

    // Global Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.key === 'l') {
                e.preventDefault();
                // WVAULT P0 FIX: Ensure lock action completes before state update
                onLock?.();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onLock]);

    // Clipboard Time Bomb Logic - BUG FIX 7: Fixed memory leak with proper cleanup
    useEffect(() => {
        // Clear any existing interval before setting up a new one
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        if (toast?.duration) {
            intervalRef.current = setInterval(() => {
                const elapsed = Date.now() - toast.startTime;
                const remaining = Math.max(0, toast.duration - elapsed);
                const pct = (remaining / toast.duration) * 100;

                setToast(prev => {
                    if (!prev) return null;
                    return { ...prev, progress: pct };
                });

                if (remaining <= 0) {
                    if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = null;
                    }
                    setToast(null);
                }
            }, 100);
        }

        // Cleanup function
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [toast?.startTime, toast?.duration]);

    const showClipboardToast = useCallback((msg) => {
        setToast({ message: msg, duration: 30000, startTime: Date.now(), progress: 100 });
    }, []);

    // BUG FIX 7: Attach showToast to window with proper cleanup
    useEffect(() => {
        window.showToast = showClipboardToast;
        return () => {
            // Clean up window reference on unmount
            if (window.showToast === showClipboardToast) {
                delete window.showToast;
            }
        };
    }, [showClipboardToast]);

    return (
        <div className="w-full h-full flex flex-col relative overflow-hidden bg-bg-primary">
            {/* WVAULT Celestial Background */}
            <div className="wvault-constellation-bg absolute inset-0 z-0" />
            <div className="wvault-stars absolute inset-0 z-[1]" />
            <div className="noise-bg absolute inset-0 z-[2]" />
            <Particles count={40} />

            {toast && <Toast message={toast.message} progress={toast.progress} />}

            {/* Title Bar (Mac-style inset) */}
            <div className="relative z-50">
                <TitleBar onLock={onLock} onSettings={onSettings} isLoggedIn={true} />
            </div>

            {/* Main Layout Area */}
            <div className="flex-1 flex min-h-0 relative z-10">
                <Sidebar
                    activeView={activeView}
                    onViewChange={onViewChange}
                    stats={stats}
                />

                {/* Content Area */}
                <main className="flex-1 flex flex-col min-w-0 bg-black/10 backdrop-blur-sm relative overflow-hidden">
                    {children}
                </main>
            </div>
        </div>
    );
}
