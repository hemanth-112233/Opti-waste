import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, getInitials } from '../store/useAuthStore';
import {
    User, Settings, Key, Bell,
    HelpCircle, Info, LogOut, ChevronDown, CheckCircle
} from 'lucide-react';
import styles from './UserProfileDropdown.module.css';

const UserProfileDropdown: React.FC = () => {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const close = () => setIsOpen(false);

    const handleSignOut = () => {
        if (window.confirm("Are you sure you want to sign out?")) {
            close();
            logout(false);
            navigate('/login', { replace: true });
        }
    };

    const go = (path: string) => {
        close();
        navigate(path);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                close();
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    if (!user) return null;

    const initials = getInitials(user.name);

    return (
        <div className={styles.dropdownContainer} ref={dropdownRef}>
            <button className={styles.triggerButton} onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen}>
                <div className={styles.avatarWrapper}>
                    <div className={styles.avatarText}>{initials}</div>
                    <div className={styles.onlineIndicator}></div>
                </div>
                <div className={styles.userInfo}>
                    <span className={styles.userName}>{user.name}</span>
                    <span className={styles.userRole}>{user.role}</span>
                </div>
                <ChevronDown size={14} className={`${styles.chevron} ${isOpen ? styles.rotated : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className={styles.dropdownMenu}
                    >
                        {/* Profile header */}
                        <div className={styles.dropdownHeader}>
                            <div className={styles.largeAvatarWrapper}>
                                <div className={styles.largeAvatarText}>{initials}</div>
                            </div>
                            <div className={styles.profileDetails}>
                                <h4>{user.name}</h4>
                                <p>{user.email}</p>
                                <div className={styles.statusBadge}>
                                    <CheckCircle size={12} className={styles.statusIcon} />
                                    <span>{user.status}</span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.divider}></div>

                        <div className={styles.menuGroup}>
                            <button className={styles.menuItem} onClick={() => go('/profile')}>
                                <User size={16} /> My Profile
                            </button>
                            <button className={styles.menuItem} onClick={() => go('/settings')}>
                                <Settings size={16} /> Account Settings
                            </button>
                            <button className={styles.menuItem} onClick={() => go('/settings?tab=password')}>
                                <Key size={16} /> Change Password
                                <span className={styles.placeholderTag}>Soon</span>
                            </button>
                            <button className={styles.menuItem} onClick={() => go('/notifications')}>
                                <Bell size={16} /> Notifications
                            </button>
                        </div>

                        <div className={styles.divider}></div>

                        <div className={styles.menuGroup}>
                            <button className={styles.menuItem} onClick={() => { close(); window.alert('Help & Support: support@optiwaste.io'); }}>
                                <HelpCircle size={16} /> Help &amp; Support
                            </button>
                            <button className={styles.menuItem} onClick={() => { close(); window.alert('OptiWaste v1.0 — Cloud FinOps Intelligence Platform'); }}>
                                <Info size={16} /> About OptiWaste
                            </button>
                        </div>

                        <div className={styles.divider}></div>

                        <button className={`${styles.menuItem} ${styles.danger}`} onClick={handleSignOut}>
                            <LogOut size={16} /> Sign Out
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default UserProfileDropdown;
