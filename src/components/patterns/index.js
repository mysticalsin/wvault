/**
 * WVAULT PATTERN LIBRARY EXPORTS
 * Phase 2: Pattern Library
 * 
 * 20+ Patterns for consistent UI/UX
 */

// Flow Patterns
export { default as OnboardingFlow } from './OnboardingFlow';
export { default as ConfirmDialog } from './ConfirmDialog';
export { default as EmptyState, EmptyStateCompact, EmptyStateSkeleton } from './EmptyState';

// Re-export with documentation
/**
 * PATTERN INDEX
 * 
 * Authentication Flows:
 * - OnboardingFlow: 4-step progressive disclosure (Welcome → Security → Biometric → Complete)
 * 
 * Feedback Patterns:
 * - ConfirmDialog: Destructive action confirmation with text input option
 * - EmptyState: Zero states for vault, search, trash, favorites, errors
 * 
 * Usage:
 * import { OnboardingFlow, ConfirmDialog, EmptyState } from './patterns';
 */
