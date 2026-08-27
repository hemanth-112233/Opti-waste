/**
 * Signup.tsx — Step 4B: Reference-image visual match
 *
 * Composition:
 *   LEFT  65% — Cinematic cloud environment + numbered story timeline
 *   RIGHT 35% — Tall translucent glass Signup panel (~94vh)
 *
 * Critical requirements:
 *   - compact={true} on OptiWasteCloudVisual → suppresses fake savings badge
 *   - No fake financial data anywhere on this page
 *   - Numbered vertical story timeline (01–05) with connector line
 *   - Taller glass panel (~94vh, scroll-y if needed)
 *   - Softer neutral/lavender focus glow on inputs (not blue)
 *   - All form logic preserved exactly (AuthService, validation, redirect)
 */
import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
    Mail, Lock, User, Cloud,
    AlertCircle, CheckCircle, Eye, EyeOff,
} from 'lucide-react';
import GlassButton from '../components/ui/GlassButton';
import OptiWasteCloudVisual from '../components/visuals/OptiWasteCloudVisual';
import { AuthService } from '../api/auth';
import {
    spring,
    iconButtonHover,
    iconButtonTap,
    primaryButtonHover,
    primaryButtonTap,
} from '../lib/motionSystem';
import styles from './Signup.module.css';


// ── Animation containers ─────────────────────────────────────────────────────
const formContainerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06, delayChildren: 0.20 } },
};
const fieldVariants = {
    hidden: { opacity: 0, y: 8, scale: 0.99 },
    show: { opacity: 1, y: 0, scale: 1, transition: spring.standard },
};

// ── Inline Google logo (no external deps) ────────────────────────────────────
const GoogleLogo = () => (
    <svg viewBox="0 0 48 48" width="16" height="16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.87C35.9 2.38 30.2 0 24 0 14.78 0 6.73 5.36 2.52 13.22l8.21 6.38C12.73 13.67 17.97 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.51 2.96-2.29 5.45-4.81 7.14l7.73 6C43.55 40.46 46.98 33.4 46.98 24.55z" />
        <path fill="#FBBC04" d="M10.73 28.4A14.6 14.6 0 0 1 9.9 24c0-1.4.29-2.94.82-4.4L2.52 13.22C1.03 16.19 0 20 0 24s1.03 7.81 2.52 10.98l8.21-6.58z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.94 2.31-8.16 2.31-6.03 0-11.27-4.17-13.27-10.1l-8.21 6.38C6.73 42.64 14.78 48 24 48z" />
    </svg>
);

// ── Main component ────────────────────────────────────────────────────────────
const Signup: React.FC = () => {
    const [formData, setFormData] = useState({
        name: '', email: '', password: '', confirm: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [showPwd, setShowPwd] = useState(false);
    const [showConf, setShowConf] = useState(false);
    const navigate = useNavigate();
    const rm = useReducedMotion(); // reduced-motion shorthand

    // ── Form logic — UNCHANGED ───────────────────────────────────────────────
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
        if (error) setError(null);
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (formData.password !== formData.confirm) {
            setError('Passwords do not match.');
            return;
        }
        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        setLoading(true);
        try {
            await AuthService.register({
                name: formData.name.trim(),
                email: formData.email.trim().toLowerCase(),
                password: formData.password,
            });
            setSuccess(true);
            setTimeout(() => navigate('/login'), 1800);
        } catch (err: any) {
            const data = err?.response?.data;
            if (!data) {
                setError('Unable to connect to the server. Please try again.');
            } else if (Array.isArray(data.errors) && data.errors.length > 0) {
                setError(data.errors.map((e: any) => e.message).join(' '));
            } else if (typeof data.message === 'string' && data.message) {
                setError(data.message);
            } else {
                setError('Registration failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSocialAuth = (provider: string) => {
        window.alert(`Coming soon: OAuth integration for ${provider}`);
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className={styles.page}>

            {/* ── Atmospheric page background blobs ───────────────────────── */}
            <div className={styles.bgBlob1} aria-hidden="true" />
            <div className={styles.bgBlob2} aria-hidden="true" />
            <div className={styles.bgBlob3} aria-hidden="true" />

            {/* ══════════════════════════════════════════════════════════════
                LEFT — Cloud environment (65%)
            ══════════════════════════════════════════════════════════════ */}
            <div className={styles.cloudPane}>

                {/* Top-left brand mark */}
                <motion.div
                    className={styles.brandMark}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={rm ? { duration: 0.001 } : { delay: 0.1, ...spring.gentle }}
                >
                    <div className={styles.brandBadge}>
                        <Cloud size={14} aria-hidden="true" />
                    </div>
                    <span className={styles.brandWord}>OptiWaste</span>
                </motion.div>

                {/* Cloud visual — compact=true hides fake savings badge */}
                <div className={styles.cloudWrap}>
                    <OptiWasteCloudVisual
                        compact={true}
                        className={styles.cloudVisual}
                    />
                </div>

                {/* Bottom tagline */}
                <motion.p
                    className={styles.cloudTagline}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={rm ? { duration: 0.001 } : { delay: 1.8, duration: 1 }}
                >
                    Optimize. Save. Scale.
                </motion.p>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                RIGHT — Tall floating glass Signup panel (35%)
            ══════════════════════════════════════════════════════════════ */}
            <div className={styles.formPane}>
                <motion.div
                    className={styles.glassPanel}
                    initial={rm ? {} : { opacity: 0, x: 40, scale: 0.97 }}
                    animate={rm ? {} : { opacity: 1, x: 0, scale: 1 }}
                    transition={rm ? { duration: 0.001 } : { ...spring.standard, delay: 0.12 }}
                >
                    {/* Specular top edge */}
                    <div className={styles.panelSpecular} aria-hidden="true" />

                    {/* ── Panel header ───────────────────────────────────── */}
                    <div className={styles.panelHeader}>
                        <motion.div
                            className={styles.logoBadge}
                            initial={rm ? {} : { scale: 0.75, opacity: 0 }}
                            animate={rm ? {} : { scale: 1, opacity: 1 }}
                            transition={rm ? { duration: 0.001 } : { ...spring.snappy, delay: 0.25 }}
                        >
                            <Cloud size={20} aria-hidden="true" />
                        </motion.div>

                        <motion.p
                            className={styles.eyebrow}
                            initial={rm ? {} : { opacity: 0 }}
                            animate={rm ? {} : { opacity: 1 }}
                            transition={rm ? { duration: 0.001 } : { delay: 0.30 }}
                        >
                            OPTIWASTE
                        </motion.p>

                        <motion.h1
                            className={styles.heading}
                            initial={rm ? {} : { opacity: 0, y: 8 }}
                            animate={rm ? {} : { opacity: 1, y: 0 }}
                            transition={rm ? { duration: 0.001 } : { ...spring.standard, delay: 0.34 }}
                        >
                            Start optimizing<br />your cloud
                        </motion.h1>

                        <motion.p
                            className={styles.subheading}
                            initial={rm ? {} : { opacity: 0, y: 6 }}
                            animate={rm ? {} : { opacity: 1, y: 0 }}
                            transition={rm ? { duration: 0.001 } : { delay: 0.42, duration: 0.5 }}
                        >
                            Monitor resources, detect waste, and turn cloud spend into measurable savings.
                        </motion.p>
                    </div>

                    {/* ── Error / success banners ─────────────────────────── */}
                    <AnimatePresence mode="wait">
                        {error && (
                            <motion.div
                                key="err"
                                className={styles.errorBanner}
                                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={spring.snappy}
                            >
                                <AlertCircle size={14} aria-hidden="true" />
                                <span>{error}</span>
                            </motion.div>
                        )}
                        {success && (
                            <motion.div
                                key="ok"
                                className={styles.successBanner}
                                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0 }}
                                transition={spring.snappy}
                            >
                                <CheckCircle size={14} aria-hidden="true" />
                                <span>Account created! Redirecting to sign in…</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ── Form with staggered field entrance ─────────────── */}
                    <motion.form
                        onSubmit={handleSignup}
                        className={styles.form}
                        variants={formContainerVariants}
                        initial="hidden"
                        animate="show"
                        noValidate
                    >
                        {/* Full Name */}
                        <motion.div variants={fieldVariants} className={styles.field}>
                            <label htmlFor="su-name" className={styles.label}>Full Name</label>
                            <div className={styles.inputRow}>
                                <User size={14} className={styles.inputIcon} aria-hidden="true" />
                                <input
                                    id="su-name" name="name" type="text"
                                    className={styles.input}
                                    placeholder="Jane Smith"
                                    value={formData.name}
                                    onChange={handleChange}
                                    autoComplete="name" required
                                />
                            </div>
                        </motion.div>

                        {/* Email */}
                        <motion.div variants={fieldVariants} className={styles.field}>
                            <label htmlFor="su-email" className={styles.label}>Email Address</label>
                            <div className={styles.inputRow}>
                                <Mail size={14} className={styles.inputIcon} aria-hidden="true" />
                                <input
                                    id="su-email" name="email" type="email"
                                    className={styles.input}
                                    placeholder="jane@company.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    autoComplete="email" required
                                />
                            </div>
                        </motion.div>

                        {/* Password */}
                        <motion.div variants={fieldVariants} className={styles.field}>
                            <label htmlFor="su-pwd" className={styles.label}>Password</label>
                            <div className={styles.inputRow}>
                                <Lock size={14} className={styles.inputIcon} aria-hidden="true" />
                                <input
                                    id="su-pwd" name="password"
                                    type={showPwd ? 'text' : 'password'}
                                    className={`${styles.input} ${styles.inputHasEye}`}
                                    placeholder="Min. 6 characters"
                                    value={formData.password}
                                    onChange={handleChange}
                                    autoComplete="new-password" required
                                />
                                <motion.button
                                    type="button" className={styles.eyeBtn}
                                    onClick={() => setShowPwd(p => !p)}
                                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                                    whileHover={rm ? undefined : iconButtonHover}
                                    whileTap={rm ? undefined : iconButtonTap}
                                >
                                    {showPwd ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}
                                </motion.button>
                            </div>
                        </motion.div>

                        {/* Confirm */}
                        <motion.div variants={fieldVariants} className={styles.field}>
                            <label htmlFor="su-conf" className={styles.label}>Confirm Password</label>
                            <div className={styles.inputRow}>
                                <Lock size={14} className={styles.inputIcon} aria-hidden="true" />
                                <input
                                    id="su-conf" name="confirm"
                                    type={showConf ? 'text' : 'password'}
                                    className={`${styles.input} ${styles.inputHasEye}`}
                                    placeholder="Repeat password"
                                    value={formData.confirm}
                                    onChange={handleChange}
                                    autoComplete="new-password" required
                                />
                                <motion.button
                                    type="button" className={styles.eyeBtn}
                                    onClick={() => setShowConf(p => !p)}
                                    aria-label={showConf ? 'Hide password' : 'Show password'}
                                    whileHover={rm ? undefined : iconButtonHover}
                                    whileTap={rm ? undefined : iconButtonTap}
                                >
                                    {showConf ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}
                                </motion.button>
                            </div>
                        </motion.div>

                        {/* Terms */}
                        <motion.label variants={fieldVariants} className={styles.termsLabel}>
                            <input type="checkbox" className={styles.termsBox} required />
                            <span>I agree to the <a href="#terms" className={styles.termsLink}>Terms &amp; Conditions</a></span>
                        </motion.label>

                        {/* Primary CTA */}
                        <motion.div variants={fieldVariants}>
                            <GlassButton
                                type="submit"
                                variant="primary"
                                size="lg"
                                className={styles.submitBtn}
                                loading={loading}
                                whileHover={rm ? undefined : primaryButtonHover}
                                whileTap={rm ? undefined : primaryButtonTap}
                            >
                                {success
                                    ? <><CheckCircle size={15} style={{ marginRight: 6 }} aria-hidden="true" />Account created</>
                                    : 'Create account'
                                }
                            </GlassButton>
                        </motion.div>
                    </motion.form>

                    {/* Divider */}
                    <div className={styles.divider}><span>or continue with</span></div>

                    {/* Social buttons — 2×2 grid */}
                    <div className={styles.socialGrid}>
                        <GlassButton variant="secondary" size="sm" className={styles.socialBtn}
                            onClick={() => handleSocialAuth('Google')} icon={<GoogleLogo />}>
                            Google
                        </GlassButton>
                        <GlassButton variant="secondary" size="sm" className={styles.socialBtn}
                            onClick={() => handleSocialAuth('Microsoft')}
                            icon={
                                <svg viewBox="0 0 21 21" width="15" height="15" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                    <path fill="#f25022" d="M0 0h9.7v9.7H0z" /><path fill="#7fba00" d="M11.3 0h9.7v9.7h-9.7z" />
                                    <path fill="#00a4ff" d="M0 11.3h9.7V21H0z" /><path fill="#ffb900" d="M11.3 11.3h9.7V21h-9.7z" />
                                </svg>
                            }>
                            Microsoft
                        </GlassButton>
                        <GlassButton variant="secondary" size="sm" className={styles.socialBtn}
                            onClick={() => handleSocialAuth('GitHub')}
                            icon={
                                <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
                                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                </svg>
                            }>
                            GitHub
                        </GlassButton>
                        <GlassButton variant="secondary" size="sm" className={styles.socialBtn}
                            onClick={() => handleSocialAuth('Apple')}
                            icon={
                                <svg viewBox="0 0 384 512" width="14" height="14" fill="currentColor" aria-hidden="true">
                                    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
                                </svg>
                            }>
                            Apple
                        </GlassButton>
                    </div>

                    {/* Login link */}
                    <p className={styles.loginLine}>
                        Already have an account?{' '}
                        <Link to="/login" className={styles.loginLink}>Sign in →</Link>
                    </p>
                </motion.div>
            </div>
        </div>
    );
};

export default Signup;
