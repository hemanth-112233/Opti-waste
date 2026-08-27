/**
 * Verification.tsx
 * OptiWaste — Phase 21 Step 3: Recommendation Verification Dashboard
 *
 * Features:
 *  - Summary stat cards (verified, partially verified, failed, not verifiable, savings, avg error)
 *  - Status filter chips
 *  - GlassTable with savings comparison, prediction error, evidence counts
 *  - Detail modal: waterfall cost comparison, savings result row, error bar,
 *    evidence section with sample counts, verification notes, status explainer
 *  - Run Verification button (POST /verifications/run) with toast
 *  - Proper handling of NOT_VERIFIABLE (not an error)
 *  - All data from real API — zero hardcoded values
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2, AlertCircle, XCircle, HelpCircle,
    DollarSign, BarChart2, Play, RefreshCw, ArrowDown,
    Database, Info, ChevronRight, AlertTriangle,
} from 'lucide-react';

import styles from './Verification.module.css';
import { GlassStatCard } from '../components/ui/GlassStatCard';
import { GlassButton } from '../components/ui/GlassButton';
import { GlassModal } from '../components/ui/GlassModal';
import { GlassTable } from '../components/ui/GlassTable';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

import {
    useVerificationSummary,
    useVerifications,
    useVerification,
    useRunVerification,
} from '../lib/queries';

import type {
    VerificationStatus,
    VerificationRecord,
    VerificationRecommendation,
} from '../api/verifications';

// ── Types & helpers ───────────────────────────────────────────────────────────

type StatusFilter = 'all' | VerificationStatus;

interface Toast { id: number; message: string; kind: 'success' | 'error' }

function fmt$(n: number | undefined | null): string {
    if (n == null) return '—';
    return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function pct(n: number | undefined | null): string {
    if (n == null) return '—';
    return n.toFixed(2) + '%';
}

function titleCase(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function recOf(v: VerificationRecord): VerificationRecommendation | null {
    if (!v.recommendation || typeof v.recommendation === 'string') return null;
    return v.recommendation as VerificationRecommendation;
}

// ── Status helpers ────────────────────────────────────────────────────────────

const statusBadgeClass: Record<string, string> = {
    verified: styles.statusVerified,
    partially_verified: styles.statusPartial,
    failed: styles.statusFailed,
    not_verifiable: styles.statusNotVerifiable,
    pending: styles.statusPending,
    in_progress: styles.statusPending,
};

const statusLabel: Record<string, string> = {
    verified: 'Verified',
    partially_verified: 'Partial',
    failed: 'Failed',
    not_verifiable: 'Not Verifiable',
    pending: 'Pending',
    in_progress: 'In Progress',
};

const statusExplainer: Record<string, { text: string; cls: string }> = {
    verified: {
        text: 'Actual savings closely match the predicted savings within the configured verification threshold (≤20% error).',
        cls: styles.explainerVerified,
    },
    partially_verified: {
        text: 'Actual savings were observed, but prediction variance exceeded the verified threshold (20–50% error).',
        cls: styles.explainerPartial,
    },
    failed: {
        text: 'Implementation did not produce the expected savings evidence. Costs may have increased.',
        cls: styles.explainerFailed,
    },
    not_verifiable: {
        text: 'Insufficient post-implementation cost evidence available. Re-run verification once more cost records are collected.',
        cls: styles.explainerNotVerifiable,
    },
    pending: {
        text: 'Verification result is pending. Run verification to compute this record.',
        cls: styles.explainerNotVerifiable,
    },
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
    <span className={`${styles.badge} ${statusBadgeClass[status] ?? styles.statusPending}`}>
        {statusLabel[status] ?? titleCase(status)}
    </span>
);

// ── Toast ─────────────────────────────────────────────────────────────────────

const ToastBar: React.FC<{ toasts: Toast[]; onRemove: (id: number) => void }> = ({ toasts, onRemove }) => (
    <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <AnimatePresence>
            {toasts.map(t => (
                <motion.div
                    key={t.id}
                    initial={{ opacity: 0, x: 80 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 80 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    onClick={() => onRemove(t.id)}
                    style={{
                        padding: '11px 18px', borderRadius: 12, fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', maxWidth: 360,
                        boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
                        background: t.kind === 'success'
                            ? 'linear-gradient(135deg,rgba(52,199,89,0.94),rgba(30,180,60,0.94))'
                            : 'linear-gradient(135deg,rgba(255,59,48,0.94),rgba(220,40,30,0.94))',
                        color: '#fff', backdropFilter: 'blur(16px)',
                    }}
                >
                    {t.message}
                </motion.div>
            ))}
        </AnimatePresence>
    </div>
);

// ── Filter chips ──────────────────────────────────────────────────────────────

const filterOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'verified', label: 'Verified' },
    { value: 'partially_verified', label: 'Partially Verified' },
    { value: 'failed', label: 'Failed' },
    { value: 'not_verifiable', label: 'Not Verifiable' },
];

// ── Detail Modal ──────────────────────────────────────────────────────────────

const DetailModal: React.FC<{
    verificationId: string | null;
    onClose: () => void;
}> = ({ verificationId, onClose }) => {
    const { data, isLoading } = useVerification(verificationId);
    const v: VerificationRecord | undefined = data?.data;
    const rec = v ? recOf(v) : null;

    const explainer = v ? statusExplainer[v.verification_status] : null;
    const errBarWidth = v ? Math.min(100, v.prediction_error_pct) : 0;

    return (
        <GlassModal
            isOpen={!!verificationId}
            onClose={onClose}
            title="Verification Detail"
            width="720px"
        >
            {isLoading || !v ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[100, 130, 80, 80, 120].map((h, i) => (
                        <LoadingSkeleton key={i} type="card" height={h} />
                    ))}
                </div>
            ) : (
                <div className={styles.modalBody}>
                    {/* Title and status */}
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: '#1a1a2e', lineHeight: 1.35 }}>
                            {rec?.recommendation_title ?? 'Verification Record'}
                        </div>
                        <div className={styles.modalMeta}>
                            <StatusBadge status={v.verification_status} />
                            {rec?.recommendation_type && (
                                <span style={{ fontSize: 11, background: 'rgba(0,0,0,0.06)', padding: '3px 9px', borderRadius: 8, color: '#4b5563', fontWeight: 500 }}>
                                    {titleCase(rec.recommendation_type)}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Resource info */}
                    {rec?.resource && (
                        <div className={styles.resourceInfo}>
                            <span style={{ fontWeight: 600, color: '#1a1a2e' }}>{rec.resource.resource_name}</span>
                            <span>·</span>
                            <span>{rec.resource.resource_type}</span>
                            <span>·</span>
                            <span>{rec.resource.environment}</span>
                        </div>
                    )}

                    {/* Status explainer */}
                    {explainer && (
                        <div className={`${styles.statusExplainer} ${explainer.cls}`}>
                            {explainer.text}
                        </div>
                    )}

                    {/* NOT_VERIFIABLE sample warning */}
                    {v.verification_status === 'not_verifiable' && (
                        <div className={styles.sampleWarning}>
                            <AlertTriangle size={14} />
                            Not enough post-implementation cost evidence — pre samples: {v.pre_sample_count}, post samples: {v.post_sample_count}.
                        </div>
                    )}

                    <div className={styles.divider} />

                    {/* Waterfall: Baseline → Post */}
                    {v.baseline_cost > 0 && (
                        <div className={styles.waterfallCard}>
                            <div className={styles.waterfallColumn}>
                                <div className={styles.waterfallLabel}>Baseline Cost</div>
                                <div className={styles.waterfallValue}>{fmt$(v.baseline_cost)}</div>
                                <div className={styles.waterfallSub}>avg / month (pre-implementation)</div>
                            </div>
                            <div className={styles.waterfallArrow}>
                                <ArrowDown size={20} />
                                <div className={styles.waterfallArrowText}>After Implementation</div>
                            </div>
                            <div className={styles.waterfallColumn}>
                                <div className={styles.waterfallLabel}>Post-Implementation Cost</div>
                                <div className={styles.waterfallValue}>{fmt$(v.post_implementation_cost)}</div>
                                <div className={styles.waterfallSub}>avg / month (post-implementation)</div>
                            </div>
                        </div>
                    )}

                    {/* Actual / Predicted / Error */}
                    <div className={styles.savingsResultRow}>
                        <div className={`${styles.resultCard} ${styles.resultCardGreen}`}>
                            <div className={styles.resultLabel}>Actual Savings</div>
                            <div className={`${styles.resultValue} ${styles.resultValueGreen}`}>{fmt$(v.actual_savings)}</div>
                            <div className={styles.resultUnit}>per month</div>
                        </div>
                        <div className={`${styles.resultCard} ${styles.resultCardBlue}`}>
                            <div className={styles.resultLabel}>Predicted Savings</div>
                            <div className={`${styles.resultValue} ${styles.resultValueBlue}`}>{fmt$(v.predicted_savings)}</div>
                            <div className={styles.resultUnit}>per month</div>
                        </div>
                        <div className={`${styles.resultCard} ${styles.resultCardAmber}`}>
                            <div className={styles.resultLabel}>Prediction Error</div>
                            <div className={`${styles.resultValue} ${styles.resultValueAmber}`}>{pct(v.prediction_error_pct)}</div>
                            <div className={styles.resultUnit}>error vs predicted</div>
                        </div>
                    </div>

                    {/* Prediction error bar */}
                    {v.prediction_error_pct > 0 && (
                        <div className={styles.errorBarWrapper}>
                            <div className={styles.errorBarTrack}>
                                <div className={styles.errorBarFill} style={{ width: `${errBarWidth}%` }} />
                            </div>
                            <div className={styles.errorBarLabels}>
                                <span>0% (Perfect)</span>
                                <span>20% (Threshold)</span>
                                <span>50%</span>
                                <span>100%</span>
                            </div>
                        </div>
                    )}

                    <div className={styles.divider} />

                    {/* Verification Evidence */}
                    <div className={styles.section}>
                        <div className={styles.sectionLabel}>
                            <Database size={11} style={{ display: 'inline', marginRight: 4 }} />
                            Verification Evidence
                        </div>
                        <div className={styles.evidenceBox}>
                            <div className={styles.evidenceItem}>
                                <div className={styles.evidenceKey}>Pre-Implementation Samples</div>
                                <div className={styles.evidenceVal}>{v.pre_sample_count}</div>
                            </div>
                            <div className={styles.evidenceItem}>
                                <div className={styles.evidenceKey}>Post-Implementation Samples</div>
                                <div className={styles.evidenceVal}>{v.post_sample_count}</div>
                            </div>
                            <div className={styles.evidenceItem}>
                                <div className={styles.evidenceKey}>Baseline Window</div>
                                <div className={styles.evidenceVal}>30 days pre-implementation</div>
                            </div>
                            <div className={styles.evidenceItem}>
                                <div className={styles.evidenceKey}>Verification Window</div>
                                <div className={styles.evidenceVal}>{v.verification_window_days.toFixed(1)} days post-implementation</div>
                            </div>
                            {v.implementation_date && (
                                <div className={styles.evidenceItem}>
                                    <div className={styles.evidenceKey}>Implementation Anchor</div>
                                    <div className={styles.evidenceVal}>{new Date(v.implementation_date).toLocaleDateString()}</div>
                                </div>
                            )}
                            <div className={styles.evidenceItem}>
                                <div className={styles.evidenceKey}>Savings Variance</div>
                                <div className={styles.evidenceVal}>{fmt$(v.savings_variance)}</div>
                            </div>
                            <div className={styles.evidenceItem}>
                                <div className={styles.evidenceKey}>Engine Confidence</div>
                                <div className={styles.evidenceVal}>{(v.confidence_score * 100).toFixed(0)}%</div>
                            </div>
                            <div className={styles.evidenceItem}>
                                <div className={styles.evidenceKey}>Estimated Risk</div>
                                <div className={styles.evidenceVal}>{v.estimated_risk}</div>
                            </div>
                        </div>
                    </div>

                    {/* Verification notes — audit trail */}
                    {v.verification_notes && (
                        <div className={styles.section}>
                            <div className={styles.sectionLabel}>
                                <Info size={11} style={{ display: 'inline', marginRight: 4 }} />
                                Audit Trail — Verification Notes
                            </div>
                            <div className={styles.notesBlock}>{v.verification_notes}</div>
                        </div>
                    )}

                    {/* Timestamp */}
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: -8 }}>
                        Last verified: {new Date(v.verified_at).toLocaleString()}
                    </div>
                </div>
            )}
        </GlassModal>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const Verification: React.FC = () => {
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // ── Toast ──────────────────────────────────────────────────────────────────
    const [toasts, setToasts] = useState<Toast[]>([]);
    const addToast = useCallback((message: string, kind: 'success' | 'error') => {
        const id = Date.now();
        setToasts(ts => [...ts, { id, message, kind }]);
        setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 4800);
    }, []);
    const removeToast = useCallback((id: number) => setToasts(ts => ts.filter(t => t.id !== id)), []);

    // ── Data ───────────────────────────────────────────────────────────────────
    const summaryQ = useVerificationSummary();
    const listQ = useVerifications({
        status: statusFilter !== 'all' ? statusFilter : undefined,
    });
    const runMutation = useRunVerification();

    const summary = summaryQ.data?.data;
    const items: VerificationRecord[] = listQ.data?.data ?? [];
    const total: number = listQ.data?.total ?? 0;

    // ── Run handler ────────────────────────────────────────────────────────────
    const [runResult, setRunResult] = useState<{ total: number } | null>(null);

    const handleRun = async () => {
        setRunResult(null);
        try {
            const res = await runMutation.mutateAsync(undefined);
            const { totalProcessed, verified, partiallyVerified } = res.data;
            setRunResult({ total: totalProcessed });
            const meaningful = verified + partiallyVerified;
            if (totalProcessed === 0) {
                addToast('0 recommendations were eligible for verification.', 'success');
            } else {
                addToast(
                    `Verification completed — ${totalProcessed} recommendation${totalProcessed !== 1 ? 's' : ''} processed, ${meaningful} verified.`,
                    'success'
                );
            }
        } catch (e: any) {
            addToast(e?.response?.data?.detail ?? e?.message ?? 'Verification run failed', 'error');
        }
    };

    // ── Table columns ──────────────────────────────────────────────────────────
    const columns = [
        {
            key: 'recommendation', header: 'Resource / Recommendation', width: '22%',
            render: (item: VerificationRecord) => {
                const rec = recOf(item);
                return (
                    <div>
                        <div className={styles.resourceName}>{rec?.resource?.resource_name ?? '—'}</div>
                        <div className={styles.recTitle}>{rec?.recommendation_title ?? '—'}</div>
                    </div>
                );
            },
        },
        {
            key: 'verification_status', header: 'Status', width: '13%', align: 'center' as const,
            render: (item: VerificationRecord) => <StatusBadge status={item.verification_status} />,
        },
        {
            key: 'baseline_cost', header: 'Baseline', width: '10%', align: 'right' as const,
            render: (item: VerificationRecord) => (
                <span style={{ fontSize: 13, color: '#4b5563' }}>{fmt$(item.baseline_cost)}</span>
            ),
        },
        {
            key: 'post_implementation_cost', header: 'Post-Impl.', width: '10%', align: 'right' as const,
            render: (item: VerificationRecord) => (
                <span style={{ fontSize: 13, color: '#4b5563' }}>{fmt$(item.post_implementation_cost)}</span>
            ),
        },
        {
            key: 'actual_savings', header: 'Actual Savings', width: '11%', align: 'right' as const,
            render: (item: VerificationRecord) => (
                <span className={item.actual_savings > 0 ? styles.savingsPos : item.actual_savings < 0 ? styles.savingsNeg : styles.savingsNeutral}>
                    {fmt$(item.actual_savings)}/mo
                </span>
            ),
        },
        {
            key: 'predicted_savings', header: 'Predicted', width: '10%', align: 'right' as const,
            render: (item: VerificationRecord) => (
                <span className={styles.savingsNeutral}>{fmt$(item.predicted_savings)}/mo</span>
            ),
        },
        {
            key: 'prediction_error_pct', header: 'Error', width: '8%', align: 'center' as const,
            render: (item: VerificationRecord) => (
                <span className={styles.predErr}>{pct(item.prediction_error_pct)}</span>
            ),
        },
        {
            key: 'pre_sample_count', header: 'Evidence', width: '9%', align: 'center' as const,
            render: (item: VerificationRecord) => (
                <span className={styles.evidencePill}>
                    {item.pre_sample_count}→{item.post_sample_count}
                </span>
            ),
        },
        {
            key: 'verified_at', header: 'Date', width: '11%',
            render: (item: VerificationRecord) => (
                <span style={{ fontSize: 12, color: '#9ca3af' }}>
                    {new Date(item.verified_at).toLocaleDateString()}
                </span>
            ),
        },
        {
            key: '_act', header: '', width: '4%', align: 'center' as const,
            render: () => <ChevronRight size={15} style={{ color: '#9ca3af' }} />,
        },
    ];

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <>
            <motion.div
                className={styles.page}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
                {/* ── Header ─────────────────────────────────────────────────────── */}
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <h1 className={styles.title}>Recommendation Verification</h1>
                        <p className={styles.subtitle}>
                            Measure actual savings against predicted savings using real post-implementation cost evidence.
                        </p>
                        <AnimatePresence>
                            {runResult !== null && (
                                <motion.div
                                    className={styles.runResult}
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                >
                                    <RefreshCw size={13} />
                                    {runResult.total === 0
                                        ? '0 recommendations eligible for verification'
                                        : `${runResult.total} recommendation${runResult.total !== 1 ? 's' : ''} processed`}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <GlassButton
                        variant="primary"
                        size="md"
                        icon={<Play size={15} />}
                        loading={runMutation.isPending}
                        onClick={handleRun}
                        disabled={runMutation.isPending}
                        aria-label="Run verification engine"
                    >
                        Run Verification
                    </GlassButton>
                </div>

                {/* ── Summary Cards ───────────────────────────────────────────────── */}
                {summaryQ.isLoading ? (
                    <div className={styles.skeletonGrid}>
                        {[...Array(6)].map((_, idx) => (
                            <LoadingSkeleton key={idx} type="card" className={styles.skeletonCard} />
                        ))}
                    </div>
                ) : (
                    <motion.div
                        className={styles.summaryGrid}
                        initial="hidden"
                        animate="visible"
                        variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
                    >
                        {[
                            { title: 'Verified', value: summary?.verifiedCount ?? 0, icon: CheckCircle2, color: 'green' as const },
                            { title: 'Partially Verified', value: summary?.partiallyVerifiedCount ?? 0, icon: AlertCircle, color: 'orange' as const },
                            { title: 'Failed', value: summary?.failedCount ?? 0, icon: XCircle, color: 'red' as const },
                            { title: 'Not Verifiable', value: summary?.notVerifiableCount ?? 0, icon: HelpCircle, color: 'gray' as const },
                            {
                                title: 'Confirmed Savings',
                                value: fmt$(summary?.totalConfirmedSavings ?? 0) + '/mo',
                                icon: DollarSign, color: 'green' as const
                            },
                            {
                                title: 'Avg. Prediction Error',
                                value: pct(summary?.avgPredictionErrorPct ?? 0),
                                icon: BarChart2, color: 'purple' as const
                            },
                        ].map((card) => (
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

                {/* ── Filter Bar ──────────────────────────────────────────────────── */}
                <div className={styles.filterBar}>
                    <span className={styles.filterLabel}>Status</span>
                    {filterOptions.map(o => (
                        <button
                            key={o.value}
                            className={`${styles.chip} ${statusFilter === o.value ? styles.chipActive : ''}`}
                            onClick={() => setStatusFilter(o.value)}
                            aria-pressed={statusFilter === o.value}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>

                {/* ── Table / Empty ────────────────────────────────────────────────── */}
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <span className={styles.panelTitle}>
                            Verification Records&nbsp;
                            {!listQ.isLoading && (
                                <span className={styles.panelCount}>({total} result{total !== 1 ? 's' : ''})</span>
                            )}
                        </span>
                    </div>

                    {listQ.isLoading ? (
                        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[...Array(4)].map((_, idx) => (
                                <LoadingSkeleton key={idx} type="table-row" />
                            ))}
                        </div>
                    ) : items.length === 0 ? (
                        statusFilter !== 'all' ? (
                            <EmptyState
                                title="No verifications match this filter"
                                message="Try selecting a different status filter."
                                icon="inbox"
                            />
                        ) : (
                            <EmptyState
                                title="No verification records yet"
                                message="Implement a recommendation and run verification to measure its actual savings."
                                icon="folder"
                                action={
                                    <GlassButton
                                        variant="primary"
                                        size="sm"
                                        icon={<Play size={14} />}
                                        loading={runMutation.isPending}
                                        onClick={handleRun}
                                        aria-label="Run verification"
                                    >
                                        Run Verification
                                    </GlassButton>
                                }
                            />
                        )
                    ) : (
                        <GlassTable
                            data={items}
                            columns={columns}
                            keyExtractor={(item: VerificationRecord) => item.id}
                            onRowClick={(item: VerificationRecord) => setSelectedId(item.id)}
                            emptyMessage="No verification records found."
                        />
                    )}
                </div>
            </motion.div>

            {/* ── Detail Modal ────────────────────────────────────────────────────── */}
            <DetailModal
                verificationId={selectedId}
                onClose={() => setSelectedId(null)}
            />

            {/* ── Toast Bar ────────────────────────────────────────────────────────── */}
            <ToastBar toasts={toasts} onRemove={removeToast} />
        </>
    );
};

export default Verification;
