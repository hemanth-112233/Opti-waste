import React, { useState, useEffect } from 'react';
import styles from './CostModal.module.css';
import { useResources, useCreateCost, useUpdateCost } from '../../lib/queries';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    cost?: any;
}

const CostModal: React.FC<Props> = ({ isOpen, onClose, cost }) => {
    const [formData, setFormData] = useState({
        resource_id: '',
        provider_id: '',
        billing_period: '',
        daily_cost: 0,
        weekly_cost: 0,
        monthly_cost: 0,
        projected_monthly_cost: 0,
        currency: 'USD',
        billing_status: 'pending',
        cost_timestamp: new Date().toISOString().slice(0, 16)
    });

    const { data: resData } = useResources({ limit: 1000 });
    const resources = resData?.data || [];

    const createMutation = useCreateCost();
    const updateMutation = useUpdateCost();

    useEffect(() => {
        if (cost) {
            setFormData({
                resource_id: cost.resource_id?.id || cost.resource_id?._id || cost.resource_id || '',
                provider_id: cost.provider_id?.id || cost.provider_id?._id || cost.provider_id || '',
                billing_period: cost.billing_period || '',
                daily_cost: cost.daily_cost || 0,
                weekly_cost: cost.weekly_cost || 0,
                monthly_cost: cost.monthly_cost || 0,
                projected_monthly_cost: cost.projected_monthly_cost || 0,
                currency: cost.currency || 'USD',
                billing_status: cost.billing_status || 'pending',
                cost_timestamp: new Date(cost.cost_timestamp).toISOString().slice(0, 16)
            });
        }
    }, [cost]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? Number(value) : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = { ...formData, cost_timestamp: new Date(formData.cost_timestamp).toISOString() };
            if (cost) {
                await updateMutation.mutateAsync({ id: cost._id || cost.id, payload });
            } else {
                await createMutation.mutateAsync(payload);
            }
            onClose();
        } catch (err: any) {
            alert(err?.response?.data?.detail || 'Error saving cost record.');
        }
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2 className={styles.title}>{cost ? 'Edit Cost Record' : 'Log New Expense'}</h2>
                    <button onClick={onClose} className={styles.closeButton}>
                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Cloud Resource *</label>
                            <select required name="resource_id" value={formData.resource_id} onChange={handleChange} className={`${styles.input} ${styles.select}`}>
                                <option value="">Select Resource...</option>
                                {resources.map((res: any) => (
                                    <option key={res.id || res._id} value={res.id || res._id}>
                                        {res.resource_name} ({res.provider_type})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Billing Period *</label>
                            <input type="text" placeholder="e.g. 2026-August" required name="billing_period" value={formData.billing_period} onChange={handleChange} className={styles.input} />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Daily Cost</label>
                            <input type="number" step="0.01" min="0" required name="daily_cost" value={formData.daily_cost} onChange={handleChange} className={styles.input} />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Monthly Cost</label>
                            <input type="number" step="0.01" min="0" required name="monthly_cost" value={formData.monthly_cost} onChange={handleChange} className={styles.input} />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Projected Monthly</label>
                            <input type="number" step="0.01" min="0" required name="projected_monthly_cost" value={formData.projected_monthly_cost} onChange={handleChange} className={styles.input} />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Billing Status</label>
                            <select name="billing_status" value={formData.billing_status} onChange={handleChange} className={`${styles.input} ${styles.select}`}>
                                <option value="pending">Pending</option>
                                <option value="paid">Paid</option>
                                <option value="failed">Failed</option>
                            </select>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Currency</label>
                            <input type="text" name="currency" value={formData.currency} onChange={handleChange} className={styles.input} />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Timestamp</label>
                            <input type="datetime-local" name="cost_timestamp" value={formData.cost_timestamp} onChange={handleChange} className={styles.input} />
                        </div>
                    </div>

                    <div className={styles.actions}>
                        <button type="button" onClick={onClose} className={styles.cancelBtn}>Cancel</button>
                        <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className={styles.submitBtn}>
                            {cost ? 'Save Changes' : 'Log Expense'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CostModal;
