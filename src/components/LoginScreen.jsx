import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield, Eye, EyeOff, KeyRound, Lock, Fingerprint,
    LogOut, AlertTriangle, CheckCircle2, User, ChevronRight,
    Loader2, Sparkles, ScanFace, Trash2
} from 'lucide-react';

// Password strength analyzer
const analyzePasswordStrength = (password) => {
    if (!password) return { score: 0, label: 'None', color: 'text-gray-400' };

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
    const colors = [
        'text-red-500',
        'text-red-400',
        'text-yellow-400',
        'text-blue-400',
        'text-emerald-400',
        'text-emerald-300'
    ];

    return {
        score: Math.min(score, 5),
        label: labels[Math.min(score, 5)],
        color: colors[Math.min(score, 5)]
    };
};

// Biometric icon component
const BiometricIcon = ({ method, className = "" }) => {
    switch (method) {
        case 'windows-hello':
            return <ScanFace className={className} />;
        case 'touch-id':
            return <Fingerprint className={className} />;
        case 'fingerprint':
            return <Fingerprint className={className} />;
        default:
            return <Fingerprint className={className} />;
    }
};

// Forgot Password — nuclear reset flow (two-step confirm inline)
function ForgotPasswordReset() {
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);

    const handleReset = async () => {
        setLoading(true);
        try {
            await window.wvault.authReset();
            window.location.reload();
        } catch (err) {
            console.error('Reset error:', err);
            setLoading(false);
        }
    };

    if (step === 0) {
        return (
            <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full py-3 text-white/25 hover:text-white/50 transition-colors text-[13px]"
            >
                Forgot password?
            </button>
        );
    }

    return (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 space-y-3">
            <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-[13px] font-semibold text-red-300">Reset Vault?</p>
                    <p className="text-[11px] text-red-200/60 mt-0.5">
                        This permanently erases <strong>all data</strong>. There is no recovery.
                    </p>
                </div>
            </div>
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="flex-1 py-2 rounded-xl text-[13px] text-white/40 hover:text-white/60 border border-white/[0.06] hover:bg-white/[0.04] transition-all"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleReset}
                    disabled={loading}
                    className="flex-1 py-2 rounded-xl text-[13px] font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Erase & Reset
                </button>
            </div>
        </div>
    );
}

export default function LoginScreen({ isFirstRun, onLogin, onSetup }) {
    // Form state
    const [step, setStep] = useState(1);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [setupSuccess, setSetupSuccess] = useState(false);

    // Biometric state
    const [biometricStatus, setBiometricStatus] = useState(null);
    const [biometricEnrolled, setBiometricEnrolled] = useState(false);
    const [isBiometricLoading, setIsBiometricLoading] = useState(false);

    // UI state
    const mountedRef = useRef(true);

    useEffect(() => {
        return () => { mountedRef.current = false; };
    }, []);

    // Check biometric status on mount
    useEffect(() => {
        const checkBiometric = async () => {
            if (!isFirstRun) {
                try {
                    const status = await window.wvault.biometricGetStatus();
                    setBiometricStatus(status);

                    if (status.available) {
                        const enrolled = await window.wvault.biometricIsEnrolled();
                        setBiometricEnrolled(enrolled.enrolled);
                    }
                } catch (err) {
                    console.log('[Biometric] Status check failed:', err);
                }
            }
        };
        checkBiometric();
    }, [isFirstRun]);

    const handleBiometricAuth = async () => {
        setIsBiometricLoading(true);
        setError('');

        try {
            const result = await window.wvault.biometricAuthenticate();
            if (result.success && result.password) {
                // Use the retrieved password to login
                const loginResult = await window.wvault.authLogin(result.password);
                if (loginResult.success) {
                    onLogin();
                } else {
                    setError('Biometric authentication succeeded but vault unlock failed');
                }
            } else {
                setError(result.error || 'Biometric authentication failed');
            }
        } catch (err) {
            setError('Biometric authentication error');
        } finally {
            setIsBiometricLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isFirstRun) {
                if (step === 1) {
                    const trimmedName = name.trim();
                    if (!trimmedName || trimmedName.length < 2) {
                        setError('Please enter a valid name (at least 2 characters)');
                        setLoading(false);
                        return;
                    }
                    setStep(2);
                    setLoading(false);
                    return;
                }

                // Validate password
                if (password.length < 8) {
                    setError('Password must be at least 8 characters');
                    setLoading(false);
                    return;
                }

                if (password !== confirmPassword) {
                    setError('Passwords do not match');
                    setLoading(false);
                    return;
                }

                setSetupSuccess(true);

                const result = await window.wvault.authSetup(password, name);

                if (!result.success) {
                    setSetupSuccess(false);
                    setError(result.error || 'Failed to create vault');
                    setLoading(false);
                    return;
                }

                // Register biometric if available
                const bioStatus = await window.wvault.biometricGetStatus();
                if (bioStatus.available) {
                    try {
                        await window.wvault.biometricRegister();
                        console.log('[Biometric] Registered successfully');
                    } catch (bioErr) {
                        console.log('[Biometric] Registration skipped:', bioErr);
                    }
                }

                setTimeout(() => {
                    if (mountedRef.current) {
                        onSetup(result.name || name);
                    }
                }, 1000);
            } else {
                // Login
                const result = await window.wvault.authLogin(password);
                if (!result.success) {
                    setError(result.error || 'Incorrect password');
                    setLoading(false);
                    return;
                }
                onLogin();
            }
        } catch (err) {
            console.error('Auth error:', err);
            setError('An unexpected error occurred');
            setLoading(false);
        }
    };

    const passwordStrength = analyzePasswordStrength(password);

    // Success state after setup
    if (setupSuccess) {
        return (
            <div className="w-full h-full flex flex-col bg-[#0a0a0f] relative overflow-hidden">
                {/* Animated background */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/15 rounded-full blur-[128px] animate-pulse" />
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/15 rounded-full blur-[128px] animate-pulse delay-1000" />
                </div>

                <div className="flex-1 flex items-center justify-center p-6 relative z-10">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-center"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 15 }}
                            className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 flex items-center justify-center border border-emerald-500/30"
                        >
                            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                        </motion.div>
                        <h2 className="text-3xl font-bold text-white mb-3" style={{ letterSpacing: '-0.03em' }}>Vault Created!</h2>
                        <p className="text-white/40 text-[15px]">Welcome to WVault, {name}. Your secure world awaits.</p>
                    </motion.div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col bg-[#0a0a0f] relative overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[150px]" />
                <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[150px]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-[200px]" />
            </div>

            {/* Grid pattern overlay */}
            <div
                className="absolute inset-0 opacity-[0.02]"
                style={{
                    backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                                      linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                    backgroundSize: '50px 50px'
                }}
            />

            {/* Content */}
            <div className="flex-1 flex items-center justify-center p-6 relative z-10">
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="w-full max-w-md"
                >
                    {/* Logo/Icon with breathing glow */}
                    <div className="flex justify-center mb-10">
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="relative"
                        >
                            {/* Glow halo */}
                            <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-cyan-500/30 to-purple-600/30 blur-xl animate-pulse" />
                            <div className="relative w-[88px] h-[88px] rounded-[28px] bg-gradient-to-br from-[#0d1525] to-[#0f1a30] flex items-center justify-center border border-white/10 shadow-lg shadow-cyan-500/10">
                                <Shield className="w-11 h-11 text-cyan-400" />
                            </div>
                        </motion.div>
                    </div>

                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-[34px] font-bold text-white mb-3" style={{ letterSpacing: '-0.03em' }}>
                            {isFirstRun ? 'Create Your Vault' : 'Welcome Back'}
                        </h1>
                        <p className="text-white/35 text-[15px] leading-relaxed max-w-xs mx-auto">
                            {isFirstRun
                                ? 'Secure your digital life with military-grade encryption'
                                : 'Unlock your vault to access your secure world'
                            }
                        </p>
                    </div>

                    {/* Biometric Auth Option (Login only) */}
                    {!isFirstRun && biometricStatus?.available && biometricEnrolled && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6"
                        >
                            <button
                                onClick={handleBiometricAuth}
                                disabled={isBiometricLoading}
                                className="w-full py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all group flex items-center justify-center gap-3"
                            >
                                {isBiometricLoading ? (
                                    <Loader2 className="w-6 h-6 text-white/60 animate-spin" />
                                ) : (
                                    <>
                                        <BiometricIcon
                                            method={biometricStatus.method}
                                            className="w-6 h-6 text-cyan-400 group-hover:scale-110 transition-transform"
                                        />
                                        <span className="text-white font-medium">
                                            Unlock with {biometricStatus.method === 'touch-id' ? 'Touch ID' :
                                                biometricStatus.method === 'windows-hello' ? 'Windows Hello' :
                                                    'Fingerprint'}
                                        </span>
                                    </>
                                )}
                            </button>

                            <div className="flex items-center gap-4 my-6">
                                <div className="flex-1 h-px bg-white/10" />
                                <span className="text-white/30 text-sm">or</span>
                                <div className="flex-1 h-px bg-white/10" />
                            </div>
                        </motion.div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isFirstRun && step === 1 && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="space-y-4"
                            >
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => {
                                            setName(e.target.value);
                                            if (error) setError('');
                                        }}
                                        placeholder="Your Name"
                                        maxLength={50}
                                        autoFocus
                                        autoComplete="name"
                                        aria-label="Your name"
                                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl pl-12 pr-4 py-4.5 text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/30 focus:bg-white/[0.06] transition-all text-[15px]"
                                    />
                                </div>
                            </motion.div>
                        )}

                        {(isFirstRun && step === 2) || !isFirstRun ? (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="space-y-4"
                            >
                                {/* Password Input */}
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value);
                                            if (error) setError('');
                                        }}
                                        placeholder={isFirstRun ? 'Create Master Password' : 'Enter Master Password'}
                                        autoComplete={isFirstRun ? 'new-password' : 'current-password'}
                                        aria-label={isFirstRun ? 'Create master password' : 'Enter master password'}
                                        aria-describedby="password-requirements"
                                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl pl-12 pr-12 py-4.5 text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/30 focus:bg-white/[0.06] transition-all text-[15px]"
                                        autoFocus={!isFirstRun}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>

                                {/* Password Strength Indicator */}
                                {isFirstRun && password && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="space-y-2"
                                    >
                                        <div className="flex gap-1.5 h-1.5">
                                            {[...Array(4)].map((_, i) => (
                                                <div
                                                    key={i}
                                                    className={`flex-1 rounded-full transition-all duration-500 ${i < passwordStrength.score
                                                        ? passwordStrength.score >= 4 ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30' :
                                                            passwordStrength.score >= 3 ? 'bg-cyan-500 shadow-sm shadow-cyan-500/30' :
                                                                passwordStrength.score >= 2 ? 'bg-amber-500 shadow-sm shadow-amber-500/30' : 'bg-red-500 shadow-sm shadow-red-500/30'
                                                        : 'bg-white/[0.06]'
                                                        }`}
                                                />
                                            ))}
                                        </div>
                                        <p className={`text-xs ${passwordStrength.color}`}>
                                            {passwordStrength.label}
                                        </p>
                                    </motion.div>
                                )}

                                {/* Confirm Password */}
                                {isFirstRun && (
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) => {
                                                setConfirmPassword(e.target.value);
                                                if (error) setError('');
                                            }}
                                            placeholder="Confirm Password"
                                            autoComplete="new-password"
                                            aria-label="Confirm master password"
                                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl pl-12 pr-4 py-4.5 text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/30 focus:bg-white/[0.06] transition-all text-[15px]"
                                        />
                                    </div>
                                )}

                                {/* Security Warning */}
                                {isFirstRun && (
                                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3">
                                        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <h3 className="text-sm font-semibold text-amber-300 mb-1">No Password Recovery</h3>
                                            <p className="text-xs text-amber-200/70">
                                                This is a zero-knowledge vault. If you lose your password,
                                                <strong> all data is lost forever</strong>.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        ) : null}

                        {/* Error Display */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10, x: 0 }}
                                    animate={{ opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ x: { duration: 0.4, ease: 'easeInOut' } }}
                                    className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3"
                                >
                                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                                    <p className="text-sm text-red-300">{error}</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-semibold shadow-lg shadow-cyan-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group text-[15px]"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <span>{isFirstRun ? (step === 1 ? 'Continue' : 'Create Vault') : 'Unlock Vault'}</span>
                                    <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                                </>
                            )}
                        </button>

                        {/* Back Button (Setup step 2) */}
                        {isFirstRun && step === 2 && (
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="w-full py-3 text-white/40 hover:text-white/60 transition-colors text-sm"
                            >
                                ← Back
                            </button>
                        )}

                        {/* Forgot Password — only shown on login (not first run) */}
                        {!isFirstRun && (
                            <ForgotPasswordReset />
                        )}
                    </form>

                    {/* Footer */}
                    <div className="mt-8 flex items-center justify-center gap-2 text-white/20 text-xs">
                        <Sparkles className="w-3 h-3" />
                        <span>Zero-knowledge • AES-256-GCM • Offline-first</span>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
