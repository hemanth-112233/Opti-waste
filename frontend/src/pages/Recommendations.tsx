/**
 * Recommendations.tsx
 * OptiWaste — Phase 21: Optimization Recommendation Engine UI
 *
 * Features:
 *  - Summary stat cards (total, pending, accepted, implemented, savings)
 *  - Status / priority / type filter bar
 *  - GlassTable with priority + status badges
 *  - Detail modal with explainability, savings visualization, confidence bar
 *  - Status action buttons (Accept / Dismiss / Mark Implemented)
 *  - React Query for all data; mutations invalidate full recommendation cache
 *  - Loading skeletons, empty states, error toasts
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle, CheckCircle, Clock, XCircle, DollarSign,
    Zap, Play, RefreshCw, Info, ChevronRight,
    BarChart2, Target,
} from 'lucide-react';

import styles from './Recommendations.module.css';
import { GlassStatCard } from '../components/ui/GlassStatCard';
import { GlassButton } from '../components/ui/GlassButton';
import { GlassModal } from '../components/ui/GlassModal';
import { GlassTable } from '../components/ui/GlassTable';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

import {
    useRecommendationSummary,
    useRecommendations,
    useRecommendation,
    useGenerateRecommendations,
    useUpdateRecommendationStatus,
    useVerifications,
} from '../lib/queries';

import { spring, fadeUp, reduceMotion } from '../lib/motionSystem';

import type {
    RecommendationStatus,
    RecommendationPriority,
    RecommendationType,
    Recommendation,
    RecommendationResource,
} from '../api/recommendations';

import type { VerificationRecord } from '../api/verifications';

// ── Types ─────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | RecommendationStatus;
type PriorityFilter = 'all' | RecommendationPriority;
type TypeFilter = 'all' | RecommendationType;

interface Toast {
    id: number;
    message: string;
    kind: 'success' | 'error';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(n: number): string {
    return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function pct(n: number): string {
    return (n * 100).toFixed(0) + '%';
}

function titleCase(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function resourceOf(r: Recommendation): RecommendationResource | null {
    if (!r.resource) return null;
    if (typeof r.resource === 'string') return null;
    return r.resource as RecommendationResource;
}

// ── Badge components ──────────────────────────────────────────────────────────

const priorityClass: Record<string, string> = {
    CRITICAL: styles.badgeCritical,
    HIGH: styles.badgeHigh,
    MEDIUM: styles.badgeMedium,
    LOW: styles.badgeLow,
};

const statusClass: Record<string, string> = {
    pending: styles.statusPending,
    accepted: styles.statusAccepted,
    implemented: styles.statusImplemented,
    dismissed: styles.statusDismissed,
};

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => (
    <span className={`${styles.badge} ${priorityClass[priority] ?? styles.badgeLow}`}>
        {priority}
    </span>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
    <span className={`${styles.badge} ${statusClass[status] ?? styles.statusPending}`}>
        {titleCase(status)}
    </span>
);

const TypeBadge: React.FC<{ type: string }> = ({ type }) => (
    <span className={styles.typeBadge}>{titleCase(type)}</span>
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
                        padding: '11px 18px',
                        borderRadius: 12,
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                        maxWidth: 340,
                        boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
                        background: t.kind === 'success'
                            ? 'linear-gradient(135deg,rgba(52,199,89,0.94),rgba(30,180,60,0.94))'
                            : 'linear-gradient(135deg,rgba(255,59,48,0.94),rgba(220,40,30,0.94))',
                        color: '#fff',
                        backdropFilter: 'blur(16px)',
                    }}
                >
                    {t.message}
                </motion.div>
            ))}
        </AnimatePresence>
    </div>
);

// ── Filter chip helpers ───────────────────────────────────────────────────────

const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'implemented', label: 'Implemented' },
    { value: 'dismissed', label: 'Dismissed' },
];

const priorityOptions: { value: PriorityFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'CRITICAL', label: 'Critical' },
    { value: 'HIGH', label: 'High' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'LOW', label: 'Low' },
];

const typeOptions: { value: TypeFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'idle', label: 'Idle' },
    { value: 'underutilized', label: 'Underutilized' },
    { value: 'overprovisioned', label: 'Overprovisioned' },
    { value: 'unattached_storage', label: 'Unattached Storage' },
    { value: 'storage_waste', label: 'Storage Waste' },
    { value: 'cost_anomaly', label: 'Cost Anomaly' },
];

function Chips<T extends string>({
    options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
    return (
        <div className={styles.filterChips}>
            {options.map(o => (
                <button
                    key={o.value}
                    className={`${styles.chip} ${value === o.value ? styles.chipActive : ''}`}
                    onClick={() => onChange(o.value)}
                    aria-pressed={value === o.value}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

// ── Verification status helpers ───────────────────────────────────────────────

const verificationStatusLabel: Record<string, string> = {
    verified: 'Verified',
    partially_verified: 'Partially Verified',
    not_verifiable: 'Not Verifiable',
    failed: 'Failed',
    in_progress: 'In Progress',
    pending: 'Pending',
};

const verificationStatusClass: Record<string, string> = {
    verified: styles.vstVerified,
    partially_verified: styles.vstPartial,
    not_verifiable: styles.vstNa,
    failed: styles.vstFailed,
    in_progress: styles.vstPending,
    pending: styles.vstPending,
};

// ── Detail Modal ──────────────────────────────────────────────────────────────

const DetailModal: React.FC<{
    recId: string | null;
    onClose: () => void;
    onStatusChange: (msg: string) => void;
    onError: (msg: string) => void;
}> = ({ recId, onClose, onStatusChange, onError }) => {
    const { data, isLoading } = useRecommendation(recId);
    const updateStatus = useUpdateRecommendationStatus();
    const [acting, setActing] = useState<RecommendationStatus | null>(null);

    // Fetch verification record linked to this recommendation
    const verifQ = useVerifications(
        recId ? { recommendation: recId } : {}
    );
    const verification: VerificationRecord | null =
        (verifQ.data?.data?.length ? verifQ.data.data[0] : null) ?? null;

    const rec: Recommendation | undefined = data?.data;
    const res = rec ? resourceOf(rec) : null;

    const doStatus = async (status: RecommendationStatus, label: string) => {
        if (!rec) return;
        setActing(status);
        try {
            await updateStatus.mutateAsync({ id: rec.id, status });
            onStatusChange(label);
            onClose();
        } catch (e: any) {
            onError(e?.response?.data?.detail ?? e?.message ?? 'Status update failed');
        } finally {
            setActing(null);
        }
    };

    const nullFmt$ = (n: number | null | undefined): string =>
        (n != null && n > 0) ? fmt$(n) : '—';
    const nullPct = (n: number | null | undefined): string =>
        n != null ? pct(n) : '—';

    return (
        <GlassModal
            isOpen={!!recId}
            onClose={onClose}
            title="Recommendation Detail"
            width="760px"
        >
            {isLoading || !rec ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[100, 80, 60, 80, 120, 80].map((h, idx) => (
                        <LoadingSkeleton key={idx} type="card" height={h} />
                    ))}
                </div>
            ) : (
                <div className={styles.modalBody}>

                    {/* ── Header: title + badges ─── */}
                    <div className={styles.modalHeader}>
                        <h2 className={styles.modalTitle}>{rec.recommendation_title}</h2>
                        <div className={styles.modalMeta}>
                            <PriorityBadge priority={rec.priority} />
                            <StatusBadge status={rec.status} />
                            <TypeBadge type={rec.recommendation_type} />
                        </div>
                    </div>

                    {/* ── Resource grid ─── */}
                    {res && (
                        <div className={styles.resourceGrid}>
                            <div className={styles.resourceGridItem}>
                                <span className={styles.resourceGridLabel}>Resource</span>
                                <span className={styles.resourceGridValue}>{res.resource_name}</span>
                            </div>
                            <div className={styles.resourceGridItem}>
                                <span className={styles.resourceGridLabel}>Type</span>
                                <span className={styles.resourceGridValue}>{res.resource_type || '—'}</span>
                            </div>
                            {res.instance_type && (
                                <div className={styles.resourceGridItem}>
                                    <span className={styles.resourceGridLabel}>Instance</span>
                                    <span className={styles.resourceGridValue}>{res.instance_type}</span>
                                </div>
                            )}
                            <div className={styles.resourceGridItem}>
                                <span className={styles.resourceGridLabel}>Provider</span>
                                <span className={styles.resourceGridValue}>{res.provider_type || '—'}</span>
                            </div>
                            <div className={styles.resourceGridItem}>
                                <span className={styles.resourceGridLabel}>Environment</span>
                                <span className={styles.resourceGridValue}>{res.environment || '—'}</span>
                            </div>
                            <div className={styles.resourceGridItem}>
                                <span className={styles.resourceGridLabel}>Monthly Cost</span>
                                <span className={styles.resourceGridValue}>
                                    {res.monthly_cost != null && res.monthly_cost > 0
                                        ? fmt$(res.monthly_cost)
                                        : '—'}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className={styles.divider} />

                    {/* ── Savings + confidence ─── */}
                    <div className={styles.modalSavingsRow}>
                        <div className={styles.modalSavingsCard}>
                            <div className={styles.modalSavingsLabel}>Predicted Monthly Savings</div>
                            <div className={styles.modalSavingsValue}>
                                {rec.predicted_savings != null && rec.predicted_savings > 0
                                    ? fmt$(rec.predicted_savings)
                                    : '—'}
                            </div>
                            {rec.savings_basis && (
                                <div className={styles.modalSavingsUnit}>per month (estimated)</div>
                            )}
                        </div>
                        <div className={styles.modalConfCard}>
                            <div className={styles.modalSavingsLabel}>Engine Confidence</div>
                            {rec.confidence_score != null ? (
                                <>
                                    <div className={styles.confValue}>{pct(rec.confidence_score)}</div>
                                    <div className={styles.confBar}>
                                        <div className={styles.confFill} style={{ width: pct(rec.confidence_score) }} />
                                    </div>
                                </>
                            ) : (
                                <div className={styles.confValue} style={{ color: '#9ca3af' }}>—</div>
                            )}
                        </div>
                    </div>

                    {/* ── Description ─── */}
                    {rec.recommendation_description && (
                        <div className={styles.section}>
                            <div className={styles.sectionLabel}>
                                <Info size={11} style={{ display: 'inline', marginRight: 4 }} />
                                Description
                            </div>
                            <div className={styles.sectionText}>{rec.recommendation_description}</div>
                        </div>
                    )}

                    {/* ── Why this recommendation ─── */}
                    {rec.recommendation_reason && (
                        <div className={styles.section}>
                            <div className={styles.sectionLabel}>
                                <Info size={11} style={{ display: 'inline', marginRight: 4 }} />
                                Why This Recommendation?
                            </div>
                            <div className={styles.sectionText}>{rec.recommendation_reason}</div>
                        </div>
                    )}

                    {/* ── Recommended action ─── */}
                    {rec.recommended_action && (
                        <div className={`${styles.section} ${styles.actionSection}`}>
                            <div className={styles.sectionLabel}>
                                <Target size={11} style={{ display: 'inline', marginRight: 4 }} />
                                Recommended Action
                            </div>
                            <div className={styles.sectionText}>{rec.recommended_action}</div>
                        </div>
                    )}

                    {/* ── Estimated impact ─── */}
                    {rec.estimated_impact ? (
                        <div className={styles.section}>
                            <div className={styles.sectionLabel}>
                                <BarChart2 size={11} style={{ display: 'inline', marginRight: 4 }} />
                                Estimated Impact
                            </div>
                            <div className={styles.sectionText}>{rec.estimated_impact}</div>
                        </div>
                    ) : null}

                    {/* ── Savings basis ─── */}
                    {rec.savings_basis && (
                        <div className={styles.section}>
                            <div className={styles.sectionLabel}>
                                <BarChart2 size={11} style={{ display: 'inline', marginRight: 4 }} />
                                How Savings Were Calculated
                            </div>
                            <div className={styles.codeBlock}>{rec.savings_basis}</div>
                        </div>
                    )}

                    <div className={styles.divider} />

                    {/* ── Verification panel ─── */}
                    <div className={styles.section}>
                        <div className={styles.sectionLabel}>
                            <CheckCircle size={11} style={{ display: 'inline', marginRight: 4 }} />
                            Verification
                        </div>

                        {verifQ.isLoading ? (
                            <LoadingSkeleton type="card" height={80} />
                        ) : !verification ? (
                            <div className={styles.verificationEmpty}>
                                {rec.status === 'implemented'
                                    ? 'Verification engine has not run yet for this recommendation. Run the verification engine to compare predicted vs. actual savings.'
                                    : 'Not yet verified — verification runs on implemented recommendations only.'}
                            </div>
                        ) : (
                            <div className={styles.verificationPanel}>
                                {/* Status row */}
                                <div className={styles.verifRow}>
                                    <span className={`${styles.vstBadge} ${verificationStatusClass[verification.verification_status] ?? styles.vstPending}`}>
                                        {verificationStatusLabel[verification.verification_status] ?? verification.verification_status}
                                    </span>
                                    {verification.verified_at && (
                                        <span className={styles.verifMeta}>
                                            Verified {new Date(verification.verified_at).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>

                                {/* Savings comparison */}
                                <div className={styles.verifGrid}>
                                    <div className={styles.verifCell}>
                                        <span className={styles.verifCellLabel}>Predicted</span>
                                        <span className={styles.verifCellValue}>{nullFmt$(verification.predicted_savings)}</span>
                                    </div>
                                    <div className={styles.verifCell}>
                                        <span className={styles.verifCellLabel}>Actual Savings</span>
                                        <span className={`${styles.verifCellValue} ${verification.actual_savings > 0 ? styles.verifGreen : styles.verifRed}`}>
                                            {nullFmt$(verification.actual_savings)}
                                        </span>
                                    </div>
                                    <div className={styles.verifCell}>
                                        <span className={styles.verifCellLabel}>Baseline Cost</span>
                                        <span className={styles.verifCellValue}>{nullFmt$(verification.baseline_cost)}</span>
                                    </div>
                                    <div className={styles.verifCell}>
                                        <span className={styles.verifCellLabel}>Post-Impl. Cost</span>
                                        <span className={styles.verifCellValue}>{nullFmt$(verification.post_implementation_cost)}</span>
                                    </div>
                                    <div className={styles.verifCell}>
                                        <span className={styles.verifCellLabel}>Prediction Error</span>
                                        <span className={styles.verifCellValue}>
                                            {verification.prediction_error_pct != null
                                                ? `${verification.prediction_error_pct}%`
                                                : '—'}
                                        </span>
                                    </div>
                                    <div className={styles.verifCell}>
                                        <span className={styles.verifCellLabel}>Confidence</span>
                                        <span className={styles.verifCellValue}>{nullPct(verification.confidence_score)}</span>
                                    </div>
                                </div>

                                {/* Verification notes */}
                                {verification.verification_notes && (
                                    <div className={styles.verifNotes}>{verification.verification_notes}</div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className={styles.divider} />

                    {/* ── Actions ─── */}
                    <div className={styles.modalActions}>
                        {rec.status === 'pending' && (
                            <>
                                <GlassButton
                                    variant="primary"
                                    size="sm"
                                    icon={<CheckCircle size={14} />}
                                    loading={acting === 'accepted'}
                                    onClick={() => doStatus('accepted', 'Recommendation accepted')}
                                    aria-label="Accept recommendation"
                                >
                                    Accept
                                </GlassButton>
                                <GlassButton
                                    variant="danger"
                                    size="sm"
                                    icon={<XCircle size={14} />}
                                    loading={acting === 'dismissed'}
                                    onClick={() => doStatus('dismissed', 'Recommendation dismissed')}
                                    aria-label="Dismiss recommendation"
                                >
                                    Dismiss
                                </GlassButton>
                            </>
                        )}
                        {rec.status === 'accepted' && (
                            <>
                                <GlassButton
                                    variant="primary"
                                    size="sm"
                                    icon={<Play size={14} />}
                                    loading={acting === 'implemented'}
                                    onClick={() => doStatus('implemented', 'Recommendation marked as implemented')}
                                    aria-label="Mark as implemented"
                                >
                                    Mark Implemented
                                </GlassButton>
                                <GlassButton
                                    variant="danger"
                                    size="sm"
                                    icon={<XCircle size={14} />}
                                    loading={acting === 'dismissed'}
                                    onClick={() => doStatus('dismissed', 'Recommendation dismissed')}
                                    aria-label="Dismiss recommendation"
                                >
                                    Dismiss
                                </GlassButton>
                            </>
                        )}
                        {rec.status === 'implemented' && (
                            <div className={styles.implementedBadge}>
                                <CheckCircle size={15} /> Implemented
                            </div>
                        )}
                        {rec.status === 'dismissed' && (
                            <div className={styles.dismissedBadge}>
                                <XCircle size={15} /> Dismissed
                            </div>
                        )}
                    </div>
                </div>
            )}
        </GlassModal>
    );
};


// ── Main Page ─────────────────────────────────────────────────────────────────

const Recommendations: React.FC = () => {
    // ── Filters ───────────────────────────────────────────────────────────────
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

    // ── Modal ──────────────────────────────────────────────────────────────────
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // ── Toast ──────────────────────────────────────────────────────────────────
    const [toasts, setToasts] = useState<Toast[]>([]);
    const addToast = useCallback((message: string, kind: 'success' | 'error') => {
        const id = Date.now();
        setToasts(ts => [...ts, { id, message, kind }]);
        setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 4500);
    }, []);
    const removeToast = useCallback((id: number) => setToasts(ts => ts.filter(t => t.id !== id)), []);

    // ── Data ───────────────────────────────────────────────────────────────────
    const summaryQ = useRecommendationSummary();
    const listQ = useRecommendations({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        recommendation_type: typeFilter !== 'all' ? typeFilter : undefined,
    });
    const generate = useGenerateRecommendations();

    const summary = summaryQ.data?.data;
    const items: Recommendation[] = listQ.data?.data ?? [];
    const total: number = listQ.data?.total ?? 0;

    // ── Generate handler ───────────────────────────────────────────────────────
    const [genResult, setGenResult] = useState<{ count: number } | null>(null);
    const handleGenerate = async () => {
        setGenResult(null);
        try {
            const res = await generate.mutateAsync();
            const count = res.data.totalRecommendationsGenerated;
            setGenResult({ count });
            if (count > 0) {
                addToast(`${count} recommendation${count === 1 ? '' : 's'} generated`, 'success');
            } else {
                addToast('Everything looks optimized — no new recommendations found.', 'success');
            }
        } catch (e: any) {
            addToast(e?.response?.data?.detail ?? e?.message ?? 'Generation failed', 'error');
        }
    };

    // ── Table columns ──────────────────────────────────────────────────────────
    const columns = [
        {
            key: 'recommendation_title', header: 'Recommendation', width: '28%',
            render: (item: Recommendation) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={14} style={{ color: '#ff9500', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', lineHeight: 1.3 }}>
                        {item.recommendation_title}
                    </span>
                </div>
            ),
        },
        {
            key: 'resource', header: 'Resource', width: '18%',
            render: (item: Recommendation) => {
                const r = resourceOf(item);
                if (!r) return <span style={{ fontSize: 12, color: '#9ca3af' }}>—</span>;
                return (
                    <div className={styles.resourceCell}>
                        <span className={styles.resourceCellName}>{r.resource_name}</span>
                        <span className={styles.resourceCellMeta}>
                            {r.resource_type}{r.provider_type ? ` · ${r.provider_type}` : ''}
                        </span>
                    </div>
                );
            },
        },
        {
            key: 'recommendation_type', header: 'Type', width: '14%',
            render: (item: Recommendation) => <TypeBadge type={item.recommendation_type} />,
        },
        {
            key: 'priority', header: 'Priority', width: '10%', align: 'center' as const,
            render: (item: Recommendation) => <PriorityBadge priority={item.priority} />,
        },
        {
            key: 'predicted_savings', header: 'Est. Savings', width: '12%', align: 'right' as const,
            render: (item: Recommendation) => (
                <span className={styles.savings}>{fmt$(item.predicted_savings)}<span style={{ fontWeight: 400, fontSize: 11, color: '#26a745' }}>/mo</span></span>
            ),
        },
        {
            key: 'confidence_score', header: 'Confidence', width: '11%', align: 'center' as const,
            render: (item: Recommendation) => (
                <div className={styles.confCellWrap}>
                    <span className={styles.confCellPct}>{pct(item.confidence_score)}</span>
                    <div className={styles.confBarInline}>
                        <div className={styles.confFillInline} style={{ width: pct(item.confidence_score) }} />
                    </div>
                </div>
            ),
        },
        {
            key: 'status', header: 'Status', width: '10%', align: 'center' as const,
            render: (item: Recommendation) => <StatusBadge status={item.status} />,
        },
        {
            key: '_action', header: '', width: '6%', align: 'center' as const,
            render: () => (
                <ChevronRight size={15} style={{ color: '#9ca3af' }} />
            ),
        },
    ];

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <>
            <motion.div
                className={styles.page}
                initial={fadeUp.hidden}
                animate={fadeUp.visible}
                transition={reduceMotion(spring.standard)}
            >
                {/* ── Header ─────────────────────────────────────────────────────── */}
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <h1 className={styles.title}>Optimization Recommendations</h1>
                        <p className={styles.subtitle}>
                            Turn detected cloud waste into actionable, data-driven optimization decisions.
                        </p>
                        <AnimatePresence>
                            {genResult && (
                                <motion.div
                                    className={styles.generateResult}
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                >
                                    <RefreshCw size={13} />
                                    {genResult.count > 0
                                        ? `${genResult.count} recommendation${genResult.count === 1 ? '' : 's'} generated`
                                        : 'Everything looks optimized — no new recommendations found.'}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <GlassButton
                        variant="primary"
                        size="md"
                        icon={<Zap size={15} />}
                        loading={generate.isPending}
                        onClick={handleGenerate}
                        disabled={generate.isPending}
                        aria-label="Generate optimization recommendations"
                    >
                        Generate Recommendations
                    </GlassButton>
                </div>

                {/* ── Summary Cards ───────────────────────────────────────────────── */}
                {summaryQ.isLoading ? (
                    <div className={styles.skeletonGrid}>
                        {[...Array(5)].map((_, idx) => (
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
                            { title: 'Total', value: summary?.totalRecommendations ?? 0, icon: AlertTriangle, color: 'purple' as const },
                            { title: 'Pending', value: summary?.pendingCount ?? 0, icon: Clock, color: 'gray' as const },
                            { title: 'Accepted', value: summary?.acceptedCount ?? 0, icon: CheckCircle, color: 'blue' as const },
                            { title: 'Implemented', value: summary?.implementedCount ?? 0, icon: Play, color: 'green' as const },
                            {
                                title: 'Est. Savings',
                                value: summary?.estimatedTotalSavings != null
                                    ? fmt$(summary.estimatedTotalSavings) + '/mo'
                                    : '—',
                                icon: DollarSign, color: 'orange' as const,
                            },
                        ].map((card) => (
                            <motion.div
                                key={card.title}
                                variants={{
                                    hidden: fadeUp.hidden,
                                    visible: { ...fadeUp.visible, transition: reduceMotion(spring.standard) },
                                }}
                            >
                                <GlassStatCard {...card} />
                            </motion.div>
                        ))}
                    </motion.div>
                )}

                {/* ── Filter Bar ──────────────────────────────────────────────────── */}
                <div className={styles.filterBar}>
                    <div className={styles.filterGroup}>
                        <div className={styles.filterLabel}>Status</div>
                        <Chips options={statusOptions} value={statusFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} />
                    </div>
                    <div className={styles.filterGroup}>
                        <div className={styles.filterLabel}>Priority</div>
                        <Chips options={priorityOptions} value={priorityFilter} onChange={(v) => setPriorityFilter(v as PriorityFilter)} />
                    </div>
                    <div className={styles.filterGroup}>
                        <div className={styles.filterLabel}>Type</div>
                        <Chips options={typeOptions} value={typeFilter} onChange={(v) => setTypeFilter(v as TypeFilter)} />
                    </div>
                </div>

                {/* ── Table / Empty ────────────────────────────────────────────────── */}
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <span className={styles.panelTitle}>
                            Recommendations&nbsp;
                            {!listQ.isLoading && (
                                <span className={styles.panelCount}>({total} result{total !== 1 ? 's' : ''})</span>
                            )}
                        </span>
                        {!listQ.isLoading && listQ.error && (
                            <span style={{ fontSize: 12, color: '#ff3b30' }}>Failed to load</span>
                        )}
                    </div>

                    {listQ.isLoading ? (
                        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[...Array(4)].map((_, idx) => (
                                <LoadingSkeleton key={idx} type="table-row" />
                            ))}
                        </div>
                    ) : items.length === 0 ? (
                        statusFilter !== 'all' || priorityFilter !== 'all' || typeFilter !== 'all' ? (
                            <EmptyState
                                title="No matching recommendations"
                                message="Try adjusting your filters to find recommendations."
                                icon="inbox"
                            />
                        ) : (
                            <EmptyState
                                title="No optimization recommendations yet."
                                message="Run the recommendation engine after waste analysis to generate data-driven optimization actions."
                                icon="folder"
                                action={
                                    <GlassButton
                                        variant="primary"
                                        size="sm"
                                        icon={<Zap size={14} />}
                                        loading={generate.isPending}
                                        onClick={handleGenerate}
                                        aria-label="Generate recommendations"
                                    >
                                        Generate Recommendations
                                    </GlassButton>
                                }
                            />
                        )
                    ) : (
                        <GlassTable
                            data={items}
                            columns={columns}
                            keyExtractor={(item: Recommendation) => item.id}
                            onRowClick={(item: Recommendation) => setSelectedId(item.id)}
                            emptyMessage="No recommendations found."
                        />
                    )}
                </div>
            </motion.div>

            {/* ── Detail Modal ────────────────────────────────────────────────────── */}
            <DetailModal
                recId={selectedId}
                onClose={() => setSelectedId(null)}
                onStatusChange={(msg) => { addToast(msg, 'success'); }}
                onError={(msg) => { addToast(msg, 'error'); }}
            />

            {/* ── Toast Bar ────────────────────────────────────────────────────────── */}
            <ToastBar toasts={toasts} onRemove={removeToast} />
        </>
    );
};

export default Recommendations;
