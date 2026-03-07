import { useEffect, useRef } from 'react';

/**
 * Traps keyboard focus within a container element (WCAG 2.2 AA requirement for modals).
 * Focus cycles through interactive elements on Tab/Shift+Tab.
 * @param {boolean} active - Whether the trap is active
 * @returns {React.RefObject} Ref to attach to the container element
 */
export default function useFocusTrap(active = true) {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!active || !containerRef.current) return;

        const container = containerRef.current;
        const previouslyFocused = document.activeElement;

        const getFocusableElements = () => {
            return container.querySelectorAll(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
            );
        };

        // Focus first focusable element
        const focusables = getFocusableElements();
        if (focusables.length > 0) {
            focusables[0].focus();
        }

        const handleKeyDown = (e) => {
            if (e.key !== 'Tab') return;

            const elements = getFocusableElements();
            if (elements.length === 0) return;

            const first = elements[0];
            const last = elements[elements.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        container.addEventListener('keydown', handleKeyDown);

        return () => {
            container.removeEventListener('keydown', handleKeyDown);
            // Restore focus on unmount
            if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
                previouslyFocused.focus();
            }
        };
    }, [active]);

    return containerRef;
}
