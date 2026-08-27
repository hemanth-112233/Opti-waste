import React from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Shield, Activity, Calendar } from 'lucide-react';
import { useAuthStore, getInitials } from '../store/useAuthStore';
import GlassCard from '../components/ui/GlassCard';

const Profile: React.FC = () => {
    const { user } = useAuthStore();

    if (!user) return null;

    const initials = getInitials(user.name);
    const memberSince = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

    return (
        <div style={{ padding: '2rem', maxWidth: 640 }}>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1d2739', marginBottom: '0.25rem' }}>My Profile</h1>
                <p style={{ color: '#6b7280', marginBottom: '2rem', fontSize: '0.9rem' }}>Your account information and identity.</p>

                <GlassCard style={{ padding: '2rem', marginBottom: '1.5rem' }}>
                    {/* Avatar row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div style={{
                            width: 72, height: 72, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #007AFF, #5856D6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.6rem', fontWeight: 700, color: '#fff', flexShrink: 0
                        }}>
                            {initials}
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1d2739', marginBottom: 4 }}>{user.name}</h2>
                            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{user.email}</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {[
                            { icon: User, label: 'Full Name', value: user.name },
                            { icon: Mail, label: 'Email', value: user.email },
                            { icon: Shield, label: 'Role', value: user.role },
                            { icon: Activity, label: 'Status', value: user.status },
                            { icon: Calendar, label: 'Member Since', value: memberSince },
                        ].map(({ icon: Icon, label, value }) => (
                            <div key={label} style={{
                                display: 'flex', alignItems: 'center', gap: '1rem',
                                padding: '0.75rem 1rem', borderRadius: 12,
                                background: 'rgba(0,0,0,0.025)', border: '1px solid rgba(0,0,0,0.06)'
                            }}>
                                <Icon size={16} style={{ color: '#007AFF', flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block' }}>{label}</span>
                                    <span style={{ fontSize: '0.9rem', color: '#1d2739', fontWeight: 500 }}>{value}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </GlassCard>

                <p style={{ fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center' }}>
                    Profile editing coming soon. Contact your administrator to update account details.
                </p>
            </motion.div>
        </div>
    );
};

export default Profile;
