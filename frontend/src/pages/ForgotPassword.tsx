import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Mail, Cloud } from 'lucide-react';
import GlassInput from '../components/ui/GlassInput';
import GlassButton from '../components/ui/GlassButton';
import styles from './Login.module.css'; // Reusing Login styles for consistent Apple Glass Theme

const ForgotPassword: React.FC = () => {
    const handleReset = (e: React.FormEvent) => {
        e.preventDefault();
        alert("Coming soon: Password Reset flows!");
    };

    return (
        <div className={styles.authContainer}>
            <div className={styles.ambientGlowPrimary} />
            <div className={styles.ambientGlowSecondary} />

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={styles.authCard}
            >
                <div className={styles.logoContainer}>
                    <div className={styles.logoBg}>
                        <Cloud size={32} />
                    </div>
                </div>

                <div className={styles.header}>
                    <h2>Reset Password</h2>
                    <p>Enter your email to receive recovery instructions.</p>
                </div>

                <form onSubmit={handleReset} className={styles.formGroup}>
                    <GlassInput
                        name="email"
                        type="email"
                        placeholder="Email Address"
                        icon={Mail}
                        required
                    />

                    <GlassButton type="submit" variant="primary" className={styles.submitBtn}>
                        Send Recovery Link
                    </GlassButton>
                </form>

                <div className={styles.footerLink}>
                    <span>Remembered your password? </span>
                    <Link to="/login">Sign in</Link>
                </div>
            </motion.div>
        </div>
    );
};

export default ForgotPassword;
