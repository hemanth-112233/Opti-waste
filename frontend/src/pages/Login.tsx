import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Mail, Lock, Cloud } from 'lucide-react';
import GlassInput from '../components/ui/GlassInput';
import GlassButton from '../components/ui/GlassButton';
import styles from './Login.module.css';

const Login: React.FC = () => {
    const [credentials, setCredentials] = useState({ email: '', password: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rememberMe, setRememberMe] = useState(false);
    const { login } = useAuthStore();
    const location = useLocation();

    React.useEffect(() => {
        if (location.search.includes('expired=true')) {
            setError('Your session has expired. Please sign in again.');
        }
    }, [location]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCredentials(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    /** Extract a user-facing message from an Axios error without leaking internals */
    const extractErrorMessage = (err: any): string => {
        const data = err?.response?.data;
        if (!data) return 'Unable to connect to the server. Please try again.';
        // Zod validation errors (array of {message})
        if (Array.isArray(data.errors) && data.errors.length > 0) {
            return data.errors.map((e: any) => e.message).join(' ');
        }
        // Standard backend message field
        if (typeof data.message === 'string' && data.message) {
            return data.message;
        }
        return 'Invalid credentials. Please try again.';
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            await login({ username: credentials.email, password: credentials.password }, rememberMe);
            // App.tsx handles the <Navigate to="/dashboard" /> automatically once isAuthenticated becomes true
        } catch (err: any) {
            setError(extractErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSocialAuth = (provider: string) => {
        window.alert(`Coming soon: OAuth integration for ${provider}`);
    };

    return (
        <div className={styles.authContainer}>
            {/* Ambient Backdrops matching Layout */}
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
                    <h2>Sign in to OptiWaste</h2>
                    <p>Enter your details to access your FinOps dashboard.</p>
                </div>

                {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.errorMessage}>
                        {error}
                    </motion.div>
                )}

                <form onSubmit={handleEmailAuth} className={styles.formGroup}>
                    <GlassInput
                        name="email"
                        type="email"
                        placeholder="Email Address"
                        icon={Mail}
                        value={credentials.email}
                        onChange={handleChange}
                        required
                    />
                    <GlassInput
                        name="password"
                        type="password"
                        placeholder="Password"
                        icon={Lock}
                        value={credentials.password}
                        onChange={handleChange}
                        required
                    />

                    <div className={styles.optionsRow}>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                            />
                            <span>Remember Me</span>
                        </label>
                        <Link to="#" className={styles.forgotLink}>Forgot password?</Link>
                    </div>

                    <GlassButton
                        type="submit"
                        variant="primary"
                        className={styles.submitBtn}
                        loading={isLoading}
                    >
                        Sign In
                    </GlassButton>
                </form>

                <div className={styles.divider}>
                    <span>Or continue with</span>
                </div>

                <div className={styles.socialGrid}>
                    <GlassButton variant="secondary" onClick={() => handleSocialAuth('Google')} className={styles.socialBtn}>
                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHBhdGggZmlsbD0iI0VBNDMzNSIgZD0iTTI0IDkuNWMzLjU0IDAgNi43MSAxLjIyIDkuMjEgMy42bDYuODUtNi44N0MzNS45IDIuMzggMzAuMiAwIDI0IDBDMTQuNzggMCA2LjczIDUuMzYgMi41MiAxMy4yMkwxMC43MyAxOS42QzEyLjczIDEzLjY3IDE3Ljk3IDkuNSAyNCA5LjV6Ii8+PHBhdGggZmlsbD0iIzQyODVGNCIgZD0iTTQ2Ljk4IDI0LjU1YzAtMS41Ny0uMTUtMy4wOS0uMzgtNC41NUgyNHY5LjAyaDEyLjA1Yy0uNTEgMi45Ni0yLjI5IDUuNDUtNC44MSA3LjE0bDcuNzMgNkMzOS41NSA0MC40NiA0Ni45OCAzMy40IDQ2Ljk4IDI0LjU1eiIvPjxwYXRoIGZpbGw9IiNGQkJDMDQiIGQ9Ik0xMC43MyAyOC40QyAxMC4xOSAyNi45NCA5LjkgMjUuNCA5LjkgMjRzLjI5LTIuOTQuODItNC40TDIuNTIgMTMuMjJDMS4wMyAxNi4xOSAwIDIwIDAgMjRzMS4wMyA3LjgxIDIuNTIgMTAuOThMMTAuNzMgMjguNHoiLz48cGF0aCBmaWxsPSIjMzRBODUzIiBkPSJNMjQgNDhjNi40OCAwIDExLjkzLTIuMTMgMTUuODktNS44MWwtNy43My02YzIuMTUtMS40NSAzLjUzLTQuMSAzLjUzLTcuMTVIMjR2LTkuMDJoMjIuNjJjLjIyIDEuNDkuMzggMy4wMS4zOCA0LjU1IDAgMTAuODItNi43MyAxOS40Mi0xNy4xMSAxOS40Mi05LjI3IDAtMTcuMjctNS4zNi0yMS40OC0xMy4yMmwtOC4yMSA2LjM4QzYuNzMgNDIuNjQgMTQuNzggNDggMjQgNDh6Ii8+PC9zdmc+" alt="Google" width="18" height="18" />
                        Google
                    </GlassButton>
                    <GlassButton variant="secondary" onClick={() => handleSocialAuth('Microsoft')} className={styles.socialBtn}>
                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMSAyMSI+PHBhdGggZmlsbD0iI2YyNTAyMiIgZD0iTTAgMGg5Ljd2OS43SDB6Ii8+PHBhdGggZmlsbD0iIzdmYmEwMCIgZD0iTTExLjMgMGg5Ljd2OS43aC05Ljd6Ii8+PHBhdGggZmlsbD0iIzAwYTRmZiIgZD0iTTAgMTEuM2g5LjdWMjFIMHoiLz48cGF0aCBmaWxsPSIjZmZiOTAwIiBkPSJNMTEuMyAxMS4zaDkuN1YyMWgtOS43eiIvPjwvc3ZnPg==" alt="Microsoft" width="18" height="18" />
                        Microsoft
                    </GlassButton>
                    <GlassButton variant="secondary" onClick={() => handleSocialAuth('GitHub')} className={styles.socialBtn}>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                        GitHub
                    </GlassButton>
                    <GlassButton variant="secondary" onClick={() => handleSocialAuth('Apple')} className={styles.socialBtn}>
                        <svg viewBox="0 0 384 512" width="18" height="18" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" /></svg>
                        Apple
                    </GlassButton>
                </div>

                <div className={styles.footerLink}>
                    <span>Don't have an account? </span>
                    <Link to="/signup">Sign up now</Link>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
