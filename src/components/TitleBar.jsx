import React from 'react';
import { Shield, Minus, Square, X, Settings, Lock } from 'lucide-react';

export default function TitleBar({ onLock, onSettings, isLoggedIn }) {
    return (
        <header className="drag-region h-11 flex items-center justify-between px-4 border-b border-white/[0.04] bg-black/30 backdrop-blur-md relative z-50 flex-shrink-0">
            {/* Logo */}
            <div className="flex items-center gap-2.5 no-drag">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center border border-cyan-400/15">
                    <Shield className="w-3.5 h-3.5 text-cyan-300" strokeWidth={2} />
                </div>
                <span className="text-xs font-semibold tracking-wide text-secondary uppercase">
                    WVault
                </span>
                {isLoggedIn && (
                    <span className="flex items-center gap-1 text-[10px] text-white/20 ml-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/40 animate-pulse" />
                        Unlocked
                    </span>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-0.5 no-drag">
                {isLoggedIn && (
                    <>
                        <button
                            onClick={onSettings}
                            className="no-drag w-7 h-7 flex items-center justify-center rounded-md text-muted hover:text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200"
                            title="Settings"
                        >
                            <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={onLock}
                            className="no-drag w-7 h-7 flex items-center justify-center rounded-md text-[#FF2D55] hover:text-[#FF4D6F] hover:bg-[#FF2D55]/10 transition-all duration-200"
                            title="Lock Vault (Ctrl+L)"
                        >
                            <Lock className="w-3.5 h-3.5" />
                        </button>
                        <div className="w-px h-4 bg-white/[0.06] mx-1" />
                    </>
                )}
                <button
                    onClick={() => window.wvault.minimize()}
                    className="no-drag w-7 h-7 flex items-center justify-center rounded-md text-muted hover:text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200"
                >
                    <Minus className="w-3 h-3" />
                </button>
                <button
                    onClick={() => window.wvault.maximize()}
                    className="no-drag w-7 h-7 flex items-center justify-center rounded-md text-muted hover:text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200"
                >
                    <Square className="w-2.5 h-2.5" />
                </button>
                <button
                    onClick={() => window.wvault.close()}
                    className="no-drag w-7 h-7 flex items-center justify-center rounded-md text-muted hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                >
                    <X className="w-3 h-3" />
                </button>
            </div>
        </header>
    );
}
