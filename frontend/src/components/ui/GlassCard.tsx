import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import styles from './GlassCard.module.css';

interface GlassCardProps extends HTMLMotionProps<'div'> {
    children: React.ReactNode;
    className?: string;
    variant?: 'light' | 'heavy' | 'ultra-light';
    hoverEffect?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
    children,
    className = '',
    variant = 'light',
    hoverEffect = false,
    ...props
}) => {
    return (
        <motion.div
            className={`${styles.glassCard} ${styles[variant]} ${hoverEffect ? styles.hoverable : ''} ${className}`}
            {...props}
        >
            {children}
        </motion.div>
    );
};

export default GlassCard;
