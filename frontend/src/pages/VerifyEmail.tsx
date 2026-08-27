import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Cloud, CheckCircle } from 'lucide-react';
import GlassButton from '../components/ui/GlassButton';
import styles from './Login.module.css';

const VerifyEmail: React.FC = () => {
    return (
        <div className={styles.authContainer}>
            <div className={styles.ambientGlowPrimary} />
            <div className={styles.ambientGlowSecondary} />

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={styles.authCard}
                style={{ textAlign: 'center' }}
            >
                <div className={styles.logoContainer}>
                    <div className={styles.logoBg}>
                        <Cloud size={32} />
                    </div>
                </div>

                <div className={styles.header} style={{ marginBottom: '16px' }}>
                    <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto 12px' }} />
                    <h2>Almost There!</h2>
                    <p>We've sent a verification link to your email address. Please click it to verify your account.</p>
                </div>

                <GlassButton variant="secondary" className={styles.submitBtn} onClick={() => alert("Coming soon: Resend Email Logic")}>
                    Resend Email
                </GlassButton>

                <div className={styles.footerLink} style={{ marginTop: '20px' }}>
                    <Link to="/login">Back to Sign In</Link>
                </div>
            </motion.div>
        </div>
    );
};

export default VerifyEmail;
