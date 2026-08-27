import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import styles from './GlassStatCard.module.css';

interface StatTrend {
    value: number;
    label?: string;
    isPositive?: boolean;
}

interface GlassStatCardProps {
    title: string;
    value: string | number;
    icon: React.ElementType;
    trend?: StatTrend;
    color?: 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'gray';
    loading?: boolean;
}

export const GlassStatCard: React.FC<GlassStatCardProps> = ({
    title,
    value,
    icon: Icon,
    trend,
    color = 'gray',
    loading = false
}) => {
    if (loading) {
        return (
            <div className={`${styles.card} ${styles.loading}`}>
                <div className={styles.loadingPulse}></div>
            </div>
        );
    }

    return (
        <motion.div
            className={styles.card}
            whileHover={{ y: -5, scale: 1.01, boxShadow: '0 16px 48px rgba(0,0,0,0.12), 0 8px 20px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.90)' }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        >
            <div className={styles.header}>
                <h3 className={styles.title}>{title}</h3>
                <div className={`${styles.iconWrapper} ${styles[color]}`}>
                    <Icon size={20} />
                </div>
            </div>

            <div className={styles.content}>
                <div className={styles.value}>{value}</div>

                {trend && (
                    <div className={`${styles.trend} ${trend.isPositive ? styles.positive : styles.negative}`}>
                        {trend.isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        <span>{trend.value}% {trend.label && <span className={styles.trendLabel}>vs {trend.label}</span>}</span>
                    </div>
                )}
            </div>

            {/* Subtle bottom gradient accent */}
            <div className={`${styles.accent} ${styles[`accent-${color}`]}`}></div>
        </motion.div>
    );
};

export default GlassStatCard;
