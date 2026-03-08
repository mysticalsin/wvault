/**
 * WVAULT CONFIRM DIALOG PATTERN
 * Phase 2: Pattern Library - Confirmation Flows
 * 
 * Anti-pattern prevention:
 * - NO destructive actions without confirmation
 * - NO vague button labels ("OK" / "Cancel")
 * - ALWAYS show consequences of the action
 * - ALWAYS allow escape (ESC key, click outside, Cancel)
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useFocusTrap from '../../hooks/useFocusTrap';
import { 
    AlertTriangle, X, Trash2, Lock, LogOut, 
    RefreshCw, ShieldAlert, CheckCircle2
} from 'lucide-react';

const dialogConfigs = {
    delete: {
        icon: Trash2,
        iconColor: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/20',
        confirmLabel: 'Delete',
        confirmClass: 'bg-red-600 hover:bg-red-500',
        destructive: true
    },
    trash: {
        icon: Trash2,
        iconColor: 'text-amber-400',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/20',
        confirmLabel: 'Move to Trash',
        confirmClass: 'bg-amber-600 hover:bg-amber-500',
        destructive: true
    },
    logout: {
        icon: LogOut,
        iconColor: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/20',
        confirmLabel: 'Log Out',
        confirmClass: 'bg-blue-600 hover:bg-blue-500',
        destructive: false
    },
    lock: {
        icon: Lock,
        iconColor: 'text-emerald-400',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/20',
        confirmLabel: 'Lock Vault',
        confirmClass: 'bg-emerald-600 hover:bg-emerald-500',
        destructive: false
    },
    reset: {
        icon: ShieldAlert,
        iconColor: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/20',
        confirmLabel: 'Reset Everything',
        confirmClass: 'bg-red-600 hover:bg-red-500',
        destructive: true
    },
    restore: {
        icon: RefreshCw,
        iconColor: 'text-emerald-400',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/20',
        confirmLabel: 'Restore',
        confirmClass: 'bg-emerald-600 hover:bg-emerald-500',
        destructive: false
    }
};

export default function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    type = 'delete',
    title,
    message,
    itemName,
    confirmLabel,
    cancelLabel = 'Cancel',
    isLoading = false,
    requireTextConfirmation = false,
    confirmationText = 'DELETE'
}) {
    const [inputValue, setInputValue] = React.useState('');
    const focusTrapRef = useFocusTrap(isOpen);

    const config = dialogConfigs[type];
    const Icon = config.icon;
    
    // Reset input when dialog opens
    useEffect(() => {
        if (isOpen) {
            setInputValue('');
        }
    }, [isOpen]);
    
    // Handle ESC key
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);
    
    const handleConfirm = () => {
        if (requireTextConfirmation && inputValue !== confirmationText) {
            return;
        }
        onConfirm();
    };
    
    const isConfirmDisabled = isLoading || 
        (requireTextConfirmation && inputValue !== confirmationText);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    
                    {/* Dialog */}
                    <motion.div
                        ref={focusTrapRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label={title || config.title}
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-md bg-[#151520] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-start gap-4 p-6 pb-4">
                            <div className={`w-12 h-12 rounded-xl ${config.bgColor} border ${config.borderColor} flex items-center justify-center flex-shrink-0`}>
                                <Icon className={`w-6 h-6 ${config.iconColor}`} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-semibold text-white mb-1">
                                    {title}
                                </h3>
                                <p className="text-sm text-white/60 leading-relaxed">
                                    {message}
                                </p>
                                {itemName && (
                                    <p className="mt-2 text-sm font-medium text-white/80 truncate">
                                        "{itemName}"
                                    </p>
                                )}
                            </div>
                            
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg text-white/60 hover:text-white/60 hover:bg-white/5 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Text Confirmation (for destructive actions) */}
                        {requireTextConfirmation && (
                            <div className="px-6 pb-4">
                                <label className="block text-xs font-medium text-white/50 mb-2">
                                    Type <span className="text-white/80 font-semibold">{confirmationText}</span> to confirm
                                </label>
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder={confirmationText}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/60 focus:outline-none focus:border-red-500/50 text-center tracking-widest uppercase font-mono"
                                    autoFocus
                                />
                            </div>
                        )}
                        
                        {/* Footer Actions */}
                        <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-white/5">
                            <button
                                onClick={onClose}
                                disabled={isLoading}
                                className="px-5 py-2.5 rounded-xl text-white/70 hover:text-white hover:bg-white/5 font-medium transition-colors disabled:opacity-50"
                            >
                                {cancelLabel}
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={isConfirmDisabled}
                                className={`px-5 py-2.5 rounded-xl text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${config.confirmClass}`}
                            >
                                {isLoading ? (
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </motion.div>
                                ) : null}
                                {confirmLabel || config.confirmLabel}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// Usage Examples Component
export function ConfirmDialogExamples() {
    const [dialog, setDialog] = React.useState(null);
    
    return (
        <div className="space-y-4">
            <button
                onClick={() => setDialog({ type: 'delete', title: 'Delete Password?', message: 'This action cannot be undone. The password will be permanently removed from your vault.' })}
                className="text-sm text-red-400 hover:text-red-300"
            >
                Test Delete Dialog
            </button>
            
            <button
                onClick={() => setDialog({ type: 'reset', title: 'Reset Vault?', message: 'This will delete ALL your passwords and data. This cannot be undone.', requireTextConfirmation: true })}
                className="text-sm text-red-400 hover:text-red-300"
            >
                Test Reset Dialog (with confirmation)
            </button>
            
            {dialog && (
                <ConfirmDialog
                    isOpen={!!dialog}
                    onClose={() => setDialog(null)}
                    onConfirm={() => {
                        console.log('Confirmed:', dialog.type);
                        setDialog(null);
                    }}
                    {...dialog}
                />
            )}
        </div>
    );
}
