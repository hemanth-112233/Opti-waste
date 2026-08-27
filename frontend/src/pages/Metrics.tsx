import React, { useState } from 'react';
import styles from './Metrics.module.css';
import {
    useMetrics,
    useMetricSummary,
    useCreateMetric,
    useUpdateMetric,
    useDeleteMetric,
    useResources
} from '../lib/queries';
import MetricModal from '../components/metrics/MetricModal';
import GlassTable from '../components/ui/GlassTable';
import GlassStatCard from '../components/ui/GlassStatCard';
import GlassButton from '../components/ui/GlassButton';
import { Activity, Database, HardDrive, Cpu, Plus } from 'lucide-react';

const notify = (msg: string) => alert(msg);

const Metrics: React.FC = () => {
    const [selectedResource, setSelectedResource] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMetric, setEditingMetric] = useState<any>(null);

    const { data: qData, isLoading, error } = useMetrics({ resource_id: selectedResource, limit: 100 });
    const metrics = qData?.data || [];
    const { data: summary, isLoading: loadingSummary } = useMetricSummary();
    const { data: resData } = useResources({ limit: 1000 });
    const resources = resData?.data || [];

    const createMetric = useCreateMetric();
    const updateMetric = useUpdateMetric();
    const deleteMetric = useDeleteMetric();

    const handleOpenAdd = () => {
        setEditingMetric(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (metric: any) => {
        setEditingMetric(metric);
        setIsModalOpen(true);
    };

    const handleSubmit = async (formData: any) => {
        try {
            if (editingMetric) {
                await updateMetric.mutateAsync({ id: editingMetric.id || editingMetric._id, payload: formData });
                notify('Metric updated successfully');
            } else {
                await createMetric.mutateAsync(formData);
                notify('Metric logged successfully');
            }
            setIsModalOpen(false);
        } catch (err: any) {
            notify(err.response?.data?.detail || 'An error occurred');
        }
    };

    const handleDelete = async (id: string, stamp: string) => {
        if (!window.confirm(`Are you sure you want to delete metric logged at ${stamp}?`)) return;
        try {
            await deleteMetric.mutateAsync(id);
            notify('Metric deleted');
        } catch (err: any) {
            notify('Deletion failed');
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Utilization Metrics</h1>
                    <p className={styles.subtitle}>Granular telemetry across tracked cloud components.</p>
                </div>
                <GlassButton variant="primary" icon={<Plus size={16} />} onClick={handleOpenAdd}>
                    Log Custom Metric
                </GlassButton>
            </div>

            <div className={styles.summaryGrid}>
                <GlassStatCard
                    title="Avg CPU Utilization"
                    value={`${summary?.average_cpu_utilization?.toFixed(1) || 0}%`}
                    icon={Cpu}
                    loading={loadingSummary}
                    color="blue"
                />
                <GlassStatCard
                    title="Avg Memory Usage"
                    value={`${summary?.average_memory_utilization?.toFixed(1) || 0}%`}
                    icon={Database}
                    loading={loadingSummary}
                    color="purple"
                />
                <GlassStatCard
                    title="Avg Storage"
                    value={`${summary?.average_storage_utilization?.toFixed(1) || 0}%`}
                    icon={HardDrive}
                    loading={loadingSummary}
                    color="green"
                />
                <GlassStatCard
                    title="Avg Network (In/Out)"
                    value={`${((summary?.average_network_in || 0) + (summary?.average_network_out || 0)).toFixed(1)} Mbps`}
                    icon={Activity}
                    loading={loadingSummary}
                    color="orange"
                />
            </div>

            <div className={styles.toolbar}>
                <select
                    className={styles.selectInput}
                    value={selectedResource}
                    onChange={(e) => setSelectedResource(e.target.value)}
                >
                    <option value="">All Cloud Resources (Filter)</option>
                    {resources.map((res: any) => (
                        <option key={res.id || res._id} value={res.id || res._id}>
                            {res.resource_name} ({res.provider_type})
                        </option>
                    ))}
                </select>
            </div>

            {error ? (
                <div className={styles.errorState}>Failed to load metrics</div>
            ) : (
                <GlassTable
                    columns={[
                        {
                            key: 'timestamp',
                            header: 'Time Logged',
                            render: (m) => new Date(m.metric_timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                        },
                        {
                            key: 'resource',
                            header: 'Resource Profile',
                            render: (m) => m.resource_id?.resource_name || 'N/A'
                        },
                        {
                            key: 'cpu',
                            header: 'CPU Util.',
                            render: (m) => (
                                <span style={{ color: (m.cpu_utilization > 80) ? 'var(--color-system-red)' : 'inherit', fontWeight: m.cpu_utilization > 80 ? 600 : 400 }}>
                                    {m.cpu_utilization.toFixed(1)}%
                                </span>
                            )
                        },
                        {
                            key: 'memory',
                            header: 'Mem Util.',
                            render: (m) => (
                                <span style={{ color: (m.memory_utilization > 80) ? 'var(--color-system-red)' : 'inherit', fontWeight: m.memory_utilization > 80 ? 600 : 400 }}>
                                    {m.memory_utilization.toFixed(1)}%
                                </span>
                            )
                        },
                        {
                            key: 'storage',
                            header: 'Storage',
                            render: (m) => `${m.storage_utilization.toFixed(1)}%`
                        },
                        {
                            key: 'state',
                            header: 'State',
                            render: (m) => (
                                <span className={`${styles.badge} ${m.instance_state === 'running' ? styles.badgeActive : styles.badgeInactive}`}>
                                    {m.instance_state.toUpperCase()}
                                </span>
                            )
                        },
                        {
                            key: 'actions',
                            header: '',
                            align: 'right',
                            render: (m) => (
                                <div className={styles.actionGroup}>
                                    <button className={styles.actionBtn} onClick={() => handleOpenEdit(m)}>Edit</button>
                                    <button className={`${styles.actionBtn} ${styles.actionBtnDelete}`} onClick={() => handleDelete(m.id || m._id, new Date(m.metric_timestamp).toLocaleString())}>Delete</button>
                                </div>
                            )
                        }
                    ]}
                    data={metrics}
                    keyExtractor={(m) => m.id || m._id}
                    loading={isLoading}
                    emptyMessage="No metrics historically tracked for this resource."
                />
            )}

            {isModalOpen && (
                <MetricModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleSubmit}
                    metric={editingMetric}
                />
            )}
        </div>
    );
};

export default Metrics;
