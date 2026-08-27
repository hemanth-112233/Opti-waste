import React from 'react';
import styles from './LoadingSkeleton.module.css';

interface SkeletonProps {
    type?: 'text' | 'title' | 'avatar' | 'card' | 'table-row';
    count?: number;
    className?: string;
    width?: string | number;
    height?: string | number;
}

export const LoadingSkeleton: React.FC<SkeletonProps> = ({
    type = 'text',
    count = 1,
    className = '',
    width,
    height
}) => {
    const elements = Array.from({ length: count }, (_, i) => i);

    return (
        <>
            {elements.map((key) => (
                <div
                    key={key}
                    className={`${styles.skeleton} ${styles[type]} ${className}`}
                    style={{ width, height }}
                />
            ))}
        </>
    );
};

export default LoadingSkeleton;
