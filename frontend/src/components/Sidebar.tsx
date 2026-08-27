/**
 * Sidebar.tsx — Step 3D Upgrade
 *
 * Navigation interaction system:
 *   - Each nav item wraps its icon in a motion.span for the hover nudge
 *   - `layoutId="sidebar-active"` spring animation retained for active pill
 *   - Footer profile item uses whileHover for card lift
 *   - sidebarItemHover preset from motionSystem ensures consistency
 */
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
    LayoutDashboard, Cloud, Server, Activity, DollarSign,
    AlertTriangle, Zap, CheckCircle, BarChart3, Settings,
    ShieldAlert, RefreshCcw,
} from 'lucide-react';
import { useAuthStore, getInitials } from '../store/useAuthStore';
import { spring } from '../lib/motionSystem';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Providers', path: '/providers', icon: Cloud },
    { name: 'Resources', path: '/resources', icon: Server },
    { name: 'Metrics', path: '/metrics', icon: Activity },
    { name: 'Cost Analytics', path: '/costs', icon: DollarSign },
    { name: 'Waste Detection', path: '/waste-detection', icon: Zap },
    { name: 'Waste Risk Index', path: '/waste-risk', icon: ShieldAlert },
    { name: 'Recommendations', path: '/recommendations', icon: AlertTriangle },
    { name: 'Verification', path: '/verification', icon: CheckCircle },
    { name: 'Closed Loop', path: '/closed-loop', icon: RefreshCcw },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'Settings', path: '/settings', icon: Settings },
];

const Sidebar: React.FC = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const reducedMotion = useReducedMotion();

    const displayName = user?.name || 'User';
    const displayEmail = user?.email || '';
    const initials = user ? getInitials(displayName) : '?';

    return (
        <motion.aside
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={spring.standard}
            className={styles.aside}
        >
            <div className={styles.header}>
                <div className={styles.logoWrapper}>
                    <Cloud className={styles.logoIcon} size={24} />
                </div>
                <h1 className={styles.title}>OptiWaste</h1>
            </div>

            <nav className={styles.nav}>
                {NAV_ITEMS.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                {isActive && (
                                    <motion.div
                                        layoutId="sidebar-active"
                                        className={styles.activeIndicator}
                                        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                                    />
                                )}
                                {/* Icon with spring nudge on hover */}
                                <motion.span
                                    className={styles.iconMotionWrapper}
                                    whileHover={reducedMotion ? undefined : { x: 2, scale: 1.10 }}
                                    transition={spring.snappy}
                                >
                                    <item.icon
                                        className={styles.icon}
                                        size={18}
                                        style={{ opacity: isActive ? 1 : 0.72 }}
                                    />
                                </motion.span>
                                <span className={styles.navText}>{item.name}</span>
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Profile footer — glass hover card */}
            <motion.div
                className={styles.footer}
                onClick={() => navigate('/profile')}
                style={{ cursor: 'pointer' }}
                whileHover={reducedMotion ? undefined : { scale: 1.015 }}
                whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                transition={spring.snappy}
            >
                <div className={styles.footerUser}>
                    <div className={styles.avatar}>{initials}</div>
                    <div className={styles.userInfo}>
                        <p className={styles.userName}>{displayName}</p>
                        <p className={styles.userRole}>{displayEmail}</p>
                    </div>
                </div>
            </motion.div>
        </motion.aside>
    );
};

export default Sidebar;
