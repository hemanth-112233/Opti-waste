import React, { useState, useRef, useEffect } from 'react';
import { Bell, Plus, X, Server, Cloud, Activity, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import GlassSearchBar from './ui/GlassSearchBar';
import UserProfileDropdown from './UserProfileDropdown';
import styles from './Topbar.module.css';

const QUICK_ACTIONS = [
    { label: 'Add Cloud Provider', path: '/providers', icon: Cloud },
    { label: 'Add Cloud Resource', path: '/resources', icon: Server },
    { label: 'Record Metric', path: '/metrics', icon: Activity },
    { label: 'Record Cost Entry', path: '/costs', icon: DollarSign },
];

const Topbar: React.FC = () => {
    const navigate = useNavigate();
    const [showActions, setShowActions] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const actionsRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);

    const currentDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric'
    });

    // Close popups on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setShowActions(false);
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <header className={styles.topbar}>
            <div className={styles.leftSection}>
                <div className={styles.dateWrapper}>
                    <span className={styles.dateText}>{currentDate}</span>
                </div>
            </div>

            <div className={styles.centerSection}>
                <GlassSearchBar
                    placeholder="Search resources, costs, alerts..."
                    containerClassName={styles.searchContainer}
                />
            </div>

            <div className={styles.rightSection}>
                {/* New Action button */}
                <div style={{ position: 'relative' }} ref={actionsRef}>
                    <button
                        className={styles.newActionBtn}
                        onClick={() => { setShowActions(v => !v); setShowNotifications(false); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '0.45rem 0.9rem',
                            background: 'rgba(0,122,255,0.1)',
                            border: '1.5px solid rgba(0,122,255,0.25)',
                            borderRadius: 10, color: '#007AFF',
                            fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Plus size={15} /> New Action
                    </button>
                    <AnimatePresence>
                        {showActions && (
                            <motion.div
                                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                style={{
                                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                                    background: 'rgba(255,255,255,0.92)',
                                    backdropFilter: 'blur(20px)',
                                    border: '1.5px solid rgba(0,0,0,0.08)',
                                    borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                                    padding: '0.5rem', minWidth: 200, zIndex: 999
                                }}
                            >
                                {QUICK_ACTIONS.map(({ label, path, icon: Icon }) => (
                                    <button
                                        key={path}
                                        onClick={() => { setShowActions(false); navigate(path); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            width: '100%', padding: '0.6rem 0.8rem',
                                            borderRadius: 8, border: 'none', background: 'transparent',
                                            color: '#1d2739', fontSize: '0.875rem', cursor: 'pointer',
                                            transition: 'background 0.15s', textAlign: 'left'
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,122,255,0.07)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <Icon size={15} style={{ color: '#007AFF' }} />
                                        {label}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Icon group */}
                <div className={styles.iconGroup}>
                    {/* Notifications */}
                    <div style={{ position: 'relative' }} ref={notifRef}>
                        <button
                            className={styles.iconBtn}
                            aria-label="Notifications"
                            onClick={() => { setShowNotifications(v => !v); setShowActions(false); }}
                        >
                            <Bell size={20} />
                        </button>
                        <AnimatePresence>
                            {showNotifications && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                    transition={{ duration: 0.15 }}
                                    style={{
                                        position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                                        background: 'rgba(255,255,255,0.92)',
                                        backdropFilter: 'blur(20px)',
                                        border: '1.5px solid rgba(0,0,0,0.08)',
                                        borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                                        width: 280, zIndex: 999
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1d2739' }}>Notifications</span>
                                        <button onClick={() => setShowNotifications(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
                                            <X size={14} />
                                        </button>
                                    </div>
                                    <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                                        <Bell size={28} style={{ color: '#d1d5db', marginBottom: 8 }} />
                                        <p style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: 500 }}>No new notifications</p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <UserProfileDropdown />
            </div>
        </header>
    );
};

export default Topbar;
