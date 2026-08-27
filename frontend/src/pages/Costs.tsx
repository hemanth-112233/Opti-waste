import React, { useState } from 'react';
import { useCosts, useCostSummary, useDeleteCost } from '../lib/queries';
import { Plus, TrendingUp, DollarSign, Cloud, Server, Activity } from 'lucide-react';
import CostModal from '../components/costs/CostModal';
import styles from './Costs.module.css';

import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import GlassStatCard from '../components/ui/GlassStatCard';
import GlassTable from '../components/ui/GlassTable';
import ChartContainer from '../components/ui/ChartContainer';
import GlassButton from '../components/ui/GlassButton';

const COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#5856D6'];

const Costs: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCost, setSelectedCost] = useState<any>(null);

    const { data: qData, isLoading } = useCosts({ limit: 100 });
    const costs = qData?.data || [];
    const { data: summaryData, isLoading: summaryLoading } = useCostSummary();
    const deleteMutation = useDeleteCost();

    const summary = summaryData?.summary || {};
    const providerDist = summaryData?.provider_distribution || {};
    const topResources = summaryData?.top_expensive_resources || [];

    const pieData = Object.keys(providerDist).map((key) => ({
        name: key,
        value: providerDist[key]
    }));

    const handleDelete = async (id: string, resourceName: string) => {
        if (confirm(`Are you sure you want to extract billing record for ${resourceName}?`)) {
            await deleteMutation.mutateAsync(id);
        }
    };

    const handleEdit = (cost: any) => {
        setSelectedCost(cost);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setSelectedCost(null);
        setIsModalOpen(true);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Cost Analytics</h1>
                    <p className={styles.subtitle}>Analyze and optimize your cloud spending.</p>
                </div>
                <GlassButton variant="primary" icon={<Plus size={16} />} onClick={handleCreate}>
                    Log Expense
                </GlassButton>
            </div>

            <div className={styles.summaryGrid}>
                <GlassStatCard
                    title="Total Monthly Spend"
                    value={`$${summary.total_monthly_spend?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`}
                    icon={DollarSign}
                    loading={summaryLoading}
                    color="red"
                />
                <GlassStatCard
                    title="Estimated Spend"
                    value={`$${summary.estimated_spend?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`}
                    icon={Activity}
                    loading={summaryLoading}
                    color="purple"
                />
                <GlassStatCard
                    title="Daily Average"
                    value={`$${summary.daily_spend?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`}
                    icon={TrendingUp}
                    loading={summaryLoading}
                    color="green"
                />
                <GlassStatCard
                    title="Top Provider"
                    value={pieData.length ? pieData.sort((a, b) => b.value - a.value)[0].name : 'N/A'}
                    icon={Cloud}
                    loading={summaryLoading}
                    color="blue"
                />
            </div>

            <div className={styles.chartsGrid}>
                <ChartContainer title="Provider Distribution" loading={summaryLoading}>
                    {pieData.length === 0 ? <div className={styles.emptyState}>No data</div> : (
                        <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={2} dataKey="value" stroke="none">
                                {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(v: any) => `$${Number(v).toFixed(2)}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                            <Legend iconType="circle" />
                        </PieChart>
                    )}
                </ChartContainer>

                <ChartContainer title="Top 10 Expensive Resources" loading={summaryLoading}>
                    {topResources.length === 0 ? <div className={styles.emptyState}>No data</div> : (
                        <BarChart data={topResources} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="resource_name" type="category" stroke="#8E8E93" fontSize={11} width={120} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-md)' }} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                            <Bar dataKey="total_cost" fill="#007AFF" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    )}
                </ChartContainer>
            </div>

            <div className={styles.tableCard}>
                <h2 className={styles.tableTitle}>Recent Expenses</h2>
                <GlassTable
                    columns={[
                        {
                            key: 'resource',
                            header: 'Resource',
                            render: (c) => (
                                <div className={styles.resourceCell}>
                                    <Server className={styles.resourceIcon} />
                                    <span>{c.resource_id?.resource_name || 'N/A'}</span>
                                </div>
                            )
                        },
                        {
                            key: 'provider',
                            header: 'Cloud Provider',
                            render: (c) => c.provider_id?.provider_type || 'N/A'
                        },
                        {
                            key: 'daily',
                            header: 'Daily Run Rate',
                            render: (c) => `$${(c.daily_cost || 0).toFixed(2)}`
                        },
                        {
                            key: 'monthly',
                            header: 'Monthly Base',
                            render: (c) => (
                                <span style={{ fontWeight: 600, color: 'var(--color-gray-900)' }}>
                                    ${(c.monthly_cost || 0).toFixed(2)}
                                </span>
                            )
                        },
                        { key: 'currency', header: 'Curr.', render: (c) => c.currency || 'USD' },
                        {
                            key: 'status',
                            header: 'Status',
                            render: (c) => (
                                <span className={`${styles.badge} ${c.billing_status === 'finalized' ? styles.badgeSuccess : (c.billing_status === 'estimated' ? styles.badgeWarning : '')}`} style={c.billing_status === 'estimated' ? { background: 'rgba(255, 149, 0, 0.15)', color: 'var(--color-system-orange)' } : {}}>
                                    {c.billing_status.toUpperCase()}
                                </span>
                            )
                        },
                        {
                            key: 'time',
                            header: 'Timestamp',
                            render: (c) => new Date(c.cost_timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                        },
                        {
                            key: 'actions',
                            header: '',
                            align: 'right',
                            render: (c) => (
                                <div className={styles.actionGroup}>
                                    <button className={styles.actionBtn} onClick={() => handleEdit(c)}>Edit</button>
                                    <button className={`${styles.actionBtn} ${styles.actionBtnDelete}`} onClick={() => handleDelete(c.id || c._id, c.resource_id?.resource_name || 'N/A')}>Delete</button>
                                </div>
                            )
                        }
                    ]}
                    data={costs}
                    keyExtractor={(c) => c.id || c._id}
                    loading={isLoading}
                    emptyMessage="No cost records found."
                />
            </div>

            <CostModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                cost={selectedCost}
            />
        </div>
    );
};

export default Costs;
