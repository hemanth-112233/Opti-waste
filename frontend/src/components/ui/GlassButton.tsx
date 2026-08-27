/**
 * GlassButton.tsx — Step 3D Upgrade
 *
 * Global interaction system: all button variants now use centralised
 * spring presets from motionSystem.ts. A CSS light sweep fires on hover
 * for primary buttons. All states use `useReducedMotion` to disable
 * transforms when prefers-reduced-motion is set.
 *
 * Variants:
 *   primary   — dark glass, lift + sweep on hover
 *   secondary — translucent glass, lift on hover
 *   danger    — restrained red glass
 *   ghost     — minimal, barely-there
 *
 * Loading state: elegant CSS spinner
 * Keyboard: focus-visible ring always shown
 * Touch: whileTap compression preserved
 */
import React from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import {
    primaryButtonHover,
    primaryButtonTap,
    secondaryButtonHover,
    secondaryButtonTap,
    dangerButtonHover,
    dangerButtonTap,
    ghostButtonHover,
    ghostButtonTap,
} from '../../lib/motionSystem';
import styles from './GlassButton.module.css';

interface GlassButtonProps extends HTMLMotionProps<'button'> {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    icon?: React.ReactNode;
    className?: string;
    loading?: boolean;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
    children,
    variant = 'secondary',
    size = 'md',
    icon,
    className = '',
    loading = false,
    ...props
}) => {
    const reducedMotion = useReducedMotion();

    const hoverAnim =
        reducedMotion ? undefined :
            variant === 'primary' ? primaryButtonHover :
                variant === 'danger' ? dangerButtonHover :
                    variant === 'ghost' ? ghostButtonHover :
                        secondaryButtonHover;

    const tapAnim =
        reducedMotion ? undefined :
            variant === 'primary' ? primaryButtonTap :
                variant === 'danger' ? dangerButtonTap :
                    variant === 'ghost' ? ghostButtonTap :
                        secondaryButtonTap;

    return (
        <motion.button
            whileHover={hoverAnim}
            whileTap={tapAnim}
            className={[
                styles.button,
                styles[variant],
                styles[size],
                loading ? styles.isLoading : '',
                className,
            ].join(' ')}
            disabled={loading || props.disabled}
            {...props}
        >
            {/* Light sweep — only for primary buttons, triggered by CSS :hover */}
            {variant === 'primary' && !reducedMotion && (
                <span className={styles.sweep} aria-hidden="true" />
            )}

            {loading ? (
                <span className={styles.spinner} aria-hidden="true" />
            ) : (
                <>
                    {icon && (
                        <motion.span
                            className={styles.iconWrapper}
                            whileHover={reducedMotion ? undefined : { scale: 1.12 }}
                            transition={{ duration: 0.12 }}
                        >
                            {icon}
                        </motion.span>
                    )}
                    {children}
                </>
            )}
        </motion.button>
    );
};

export default GlassButton;
