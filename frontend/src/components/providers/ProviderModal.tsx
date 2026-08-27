import React, { useState, useEffect } from 'react';
import styles from './ProviderModal.module.css';

interface ProviderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    provider?: any | null;
}

const ProviderModal: React.FC<ProviderModalProps> = ({ isOpen, onClose, onSubmit, provider }) => {
    const [formData, setFormData] = useState({
        provider_name: '',
        provider_type: 'AWS',
        account_name: '',
        account_id: '',
        region: '',
        credentials: ''
    });

    useEffect(() => {
        if (provider) {
            setFormData({
                provider_name: provider.provider_name || '',
                provider_type: provider.provider_type || 'AWS',
                account_name: provider.account_name || '',
                account_id: provider.account_id || '',
                region: provider.region || '',
                credentials: ''
            });
        } else {
            setFormData({
                provider_name: '',
                provider_type: 'AWS',
                account_name: '',
                account_id: '',
                region: '',
                credentials: ''
            });
        }
    }, [provider, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2 className={styles.title}>{provider ? 'Edit Provider' : 'Add Cloud Provider'}</h2>
                    <button type="button" onClick={onClose} className={styles.closeButton}>
                        &times;
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Provider Name</label>
                        <input
                            type="text"
                            name="provider_name"
                            required
                            className={styles.input}
                            value={formData.provider_name}
                            onChange={handleChange}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Provider Type</label>
                        <select
                            name="provider_type"
                            className={`${styles.input} ${styles.select}`}
                            value={formData.provider_type}
                            onChange={handleChange}
                        >
                            <option value="AWS" style={{ color: 'black' }}>AWS</option>
                            <option value="Azure" style={{ color: 'black' }}>Azure</option>
                            <option value="GCP" style={{ color: 'black' }}>GCP</option>
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Account Name</label>
                        <input
                            type="text"
                            name="account_name"
                            required
                            className={styles.input}
                            value={formData.account_name}
                            onChange={handleChange}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Account / Subscription ID</label>
                        <input
                            type="text"
                            name="account_id"
                            required
                            className={styles.input}
                            value={formData.account_id}
                            onChange={handleChange}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Default Region</label>
                        <input
                            type="text"
                            name="region"
                            required
                            className={styles.input}
                            value={formData.region}
                            onChange={handleChange}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            Access Credentials (JSON) {provider ? '(Leave blank strictly to retain existing)' : ''}
                        </label>
                        <input
                            type="text"
                            name="credentials"
                            className={styles.input}
                            placeholder='{"accessKey": "...", "secretKey": "..."}'
                            value={formData.credentials}
                            onChange={handleChange}
                        />
                    </div>

                    <div className={styles.actions}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className={styles.submitBtn}>
                            {provider ? 'Save Changes' : 'Connect Provider'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProviderModal;
