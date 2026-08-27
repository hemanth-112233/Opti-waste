import React from 'react';
import { motion } from 'framer-motion';
import { FileQuestion, AlertCircle, Inbox } from 'lucide-react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
    title?: string;
    message?: string;
    icon?: 'folder' | 'alert' | 'inbox' | React.ReactNode;
    action?: React.ReactNode;
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    title = "No Data Available",
    message = "There is nothing to display here at the moment.",
    icon = 'folder',
    action,
    className = ''
}) => {
    const renderIcon = () => {
        if (typeof icon !== 'string') return icon;
        switch (icon) {
            case 'alert': return <AlertCircle className={styles.icon} />;
            case 'inbox': return <Inbox className={styles.icon} />;
            case 'folder':
            default:
                return <FileQuestion className={styles.icon} />;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`${styles.container} ${className}`}
        >
            <div className={styles.iconContainer}>
                {renderIcon()}
            </div>
            <h3 className={styles.title}>{title}</h3>
            <p className={styles.message}>{message}</p>
            {action && <div className={styles.actionContainer}>{action}</div>}
        </motion.div>
    );
};

export default EmptyState;
