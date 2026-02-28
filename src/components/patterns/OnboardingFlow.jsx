/**
 * WVAULT ONBOARDING PATTERN
 * Phase 2: Pattern Library - User Onboarding
 * 
 * Progressive disclosure: 3-tier system
 * - Step 1: Welcome (Glance)
 * - Step 2: Security Setup (Scan)
 * - Step 3: First Password (Deep)
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Shield, Lock, Fingerprint, ChevronRight, ChevronLeft,
    CheckCircle2, Sparkles, KeyRound, User
} from 'lucide-react';

const steps = [
    { id: 'welcome', title: 'Welcome to WVault', icon: Shield },
    { id: 'security', title: 'Security Setup', icon: Lock },
    { id: 'biometric', title: 'Quick Unlock', icon: Fingerprint },
    { id: 'complete', title: 'All Set!', icon: CheckCircle2 }
];

// Step 1: Welcome Screen (Glance - emotional hook)
function WelcomeStep({ onNext, userName, setUserName }) {
    return (
        <div className="space-y-8 text-center">
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-600/20 flex items-center justify-center border border-white/10"
            >
                <Shield className="w-12 h-12 text-indigo-400" />
            </motion.div>
            
            <div>
                <h2 className="text-3xl font-bold text-white mb-3">
                    Secure Your Digital Life
                </h2>
                <p className="text-white/50 max-w-sm mx-auto">
                    Zero-knowledge encryption. Biometric unlock. 
                    Completely offline. Your passwords, your control.
                </p>
            </div>

            <div className="space-y-4">
                <div className="relative max-w-xs mx-auto">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="What should we call you?"
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 text-center"
                    />
                </div>
                
                <button
                    onClick={onNext}
                    disabled={!userName.trim()}
                    className="w-full max-w-xs mx-auto py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                >
                    Get Started
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>
    );
}

// Step 2: Security Setup (Scan - information gathering)
function SecurityStep({ onNext, onBack, password, setPassword, confirmPassword, setConfirmPassword }) {
    const strength = calculateStrength(password);
    
    return (
        <div className="space-y-6">
            <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <KeyRound className="w-8 h-8 text-amber-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Create Master Password</h2>
                <p className="text-white/50 text-sm">
                    This is the only password you'll need to remember.
                </p>
            </div>

            <div className="space-y-4 max-w-sm mx-auto">
                {/* Password Input */}
                <div className="space-y-2">
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Master Password"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50"
                    />
                    
                    {/* Strength Indicator */}
                    {password && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="space-y-2"
                        >
                            <div className="flex gap-1 h-1.5">
                                {[1, 2, 3, 4, 5].map((level) => (
                                    <div
                                        key={level}
                                        className={`flex-1 rounded-full transition-all duration-300 ${
                                            level <= strength.score
                                                ? strength.score >= 4 ? 'bg-emerald-500' :
                                                  strength.score >= 3 ? 'bg-blue-500' :
                                                  strength.score >= 2 ? 'bg-amber-500' : 'bg-red-500'
                                                : 'bg-white/10'
                                        }`}
                                    />
                                ))}
                            </div>
                            <p className={`text-xs ${strength.color}`}>{strength.label}</p>
                        </motion.div>
                    )}
                </div>

                <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm Password"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50"
                />

                {/* Critical Warning */}
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3">
                    <Sparkles className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <p className="text-xs text-red-200/80">
                        <strong>No password recovery.</strong> If you lose this password, 
                        your data is lost forever. Store it securely.
                    </p>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-3 max-w-sm mx-auto">
                <button
                    onClick={onBack}
                    className="flex-1 py-4 rounded-xl bg-white/5 text-white/70 hover:bg-white/10 transition-colors"
                >
                    Back
                </button>
                <button
                    onClick={onNext}
                    disabled={!password || password !== confirmPassword || strength.score < 2}
                    className="flex-1 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Continue
                </button>
            </div>
        </div>
    );
}

// Step 3: Biometric Setup (Optional)
function BiometricStep({ onNext, onSkip, biometricStatus }) {
    const [isRegistering, setIsRegistering] = useState(false);
    
    const handleRegister = async () => {
        setIsRegistering(true);
        try {
            await window.wvault.biometricRegister();
            onNext();
        } catch (err) {
            console.error('Biometric registration failed:', err);
        } finally {
            setIsRegistering(false);
        }
    };
    
    if (!biometricStatus?.available) {
        onSkip();
        return null;
    }

    return (
        <div className="space-y-8 text-center">
            <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-600/20 flex items-center justify-center border border-emerald-500/30"
            >
                <Fingerprint className="w-12 h-12 text-emerald-400" />
            </motion.div>
            
            <div>
                <h2 className="text-2xl font-bold text-white mb-2">Enable Quick Unlock</h2>
                <p className="text-white/50 max-w-sm mx-auto">
                    Use {biometricStatus.method === 'touch-id' ? 'Touch ID' : 
                         biometricStatus.method === 'windows-hello' ? 'Windows Hello' : 
                         'your fingerprint'} for instant access.
                </p>
            </div>

            <div className="space-y-3 max-w-xs mx-auto">
                <button
                    onClick={handleRegister}
                    disabled={isRegistering}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold flex items-center justify-center gap-2"
                >
                    {isRegistering ? (
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                            <Sparkles className="w-5 h-5" />
                        </motion.div>
                    ) : (
                        <Fingerprint className="w-5 h-5" />
                    )}
                    {isRegistering ? 'Setting up...' : 'Enable Biometric'}
                </button>
                
                <button
                    onClick={onSkip}
                    className="w-full py-3 text-white/40 hover:text-white/60 text-sm"
                >
                    Skip for now
                </button>
            </div>
        </div>
    );
}

// Step 4: Complete
function CompleteStep({ userName, onFinish }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-8 text-center"
        >
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 flex items-center justify-center border border-emerald-500/30"
            >
                <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            </motion.div>
            
            <div>
                <h2 className="text-3xl font-bold text-white mb-2">You're All Set!</h2>
                <p className="text-white/50">
                    Welcome to WVault, {userName}. Your secure vault is ready.
                </p>
            </div>

            <button
                onClick={onFinish}
                className="w-full max-w-xs mx-auto py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold"
            >
                Open My Vault
            </button>
        </motion.div>
    );
}

// Helper: Calculate password strength
function calculateStrength(password) {
    if (!password) return { score: 0, label: '', color: '' };
    
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    
    const labels = ['Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
    const colors = ['text-red-500', 'text-red-400', 'text-amber-400', 'text-blue-400', 'text-emerald-400', 'text-emerald-300'];
    
    return {
        score: Math.min(score, 5),
        label: labels[Math.min(score, 5)],
        color: colors[Math.min(score, 5)]
    };
}

// Main Onboarding Component
export default function OnboardingFlow({ onComplete }) {
    const [currentStep, setCurrentStep] = useState(0);
    const [userName, setUserName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [biometricStatus, setBiometricStatus] = useState(null);

    useEffect(() => {
        const checkBiometric = async () => {
            const status = await window.wvault.biometricGetStatus();
            setBiometricStatus(status);
        };
        checkBiometric();
    }, []);

    const handleFinish = () => {
        onComplete({ userName, password, biometricEnabled: true });
    };

    return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
            {/* Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[128px]" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[128px]" />
            </div>

            <div className="relative z-10 w-full max-w-lg">
                {/* Progress Steps */}
                <div className="flex items-center justify-center gap-2 mb-12">
                    {steps.map((step, index) => {
                        const Icon = step.icon;
                        const isActive = index === currentStep;
                        const isCompleted = index < currentStep;
                        
                        return (
                            <React.Fragment key={step.id}>
                                <motion.div
                                    animate={{
                                        backgroundColor: isActive || isCompleted ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                        borderColor: isActive ? 'rgba(99, 102, 241, 0.5)' : isCompleted ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                    }}
                                    className="w-10 h-10 rounded-full flex items-center justify-center border"
                                >
                                    <Icon className={`w-5 h-5 ${isActive || isCompleted ? 'text-indigo-400' : 'text-white/30'}`} />
                                </motion.div>
                                {index < steps.length - 1 && (
                                    <div className={`w-8 h-0.5 ${isCompleted ? 'bg-indigo-500/50' : 'bg-white/10'}`} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Step Content */}
                <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-8">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            {currentStep === 0 && (
                                <WelcomeStep 
                                    onNext={() => setCurrentStep(1)}
                                    userName={userName}
                                    setUserName={setUserName}
                                />
                            )}
                            {currentStep === 1 && (
                                <SecurityStep
                                    onNext={() => setCurrentStep(2)}
                                    onBack={() => setCurrentStep(0)}
                                    password={password}
                                    setPassword={setPassword}
                                    confirmPassword={confirmPassword}
                                    setConfirmPassword={setConfirmPassword}
                                />
                            )}
                            {currentStep === 2 && (
                                <BiometricStep
                                    onNext={() => setCurrentStep(3)}
                                    onSkip={() => setCurrentStep(3)}
                                    biometricStatus={biometricStatus}
                                />
                            )}
                            {currentStep === 3 && (
                                <CompleteStep
                                    userName={userName}
                                    onFinish={handleFinish}
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Step Indicator */}
                <div className="flex justify-center gap-2 mt-8">
                    {steps.map((_, index) => (
                        <div
                            key={index}
                            className={`w-2 h-2 rounded-full transition-colors ${
                                index === currentStep ? 'bg-indigo-500' : 'bg-white/20'
                            }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
