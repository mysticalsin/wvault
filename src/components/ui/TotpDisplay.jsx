import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Copy } from 'lucide-react';

export default function TotpDisplay({ secret, onCopy }) {
    const [code, setCode] = useState('000 000');
    const [progress, setProgress] = useState(0);
    const intervalRef = useRef(null);
    const mountedRef = useRef(true);

    const update = useCallback(async () => {
        if (!secret) return;
        try {
            const res = await window.wvault.getTotp(secret);
            if (res.code && mountedRef.current) {
                // Split 6 digit code into 3 3
                const formatted = res.code.match(/.{1,3}/g);
                setCode(formatted ? formatted.join(' ') : res.code);
            }
        } catch (e) {
            if (mountedRef.current) {
                setCode('Error');
            }
        }
    }, [secret]);

    useEffect(() => {
        mountedRef.current = true;
        
        // Clear any existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        update();
        intervalRef.current = setInterval(() => {
            if (!mountedRef.current) return;
            
            const epoch = Math.floor(Date.now() / 1000);
            const remain = 30 - (epoch % 30);
            setProgress(remain / 30);

            if (remain === 30) update(); // Refresh on rollover
        }, 1000);

        return () => {
            mountedRef.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [secret, update]);

    const handleCopy = useCallback(() => {
        if (onCopy && code !== 'Error' && code !== '000 000') {
            onCopy(code.replace(/\s/g, ''), 'TOTP Code');
        }
    }, [code, onCopy]);

    return (
        <div className="flex items-center justify-between bg-white/5 rounded-lg p-3 border border-white/10 hover:bg-white/10 transition-colors group">
            <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 flex items-center justify-center">
                    {/* Ring background */}
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,0.1)" strokeWidth="3" fill="none" />
                        <circle
                            cx="20" cy="20" r="16"
                            stroke="#C967E8"
                            strokeWidth="3"
                            fill="none"
                            strokeDasharray="100"
                            strokeDashoffset={100 * (1 - progress)}
                            className="transition-all duration-1000 ease-linear"
                        />
                    </svg>
                    <span className="absolute text-[10px] text-white/50 font-mono">
                        {Math.ceil(progress * 30)}
                    </span>
                </div>

                <div className="flex flex-col">
                    <span className="text-xl font-mono font-bold tracking-widest text-fuchsia-300 group-hover:text-fuchsia-200 transition-colors">
                        {code}
                    </span>
                    <span className="text-[10px] text-white/60 uppercase tracking-widest">One-time Code</span>
                </div>
            </div>

            <button
                onClick={handleCopy}
                disabled={code === 'Error' || code === '000 000'}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
                <Copy className="w-4 h-4" />
            </button>
        </div>
    );
}
