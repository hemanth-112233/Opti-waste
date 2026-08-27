import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import styles from './Layout.module.css';

const Layout: React.FC = () => {
    return (
        <div className={styles.layoutContainer}>
            {/* Apple VisionOS Ambient Frost Lighting */}
            <div className={styles.ambientGlowPrimary} />
            <div className={styles.ambientGlowSecondary} />

            <div className={styles.sidebarWrapper}>
                <Sidebar />
            </div>

            <div className={styles.mainWrapper}>
                <Topbar />
                <main className={styles.mainContent}>
                    {/* Page transitions are handled at route level in App.tsx */}
                    <div className={styles.contentContainer}>
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Layout;
