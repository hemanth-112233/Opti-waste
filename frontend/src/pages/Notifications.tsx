import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellOff } from 'lucide-react';
import GlassCard from '../components/ui/GlassCard';

const Notifications: React.FC = () => {
    const [notifications] = useState<any[]>([]); // No backend yet

    return (
        <div style={{ padding: '2rem', maxWidth: 640 }}>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1d2739', marginBottom: '0.25rem' }}>Notifications</h1>
                <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '2rem' }}>
                    System alerts and activity updates.
                </p>

                <GlassCard style={{ padding: '2rem' }}>
                    {notifications.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                            <BellOff size={40} style={{ color: '#d1d5db', marginBottom: '1rem' }} />
                            <p style={{ color: '#9ca3af', fontWeight: 500, marginBottom: '0.5rem' }}>No new notifications</p>
                            <p style={{ color: '#d1d5db', fontSize: '0.85rem' }}>You're all caught up!</p>
                        </div>
                    ) : (
                        notifications.map((n, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.75rem 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                                <Bell size={16} style={{ color: '#007AFF', marginTop: 2, flexShrink: 0 }} />
                                <div>
                                    <p style={{ fontSize: '0.875rem', color: '#1d2739', marginBottom: 2 }}>{n.message}</p>
                                    <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{n.time}</p>
                                </div>
                            </div>
                        ))
                    )}
                </GlassCard>
            </motion.div>
        </div>
    );
};

export default Notifications;
