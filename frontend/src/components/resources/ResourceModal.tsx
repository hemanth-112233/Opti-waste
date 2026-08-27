import React, { useState, useEffect } from 'react';
import styles from './ResourceModal.module.css';
import { useProviders } from '../../lib/queries';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    resource?: any;
}

const ResourceModal: React.FC<Props> = ({ isOpen, onClose, onSubmit, resource }) => {
    const [formData, setFormData] = useState({
        provider_id: '',
        resource_name: '',
        resource_type: 'Compute',
        instance_type: '',
        service_name: '',
        region: '',
        availability_zone: '',
        cpu: 0,
        memory: 0,
        storage: 0,
        operating_system: '',
        status: 'running',
        owner: '',
        project_name: '',
        environment: 'Development',
        monthly_cost: 0
    });

    const { data: providersData } = useProviders({ limit: 500, status: 'active' });
    const providers = providersData?.data || [];

    useEffect(() => {
        if (resource) {
            setFormData({
                provider_id: resource.provider_id?.id || resource.provider_id || '',
                resource_name: resource.resource_name || '',
                resource_type: resource.resource_type || 'Compute',
                instance_type: resource.instance_type || '',
                service_name: resource.service_name || '',
                region: resource.region || '',
                availability_zone: resource.availability_zone || '',
                cpu: resource.cpu || 0,
                memory: resource.memory || 0,
                storage: resource.storage || 0,
                operating_system: resource.operating_system || '',
                status: resource.status || 'running',
                owner: resource.owner || '',
                project_name: resource.project_name || '',
                environment: resource.environment || 'Development',
                monthly_cost: resource.monthly_cost || 0
            });
        }
    }, [resource]);

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
                    <h2 className={styles.title}>{resource ? 'Edit Resource' : 'Add New Resource'}</h2>
                    <button onClick={onClose} className={styles.closeButton}>
                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }}>
                    <div className={styles.formGrid}>
                        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                            <label className={styles.label}>Resource Name *</label>
                            <input required name="resource_name" value={formData.resource_name} onChange={handleChange} className={styles.input} />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Cloud Provider *</label>
                            <select required name="provider_id" value={formData.provider_id} onChange={handleChange} className={`${styles.input} ${styles.select}`}>
                                <option value="">Select Provider...</option>
                                {providers.map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.provider_name} ({p.provider_type})</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Status *</label>
                            <select required name="status" value={formData.status} onChange={handleChange} className={`${styles.input} ${styles.select}`}>
                                <option value="running">Running</option>
                                <option value="stopped">Stopped</option>
                                <option value="terminated">Terminated</option>
                            </select>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Resource Type *</label>
                            <input required name="resource_type" value={formData.resource_type} onChange={handleChange} placeholder="e.g. Compute" className={styles.input} />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Service Name *</label>
                            <input required name="service_name" value={formData.service_name} onChange={handleChange} placeholder="e.g. EC2" className={styles.input} />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Region *</label>
                            <input required name="region" value={formData.region} onChange={handleChange} className={styles.input} />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Environment</label>
                            <select name="environment" value={formData.environment} onChange={handleChange} className={`${styles.input} ${styles.select}`}>
                                <option value="Development">Development</option>
                                <option value="Staging">Staging</option>
                                <option value="Production">Production</option>
                            </select>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>CPU (Cores)</label>
                            <input type="number" step="0.1" name="cpu" value={formData.cpu} onChange={handleChange} className={styles.input} />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Memory (GB)</label>
                            <input type="number" step="0.1" name="memory" value={formData.memory} onChange={handleChange} className={styles.input} />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Storage (GB)</label>
                            <input type="number" step="0.1" name="storage" value={formData.storage} onChange={handleChange} className={styles.input} />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Monthly Cost ($)</label>
                            <input type="number" step="0.01" name="monthly_cost" value={formData.monthly_cost} onChange={handleChange} className={styles.input} />
                        </div>

                        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                            <label className={styles.label}>Owner / Team</label>
                            <input name="owner" value={formData.owner} onChange={handleChange} className={styles.input} />
                        </div>
                    </div>

                    <div className={styles.actions}>
                        <button type="button" onClick={onClose} className={styles.cancelBtn}>Cancel</button>
                        <button type="submit" className={styles.submitBtn}>
                            {resource ? 'Save Changes' : 'Create Resource'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ResourceModal;
