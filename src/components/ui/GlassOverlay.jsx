import React, { useState, useEffect } from 'react';
import { Search, Copy, X, CornerDownRight } from 'lucide-react';

export default function GlassOverlay() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
        // Auto-focus search on mount
        document.getElementById('overlay-search')?.focus();

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') window.wvault.overlayClose();
            if (e.key === 'ArrowDown') setSelectedIndex(i => Math.min(i + 1, results.length - 1));
            if (e.key === 'ArrowUp') setSelectedIndex(i => Math.max(i - 1, 0));
            if (e.key === 'Enter' && results[selectedIndex]) {
                handleCopy(results[selectedIndex]);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [results, selectedIndex]);

    useEffect(() => {
        if (!query) {
            setResults([]);
            return;
        }
        // Debounce search
        const timer = setTimeout(async () => {
            const res = await window.wvault.overlaySearch(query);
            if (res.success) {
                setResults(res.results.slice(0, 5)); // Limit to 5 results
                setSelectedIndex(0);
            }
        }, 150);
        return () => clearTimeout(timer);
    }, [query]);

    const handleCopy = (item) => {
        window.wvault.overlayCopy(item.password);
        window.wvault.overlayClose();
    };

    return (
        <div className="h-screen w-screen bg-transparent flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-[#050208]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scale-in">
                {/* Search Bar */}
                <div className="flex items-center px-4 py-3 border-b border-white/5 bg-white/5">
                    <Search className="w-5 h-5 text-purple-400 mr-3" />
                    <input
                        id="overlay-search"
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="WVault Search..."
                        className="flex-1 bg-transparent border-none outline-none text-white text-lg placeholder-white/50"
                        autoFocus
                    />
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-white/60 tracking-wider">ESC to Close</span>
                    </div>
                </div>

                {/* Results */}
                {results.length > 0 && (
                    <div className="max-h-[300px] overflow-y-auto">
                        {results.map((item, index) => (
                            <div
                                key={item.id}
                                onClick={() => handleCopy(item)}
                                className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${index === selectedIndex ? 'bg-fuchsia-500/20 border-l-2 border-fuchsia-500' : 'hover:bg-white/5 border-l-2 border-transparent'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-white/10 p-1">
                                        <img src={item.icon_url} className="w-full h-full object-contain" onError={(e) => e.target.style.display = 'none'} />
                                    </div>
                                    <div>
                                        <div className="text-white font-medium text-sm">{item.service}</div>
                                        <div className="text-white/60 text-xs">{item.username}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-xs text-white/60 font-mono">Run Action</span>
                                    <CornerDownRight className="w-4 h-4 text-white/60" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {query && results.length === 0 && (
                    <div className="p-4 text-center text-white/60 text-sm">No results found.</div>
                )}
            </div>
        </div>
    );
}
