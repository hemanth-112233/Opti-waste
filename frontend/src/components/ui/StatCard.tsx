import React from 'react';
import { GlassCard } from './GlassCard';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import styles from './StatCard.module.css';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    loading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, trend, loading = false }) => {
    return (
        <GlassCard className={styles.statCard}>
            <div className={styles.header}>
                <div className={styles.iconWrapper}>
                    <Icon className={styles.icon} />
                </div>
                {trend && (
                    <div className={`${styles.trendBadge} ${trend.isPositive ? styles.trendPositive :
                        trend.value === 0 ? styles.trendNeutral : styles.trendNegative
                        }`}>
                        {trend.value === 0 ? <Minus className={styles.trendIcon} /> :
                            trend.isPositive ? <TrendingDown className={styles.trendIcon} /> : <TrendingUp className={styles.trendIcon} />}
                        {Math.abs(trend.value)}%
                    </div>
                )}
            </div>

            <div>
                {loading ? (
                    <div className={styles.loadingSkeleton}></div>
                ) : (
                    <h3 className={styles.value}>{value}</h3>
                )}
                <p className={styles.title}>{title}</p>
            </div>
        </GlassCard>
    );
};

export default StatCard;
