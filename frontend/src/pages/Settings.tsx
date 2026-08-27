import React from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Bell, Shield, Monitor, Database } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import GlassCard from '../components/ui/GlassCard';

const Settings: React.FC = () => {
    const { user, logout } = useAuthStore();

    return (
        <div style={{ padding: '2rem', maxWidth: 680 }}>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1d2739', marginBottom: '0.25rem' }}>Account Settings</h1>
                <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '2rem' }}>Manage your account preferences and session.</p>

                {/* Account Info */}
                <GlassCard style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1d2739', display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                        <SettingsIcon size={16} style={{ color: '#007AFF' }} /> Account
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Display Name</span>
                            <span style={{ color: '#1d2739', fontSize: '0.875rem', fontWeight: 500 }}>{user?.name}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Email</span>
                            <span style={{ color: '#1d2739', fontSize: '0.875rem', fontWeight: 500 }}>{user?.email}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Role</span>
                            <span style={{ padding: '0.2rem 0.6rem', borderRadius: 20, background: 'rgba(0,122,255,0.1)', color: '#007AFF', fontSize: '0.75rem', fontWeight: 600 }}>{user?.role}</span>
                        </div>
                    </div>
                </GlassCard>

                {/* Notifications */}
                <GlassCard style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1d2739', display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                        <Bell size={16} style={{ color: '#007AFF' }} /> Notifications
                        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 400 }}>Coming soon</span>
                    </h3>
                    <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Email and in-app notification preferences will be configurable here.</p>
                </GlassCard>

                {/* Security */}
                <GlassCard style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1d2739', display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                        <Shield size={16} style={{ color: '#007AFF' }} /> Security
                        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#9ca3af', fontWeight: 400 }}>Coming soon</span>
                    </h3>
                    <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Password change, two-factor authentication, and active sessions.</p>
                </GlassCard>

                {/* Interface */}
                <GlassCard style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1d2739', display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                        <Monitor size={16} style={{ color: '#007AFF' }} /> Interface
                    </h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ fontSize: '0.875rem', color: '#1d2739', fontWeight: 500, marginBottom: 2 }}>Theme</p>
                            <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>White Glass (Apple VisionOS)</p>
                        </div>
                        <div style={{ padding: '0.25rem 0.75rem', background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.3)', borderRadius: 20, fontSize: '0.75rem', color: '#34C759', fontWeight: 600 }}>Active</div>
                    </div>
                </GlassCard>

                {/* Danger zone */}
                <GlassCard style={{ padding: '1.5rem', borderColor: 'rgba(255,59,48,0.2)' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#FF3B30', display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                        <Database size={16} /> Danger Zone
                    </h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ fontSize: '0.875rem', color: '#1d2739', fontWeight: 500, marginBottom: 2 }}>Sign out of this session</p>
                            <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Clears your session and returns to login.</p>
                        </div>
                        <button
                            onClick={() => { if (window.confirm('Sign out?')) logout(); }}
                            style={{ background: 'rgba(255,59,48,0.1)', border: '1.5px solid rgba(255,59,48,0.3)', color: '#FF3B30', padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}
                        >
                            Sign Out
                        </button>
                    </div>
                </GlassCard>
            </motion.div>
        </div>
    );
};

export default Settings;
