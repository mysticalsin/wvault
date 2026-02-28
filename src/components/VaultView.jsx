import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
    Search, Plus, Grid, List, ChevronLeft, ChevronRight,
    CreditCard as CardIcon, StickyNote, KeyRound,
    Copy, Clock, Star, ExternalLink, Eye, EyeOff, Trash2, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CreditCard from './CreditCard';
import TotpDisplay from './TotpDisplay';

// PERFORMANCE: Pagination constants for large vaults
const ITEMS_PER_PAGE = 50;

// BUG FIX 3: XSS Protection - Helper function to sanitize display text
const sanitizeText = (text) => {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

export default function VaultView({
    items, typeFilter, onAdd, onEdit,
    onDelete, onToggleFavorite, showToast, onCopy, isTrashView = false
}) {
    const [viewMode, setViewMode] = useState('grid');
    const [search, setSearch] = useState('');
    const [showPasswords, setShowPasswords] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const contentRef = useRef(null);

    // PERFORMANCE: Memoized filtered results
    const filtered = useMemo(() => {
        return items.filter(item => {
            if (typeFilter !== 'all' && item.type !== typeFilter) return false;

            const q = search.toLowerCase();
            return (
                (item.service || '').toLowerCase().includes(q) ||
                (item.username || '').toLowerCase().includes(q) ||
                (item.notes || '').toLowerCase().includes(q) ||
                (item.category || '').toLowerCase().includes(q)
            );
        });
    }, [items, typeFilter, search]);

    // PERFORMANCE: Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [search, typeFilter]);

    // PERFORMANCE: Paginated results for large vaults
    const { paginatedItems, totalPages, startIndex, endIndex } = useMemo(() => {
        const total = filtered.length;
        const pages = Math.ceil(total / ITEMS_PER_PAGE) || 1;
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = Math.min(start + ITEMS_PER_PAGE, total);
        return {
            paginatedItems: filtered.slice(start, end),
            totalPages: pages,
            startIndex: start,
            endIndex: end
        };
    }, [filtered, currentPage]);

    // PERFORMANCE: Scroll to top when page changes
    useEffect(() => {
        contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentPage]);

    const togglePasswordVisibility = useCallback((id, e) => {
        e.stopPropagation();
        setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
    }, []);

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Toolbar */}
            <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-black/10 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-white/90 capitalize">{typeFilter === 'all' ? 'All Items' : typeFilter + 's'}</h2>
                    <span className="bg-white/5 px-2 py-0.5 rounded-md text-xs text-white/40 font-mono">{filtered.length}</span>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 group-focus-within:text-cyan-400 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search items..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-white/[0.04] border border-white/[0.08] rounded-full pl-10 pr-4 py-2 w-64 text-[13px] text-white/90 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/30 focus:bg-white/[0.06] transition-all placeholder:text-white/20"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                            >
                                ×
                            </button>
                        )}
                    </div>

                    <div className="h-6 w-px bg-white/10 mx-2" />

                    <div className="flex p-1 bg-black/20 rounded-lg border border-white/5">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}
                            title="Grid view"
                        >
                            <Grid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}
                            title="List view"
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>

                    <button
                        onClick={onAdd}
                        className="bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-[13px] font-semibold shadow-lg shadow-cyan-500/15 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <Plus className="w-4 h-4" />
                        <span>New</span>
                    </button>
                </div>
            </header>

            {/* Content */}
            <div ref={contentRef} className="flex-1 overflow-y-auto p-6 scroll-smooth">
                {filtered.length === 0 ? (
                    <EmptyState type={typeFilter} onAdd={onAdd} searchTerm={search} />
                ) : (
                    <>
                        {/* PERFORMANCE: Results count */}
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-xs text-white/40">
                                Showing {startIndex + 1}-{endIndex} of {filtered.length} items
                            </p>
                            {totalPages > 1 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4 text-white/60" />
                                    </button>
                                    <span className="text-xs text-white/60 min-w-[3rem] text-center">
                                        {currentPage} / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4 text-white/60" />
                                    </button>
                                </div>
                            )}
                        </div>

                        <AnimatePresence mode='popLayout'>
                            {viewMode === 'grid' ? (
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
                                    {paginatedItems.map(item => (
                                        <VaultCard
                                            key={item.id}
                                            item={item}
                                            onEdit={onEdit}
                                            onDelete={onDelete}
                                            onToggleFavorite={onToggleFavorite}
                                            onCopy={onCopy}
                                            showPassword={showPasswords[item.id]}
                                            onTogglePassword={(e) => togglePasswordVisibility(item.id, e)}
                                            isTrashView={isTrashView}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {paginatedItems.map(item => (
                                        <VaultRow
                                            key={item.id}
                                            item={item}
                                            onEdit={onEdit}
                                            onCopy={onCopy}
                                            onDelete={onDelete}
                                            isTrashView={isTrashView}
                                        />
                                    ))}
                                </div>
                            )}
                        </AnimatePresence>

                        {/* PERFORMANCE: Bottom pagination for large lists */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-white/5">
                                <button
                                    onClick={() => setCurrentPage(1)}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-xs text-white/60 transition-colors"
                                >
                                    First
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4 text-white/60" />
                                </button>
                                <span className="text-xs text-white/60 px-4">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4 text-white/60" />
                                </button>
                                <button
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-xs text-white/60 transition-colors"
                                >
                                    Last
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function VaultCard({ item, onEdit, onToggleFavorite, onCopy, showPassword, onTogglePassword, onDelete, isTrashView }) {
    const isCard = item.type === 'card';
    const isNote = item.type === 'note';
    const isFavorite = item.favorite === 1 || item.favorite === true;
    // Bug 6 fix: track icon load failures to show fallback
    const [iconFailed, setIconFailed] = React.useState(false);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            onClick={() => onEdit(item)}
            className="group relative bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] hover:border-white/[0.1] rounded-2xl p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30 cursor-pointer overflow-hidden"
        >
            <div className={`absolute top-0 left-0 bottom-0 w-1 ${isCard ? 'bg-gradient-to-b from-purple-500 to-pink-500' :
                isNote ? 'bg-gradient-to-b from-yellow-400 to-orange-500' :
                    'bg-gradient-to-b from-blue-500 to-cyan-500'
                }`} />

            {/* Header */}
            <div className="flex justify-between items-start mb-4 pl-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center p-1.5 shadow-inner border border-white/5 overflow-hidden">
                        {item.icon_url && !iconFailed ? (
                            <img
                                src={item.icon_url}
                                className="w-full h-full object-contain"
                                onError={() => {
                                    setIconFailed(true);
                                }}
                                alt=""
                            />
                        ) : null}
                        {/* Fallback icon - shows when no icon_url or image failed to load */}
                        {(!item.icon_url || iconFailed) && (
                            isCard ? <CardIcon className="w-5 h-5 text-purple-400" /> :
                                isNote ? <StickyNote className="w-5 h-5 text-yellow-400" /> :
                                    <KeyRound className="w-5 h-5 text-blue-400" />
                        )}
                    </div>
                    <div className="overflow-hidden">
                        {/* BUG FIX 3: Sanitized service and username */}
                        <h3 className="font-semibold text-white/90 truncate w-36 text-sm" title={item.service}>{sanitizeText(item.service)}</h3>
                        <p className="text-xs text-white/40 truncate w-36" title={item.username}>{sanitizeText(item.username || item.card?.holder || 'Note')}</p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {isTrashView ? (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                                className="p-1.5 rounded-lg text-white/40 hover:text-green-400 hover:bg-green-500/10 transition-all"
                                title="Restore from Trash"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                                className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                title="Delete Forever"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </>
                    ) : (
                        <>
                            {item.url && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); window.open(item.url, '_blank'); }}
                                    className="p-1.5 rounded-lg text-white/20 hover:text-blue-400 hover:bg-white/5 transition-all"
                                    title="Open URL"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id); }}
                                className={`p-1.5 rounded-lg transition-all ${isFavorite ? 'text-amber-400' : 'text-white/10 hover:text-amber-400 hover:bg-white/5'}`}
                                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            >
                                <Star className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                                className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                title="Move to Trash"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="pl-3 space-y-3">
                {isCard ? (
                    <div className="transform scale-90 origin-top-left -ml-2 pointer-events-none">
                        <CreditCard card={item.card || {}} showDetails={false} />
                    </div>
                ) : isNote ? (
                    <p className="text-xs text-white/30 line-clamp-3 italic min-h-[3rem]">
                        {sanitizeText(item.notes) || "No content..."}
                    </p>
                ) : (
                    <div className="space-y-3">
                        {/* Password Field */}
                        <div className="flex items-center justify-between bg-black/20 rounded-lg px-3 py-2 border border-white/5 group/field hover:border-white/20 transition-colors">
                            <span className="text-xs text-white/80 font-mono tracking-wider break-all">
                                {showPassword ? (item.password || '—') : '••••••••••••'}
                            </span>
                            <div className="flex gap-1 opacity-0 group-hover/field:opacity-100 transition-opacity">
                                {item.password && (
                                    <>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onTogglePassword(e); }}
                                            className="p-1 hover:text-white hover:bg-white/10 rounded text-white/50"
                                            title={showPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onCopy(item.password, "Password"); }}
                                            className="p-1 hover:text-white hover:bg-white/10 rounded text-white/50"
                                            title="Copy password"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Live TOTP */}
                        {item.totp && (
                            <div onClick={e => e.stopPropagation()}>
                                <TotpDisplay secret={item.totp} onCopy={onCopy} />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Hover Shine Effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/0 via-white/[0.03] to-white/0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-500" />
        </motion.div>
    );
}

function EmptyState({ type, onAdd, searchTerm }) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center pb-20">
            <div className="w-16 h-16 bg-white/[0.04] rounded-2xl flex items-center justify-center mb-4">
                <Search className="w-7 h-7 text-white/15" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-bold text-white/50" style={{ letterSpacing: '-0.02em' }}>
                {searchTerm ? `No results for "${sanitizeText(searchTerm)}"` : `No ${type === 'all' ? 'items' : type + 's'} found`}
            </h3>
            <p className="text-[13px] text-white/30 mt-2 max-w-xs">
                {searchTerm ? 'Try a different search term or clear the search.' : 'Get started by adding your first item to the vault.'}
            </p>
            {!searchTerm && (
                <button onClick={onAdd} className="mt-5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white text-[13px] font-semibold shadow-lg shadow-cyan-500/15 transition-all duration-200 flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Add First Item
                </button>
            )}
        </div>
    );
}

function VaultRow({ item, onEdit, onCopy, onDelete, isTrashView }) {
    const isFavorite = item.favorite === 1 || item.favorite === true;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => onEdit(item)}
            className="glass-panel-light p-3 flex items-center gap-4 cursor-pointer hover:bg-white/[0.05] transition-all duration-150 group"
        >
            <div className="w-8 h-8 rounded-lg bg-white/5 p-1 flex-shrink-0">
                {item.icon_url ? (
                    <img
                        src={item.icon_url}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                            console.log('[VaultRow] Failed to load icon:', item.icon_url);
                            e.target.style.display = 'none';
                        }}
                        alt=""
                    />
                ) : null}
                {!item.icon_url && (
                    <div className="w-full h-full flex items-center justify-center">
                        <KeyRound className="w-4 h-4 text-white/30" />
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    {/* BUG FIX 3: Sanitized service name */}
                    <span className="font-semibold text-sm text-white/90 truncate">{sanitizeText(item.service)}</span>
                    {isFavorite && <Star className="w-3 h-3 text-amber-400 fill-current flex-shrink-0" />}
                </div>
                <span className="text-white/40 text-xs truncate block">{sanitizeText(item.username) || '—'}</span>
            </div>
            <span className="text-white/20 text-xs font-mono uppercase flex-shrink-0">{item.type}</span>
            {isTrashView ? (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                        className="p-2 rounded-lg text-white/40 hover:text-green-400 hover:bg-green-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        title="Restore from Trash"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                        className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete Forever"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </>
            ) : (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); onCopy(item.password, "Password"); }}
                        className="p-2 rounded-lg text-white/20 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
                        title="Copy password"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                    {onDelete && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                            className="p-2 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                            title="Move to Trash"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </>
            )}
        </motion.div>
    );
}
