import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from './store/useAuthStore';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Providers from './pages/Providers';
import Resources from './pages/Resources';
import Metrics from './pages/Metrics';
import Costs from './pages/Costs';

import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import WasteDetection from './pages/WasteDetection';
import WasteRisk from './pages/WasteRisk';
import Recommendations from './pages/Recommendations';
import Verification from './pages/Verification';
import ClosedLoop from './pages/ClosedLoop';
import Reports from './pages/Reports';

import { queryClient } from './lib/queryClient';

// ── Apple-style page transition — subtle fade + scale ──────────
const pageVariants = {
  initial: { opacity: 0, scale: 0.985, y: 8 },
  animate: {
    opacity: 1, scale: 1, y: 0,
    transition: { type: 'spring' as const, stiffness: 380, damping: 32 }
  },
  exit: {
    opacity: 0, scale: 0.985, y: -4,
    transition: { duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] as any }
  },
};

const PageWrap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" style={{ width: '100%' }}>
    {children}
  </motion.div>
);

// Inner component that has access to useLocation (must be inside BrowserRouter)
const AppRoutes: React.FC<{ isAuthenticated: boolean }> = ({ isAuthenticated }) => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        {/* Public routes */}
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/signup" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Signup />} />
        <Route path="/forgot-password" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ForgotPassword />} />
        <Route path="/reset-password" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ResetPassword />} />
        <Route path="/verify-email" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <VerifyEmail />} />

        {/* Protected layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<PageWrap><Dashboard /></PageWrap>} />
            <Route path="/profile" element={<PageWrap><Profile /></PageWrap>} />
            <Route path="/settings" element={<PageWrap><Settings /></PageWrap>} />
            <Route path="/notifications" element={<PageWrap><Notifications /></PageWrap>} />
            <Route path="/reports" element={<PageWrap><Reports /></PageWrap>} />
            <Route path="/waste-detection" element={<PageWrap><WasteDetection /></PageWrap>} />
            <Route path="/waste-risk" element={<PageWrap><WasteRisk /></PageWrap>} />
            <Route path="/recommendations" element={<PageWrap><Recommendations /></PageWrap>} />
            <Route path="/verification" element={<PageWrap><Verification /></PageWrap>} />
            <Route path="/closed-loop" element={<PageWrap><ClosedLoop /></PageWrap>} />
            <Route path="/resources" element={<PageWrap><Resources /></PageWrap>} />
            <Route path="/metrics" element={<PageWrap><Metrics /></PageWrap>} />
            <Route path="/costs" element={<PageWrap><Costs /></PageWrap>} />
            <Route path="/providers" element={<PageWrap><Providers /></PageWrap>} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </AnimatePresence>
  );
};

function App() {
  const { initialize, isAuthenticated, isAuthLoading } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isAuthLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(160deg, #EEEEEF 0%, #F0F0F5 100%)',
        flexDirection: 'column', gap: 16
      }}>
        <div style={{
          width: 40, height: 40,
          border: '3px solid rgba(0,122,255,0.15)',
          borderTopColor: '#007AFF',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes isAuthenticated={isAuthenticated} />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
