import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import styles from './ProtectedRoute.module.css';

interface ProtectedRouteProps {
    allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
    const { isAuthenticated, role, isAuthLoading } = useAuthStore();

    if (isAuthLoading) {
        return null; // Or a subtle spinner matching Apple Glass UI
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && allowedRoles.length > 0) {
        const userRole = role || 'Viewer';

        if (userRole === 'Administrator') {
            return <Outlet />;
        }

        if (!allowedRoles.includes(userRole)) {
            return (
                <div className={styles.forbiddenContainer}>
                    <h1 className={styles.forbiddenTitle}>403 Forbidden</h1>
                    <p className={styles.forbiddenText}>Your current role ({userRole}) does not have permissions to view this page.</p>
                    <p className={styles.forbiddenText}>Required Roles: {allowedRoles.join(', ')}</p>
                </div>
            );
        }
    }

    return <Outlet />;
};

export default ProtectedRoute;
