import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import Particles from '../3d/Particles';

export default function PinScreen({ onUnlock, onLogout }) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const mountedRef = useRef(true);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // BUG FIX 8: Fixed race condition - use useCallback and check mount state
    const handleUnlock = useCallback(async () => {
        if (isSubmitting || pin.length !== 4) return;
        
        setIsSubmitting(true);
        
        try {
            const res = await window.wvault.authUnlockWithPin(pin);
            
            // Only update state if component is still mounted
            if (mountedRef.current) {
                if (res.success) {
                    onUnlock();
                } else {
                    setError(true);
                    setPin('');
                    setTimeout(() => {
                        if (mountedRef.current) {
                            setError(false);
                        }
                    }, 500);
                }
            }
        } catch (err) {
            console.error('PIN unlock error:', err);
            if (mountedRef.current) {
                setError(true);
                setPin('');
            }
        } finally {
            if (mountedRef.current) {
                setIsSubmitting(false);
            }
        }
    }, [pin, isSubmitting, onUnlock]);

    // BUG FIX 8: Prevent multiple submissions when PIN is complete
    useEffect(() => {
        if (pin.length === 4 && !isSubmitting) {
            handleUnlock();
        }
    }, [pin, isSubmitting, handleUnlock]);

    const handleNum = (num) => {
        if (pin.length < 4 && !isSubmitting) {
            setPin(p => p + num);
        }
    };

    const handleBackspace = () => {
        if (!isSubmitting) {
            setPin(p => p.slice(0, -1));
        }
    };

    // Keyboard support
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (isSubmitting) return;
            
            if (e.key >= '0' && e.key <= '9') {
                handleNum(e.key);
            } else if (e.key === 'Backspace') {
                handleBackspace();
            } else if (e.key === 'Enter' && pin.length === 4) {
                handleUnlock();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [pin, isSubmitting, handleUnlock]);

    return (
        <div className="w-full h-full flex items-center justify-center relative bg-bg-primary overflow-hidden">
            <div className="vault-bg absolute inset-0 z-0" />
            <Particles count={30} />

            <motion.div
                className="glass-panel p-8 flex flex-col items-center relative z-10 w-80"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{
                    scale: 1,
                    opacity: 1,
                    x: error ? [-10, 10, -10, 10, 0] : 0
                }}
            >
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-6 border border-accent/20">
                    <Lock className="w-8 h-8 text-accent" />
                </div>

                <h2 className="text-xl font-bold text-white mb-2">Session Locked</h2>
                <p className="text-white/40 text-sm mb-6">Enter PIN to resume</p>

                {/* Dots */}
                <div className="flex gap-4 mb-8">
                    {[0, 1, 2, 3].map(i => (
                        <motion.div
                            key={i}
                            className={`w-3 h-3 rounded-full border border-white/30 ${i < pin.length ? 'bg-accent border-accent' : ''}`}
                            animate={i < pin.length ? { scale: [1, 1.2, 1] } : {}}
                        />
                    ))}
                </div>

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button
                            key={num}
                            onClick={() => handleNum(num.toString())}
                            disabled={isSubmitting}
                            className="w-12 h-12 rounded-full glass-button hover:bg-white/10 text-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {num}
                        </button>
                    ))}
                    <div />
                    <button
                        onClick={() => handleNum('0')}
                        disabled={isSubmitting}
                        className="w-12 h-12 rounded-full glass-button hover:bg-white/10 text-lg font-medium transition-colors disabled:opacity-50"
                    >
                        0
                    </button>
                    <button
                        onClick={handleBackspace}
                        disabled={isSubmitting}
                        className="w-12 h-12 rounded-full glass-button hover:bg-white/10 text-sm font-medium transition-colors flex items-center justify-center disabled:opacity-50"
                    >
                        ⌫
                    </button>
                </div>

                <button
                    onClick={onLogout}
                    disabled={isSubmitting}
                    className="text-xs text-white/30 hover:text-white/60 transition-colors disabled:opacity-50"
                >
                    Switch User / Full Login
                </button>
            </motion.div>
        </div>
    );
}
