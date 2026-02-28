/**
 * WVAULT EMPTY STATE PATTERN
 * Phase 2: Pattern Library - Zero States
 * 
 * Guidelines:
 * - Always offer a primary action
 * - Use illustrations/icons that guide users
 * - Keep copy actionable and brief
 * - Progressive disclosure for complex empty states
 */

import React from 'react';
import { motion } from 'framer-motion';
import { 
    Search, Plus, Shield, KeyRound, FileX, 
    Trash2, Star, FolderOpen, RefreshCw
} from 'lucide-react';

const emptyStateConfigs = {
    vault: {
        icon: Shield,
        title: 'Your vault is empty',
        description: 'Start by adding your first password. Everything is encrypted on your device.',
        actionLabel: 'Add Password',
        actionIcon: Plus
    },
    search: {
        icon: Search,
        title: 'No results found',
        description: 'Try adjusting your search terms or filters.',
        actionLabel: 'Clear Search',
        actionIcon: RefreshCw
    },
    trash: {
        icon: Trash2,
        title: 'Trash is empty',
        description: 'Deleted items will appear here for 30 days before being permanently removed.',
        actionLabel: null,
        actionIcon: null
    },
    favorites: {
        icon: Star,
        title: 'No favorites yet',
        description: 'Star your most-used passwords for quick access.',
        actionLabel: 'Browse Vault',
        actionIcon: FolderOpen
    },
    generator: {
        icon: KeyRound,
        title: 'Generate a password',
        description: 'Create strong, unique passwords that are impossible to crack.',
        actionLabel: 'Generate',
        actionIcon: Plus
    },
    error: {
        icon: FileX,
        title: 'Something went wrong',
        description: 'We couldn\'t load your data. Please try again.',
        actionLabel: 'Retry',
        actionIcon: RefreshCw
    }
};

export default function EmptyState({ 
    type = 'vault', 
    onAction,
    customIcon,
    customTitle,
    customDescription,
    customActionLabel,
    className = ''
}) {
    const config = emptyStateConfigs[type];
    const Icon = customIcon || config.icon;
    const ActionIcon = config.actionIcon;
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
        >
            {/* Icon Container with gradient */}
            <motion.div
                animate={{ 
                    scale: [1, 1.05, 1],
                    opacity: [0.8, 1, 0.8]
                }}
                transition={{ 
                    duration: 4, 
                    repeat: Infinity,
                    ease: 'easeInOut'
                }}
                className="w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 flex items-center justify-center"
            >
                <Icon className="w-10 h-10 text-white/40" strokeWidth={1.5} />
            </motion.div>
            
            {/* Title */}
            <h3 className="text-lg font-semibold text-white mb-2">
                {customTitle || config.title}
            </h3>
            
            {/* Description */}
            <p className="text-sm text-white/50 max-w-sm mb-6">
                {customDescription || config.description}
            </p>
            
            {/* Primary Action */}
            {(customActionLabel !== undefined ? customActionLabel : config.actionLabel) && onAction && (
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onAction}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-medium transition-all"
                >
                    {ActionIcon && <ActionIcon className="w-4 h-4" />}
                    {customActionLabel || config.actionLabel}
                </motion.button>
            )}
            
            {/* Optional: Illustration slot for custom empty states */}
            {type === 'custom' && (
                <div className="mt-4">
                    {customIcon}
                </div>
            )}
        </motion.div>
    );
}

// Variant: Compact (for inline use in lists/cards)
export function EmptyStateCompact({ type = 'vault', onAction }) {
    const config = emptyStateConfigs[type];
    const Icon = config.icon;
    
    return (
        <div className="flex items-center gap-4 py-6 px-4 text-left">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                <Icon className="w-6 h-6 text-white/30" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/70">{config.title}</p>
                <p className="text-xs text-white/40 truncate">{config.description}</p>
            </div>
            {config.actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="px-4 py-2 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                    {config.actionLabel}
                </button>
            )}
        </div>
    );
}

// Variant: Skeleton Loading State (prevents layout shift)
export function EmptyStateSkeleton() {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-20 h-20 mb-6 rounded-2xl bg-white/5 animate-pulse" />
            <div className="w-48 h-5 mb-2 rounded bg-white/5 animate-pulse" />
            <div className="w-64 h-4 rounded bg-white/5 animate-pulse" />
        </div>
    );
}
