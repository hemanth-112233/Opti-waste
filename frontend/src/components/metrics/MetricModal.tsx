import React, { useState, useEffect } from 'react';
import styles from './MetricModal.module.css';
import { useResources } from '../../lib/queries';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    metric?: any;
}

const MetricModal: React.FC<Props> = ({ isOpen, onClose, onSubmit, metric }) => {
    const [formData, setFormData] = useState({
        resource_id: '',
        cpu_utilization: 0,
        memory_utilization: 0,
        storage_utilization: 0,
        network_in: 0,
        network_out: 0,
        disk_read: 0,
        disk_write: 0,
        instance_state: 'running',
        metric_timestamp: new Date().toISOString().slice(0, 16)
    });

    const { data: qData } = useResources({ limit: 1000, status: 'running' });
    const resources = qData?.data || [];

    useEffect(() => {
        if (metric) {
            setFormData({
                resource_id: metric.resource_id?.id || metric.resource_id?._id || metric.resource_id || '',
                cpu_utilization: metric.cpu_utilization || 0,
                memory_utilization: metric.memory_utilization || 0,
                storage_utilization: metric.storage_utilization || 0,
                network_in: metric.network_in || 0,
                network_out: metric.network_out || 0,
                disk_read: metric.disk_read || 0,
                disk_write: metric.disk_write || 0,
                instance_state: metric.instance_state || 'running',
                metric_timestamp: new Date(metric.metric_timestamp).toISOString().slice(0, 16)
            });
        }
    }, [metric]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? Number(value) : value
        }));
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2 className={styles.title}>{metric ? 'Edit Metric Log' : 'Log New Metric'}</h2>
                    <button onClick={onClose} className={styles.closeButton}>
                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...formData, metric_timestamp: new Date(formData.metric_timestamp).toISOString() }); }}>
                    <div className={styles.formGrid}>
                        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
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
                            <label className={styles.label}>CPU Utilization (%)</label>
                            <input type="number" step="0.1" min="0" max="100" required name="cpu_utilization" value={formData.cpu_utilization} onChange={handleChange} className={styles.input} />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Memory Utilization (%)</label>
                            <input type="number" step="0.1" min="0" max="100" required name="memory_utilization" value={formData.memory_utilization} onChange={handleChange} className={styles.input} />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Storage Utilization (%)</label>
                            <input type="number" step="0.1" min="0" max="100" required name="storage_utilization" value={formData.storage_utilization} onChange={handleChange} className={styles.input} />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Instance State</label>
                            <select name="instance_state" value={formData.instance_state} onChange={handleChange} className={`${styles.input} ${styles.select}`}>
                                <option value="running">Running</option>
                                <option value="stopped">Stopped</option>
                                <option value="terminated">Terminated</option>
                            </select>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Network In (Mbps)</label>
                            <input type="number" step="0.1" min="0" name="network_in" value={formData.network_in} onChange={handleChange} className={styles.input} />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Network Out (Mbps)</label>
                            <input type="number" step="0.1" min="0" name="network_out" value={formData.network_out} onChange={handleChange} className={styles.input} />
                        </div>

                        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                            <label className={styles.label}>Timestamp</label>
                            <input type="datetime-local" name="metric_timestamp" value={formData.metric_timestamp} onChange={handleChange} className={styles.input} />
                        </div>
                    </div>

                    <div className={styles.actions}>
                        <button type="button" onClick={onClose} className={styles.cancelBtn}>Cancel</button>
                        <button type="submit" className={styles.submitBtn}>
                            {metric ? 'Save Changes' : 'Log Metric'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MetricModal;
