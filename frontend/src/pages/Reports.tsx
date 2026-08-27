/**
 * Reports.tsx
 * OptiWaste — Step 9: Executive FinOps Reports & Audit Ledger
 *
 * Data sources (all real API calls, no hardcoded values):
 *   GET /costs/dashboard           → Total Cost Under Management
 *   GET /recommendations           → Waste totals, provider/env breakdown
 *   GET /verifications/summary     → Realized savings, optimization ROI
 *   GET /verifications (limit:500) → Formal audit ledger rows
 *
 * Missing values render as '—'.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    BarChart3, Download, Printer, DollarSign,
    TrendingDown, CheckCircle2, Target, Search, Filter,
} from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
    Tooltip, CartesianGrid, Cell, Legend,
} from 'recharts';

import styles from './Reports.module.css';
import { GlassStatCard } from '../components/ui/GlassStatCard';
import { GlassButton } from '../components/ui/GlassButton';
import { GlassTable } from '../components/ui/GlassTable';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

import {
    useCostSummary,
    useRecommendations,
    useVerificationSummary,
    useVerifications,
} from '../lib/queries';

import type { VerificationRecord, VerificationRecommendation } from '../api/verifications';
import type { Recommendation, RecommendationResource } from '../api/recommendations';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number | null | undefined): string {
    if (n == null) return '—';
    return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtPct(n: number | null | undefined, places = 1): string {
    if (n == null) return '—';
    return n.toFixed(places) + '%';
}

function titleCase(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function recOf(v: VerificationRecord): VerificationRecommendation | null {
    if (!v.recommendation || typeof v.recommendation === 'string') return null;
    return v.recommendation as VerificationRecommendation;
}

function resOf(r: Recommendation): RecommendationResource | null {
    if (!r.resource || typeof r.resource === 'string') return null;
    return r.resource as RecommendationResource;
}

const STATUS_CLASSES: Record<string, string> = {
    verified: styles.stVerified,
    partially_verified: styles.stPartial,
    failed: styles.stFailed,
    not_verifiable: styles.stNa,
    pending: styles.stPending,
    in_progress: styles.stPending,
    accepted: styles.stAccepted,
    implemented: styles.stVerified,
    dismissed: styles.stNa,
};

const STATUS_LABELS: Record<string, string> = {
    verified: 'Verified', partially_verified: 'Partial', failed: 'Failed',
    not_verifiable: 'N/A', pending: 'Pending', in_progress: 'In Progress',
    accepted: 'Accepted', implemented: 'Implemented', dismissed: 'Dismissed',
};

// ── CSV Export ────────────────────────────────────────────────────────────────

function exportCsv(items: VerificationRecord[]): void {
    const header = [
        'Resource Name', 'Resource Type', 'Environment', 'Rec. Type',
        'Verification Status', 'Predicted Savings ($)', 'Actual Savings ($)',
        'Prediction Error (%)', 'Verified At',
    ].join(',');

    const rows = items.map(item => {
        const rec = recOf(item);
        const res = rec?.resource;
        return [
            res?.resource_name ?? '',
            res?.resource_type ?? '',
            res?.environment ?? '',
            rec?.recommendation_type ?? '',
            item.verification_status,
            item.predicted_savings ?? '',
            item.actual_savings ?? '',
            item.prediction_error_pct ?? '',
            item.verified_at ? new Date(item.verified_at).toISOString() : '',
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `optiwaste-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

const ChartTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className={styles.tooltip}>
            <div className={styles.tooltipTitle}>{titleCase(label)}</div>
            {payload.map((p: any) => (
                <div key={p.dataKey} style={{ color: p.color, fontSize: 12, fontWeight: 500 }}>
                    {p.name}: {fmt$(p.value)}
                </div>
            ))}
        </div>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────

const Reports: React.FC = () => {
    // ── Search / filter state ─────────────────────────────────────────────────
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | string>('all');

    // ── Data queries ──────────────────────────────────────────────────────────
    const costQ = useCostSummary();
    const recQ = useRecommendations({ limit: 500 } as any);
    const verifSQ = useVerificationSummary();
    const verifLQ = useVerifications({ limit: 500 });

    const costData = costQ.data?.data ?? costQ.data;
    const recs: Recommendation[] = recQ.data?.data ?? [];
    const verifSum = verifSQ.data?.data;
    const verifItems: VerificationRecord[] = verifLQ.data?.data ?? [];

    const isLoading = costQ.isLoading || recQ.isLoading || verifSQ.isLoading;

    // ── KPI derivations ───────────────────────────────────────────────────────
    const totalMonthlyCost = (costData?.totalMonthlyCost ?? costData?.total_monthly_cost ?? null) as number | null;
    const totalWaste = useMemo(() =>
        recs.reduce((s, r) => s + (r.predicted_savings ?? 0), 0) || null,
        [recs]);
    const realizedSavings = verifSum?.totalConfirmedSavings ?? null;
    const overallRoi: number | null = useMemo(() => {
        const predicted = verifSum?.totalPredictedSavings ?? 0;
        const actual = verifSum?.totalConfirmedSavings ?? 0;
        if (!predicted) return null;
        return Math.round((actual / predicted) * 100 * 10) / 10;
    }, [verifSum]);

    // ── Provider breakdown from recommendations ────────────────────────────────
    const providerChart = useMemo(() => {
        const map: Record<string, { waste: number; savings: number; count: number }> = {};
        for (const r of recs) {
            const res = resOf(r);
            const key = res?.provider_type ?? 'Unknown';
            if (!map[key]) map[key] = { waste: 0, savings: 0, count: 0 };
            map[key].waste += r.predicted_savings ?? 0;
            map[key].savings += 0; // actual savings served from verifications
            map[key].count += 1;
        }
        // attach realized savings by matching resource names (best-effort)
        for (const v of verifItems) {
            const rec = recOf(v);
            if (!rec) continue;
            // find the recommendation to get its provider
            const matched = recs.find(r => r.id === rec.id);
            const res = matched ? resOf(matched) : null;
            const key = res?.provider_type ?? 'Unknown';
            if (map[key]) map[key].savings += v.actual_savings ?? 0;
        }
        return Object.entries(map)
            .map(([provider, v]) => ({ provider, waste: +v.waste.toFixed(2), savings: +v.savings.toFixed(2) }))
            .sort((a, b) => b.waste - a.waste);
    }, [recs, verifItems]);

    // ── Environment breakdown ─────────────────────────────────────────────────
    const envChart = useMemo(() => {
        const map: Record<string, number> = {};
        for (const r of recs) {
            const res = resOf(r);
            const env = res?.environment ?? 'Unknown';
            map[env] = (map[env] ?? 0) + (r.predicted_savings ?? 0);
        }
        return Object.entries(map)
            .map(([env, waste]) => ({ env, waste: +waste.toFixed(2) }))
            .sort((a, b) => b.waste - a.waste);
    }, [recs]);

    // ── Audit ledger rows ─────────────────────────────────────────────────────
    const uniqueStatuses = useMemo(() =>
        ['all', ...Array.from(new Set(verifItems.map(v => v.verification_status)))],
        [verifItems]);

    const filteredRows = useMemo(() => {
        let rows = verifItems;
        if (statusFilter !== 'all') rows = rows.filter(v => v.verification_status === statusFilter);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            rows = rows.filter(v => {
                const rec = recOf(v);
                return (
                    (rec?.resource?.resource_name ?? '').toLowerCase().includes(q) ||
                    (rec?.recommendation_type ?? '').toLowerCase().includes(q) ||
                    (rec?.recommendation_title ?? '').toLowerCase().includes(q)
                );
            });
        }
        return rows;
    }, [verifItems, statusFilter, search]);

    // ── Table columns ─────────────────────────────────────────────────────────
    const columns = [
        {
            key: 'resource', header: 'Resource', width: '18%',
            render: (v: VerificationRecord) => {
                const rec = recOf(v);
                return (
                    <div>
                        <div className={styles.resName}>{rec?.resource?.resource_name ?? '—'}</div>
                        <div className={styles.resMeta}>{rec?.resource?.resource_type ?? '—'}</div>
                    </div>
                );
            },
        },
        {
            key: 'env', header: 'Environment', width: '12%',
            render: (v: VerificationRecord) => (
                <span className={styles.envChip}>{recOf(v)?.resource?.environment ?? '—'}</span>
            ),
        },
        {
            key: 'type', header: 'Waste Category', width: '14%',
            render: (v: VerificationRecord) => (
                <span className={styles.typeChip}>{recOf(v)?.recommendation_type ? titleCase(recOf(v)!.recommendation_type) : '—'}</span>
            ),
        },
        {
            key: 'status', header: 'Status', width: '12%', align: 'center' as const,
            render: (v: VerificationRecord) => (
                <span className={`${styles.badge} ${STATUS_CLASSES[v.verification_status] ?? styles.stPending}`}>
                    {STATUS_LABELS[v.verification_status] ?? titleCase(v.verification_status)}
                </span>
            ),
        },
        {
            key: 'predicted_savings', header: 'Predicted', width: '11%', align: 'right' as const,
            render: (v: VerificationRecord) => (
                <span className={styles.numCell}>{fmt$(v.predicted_savings)}</span>
            ),
        },
        {
            key: 'actual_savings', header: 'Actual Savings', width: '12%', align: 'right' as const,
            render: (v: VerificationRecord) => (
                <span className={`${styles.numCell} ${v.actual_savings > 0 ? styles.savingsPos : ''}`}>
                    {fmt$(v.actual_savings)}
                </span>
            ),
        },
        {
            key: 'prediction_error_pct', header: 'Error %', width: '9%', align: 'right' as const,
            render: (v: VerificationRecord) => (
                <span className={styles.errPct}>{fmtPct(v.prediction_error_pct)}</span>
            ),
        },
        {
            key: 'verified_at', header: 'Verified At', width: '12%',
            render: (v: VerificationRecord) => (
                <span className={styles.dateCell}>{new Date(v.verified_at).toLocaleDateString()}</span>
            ),
        },
    ];

    const handlePrint = useCallback(() => window.print(), []);
    const handleExportCsv = useCallback(() => exportCsv(verifItems), [verifItems]);

    // ── Page render ───────────────────────────────────────────────────────────
    return (
        <motion.div
            className={styles.page}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.headerIcon}><BarChart3 size={20} /></div>
                    <div>
                        <h1 className={styles.title}>Executive FinOps Reports & Audit Ledger</h1>
                        <p className={styles.subtitle}>
                            Consolidated view of cloud cost management, waste reduction outcomes,
                            and closed-loop verification evidence across all providers.
                        </p>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <GlassButton
                        variant="secondary"
                        size="sm"
                        icon={<Download size={14} />}
                        onClick={handleExportCsv}
                        disabled={verifItems.length === 0}
                        aria-label="Export CSV"
                    >
                        Export CSV
                    </GlassButton>
                    <GlassButton
                        variant="secondary"
                        size="sm"
                        icon={<Printer size={14} />}
                        onClick={handlePrint}
                        aria-label="Print / Save PDF"
                    >
                        Print / PDF
                    </GlassButton>
                </div>
            </div>

            {/* ── KPI Cards ────────────────────────────────────────────────── */}
            {isLoading ? (
                <div className={styles.kpiGrid}>
                    {[...Array(4)].map((_, i) => (
                        <LoadingSkeleton key={i} type="card" className={styles.skeletonCard} />
                    ))}
                </div>
            ) : (
                <motion.div
                    className={styles.kpiGrid}
                    initial="hidden"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
                >
                    {[
                        {
                            title: 'Total Cost Under Management',
                            value: totalMonthlyCost != null ? fmt$(totalMonthlyCost) + '/mo' : '—',
                            icon: DollarSign, color: 'blue' as const,
                        },
                        {
                            title: 'Detected Cloud Waste',
                            value: totalWaste != null ? fmt$(totalWaste) + '/mo' : '—',
                            icon: TrendingDown, color: 'red' as const,
                        },
                        {
                            title: 'Realized Verified Savings',
                            value: realizedSavings != null ? fmt$(realizedSavings) + '/mo' : '—',
                            icon: CheckCircle2, color: 'green' as const,
                        },
                        {
                            title: 'Optimization ROI',
                            value: overallRoi != null ? fmtPct(overallRoi) : '—',
                            icon: Target, color: 'green' as const,
                        },
                    ].map(card => (
                        <motion.div
                            key={card.title}
                            variants={{
                                hidden: { opacity: 0, y: 16 },
                                visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
                            }}
                        >
                            <GlassStatCard {...card} />
                        </motion.div>
                    ))}
                </motion.div>
            )}

            {/* ── Charts Row ───────────────────────────────────────────────── */}
            <div className={styles.chartsRow}>
                {/* Provider breakdown */}
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <span className={styles.panelTitle}>Multi-Cloud Waste vs. Savings</span>
                        <span className={styles.panelSub}>By cloud provider (aggregate)</span>
                    </div>
                    {recQ.isLoading ? (
                        <LoadingSkeleton type="card" height={220} />
                    ) : providerChart.length === 0 ? (
                        <EmptyState title="No provider data" message="Sync cloud providers and resources to see the breakdown." icon="folder" />
                    ) : (
                        <div className={styles.chartWrap}>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={providerChart} margin={{ top: 8, right: 16, left: 8, bottom: 8 }} barGap={4}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                                    <XAxis dataKey="provider" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                    <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: 12, color: '#6b7280', paddingTop: 8 }} formatter={(v) => v === 'waste' ? 'Waste (Predicted)' : 'Realized Savings'} />
                                    <Bar dataKey="waste" name="waste" radius={[6, 6, 0, 0]} maxBarSize={44}>
                                        {providerChart.map((_, i) => <Cell key={i} fill="rgba(255,99,71,0.65)" />)}
                                    </Bar>
                                    <Bar dataKey="savings" name="savings" radius={[6, 6, 0, 0]} maxBarSize={44}>
                                        {providerChart.map((_, i) => <Cell key={i} fill="rgba(52,199,89,0.72)" />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Environment breakdown */}
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <span className={styles.panelTitle}>Waste by Environment</span>
                        <span className={styles.panelSub}>Predicted monthly waste distribution</span>
                    </div>
                    {recQ.isLoading ? (
                        <LoadingSkeleton type="card" height={220} />
                    ) : envChart.length === 0 ? (
                        <EmptyState title="No environment data" message="Tag resources with environments to see the breakdown." icon="folder" />
                    ) : (
                        <div className={styles.chartWrap}>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={envChart} layout="vertical" margin={{ top: 8, right: 20, left: 16, bottom: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" horizontal={false} />
                                    <XAxis type="number" tickFormatter={v => `$${v}`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                    <YAxis type="category" dataKey="env" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={90} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Bar dataKey="waste" name="waste" radius={[0, 6, 6, 0]} maxBarSize={32} fill="rgba(99,102,241,0.68)" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Audit Ledger ─────────────────────────────────────────────── */}
            <div className={styles.panel}>
                <div className={styles.panelHeader}>
                    <div className={styles.auditHeaderRow}>
                        <div>
                            <span className={styles.panelTitle}>FinOps Audit Ledger</span>
                            {!verifLQ.isLoading && (
                                <span className={styles.panelCount}>
                                    &nbsp;({filteredRows.length} of {verifItems.length} record{verifItems.length !== 1 ? 's' : ''})
                                </span>
                            )}
                            <div className={styles.panelSub}>Recommendation verification records — across all providers and environments</div>
                        </div>
                        <div className={styles.filterRow}>
                            <div className={styles.searchWrap}>
                                <Search size={13} className={styles.searchIcon} />
                                <input
                                    className={styles.searchInput}
                                    placeholder="Search resource or category…"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    aria-label="Search audit ledger"
                                />
                            </div>
                            <div className={styles.statusFilter}>
                                <Filter size={13} className={styles.filterIcon} />
                                <select
                                    className={styles.statusSelect}
                                    value={statusFilter}
                                    onChange={e => setStatusFilter(e.target.value)}
                                    aria-label="Filter by status"
                                >
                                    {uniqueStatuses.map(s => (
                                        <option key={s} value={s}>{s === 'all' ? 'All Statuses' : STATUS_LABELS[s] ?? titleCase(s)}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {verifLQ.isLoading ? (
                    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[...Array(5)].map((_, i) => <LoadingSkeleton key={i} type="table-row" />)}
                    </div>
                ) : filteredRows.length === 0 ? (
                    <EmptyState
                        title={verifItems.length === 0 ? 'No verification records' : 'No matching records'}
                        message={
                            verifItems.length === 0
                                ? 'Implement a recommendation and run verification to generate audit records.'
                                : 'Try clearing your search or changing the status filter.'
                        }
                        icon="inbox"
                    />
                ) : (
                    <GlassTable
                        data={filteredRows}
                        columns={columns}
                        keyExtractor={(v: VerificationRecord) => v.id}
                        emptyMessage="No records found."
                    />
                )}
            </div>
        </motion.div>
    );
};

export default Reports;
