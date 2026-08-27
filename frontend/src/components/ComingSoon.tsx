import React from 'react';
import { motion } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GlassCard from './ui/GlassCard';

interface ComingSoonProps {
    title: string;
    description: string;
    icon: LucideIcon;
    eta?: string;
}

const ComingSoon: React.FC<ComingSoonProps> = ({ title, description, icon: Icon, eta }) => {
    const navigate = useNavigate();
    return (
        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{ width: '100%', maxWidth: 480 }}
            >
                <GlassCard style={{ textAlign: 'center', padding: '3rem 2.5rem' }}>
                    <div style={{
                        width: 72, height: 72, borderRadius: '20px',
                        background: 'linear-gradient(135deg, rgba(0,122,255,0.15), rgba(88,86,214,0.15))',
                        border: '1.5px solid rgba(0,122,255,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1.5rem'
                    }}>
                        <Icon size={32} style={{ color: '#007AFF' }} />
                    </div>

                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1d2739', marginBottom: '0.75rem' }}>
                        {title}
                    </h2>
                    <p style={{ color: '#6b7280', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                        {description}
                    </p>

                    {eta && (
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '0.4rem 0.9rem', borderRadius: 20,
                            background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.2)',
                            fontSize: '0.8rem', fontWeight: 500, color: '#007AFF',
                            marginBottom: '1.5rem'
                        }}>
                            🚀 {eta}
                        </div>
                    )}

                    <button
                        onClick={() => navigate('/dashboard')}
                        style={{
                            background: 'rgba(0,122,255,0.12)', border: '1.5px solid rgba(0,122,255,0.3)',
                            color: '#007AFF', padding: '0.6rem 1.5rem', borderRadius: 10,
                            fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        ← Back to Dashboard
                    </button>
                </GlassCard>
            </motion.div>
        </div>
    );
};

export default ComingSoon;
