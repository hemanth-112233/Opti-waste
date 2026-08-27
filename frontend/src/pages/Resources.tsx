import React, { useState } from 'react';
import styles from './Providers.module.css'; // Re-use the exact same core CSS layout since they share identically structured headers/grids
import {
    useResources,
    useResourceSummary,
    useCreateResource,
    useUpdateResource,
    useDeleteResource,
} from '../lib/queries';
import ResourceModal from '../components/resources/ResourceModal';
import GlassTable from '../components/ui/GlassTable';
import GlassStatCard from '../components/ui/GlassStatCard';
import GlassInput from '../components/ui/GlassInput';
import GlassButton from '../components/ui/GlassButton';
import { Server, PlayCircle, StopCircle, CloudOff, Search } from 'lucide-react';

const notify = (msg: string) => alert(msg);

const Resources: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingResource, setEditingResource] = useState<any>(null);

    // Queries
    const { data: qData, isLoading, error } = useResources({ search: searchTerm, limit: 100 });
    const resources = qData?.data || [];
    const { data: summary } = useResourceSummary();

    // Mutations
    const createRes = useCreateResource();
    const updateRes = useUpdateResource();
    const deleteRes = useDeleteResource();

    const handleOpenAdd = () => {
        setEditingResource(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (res: any) => {
        setEditingResource(res);
        setIsModalOpen(true);
    };

    const handleSubmit = async (formData: any) => {
        try {
            if (editingResource) {
                await updateRes.mutateAsync({ id: editingResource.id, payload: formData });
                notify('Resource updated successfully');
            } else {
                await createRes.mutateAsync(formData);
                notify('Resource added successfully');
            }
            setIsModalOpen(false);
        } catch (err: any) {
            notify(err.response?.data?.detail || 'An error occurred');
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to extract ${name}?`)) return;
        try {
            await deleteRes.mutateAsync(id);
            notify('Resource deleted');
        } catch (err: any) {
            notify('Deletion failed');
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Cloud Resources</h1>
                    <p className={styles.subtitle}>Unified mapping across cross-cloud deployments.</p>
                </div>
                <GlassButton variant="primary" onClick={handleOpenAdd}>
                    + Add Resource
                </GlassButton>
            </div>

            <div className={styles.summaryGrid}>
                <GlassStatCard
                    title="Total Resources"
                    value={summary?.total_resources || 0}
                    icon={Server}
                    loading={!summary}
                    color="gray"
                />
                <GlassStatCard
                    title="Running"
                    value={summary?.running_resources || 0}
                    icon={PlayCircle}
                    loading={!summary}
                    color="green"
                />
                <GlassStatCard
                    title="Stopped"
                    value={summary?.stopped_resources || 0}
                    icon={StopCircle}
                    loading={!summary}
                    color="orange"
                />
                <GlassStatCard
                    title="Terminated"
                    value={summary?.terminated_resources || 0}
                    icon={CloudOff}
                    loading={!summary}
                    color="red"
                />
            </div>

            <div className={styles.toolbar}>
                <GlassInput
                    name="search"
                    type="text"
                    placeholder="Search by resource name, owner, or instance..."
                    icon={Search}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {error ? (
                <div className={styles.errorState}>Failed to load resources</div>
            ) : (
                <GlassTable
                    columns={[
                        {
                            key: 'resource',
                            header: 'Resource Identity',
                            render: (res) => (
                                <div>
                                    <div className={styles.cellMainText}>{res.resource_name}</div>
                                    <div className={styles.cellSubText}>{res.resource_type} • {res.provider_id?.provider_name || res.provider_type}</div>
                                </div>
                            )
                        },
                        {
                            key: 'location',
                            header: 'Location',
                            render: (res) => (
                                <div>
                                    <div className={styles.cellMainText}>{res.region}</div>
                                    <div className={styles.cellSubText}>{res.environment}</div>
                                </div>
                            )
                        },
                        {
                            key: 'hardware',
                            header: 'Hardware',
                            render: (res) => (
                                <div>
                                    <div className={styles.cellMainText}>{res.instance_type || 'N/A'}</div>
                                    <div className={styles.cellSubText}>{res.cpu} vCPU • {res.memory}GB</div>
                                </div>
                            )
                        },
                        {
                            key: 'cost',
                            header: 'Cost Base',
                            render: (res) => (
                                <div style={{ fontWeight: 600, color: 'var(--color-gray-900)' }}>
                                    ${res.monthly_cost.toFixed(2)}
                                </div>
                            )
                        },
                        {
                            key: 'status',
                            header: 'Status',
                            render: (res) => (
                                <span className={`${styles.badge} ${res.status === 'running' ? styles.badgeActive : (res.status === 'stopped' ? styles.badgeInactive : '')}`} style={res.status === 'stopped' ? { background: 'rgba(255, 149, 0, 0.15)', color: 'var(--color-system-orange)' } : {}}>
                                    {res.status.toUpperCase()}
                                </span>
                            )
                        },
                        {
                            key: 'actions',
                            header: '',
                            align: 'right',
                            render: (res) => (
                                <div className={styles.actionGroup}>
                                    <button
                                        className={styles.actionBtn}
                                        onClick={() => handleOpenEdit(res)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                                        onClick={() => handleDelete(res.id, res.resource_name)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            )
                        }
                    ]}
                    data={resources}
                    keyExtractor={(r) => r.id}
                    loading={isLoading}
                    emptyMessage="No resources found."
                />
            )}

            {isModalOpen && (
                <ResourceModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleSubmit}
                    resource={editingResource}
                />
            )}
        </div>
    );
};

export default Resources;
