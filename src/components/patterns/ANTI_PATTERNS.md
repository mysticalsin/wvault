# WVault Anti-Patterns Database

## What NOT to Do in WVault UI

This document explicitly documents patterns that are **prohibited** in WVault to ensure consistent, accessible, and user-friendly interfaces.

---

## Navigation Anti-Patterns

### ❌ Hamburger Menus on Desktop
**Why it's bad:** Hides navigation on large screens where space is plentiful
**What to use instead:** Always-visible sidebar or tab bar
**WVault standard:** Collapsible sidebar that shows icons even when collapsed

```jsx
// ❌ DON'T
<button className="hamburger">☰</button> // Hidden nav on desktop

// ✅ DO
<Sidebar>
    <NavItem icon={Home} label="Home" /> // Always visible
    <NavItem icon={Lock} label="Vault" />
</Sidebar>
```

### ❌ Mystery Meat Navigation
**Why it's bad:** Icons without labels force users to guess
**What to use instead:** Icons + text, or tooltips on hover
**WVault standard:** All nav items show both icon and text

---

## Form Anti-Patterns

### ❌ Placeholders as Labels
**Why it's bad:** Disappears when user types; harms accessibility
**What to use instead:** Floating labels or separate label elements
**WVault standard:** Separate, persistent labels above inputs

```jsx
// ❌ DON'T
<input placeholder="Email address" /> // Placeholder is the only label

// ✅ DO
<label className="block text-sm font-medium text-white/70 mb-1">
    Email address
</label>
<input placeholder="you@example.com" /> // Placeholder shows format hint
```

### ❌ Password Requirements Only on Error
**Why it's bad:** Users don't know requirements until they fail
**What to use instead:** Show requirements proactively with live feedback
**WVault standard:** Real-time password strength meter

### ❌ Disabled Submit Buttons Without Explanation
**Why it's bad:** Users don't know why they can't submit
**What to use instead:** Keep button enabled, show validation on click
**WVault standard:** Show inline validation messages

```jsx
// ❌ DON'T
<button disabled={!isValid}>Submit</button> // User wonders why disabled

// ✅ DO
<button onClick={handleSubmit}>Submit</button>
// Show error: "Password must be at least 8 characters" on click
```

---

## Visual Anti-Patterns

### ❌ Low Contrast Primary Buttons
**Why it's bad:** Fails WCAG; hard to see actionable elements
**What to use instead:** High contrast (4.5:1 minimum for text, 3:1 for UI)
**WVault standard:** All buttons meet WCAG AA minimums

```css
/* ❌ DON'T - 2.1:1 contrast ratio */
.btn-primary {
    background: #3b3b50;
    color: #6b6b80;
}

/* ✅ DO - 7.2:1 contrast ratio */
.btn-primary {
    background: #6366f1;
    color: #ffffff;
}
```

### ❌ Custom Scrollbars (Unnecessary)
**Why it's bad:** Breaks user expectations; OS provides good defaults
**What to use instead:** Native scrollbars with subtle styling only
**WVault standard:** Thin, subtle scrollbars that don't change behavior

```css
/* ❌ DON'T - Heavy custom scrollbar */
::-webkit-scrollbar {
    width: 20px; /* Too wide */
    background: linear-gradient(...); /* Overdesigned */
}

/* ✅ DO - Subtle enhancement */
::-webkit-scrollbar {
    width: 8px;
}
::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.1);
    border-radius: 4px;
}
```

### ❌ Infinite Scroll for Goal-Oriented Tasks
**Why it's bad:** Breaks wayfinding; users lose their place
**What to use instead:** Pagination for search results, "Load more" for feeds
**WVault standard:** Pagination for vault items (50 per page)

---

## Interaction Anti-Patterns

### ❌ Destructive Actions Without Confirmation
**Why it's bad:** One misclick = data loss
**What to use instead:** Confirmation dialog, undo option, or soft delete
**WVault standard:** All deletes require confirmation; trash has 30-day recovery

```jsx
// ❌ DON'T
<button onClick={permanentlyDelete}>Delete</button>

// ✅ DO
<button onClick={() => setShowConfirm(true)}>Delete</button>
<ConfirmDialog 
    title="Delete password?"
    message="This cannot be undone."
    onConfirm={moveToTrash} // Soft delete first
/>
```

### ❌ Modal Dialogs Without Escape
**Why it's bad:** Traps users; no way out if confused
**What to use instead:** Click outside, ESC key, and Cancel button all work
**WVault standard:** All modals have 3 escape methods

### ❌ No Loading States
**Why it's bad:** Users think app is frozen
**What to use instead:** Skeleton screens or spinners for >200ms operations
**WVault standard:** Skeleton for lists, spinner for buttons

---

## Content Anti-Patterns

### ❌ Vague Button Labels ("OK" / "Cancel")
**Why it's bad:** Unclear what will happen
**What to use instead:** Action verbs describing the outcome
**WVault standard:** "Save Password", "Move to Trash", "Enable Biometric"

```jsx
// ❌ DON'T
<button>OK</button>
<button>Cancel</button>

// ✅ DO
<button>Delete Permanently</button>
<button>Keep Password</button>
```

### ❌ Technical Jargon Without Explanation
**Why it's bad:** Users don't understand "AES-256-GCM" or "PBKDF2"
**What to use instead:** Plain language with optional "learn more"
**WVault standard:** "Military-grade encryption" with tooltip for details

### ❌ All Caps for Emphasis
**Why it's bad:** Harder to read; feels like shouting
**What to use instead:** Font weight, color, or size for emphasis
**WVault standard:** Use font-semibold or text-indigo-400 for emphasis

```jsx
// ❌ DON'T
<p className="uppercase">WARNING: DELETE WILL REMOVE ALL DATA</p>

// ✅ DO
<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
    <h3 className="font-semibold text-red-300">Delete All Data?</h3>
    <p className="text-red-200/70">This will permanently remove everything.</p>
</div>
```

---

## Mobile Anti-Patterns

### ❌ Touch Targets < 44px
**Why it's bad:** Hard to tap; causes errors
**What to use instead:** Minimum 44x44px touch targets
**WVault standard:** All buttons 44px+ height, icons have 44px touch area

```css
/* ❌ DON'T - Too small */
.icon-button {
    width: 24px;
    height: 24px;
}

/* ✅ DO - Proper size */
.icon-button {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.icon-button svg {
    width: 20px;
    height: 20px;
}
```

### ❌ Horizontal Scrolling for Primary Content
**Why it's bad:** Hidden content; awkward on mobile
**What to use instead:** Vertical stacking or carousels with clear indicators
**WVault standard:** Vertical lists; horizontal only for related items (cards)

---

## Accessibility Anti-Patterns

### ❌ Color as Sole Communication Method
**Why it's bad:** Colorblind users can't distinguish
**What to use instead:** Icons + text + color combined
**WVault standard:** Error states show icon + text + red color

```jsx
// ❌ DON'T - Color only
<span className="text-red-500">Required</span>

// ✅ DO - Icon + text + color
<span className="flex items-center gap-1 text-red-400">
    <AlertCircle className="w-4 h-4" />
    This field is required
</span>
```

### ❌ Missing Focus Indicators
**Why it's bad:** Keyboard users can't see where they are
**What to use instead:** Visible focus ring (2px minimum)
**WVault standard:** All interactive elements have visible focus state

### ❌ Auto-Playing Media Without Controls
**Why it's bad:** Disruptive; screen reader users can't navigate
**What to use instead:** User-initiated playback with pause/stop controls
**WVault standard:** No auto-playing media

---

## Security Anti-Patterns

### ❌ Masking Passwords Permanently
**Why it's bad:** Users can't verify what they typed
**What to use instead:** Toggle visibility, show last character briefly
**WVault standard:** Eye icon to toggle password visibility

### ❌ Showing Password Strength Only on Submit
**Why it's bad:** Users create weak passwords unknowingly
**What to use instead:** Real-time strength meter
**WVault standard:** Live strength indicator with color coding

### ❌ "Remember Me" Checked by Default
**Why it's bad:** Security risk on shared computers
**What to use instead:** Unchecked by default; biometric as alternative
**WVault standard:** Biometric unlock instead of "remember password"

---

## Performance Anti-Patterns

### ❌ Animations Without Reduced Motion Support
**Why it's bad:** Triggers motion sickness for some users
**What to use instead:** Respect prefers-reduced-motion
**WVault standard:** All animations disableable

```css
/* ✅ DO - Support reduced motion */
@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
    }
}
```

### ❌ Heavy Blur Effects on Low-End Devices
**Why it's bad:** Causes jank; drains battery
**What to use instead:** Solid backgrounds as fallback
**WVault standard:** backdrop-filter with @supports fallback

```css
.glass-panel {
    background: rgba(255,255,255,0.05);
}

@supports (backdrop-filter: blur(20px)) {
    .glass-panel {
        backdrop-filter: blur(20px);
        background: rgba(255,255,255,0.03);
    }
}
```

---

## Decision Matrix

When in doubt, ask:

| Question | If Yes | If No |
|----------|--------|-------|
| Is this accessible to screen readers? | Proceed | Redesign |
| Can users undo this action? | Proceed | Add confirmation |
| Is the contrast ratio ≥ 4.5:1? | Proceed | Adjust colors |
| Are touch targets ≥ 44px? | Proceed | Increase size |
| Does this work without JavaScript? | Proceed | Add fallback |
| Does this respect prefers-reduced-motion? | Proceed | Add media query |
| Would my grandmother understand this? | Proceed | Simplify |

---

## Violation Report Template

If you find an anti-pattern in WVault:

```
**Anti-Pattern:** [Name]
**Location:** [File/Component]
**Severity:** [Critical/High/Medium/Low]
**Issue:** [Description]
**Suggested Fix:** [Solution]
**Reference:** [Link to this doc]
```

---

**Last Updated:** 2026-02-21  
**Version:** 1.0  
**Owner:** Design System Team
