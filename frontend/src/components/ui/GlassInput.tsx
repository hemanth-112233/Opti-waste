import React from 'react';
import styles from './GlassInput.module.css';
import type { LucideIcon } from 'lucide-react';

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: LucideIcon;
    iconPosition?: 'left' | 'right';
    helperText?: string;
    containerClassName?: string;
}

export const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(({
    label,
    error,
    icon: Icon,
    iconPosition = 'left',
    helperText,
    containerClassName = '',
    className = '',
    id,
    ...props
}, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const hasIcon = !!Icon;

    return (
        <div className={`${styles.container} ${containerClassName}`}>
            {label && (
                <label htmlFor={inputId} className={styles.label}>
                    {label}
                </label>
            )}
            <div className={styles.inputWrapper}>
                {hasIcon && iconPosition === 'left' && (
                    <div className={`${styles.iconContainer} ${styles.iconLeft}`}>
                        <Icon size={18} className={styles.icon} />
                    </div>
                )}

                <input
                    id={inputId}
                    ref={ref}
                    className={`
            ${styles.input} 
            ${hasIcon && iconPosition === 'left' ? styles.hasIconLeft : ''} 
            ${hasIcon && iconPosition === 'right' ? styles.hasIconRight : ''} 
            ${error ? styles.hasError : ''} 
            ${className}
          `}
                    {...props}
                />

                {hasIcon && iconPosition === 'right' && (
                    <div className={`${styles.iconContainer} ${styles.iconRight}`}>
                        <Icon size={18} className={styles.icon} />
                    </div>
                )}
            </div>

            {(error || helperText) && (
                <p className={`${styles.helperText} ${error ? styles.errorMessage : ''}`}>
                    {error || helperText}
                </p>
            )}
        </div>
    );
});

GlassInput.displayName = 'GlassInput';
export default GlassInput;
