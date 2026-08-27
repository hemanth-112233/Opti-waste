import React from 'react';
import { Search, Bell, Moon, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import styles from './TopNav.module.css';

const TopNav: React.FC = () => {
    const { role } = useAuthStore();

    return (
        <header className={styles.header}>
            <div className={styles.searchContainer}>
                <div className={styles.inputWrapper}>
                    <Search className={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="Search resources, providers, metrics..."
                        className={styles.searchInput}
                    />
                </div>
            </div>

            <div className={styles.actions}>
                <button className={styles.actionButton}>
                    <Moon className={styles.icon} />
                </button>
                <button className={styles.actionButton}>
                    <Bell className={styles.icon} />
                    <span className={styles.badge}></span>
                </button>

                <div className={styles.divider}></div>

                <div className={styles.profileContainer}>
                    <div className={styles.profileText}>
                        <p className={styles.userName}>Admin User</p>
                        <p className={styles.userRole}>{role || 'Viewer'}</p>
                    </div>
                    <div className={styles.avatar}>
                        <UserIcon className={styles.avatarIcon} />
                    </div>
                </div>
            </div>
        </header>
    );
};

export default TopNav;
