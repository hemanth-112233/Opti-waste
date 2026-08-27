import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Lock, Cloud } from 'lucide-react';
import GlassInput from '../components/ui/GlassInput';
import GlassButton from '../components/ui/GlassButton';
import styles from './Login.module.css';

const ResetPassword: React.FC = () => {
    const handleVerify = (e: React.FormEvent) => {
        e.preventDefault();
        alert("Coming soon: Password Reset Confirmation flow!");
    };

    return (
        <div className={styles.authContainer}>
            <div className={styles.ambientGlowPrimary} />
            <div className={styles.ambientGlowSecondary} />

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={styles.authCard}
            >
                <div className={styles.logoContainer}>
                    <div className={styles.logoBg}>
                        <Cloud size={32} />
                    </div>
                </div>

                <div className={styles.header}>
                    <h2>New Password</h2>
                    <p>Enter your new secure password.</p>
                </div>

                <form onSubmit={handleVerify} className={styles.formGroup}>
                    <GlassInput
                        name="password"
                        type="password"
                        placeholder="New Password"
                        icon={Lock}
                        required
                    />
                    <GlassInput
                        name="confirmPassword"
                        type="password"
                        placeholder="Confirm Password"
                        icon={Lock}
                        required
                    />

                    <GlassButton type="submit" variant="primary" className={styles.submitBtn}>
                        Update Password
                    </GlassButton>
                </form>

                <div className={styles.footerLink}>
                    <Link to="/login">Back to Sign In</Link>
                </div>
            </motion.div>
        </div>
    );
};

export default ResetPassword;
