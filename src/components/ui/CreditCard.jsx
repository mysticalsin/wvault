import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTilt } from '../../hooks/useTilt';
import { CreditCard as CardIcon } from 'lucide-react';

export default function CreditCard({ card, showDetails = false }) {
    const [isFlipped, setIsFlipped] = useState(false);
    const tilt = useTilt({ max: 10, scale: 1.02 });

    const number = card.number || '•••• •••• •••• ••••';
    const holder = card.holder || 'CARD HOLDER';
    const expiry = card.expiry || 'MM/YY';
    const cvv = card.cvv || '•••';

    // Auto-detect brand (super simple for visuals)
    const isVisa = number.startsWith('4');
    const isMaster = number.startsWith('5');

    const bgGradient = isVisa
        ? 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)'
        : isMaster
            ? 'linear-gradient(135deg, #FF512F 0%, #DD2476 100%)'
            : 'linear-gradient(135deg, #303030 0%, #1a1a1a 100%)';

    return (
        <div className="perspective-1000 w-full h-48 cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
            <motion.div
                className="w-full h-full relative preserve-3d transition-transform duration-500"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                style={tilt.style}
                onMouseMove={tilt.handleMouseMove}
                onMouseLeave={tilt.handleMouseLeave}
            >
                {/* Front */}
                <div
                    className="absolute inset-0 rounded-xl p-6 flex flex-col justify-between backface-hidden shadow-xl border border-white/10"
                    style={{ background: bgGradient }}
                >
                    <div className="flex justify-between items-start">
                        <div className="w-12 h-8 rounded bg-yellow-400/80 flex items-center justify-center overflow-hidden relative">
                            <div className="absolute top-0 left-0 w-full h-px bg-black/20" />
                            <div className="absolute bottom-0 left-0 w-full h-px bg-black/20" />
                            <div className="w-8 h-6 border border-black/30 rounded-[2px]" />
                        </div>
                        {isVisa && <h3 className="text-white font-bold italic text-xl">VISA</h3>}
                        {isMaster && <div className="flex -space-x-3"><div className="w-8 h-8 rounded-full bg-red-500/80" /><div className="w-8 h-8 rounded-full bg-yellow-500/80" /></div>}
                        {!isVisa && !isMaster && <CardIcon className="text-white/50" />}
                    </div>

                    <div className="space-y-4">
                        <p className="font-mono text-xl tracking-wider text-white drop-shadow-md">
                            {showDetails ? number : number.replace(/\d{4} \d{4} \d{4}/, '•••• •••• ••••')}
                        </p>
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] text-white/60 uppercase tracking-widest">Card Holder</p>
                                <p className="font-medium text-white uppercase tracking-wider text-sm">{holder}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-white/60 uppercase tracking-widest">Expires</p>
                                <p className="font-medium text-white text-sm">{expiry}</p>
                            </div>
                        </div>
                    </div>

                    {/* Gloss effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-xl pointer-events-none" />
                </div>

                {/* Back */}
                <div
                    className="absolute inset-0 rounded-xl flex flex-col pt-6 backface-hidden shadow-xl border border-white/10 rotate-y-180 bg-gray-800"
                >
                    <div className="w-full h-10 bg-black/80 mb-4" />
                    <div className="px-6 relative">
                        <div className="w-[80%] h-8 bg-white/20 rounded flex items-center justify-end px-3">
                            <p className="font-mono text-black font-bold tracking-widest">{showDetails ? cvv : '•••'}</p>
                        </div>
                        <p className="text-[10px] text-white/60 mt-2">CVV</p>
                    </div>

                    <div className="absolute bottom-4 right-6 text-white/60 text-xs">
                        {isVisa ? 'VISA SECURE' : 'MASTERCARD ID'}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
