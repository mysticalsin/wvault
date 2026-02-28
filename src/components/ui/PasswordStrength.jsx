import React, { useMemo } from 'react';

/**
 * Compute approximate entropy in bits for a given password.
 * charset_size is estimated from character classes used.
 * @param {string} password
 * @returns {number} bits
 */
function calcEntropy(password) {
    if (!password) return 0;
    let charsetSize = 0;
    if (/[a-z]/.test(password)) charsetSize += 26;
    if (/[A-Z]/.test(password)) charsetSize += 26;
    if (/[0-9]/.test(password)) charsetSize += 10;
    if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32;
    if (charsetSize === 0) return 0;
    return Math.floor(password.length * Math.log2(charsetSize));
}

/**
 * Computes password strength score and metadata.
 * @param {string} password
 * @returns {{ score: number, label: string, color: string, percent: number, bits: number }}
 */
export function getStrength(password) {
    if (!password) return { score: 0, label: '', color: '#333', percent: 0, bits: 0 };

    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (password.length >= 14) score++;
    if (password.length >= 20) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    // Penalties
    if (/^[a-zA-Z]+$/.test(password)) score = Math.max(score - 1, 0);
    if (/^[0-9]+$/.test(password)) score = Math.max(score - 2, 0);
    if (/(.)\\1{2,}/.test(password)) score = Math.max(score - 1, 0);

    const maxScore = 8;
    const percent = Math.round((Math.min(score, maxScore) / maxScore) * 100);
    const bits = calcEntropy(password);

    if (percent <= 25) return { score, label: 'Weak', color: '#ef4444', percent, bits };
    if (percent <= 50) return { score, label: 'Fair', color: '#f59e0b', percent, bits };
    if (percent <= 75) return { score, label: 'Good', color: '#3b82f6', percent, bits };
    return { score, label: 'Strong', color: '#10b981', percent, bits };
}

/**
 * Visual password strength meter bar.
 * WCAG 2.1: does NOT rely on color alone — includes text label and entropy count.
 */
export default function PasswordStrength({ password }) {
    const { label, color, percent, bits } = useMemo(() => getStrength(password), [password]);

    if (!password) return null;

    return (
        <div className="space-y-1.5">
            {/* Bar track — aria-hidden because screen reader text below describes it */}
            <div
                className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden"
                aria-hidden="true"
            >
                <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                        width: `${percent}%`,
                        background: `linear-gradient(90deg, ${color}cc, ${color})`,
                        boxShadow: `0 0 8px ${color}66`,
                    }}
                />
            </div>
            {/* Labels — accessible description (not color-only) */}
            <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/25 uppercase tracking-widest">Strength</span>
                <div className="flex items-center gap-2">
                    {/* Entropy display — helps assess passphrase quality */}
                    {bits > 0 && (
                        <span className="text-[10px] text-white/30" aria-label={`${bits} bits of entropy`}>
                            {bits} bits
                        </span>
                    )}
                    <span
                        className="text-[10px] font-semibold uppercase tracking-wider transition-colors duration-300"
                        style={{ color }}
                        aria-live="polite"
                        aria-label={`Password strength: ${label}${bits > 0 ? `, ${bits} bits of entropy` : ''}`}
                    >
                        {label}
                    </span>
                </div>
            </div>
        </div>
    );
}
