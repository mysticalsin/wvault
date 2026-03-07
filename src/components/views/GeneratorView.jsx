import React, { useState, useEffect } from 'react';
import { RefreshCw, Copy, Check, ShieldCheck, Settings2, Hash, Type, Eye } from 'lucide-react';

export default function GeneratorView() {
    const [password, setPassword] = useState('');
    const [length, setLength] = useState(24);
    const [options, setOptions] = useState({
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
        easyToSay: false,
        easyToRead: false,
    });
    const [copied, setCopied] = useState(false);

    const generate = () => {
        let charset = '';
        if (options.uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        if (options.lowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
        if (options.numbers) charset += '0123456789';
        if (options.symbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

        let finalCharset = charset;
        if (options.easyToRead) {
            finalCharset = finalCharset.replace(/[IOl01]/g, '');
        }

        if (!finalCharset) return;

        let pwd = '';
        const array = new Uint32Array(length);
        crypto.getRandomValues(array);
        for (let i = 0; i < length; i++) {
            pwd += finalCharset[array[i] % finalCharset.length];
        }
        setPassword(pwd);
        setCopied(false);
    };

    useEffect(() => { generate(); }, [length, options]);

    const copy = () => {
        navigator.clipboard.writeText(password);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const toggleOption = (key) => setOptions(prev => ({ ...prev, [key]: !prev[key] }));

    return (
        <div className="h-full flex flex-col p-8 max-w-3xl mx-auto w-full items-center justify-center">
            <header className="mb-8 text-center">
                <div className="w-14 h-14 mx-auto mb-4 bg-purple-400/10 rounded-2xl flex items-center justify-center border border-purple-400/15">
                    <ShieldCheck className="w-7 h-7 text-fuchsia-400" strokeWidth={1.75} />
                </div>
                <h2 className="text-[28px] font-bold text-white/90" style={{ letterSpacing: '-0.03em' }}>Password Generator</h2>
                <p className="text-white/60 mt-2 text-[14px]">Create strong, secure passwords instantly.</p>
            </header>

            {/* Password Display */}
            <div className="relative mb-8 group w-full">
                <div className="glass-panel p-8 text-center font-mono tracking-[0.15em] break-all text-white/90 selection:bg-fuchsia-500/30 selection:text-white min-h-[5rem] flex items-center justify-center relative overflow-hidden backdrop-blur-2xl bg-white/[0.03] border-white/[0.08]">
                    <span className="text-3xl leading-relaxed">
                        {password.split('').map((char, i) => {
                            const isDigit = /\d/.test(char);
                            const isSymbol = /[^a-zA-Z0-9]/.test(char);
                            return (
                                <span key={i} className={isSymbol ? 'text-purple-400' : isDigit ? 'text-amber-400' : 'text-fuchsia-300'}>{char}</span>
                            );
                        })}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/40 to-transparent" />
                </div>

                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                    <button onClick={generate} className="p-2.5 bg-white/[0.06] hover:bg-fuchsia-500/20 rounded-xl text-white/70 hover:text-fuchsia-400 transition-all backdrop-blur-md border border-white/[0.08]" title="Regenerate">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button onClick={copy} className="p-2.5 bg-white/[0.06] hover:bg-emerald-500/20 rounded-xl text-white/70 hover:text-emerald-400 transition-all backdrop-blur-md border border-white/[0.08]" title="Copy">
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Controls */}
            <div className="glass-panel p-8 space-y-8 w-full">
                {/* Length Slider */}
                <div>
                    <div className="flex justify-between mb-4 items-center">
                        <span className="text-[13px] font-semibold text-white/60">Password Length</span>
                        <span className="text-fuchsia-400 text-[13px] font-semibold bg-purple-400/10 px-3 py-1 rounded-lg border border-purple-400/15">{length} characters</span>
                    </div>
                    <input
                        type="range"
                        min="8"
                        max="64"
                        value={length}
                        onChange={(e) => setLength(parseInt(e.target.value))}
                        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent hover:accent-accent-light transition-all"
                    />
                </div>

                {/* Toggles Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <Toggle label="Uppercase" sub="(A-Z)" checked={options.uppercase} onChange={() => toggleOption('uppercase')} icon={Type} />
                    <Toggle label="Lowercase" sub="(a-z)" checked={options.lowercase} onChange={() => toggleOption('lowercase')} icon={Type} lower />
                    <Toggle label="Numbers" sub="(0-9)" checked={options.numbers} onChange={() => toggleOption('numbers')} icon={Hash} />
                    <Toggle label="Symbols" sub="(!@#$)" checked={options.symbols} onChange={() => toggleOption('symbols')} icon={Hash} />
                    <Toggle label="Easy Read" sub="(No 1/I/O/0)" checked={options.easyToRead} onChange={() => toggleOption('easyToRead')} icon={Eye} />
                    <Toggle label="Easy Say" sub="(Pronounceable)" checked={options.easyToSay} onChange={() => toggleOption('easyToSay')} icon={Settings2} disabled />
                </div>
            </div>
        </div>
    );
}

function Toggle({ label, sub, checked, onChange, icon: Icon, lower, disabled }) {
    return (
        <label className={`relative flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-200 cursor-pointer h-24 group ${checked
            ? 'bg-fuchsia-500/10 border-purple-400/25 text-white'
            : 'bg-white/[0.03] border-white/[0.06] text-white/60 hover:bg-white/[0.05] hover:border-white/[0.1]'
            } ${disabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}>

            <div className={`absolute top-3 right-3 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${checked ? 'bg-purple-400 border-purple-400' : 'border-white/15 group-hover:border-white/30'
                }`}>
                {checked && <Check className="w-2.5 h-2.5 text-white" />}
            </div>

            <Icon className={`w-5 h-5 mb-2 transition-colors ${checked ? 'text-fuchsia-400' : 'text-white/60 group-hover:text-white/60'} ${lower ? 'lowercase' : ''}`} strokeWidth={1.75} />
            <span className="text-[13px] font-semibold">{label}</span>
            <span className="text-[11px] opacity-40">{sub}</span>

            <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="hidden" />
        </label>
    );
}
