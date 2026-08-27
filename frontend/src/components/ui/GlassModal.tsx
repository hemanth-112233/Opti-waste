import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import styles from './GlassModal.module.css';

interface GlassModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    width?: string;
    className?: string;
}

export const GlassModal: React.FC<GlassModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    width = '600px',
    className = ''
}) => {
    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className={styles.overlayWrapper}>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className={styles.backdrop}
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className={`${styles.modal} ${className}`}
                        style={{ maxWidth: width }}
                    >
                        {title && (
                            <div className={styles.header}>
                                <h3 className={styles.title}>{title}</h3>
                                <button onClick={onClose} className={styles.closeBtn}>
                                    <X size={20} />
                                </button>
                            </div>
                        )}

                        <div className={styles.content}>
                            {children}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default GlassModal;
