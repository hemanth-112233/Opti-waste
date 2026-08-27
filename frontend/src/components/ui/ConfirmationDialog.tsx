import React from 'react';
import GlassModal from './GlassModal';
import GlassButton from './GlassButton';
import { AlertCircle } from 'lucide-react';

interface ConfirmationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    loading?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title = "Confirm Action",
    message = "Are you sure you want to proceed with this action?",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    isDestructive = false,
    loading = false,
}) => {
    return (
        <GlassModal isOpen={isOpen} onClose={onClose} width="400px">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '48px', height: '48px', borderRadius: '50%',
                    backgroundColor: isDestructive ? 'rgba(255, 59, 48, 0.1)' : 'rgba(0, 122, 255, 0.1)',
                    color: isDestructive ? 'var(--color-system-red)' : 'var(--color-system-blue)',
                    marginBottom: '1rem'
                }}>
                    <AlertCircle size={24} />
                </div>

                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-gray-900)', marginBottom: '0.5rem' }}>
                    {title}
                </h3>

                <p style={{ fontSize: '0.9375rem', color: 'var(--color-gray-500)', marginBottom: '2rem' }}>
                    {message}
                </p>

                <div style={{ display: 'flex', gap: '1rem', width: '100%', justifyContent: 'center' }}>
                    <GlassButton variant="ghost" onClick={onClose} disabled={loading} style={{ flex: 1 }}>
                        {cancelLabel}
                    </GlassButton>
                    <GlassButton
                        variant={isDestructive ? 'danger' : 'primary'}
                        onClick={onConfirm}
                        loading={loading}
                        style={{ flex: 1 }}
                    >
                        {confirmLabel}
                    </GlassButton>
                </div>
            </div>
        </GlassModal>
    );
};

export default ConfirmationDialog;
