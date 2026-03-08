import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';

/**
 * Reusable confirmation dialog with animated open/close.
 *
 * Props:
 *  - title: string
 *  - message: string
 *  - confirmLabel?: string (default "Delete")
 *  - onConfirm: () => void
 *  - onCancel: () => void
 *  - danger?: boolean (uses red styling)
 */
export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel, danger = true }) {
    const [isClosing, setIsClosing] = useState(false);
    const focusTrapRef = useFocusTrap(!isClosing);

    const handleClose = useCallback(() => {
        if (isClosing) return;
        setIsClosing(true);
    }, [isClosing]);

    useEffect(() => {
        if (!isClosing) return;
        const timer = setTimeout(onCancel, 200);
        return () => clearTimeout(timer);
    }, [isClosing, onCancel]);

    // Escape key
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [handleClose]);

    return (
        <div
            className={`modal-overlay ${isClosing ? 'animate-overlay-out' : 'animate-overlay-in'}`}
            onClick={handleClose}
        >
            <div
                ref={focusTrapRef}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="modal-content glass-panel w-full max-w-sm p-6"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Icon + Title */}
                <div className="flex items-start gap-4 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${danger ? 'bg-red-500/15 border border-red-500/20' : 'bg-amber-500/15 border border-amber-500/20'}`}>
                        <AlertTriangle className={`w-5 h-5 ${danger ? 'text-red-400' : 'text-amber-400'}`} />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-white/90">{title}</h3>
                        <p className="text-sm text-white/60 mt-1 leading-relaxed">{message}</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 mt-6">
                    <button
                        onClick={handleClose}
                        className="glass-button flex-1 py-2.5 text-sm font-medium text-center"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => { onConfirm(); handleClose(); }}
                        className={`flex-1 py-2.5 text-sm font-semibold text-center rounded-[10px] border transition-all duration-200 cursor-pointer ${danger
                                ? 'bg-red-500/25 border-red-500/30 text-red-300 hover:bg-red-500/40 hover:border-red-500/50 hover:shadow-[0_4px_20px_rgba(239,68,68,0.2)]'
                                : 'bg-amber-500/25 border-amber-500/30 text-amber-300 hover:bg-amber-500/40 hover:border-amber-500/50'
                            }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
