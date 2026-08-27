import React from 'react';
import { ResponsiveContainer } from 'recharts';
import styles from './ChartContainer.module.css';

interface ChartContainerProps {
    title: string;
    description?: string;
    children: React.ReactNode;
    height?: number | string;
    className?: string;
    loading?: boolean;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
    title,
    description,
    children,
    height = 300,
    className = '',
    loading = false,
}) => {
    return (
        <div className={`${styles.chartCard} ${className}`}>
            <div className={styles.header}>
                <div className={styles.titleGroup}>
                    <h3 className={styles.title}>{title}</h3>
                    {description && <p className={styles.description}>{description}</p>}
                </div>
            </div>

            <div className={styles.chartWrapper} style={{ height }}>
                {loading ? (
                    <div className={styles.loadingOverlay}>
                        <div className={styles.spinner}></div>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        {children as any}
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};

export default ChartContainer;
