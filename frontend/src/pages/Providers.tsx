import React, { useState } from 'react';
import styles from './Providers.module.css';
import {
    useProviders,
    useCreateProvider,
    useUpdateProvider,
    useToggleProviderStatus,
    useDeleteProvider
} from '../lib/queries';
import ProviderModal from '../components/providers/ProviderModal';
import GlassTable from '../components/ui/GlassTable';
import GlassStatCard from '../components/ui/GlassStatCard';
import { Cloud, Link as LinkIcon, AlertTriangle } from 'lucide-react';
import GlassButton from '../components/ui/GlassButton';
import GlassInput from '../components/ui/GlassInput';
import { Search } from 'lucide-react';

const notify = (msg: string) => alert(msg);

const Providers: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProvider, setEditingProvider] = useState<any>(null);

    // Queries
    const { data: qData, isLoading, error } = useProviders({ search: searchTerm, limit: 100 });
    const providers = qData?.data || [];

    // Mutations
    const createProv = useCreateProvider();
    const updateProv = useUpdateProvider();
    const toggleProv = useToggleProviderStatus();
    const deleteProv = useDeleteProvider();

    // Summary Metrics
    const totalCount = providers.length;
    const activeCount = providers.filter((p: any) => p.status === 'active').length;
    const inactiveCount = totalCount - activeCount;

    const handleOpenAdd = () => {
        setEditingProvider(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (prov: any) => {
        setEditingProvider(prov);
        setIsModalOpen(true);
    };

    const handleSubmit = async (formData: any) => {
        try {
            if (editingProvider) {
                const payload = { ...formData };
                if (!payload.credentials) delete payload.credentials;
                await updateProv.mutateAsync({ id: editingProvider.id, payload });
                notify('Provider updated successfully');
            } else {
                await createProv.mutateAsync(formData);
                notify('Provider added successfully');
            }
            setIsModalOpen(false);
        } catch (err: any) {
            notify(err.response?.data?.detail || 'An error occurred');
        }
    };

    const handleToggle = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'deactivate' : 'activate';
        try {
            await toggleProv.mutateAsync({ id, action: newStatus });
        } catch (err: any) {
            notify('Toggle failed');
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
        try {
            await deleteProv.mutateAsync(id);
            notify('Provider deleted');
        } catch (err: any) {
            notify('Deletion failed');
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Cloud Providers</h1>
                    <p className={styles.subtitle}>Manage your enterprise AWS, Azure, and GCP identities safely.</p>
                </div>
                <GlassButton variant="primary" onClick={handleOpenAdd}>
                    + Add Provider
                </GlassButton>
            </div>

            <div className={styles.summaryGrid}>
                <GlassStatCard
                    title="Total Providers"
                    value={totalCount}
                    icon={Cloud}
                    loading={isLoading}
                    color="gray"
                />
                <GlassStatCard
                    title="Active Connections"
                    value={activeCount}
                    icon={LinkIcon}
                    loading={isLoading}
                    color="green"
                />
                <GlassStatCard
                    title="Inactive Accounts"
                    value={inactiveCount}
                    icon={AlertTriangle}
                    loading={isLoading}
                    color="red"
                />
            </div>

            <div className={styles.toolbar}>
                <GlassInput
                    name="search"
                    type="text"
                    placeholder="Search by provider name, account name, or account ID..."
                    icon={Search}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {error ? (
                <div className={styles.errorState}>Failed to load providers</div>
            ) : (
                <GlassTable
                    columns={[
                        {
                            key: 'provider',
                            header: 'Provider / Type',
                            render: (prov) => (
                                <div>
                                    <div className={styles.cellMainText}>{prov.provider_name}</div>
                                    <div className={styles.cellSubText}>{prov.provider_type}</div>
                                </div>
                            )
                        },
                        {
                            key: 'account',
                            header: 'Account / ID',
                            render: (prov) => (
                                <div>
                                    <div className={styles.cellMainText}>{prov.account_name}</div>
                                    <div className={styles.cellCodeText}>{prov.account_id}</div>
                                </div>
                            )
                        },
                        { key: 'region', header: 'Region' },
                        {
                            key: 'status',
                            header: 'Status',
                            render: (prov) => (
                                <span className={`${styles.badge} ${prov.status === 'active' ? styles.badgeActive : styles.badgeInactive}`}>
                                    {prov.status.toUpperCase()}
                                </span>
                            )
                        },
                        {
                            key: 'actions',
                            header: '',
                            align: 'right',
                            render: (prov) => (
                                <div className={styles.actionGroup}>
                                    <button
                                        className={styles.actionBtn}
                                        onClick={() => handleToggle(prov.id, prov.status)}
                                    >
                                        {prov.status === 'active' ? 'Disable' : 'Enable'}
                                    </button>
                                    <button
                                        className={styles.actionBtn}
                                        onClick={() => handleOpenEdit(prov)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                                        onClick={() => handleDelete(prov.id, prov.provider_name)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            )
                        }
                    ]}
                    data={providers}
                    keyExtractor={(p) => p.id}
                    loading={isLoading}
                    emptyMessage="No providers found."
                />
            )}

            {isModalOpen && (
                <ProviderModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleSubmit}
                    provider={editingProvider}
                />
            )}
        </div>
    );
};

export default Providers;
