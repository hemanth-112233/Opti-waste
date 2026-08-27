/**
 * motionSystem.ts
 * OptiWaste — Shared Framer Motion design system
 *
 * Mirrors the --motion-* CSS variables in index.css.
 * Import from this file instead of writing inline Framer Motion
 * configs to ensure consistency across all pages and components.
 */

// ── Spring Physics ─────────────────────────────────────────────────────────────

export const spring = {
    /** Large, slow transitions — hero sections, ambient floats */
    gentle: { type: 'spring' as const, stiffness: 220, damping: 28, mass: 1 },
    /** Standard card/panel entrance — the default */
    standard: { type: 'spring' as const, stiffness: 320, damping: 28, mass: 1 },
    /** Fast hover, button feedback */
    snappy: { type: 'spring' as const, stiffness: 480, damping: 32, mass: 1 },
    /** Modal entrance — slightly overdamped for authority */
    modal: { type: 'spring' as const, stiffness: 400, damping: 35, mass: 1 },
    /** Floating element elevation — very gentle */
    float: { type: 'spring' as const, stiffness: 180, damping: 22, mass: 1 },
};

// ── Duration Presets ───────────────────────────────────────────────────────────

export const duration = {
    instant: 0.08,
    fast: 0.18,
    normal: 0.30,
    smooth: 0.45,
};

// ── Easing ─────────────────────────────────────────────────────────────────────

export const ease = {
    /** Standard Apple-style decelerate */
    out: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    /** Spring-overshoot ease */
    spring: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
    /** Gentle spring */
    soft: [0.34, 1.20, 0.64, 1] as [number, number, number, number],
};

// ── Stagger Children ───────────────────────────────────────────────────────────

export const stagger = {
    /** Default — 60 ms between children */
    normal: { staggerChildren: 0.06 },
    /** Fast — 40 ms between children */
    fast: { staggerChildren: 0.04 },
    /** Slow — 90 ms between children */
    slow: { staggerChildren: 0.09 },
};

// ── Shared Variants ────────────────────────────────────────────────────────────

/** Fade + slight up lift — use for cards, list items, stat sections */
export const fadeUp = {
    hidden: { opacity: 0, y: 12, scale: 0.98 },
    visible: { opacity: 1, y: 0, scale: 1, transition: spring.standard },
    exit: { opacity: 0, y: -6, scale: 0.98, transition: { duration: duration.fast } },
};

/** Simple fade — use for overlays, backdrops */
export const fadeIn = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: duration.normal } },
    exit: { opacity: 0, transition: { duration: duration.fast } },
};

/** Scale + fade — use for modal, popover, floating menu */
export const scaleFade = {
    hidden: { opacity: 0, scale: 0.94, y: 8 },
    visible: { opacity: 1, scale: 1, y: 0, transition: spring.modal },
    exit: { opacity: 0, scale: 0.97, y: 4, transition: { duration: duration.fast, ease: ease.out } },
};

/** Slide in from right — use for drawers, slide-over panels */
export const slideRight = {
    hidden: { opacity: 0, x: 32 },
    visible: { opacity: 1, x: 0, transition: spring.standard },
    exit: { opacity: 0, x: 20, transition: { duration: duration.fast, ease: ease.out } },
};

/** Stagger container — wrap around fadeUp children */
export const staggerContainer = {
    hidden: {},
    visible: { transition: stagger.normal },
};

/** Fast stagger container — for dense grids */
export const staggerContainerFast = {
    hidden: {},
    visible: { transition: stagger.fast },
};

// ── Hover / Tap Presets ────────────────────────────────────────────────────────

/** Standard card hover — subtle lift */
export const hoverLift = {
    y: -3,
    transition: spring.snappy,
};

/** Button press feedback */
export const tapPress = {
    scale: 0.97,
    transition: { duration: duration.instant },
};

/** Icon hover nudge */
export const iconNudge = {
    scale: 1.08,
    transition: spring.snappy,
};

// ── Button Interaction Presets ─────────────────────────────────────────────────
// Centralised whileHover / whileTap / transition configs for every button type.
// Import these instead of duplicating configs across pages and components.

/**
 * Primary dark button (glass-black).
 * Subtle lift + very slight scale up with spring return.
 */
export const primaryButtonHover = {
    scale: 1.018,
    y: -2,
    transition: spring.snappy,
};
export const primaryButtonTap = {
    scale: 0.97,
    y: 0,
    transition: { duration: 0.08 },
};

/**
 * Secondary / glass button.
 * Gentler lift — lets the glass surface do the talking.
 */
export const secondaryButtonHover = {
    scale: 1.014,
    y: -2,
    transition: spring.snappy,
};
export const secondaryButtonTap = {
    scale: 0.975,
    y: 0,
    transition: { duration: 0.08 },
};

/**
 * Danger button — no scale increase, just compression on press.
 */
export const dangerButtonHover = {
    scale: 1.010,
    y: -1,
    transition: spring.snappy,
};
export const dangerButtonTap = {
    scale: 0.97,
    transition: { duration: 0.08 },
};

/**
 * Ghost / text button — minimal feedback.
 */
export const ghostButtonHover = {
    scale: 1.008,
    transition: spring.snappy,
};
export const ghostButtonTap = {
    scale: 0.97,
    transition: { duration: 0.08 },
};

/**
 * Circular icon-only button hover — scale + slight brightness via shadow.
 */
export const iconButtonHover = {
    scale: 1.10,
    transition: spring.snappy,
};
export const iconButtonTap = {
    scale: 0.93,
    transition: { duration: 0.08 },
};

/**
 * Sidebar navigation item — translates icon 2px right on hover.
 */
export const sidebarItemHover = {
    x: 2,
    transition: spring.snappy,
};

/**
 * Card hover — same as hoverLift but explicitly typed for import.
 */
export const cardHover = {
    y: -4,
    scale: 1.008,
    transition: spring.standard,
};

/**
 * Table row action hover — very subtle.
 */
export const tableActionHover = {
    scale: 1.06,
    transition: spring.snappy,
};
export const tableActionTap = {
    scale: 0.94,
    transition: { duration: 0.08 },
};


// ── Reduced-Motion Helper ──────────────────────────────────────────────────────

/**
 * Returns a Framer Motion transition object with effectively zero duration
 * if the user has opted into prefers-reduced-motion.
 *
 * Usage:
 *   <motion.div transition={reduceMotion(spring.standard)} />
 */
export function reduceMotion<T extends object>(transition: T): T | { duration: number } {
    if (
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
        return { duration: 0.001 };
    }
    return transition;
}

/**
 * Returns reduced variants if user prefers reduced motion.
 * Otherwise returns original variants.
 * All reduced variants use opacity-only transition (no transforms).
 */
export function reduceVariants<T extends Record<string, object>>(variants: T): T {
    if (
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
        const reduced: Record<string, object> = {};
        for (const key of Object.keys(variants)) {
            // Strip transform properties, keep opacity
            const { y: _y, x: _x, scale: _sc, rotate: _ro, ...rest } = variants[key] as any;
            reduced[key] = { ...rest, transition: { duration: 0.001 } };
        }
        return reduced as T;
    }
    return variants;
}
