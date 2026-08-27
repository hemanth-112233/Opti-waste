import React from 'react';
import { GlassCard } from './GlassCard';
import styles from './ChartCard.module.css';

interface ChartCardProps {
    title: string;
    description?: string;
    children: React.ReactNode;
    loading?: boolean;
    className?: string;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, description, children, loading, className = '' }) => {
    return (
        <GlassCard className={className}>
            <div className={styles.header}>
                <h3 className={styles.title}>{title}</h3>
                {description && <p className={styles.description}>{description}</p>}
            </div>
            <div className={styles.contentWrapper}>
                {loading ? (
                    <div className={styles.loaderWrapper}>
                        <div className={styles.spinner}></div>
                    </div>
                ) : (
                    children
                )}
            </div>
        </GlassCard>
    );
};

export default ChartCard;
