import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap,
    AlertTriangle,
    TrendingUp,
    DollarSign,
    RefreshCw,
    Server,
    HardDrive,
    Check,
    X as XIcon,
    Activity,
    Archive,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import GlassStatCard from '../components/ui/GlassStatCard';
import GlassButton from '../components/ui/GlassButton';
import GlassModal from '../components/ui/GlassModal';
import {
    WasteService,
    type WasteFinding,
    type WasteSummary,
    type RiskLevel,
    type WasteCategory,
} from '../api/waste';
import styles from './WasteDetection.module.css';

// ── Helpers ────────────────────────────────────────────────────────────────────

const RISK_FILTERS = ['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
type FilterOption = typeof RISK_FILTERS[number];

function riskBadgeClass(level: RiskLevel) {
    switch (level) {
        case 'LOW': return styles.riskLow;
        case 'MEDIUM': return styles.riskMedium;
        case 'HIGH': return styles.riskHigh;
        case 'CRITICAL': return styles.riskCritical;
    }
}

function dotClass(level: RiskLevel) {
    switch (level) {
        case 'LOW': return styles.dotLow;
        case 'MEDIUM': return styles.dotMedium;
        case 'HIGH': return styles.dotHigh;
        case 'CRITICAL': return styles.dotCritical;
    }
}

function riskScoreColour(level: RiskLevel) {
    switch (level) {
        case 'LOW': return 'var(--color-system-green)';
        case 'MEDIUM': return 'var(--color-system-orange)';
        case 'HIGH': return '#E64A0F';
        case 'CRITICAL': return 'var(--color-system-red)';
    }
}

function categoryLabel(cat: WasteCategory): string {
    switch (cat) {
        case 'idle': return 'Idle';
        case 'underutilized': return 'Underutilized';
        case 'overprovisioned': return 'Overprovisioned';
        case 'unattached_storage': return 'Unattached Storage';
        case 'storage_waste': return 'Storage Waste';
        case 'cost_anomaly': return 'Cost Anomaly';
    }
}

function categoryTagStyle(cat: WasteCategory): React.CSSProperties {
    switch (cat) {
        case 'idle': return { background: 'rgba(88,86,214,0.12)', color: 'var(--color-system-indigo)' };
        case 'underutilized': return { background: 'rgba(50,173,230,0.12)', color: 'var(--color-system-cyan)' };
        case 'overprovisioned': return { background: 'rgba(255,149,0,0.12)', color: 'var(--color-system-orange)' };
        case 'unattached_storage': return { background: 'rgba(175,82,222,0.12)', color: 'var(--color-system-purple)' };
        case 'storage_waste': return { background: 'rgba(255,45,85,0.10)', color: 'var(--color-system-pink)' };
        case 'cost_anomaly': return { background: 'rgba(255,59,48,0.12)', color: 'var(--color-system-red)' };
    }
}

function resourceName(f: WasteFinding): string {
    if (typeof f.resource === 'object' && f.resource !== null) {
        return (f.resource as any).resource_name || 'Unknown Resource';
    }
    return 'Unknown Resource';
}

function resourceType(f: WasteFinding): string {
    if (typeof f.resource === 'object' && f.resource !== null) {
        return `${(f.resource as any).resource_type || ''} · ${(f.resource as any).provider_type || ''}`;
    }
    return '';
}

function fmt$(n: number | null | undefined): string {
    if (n == null) return '—';
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(s: string): string {
    return new Date(s).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

// ── Animation variants ────────────────────────────────────────────────────────

type BezierTuple = [number, number, number, number];
const springEase: BezierTuple = [0.34, 1.2, 0.64, 1];
const easeOut: BezierTuple = [0.25, 0.46, 0.45, 0.94];

const pageVariants = {
    hidden: { opacity: 0, y: 18 },
    visible: {
        opacity: 1, y: 0,
        transition: { duration: 0.45, ease: springEase, staggerChildren: 0.07, when: 'beforeChildren' }
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 14 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: springEase } },
};

const rowVariants = {
    hidden: { opacity: 0, x: -8 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: easeOut } },
};

// ── Category panel config ─────────────────────────────────────────────────────

interface CategoryConfig {
    key: keyof WasteSummary;
    label: string;
    cat: WasteCategory;
    iconBg: string;
    icon: React.ElementType;
}

const CATEGORIES: CategoryConfig[] = [
    { key: 'idleResources', label: 'Idle Resources', cat: 'idle', iconBg: 'rgba(88,86,214,0.12)', icon: Activity },
    { key: 'underutilizedResources', label: 'Underutilized', cat: 'underutilized', iconBg: 'rgba(50,173,230,0.12)', icon: TrendingUp },
    { key: 'overprovisionedResources', label: 'Overprovisioned', cat: 'overprovisioned', iconBg: 'rgba(255,149,0,0.12)', icon: Server },
    { key: 'unattachedStorage', label: 'Unattached Storage', cat: 'unattached_storage', iconBg: 'rgba(175,82,222,0.12)', icon: HardDrive },
    { key: 'storageWaste', label: 'Storage Waste', cat: 'storage_waste', iconBg: 'rgba(255,45,85,0.10)', icon: Archive },
    { key: 'costAnomalies', label: 'Cost Anomalies', cat: 'cost_anomaly', iconBg: 'rgba(255,59,48,0.12)', icon: AlertTriangle },
];

// ── Toast component ───────────────────────────────────────────────────────────

interface ToastMessage {
    type: 'success' | 'error';
    text: string;
}

function Toast({ msg, onDismiss }: { msg: ToastMessage; onDismiss: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0, x: 60, y: -10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 60 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className={`${styles.toast} ${msg.type === 'success' ? styles.toastSuccess : styles.toastError}`}
        >
            {msg.type === 'success'
                ? <Check size={15} color="var(--color-system-green)" />
                : <AlertTriangle size={15} color="var(--color-system-red)" />
            }
            <span style={{ flex: 1 }}>{msg.text}</span>
            <button onClick={onDismiss} style={{ marginLeft: '0.25rem', display: 'flex', cursor: 'pointer' }}>
                <XIcon size={14} color="var(--color-gray-400)" />
            </button>
        </motion.div>
    );
}

// ── Loading skeletons ─────────────────────────────────────────────────────────

function FindingSkeleton() {
    return (
        <>
            {[0.9, 0.75, 0.85].map((w, i) => (
                <div key={i} className={styles.skeletonRow}>
                    <div className={styles.skeletonDot} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                        <div className={styles.skeletonLine} style={{ width: `${w * 60}%` }} />
                        <div className={styles.skeletonLine} style={{ width: `${w * 35}%` }} />
                    </div>
                    <div className={styles.skeletonLine} style={{ width: 56 }} />
                </div>
            ))}
        </>
    );
}

// ── Finding detail modal ──────────────────────────────────────────────────────

function FindingDetail({ finding }: { finding: WasteFinding }) {
    const pct = Math.round(finding.confidence_score * 100);

    return (
        <div className={styles.detailGrid}>
            {/* Risk Score */}
            <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Risk Score</span>
                <span className={styles.detailValue} style={{ color: riskScoreColour(finding.risk_level), fontWeight: 700, fontSize: '1.5rem' }}>
                    {finding.risk_score}
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-gray-500)', marginLeft: '0.25rem' }}>/100</span>
                </span>
            </div>

            {/* Risk Level */}
            <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Risk Level</span>
                <span className={`${styles.riskBadge} ${riskBadgeClass(finding.risk_level)}`}>
                    {finding.risk_level}
                </span>
            </div>

            {/* Confidence */}
            <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Confidence</span>
                <div style={{ flex: 1 }}>
                    <span className={styles.detailValue}>{pct}%</span>
                    <div className={styles.confidenceBar}>
                        <div className={styles.confidenceFill} style={{ width: `${pct}%` }} />
                    </div>
                </div>
            </div>

            <div className={styles.detailDivider} />

            {/* Waste Categories */}
            <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Categories</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {finding.waste_categories.map(cat => (
                        <span key={cat} className={styles.categoryTag} style={categoryTagStyle(cat)}>
                            {categoryLabel(cat)}
                        </span>
                    ))}
                </div>
            </div>

            {/* Estimated waste cost */}
            <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Est. Waste Cost</span>
                <span className={finding.estimated_waste_cost ? styles.detailCost : styles.detailValue}>
                    {fmt$(finding.estimated_waste_cost)}
                    {finding.estimated_waste_cost && <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-gray-500)', marginLeft: '0.25rem' }}>/mo</span>}
                </span>
            </div>

            {/* Resource */}
            {typeof finding.resource === 'object' && finding.resource !== null && (
                <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Resource</span>
                    <div>
                        <div className={styles.detailValue}>{(finding.resource as any).resource_name}</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-gray-500)', marginTop: '0.125rem' }}>
                            {(finding.resource as any).resource_type} · {(finding.resource as any).provider_type}
                        </div>
                    </div>
                </div>
            )}

            {/* Timestamp */}
            <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Assessed</span>
                <span className={styles.detailValue}>{fmtDate(finding.assessment_timestamp)}</span>
            </div>

            <div className={styles.detailDivider} />

            {/* Assessment Reason */}
            <div>
                <span className={styles.detailLabel} style={{ display: 'block', marginBottom: '0.625rem' }}>Assessment Reason</span>
                <div className={styles.detailReason}>{finding.assessment_reason}</div>
            </div>
        </div>
    );
}

// ── Main page component ───────────────────────────────────────────────────────

const WasteDetection: React.FC = () => {
    const qc = useQueryClient();
    const [activeFilter, setActiveFilter] = useState<FilterOption>('ALL');
    const [selectedFinding, setSelectedFinding] = useState<WasteFinding | null>(null);
    const [toast, setToast] = useState<ToastMessage | null>(null);

    const showToast = useCallback((msg: ToastMessage) => {
        setToast(msg);
        setTimeout(() => setToast(null), 5000);
    }, []);

    // ── Queries ──────────────────────────────────────────────────────────────
    const { data: summaryData, isLoading: summaryLoading } = useQuery({
        queryKey: ['waste', 'summary'],
        queryFn: () => WasteService.getSummary(),
        retry: 1,
    });

    const { data: findingsData, isLoading: findingsLoading } = useQuery({
        queryKey: ['waste', 'findings', activeFilter],
        queryFn: () => WasteService.getFindings({
            risk_level: activeFilter === 'ALL' ? undefined : activeFilter as RiskLevel,
            limit: 100,
        }),
        retry: 1,
    });

    // ── Analyze mutation ─────────────────────────────────────────────────────
    const analyzeMutation = useMutation({
        mutationFn: WasteService.analyze,
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ['waste'] });
            const n = data.data.totalFindings;
            showToast({
                type: 'success',
                text: n > 0
                    ? `Analysis complete — ${n} waste finding${n > 1 ? 's' : ''} detected.`
                    : 'Analysis complete — no waste detected from available evidence.',
            });
        },
        onError: () => {
            showToast({ type: 'error', text: 'Analysis failed. Please try again.' });
        },
    });

    // ── Finding detail fetch ─────────────────────────────────────────────────
    const { data: detailData, isLoading: detailLoading } = useQuery({
        queryKey: ['waste', 'finding', selectedFinding?._id],
        queryFn: () => WasteService.getFinding(selectedFinding!._id),
        enabled: !!selectedFinding,
        retry: 1,
    });

    const summary = summaryData?.data;
    const findings = findingsData?.data ?? [];
    const total = findingsData?.total ?? 0;

    return (
        <motion.div
            className={styles.container}
            variants={pageVariants}
            initial="hidden"
            animate="visible"
        >
            {/* ── Toast ──────────────────────────────────────────────────────── */}
            <AnimatePresence>
                {toast && (
                    <Toast msg={toast} onDismiss={() => setToast(null)} />
                )}
            </AnimatePresence>

            {/* ── Finding detail modal ────────────────────────────────────────── */}
            <GlassModal
                isOpen={!!selectedFinding}
                onClose={() => setSelectedFinding(null)}
                title="Waste Assessment Detail"
                width="620px"
            >
                <AnimatePresence mode="wait">
                    {detailLoading ? (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-gray-400)', fontSize: '0.9rem' }}
                        >
                            Loading…
                        </motion.div>
                    ) : detailData?.data ? (
                        <motion.div
                            key="detail"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <FindingDetail finding={detailData.data} />
                        </motion.div>
                    ) : selectedFinding ? (
                        <FindingDetail finding={selectedFinding} />
                    ) : null}
                </AnimatePresence>
            </GlassModal>

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <motion.div className={styles.header} variants={itemVariants}>
                <div className={styles.headerText}>
                    <h1 className={styles.title}>Cloud Waste Detection</h1>
                    <p className={styles.subtitle}>
                        Identify idle, underutilized, overprovisioned and other cloud waste using
                        real infrastructure utilization and cost data.
                    </p>
                </div>
                <GlassButton
                    variant="primary"
                    icon={analyzeMutation.isPending ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={15} />}
                    onClick={() => analyzeMutation.mutate()}
                    loading={analyzeMutation.isPending}
                    style={{ flexShrink: 0 }}
                >
                    {analyzeMutation.isPending ? 'Analyzing…' : 'Run Waste Analysis'}
                </GlassButton>
            </motion.div>

            {/* ── Summary stat cards ──────────────────────────────────────────── */}
            <motion.div className={styles.summaryGrid} variants={itemVariants}>
                <GlassStatCard
                    title="Total Findings"
                    value={summary?.totalFindings ?? 0}
                    icon={AlertTriangle}
                    loading={summaryLoading}
                    color="orange"
                />
                <GlassStatCard
                    title="High Risk"
                    value={summary?.highRisk ?? 0}
                    icon={AlertTriangle}
                    loading={summaryLoading}
                    color="red"
                />
                <GlassStatCard
                    title="Critical"
                    value={summary?.criticalRisk ?? 0}
                    icon={Zap}
                    loading={summaryLoading}
                    color="red"
                />
                <GlassStatCard
                    title="Estimated Waste"
                    value={summary ? fmt$(summary.estimatedWasteCost) : '$0.00'}
                    icon={DollarSign}
                    loading={summaryLoading}
                    color="purple"
                />
            </motion.div>

            {/* ── Category pills ──────────────────────────────────────────────── */}
            <motion.div className={styles.categoriesPanel} variants={itemVariants}>
                <h2 className={styles.categoriesTitle}>Waste Categories</h2>
                <div className={styles.categoriesGrid}>
                    {CATEGORIES.map(({ key, label, cat, iconBg, icon: Icon }) => (
                        <motion.div
                            key={cat}
                            className={styles.categoryPill}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                            onClick={() => {
                                setActiveFilter('ALL');
                            }}
                            style={{ cursor: 'default' }}
                        >
                            <div className={styles.categoryIcon} style={{ background: iconBg }}>
                                <Icon size={16} style={{ color: categoryTagStyle(cat).color as string }} />
                            </div>
                            <div className={styles.categoryText}>
                                <div className={styles.categoryLabel}>{label}</div>
                                <div className={styles.categoryCount}>
                                    {summary ? (summary[key] as number) : 0}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {/* ── Findings list ───────────────────────────────────────────────── */}
            <motion.div variants={itemVariants}>
                {/* Filter bar + section title */}
                <div className={styles.filterSection} style={{ marginBottom: '1rem' }}>
                    <span className={styles.sectionTitle}>Findings</span>
                    <div className={styles.filterTabs}>
                        {RISK_FILTERS.map(f => (
                            <button
                                key={f}
                                className={`${styles.filterTab} ${activeFilter === f ? styles.filterTabActive : ''}`}
                                onClick={() => setActiveFilter(f)}
                            >
                                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={styles.findingsPanel}>
                    <div className={styles.findingsHeader}>
                        <span className={styles.findingsTitle}>Waste Assessments</span>
                        {!findingsLoading && (
                            <span className={styles.findingsCount}>
                                {total} {total === 1 ? 'finding' : 'findings'}
                            </span>
                        )}
                    </div>

                    {/* Content */}
                    {findingsLoading ? (
                        <FindingSkeleton />
                    ) : findings.length === 0 ? (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}>
                                <Server size={24} />
                            </div>
                            <div className={styles.emptyTitle}>
                                {activeFilter === 'ALL'
                                    ? 'No waste findings detected yet'
                                    : `No ${activeFilter.toLowerCase()} risk findings`}
                            </div>
                            <p className={styles.emptySubtitle}>
                                {activeFilter === 'ALL'
                                    ? 'Run a Waste Analysis to scan your cloud resources. The engine requires sufficient metric and cost observations to confidently identify waste — ensure your resources are actively sending telemetry.'
                                    : `No findings at the ${activeFilter.toLowerCase()} risk level. Try a different filter or run a new analysis.`}
                            </p>
                            {activeFilter === 'ALL' && (
                                <GlassButton
                                    variant="primary"
                                    icon={<Zap size={14} />}
                                    onClick={() => analyzeMutation.mutate()}
                                    loading={analyzeMutation.isPending}
                                    size="sm"
                                >
                                    Run Waste Analysis
                                </GlassButton>
                            )}
                        </div>
                    ) : (
                        <AnimatePresence initial={false}>
                            {findings.map((finding, i) => (
                                <motion.div
                                    key={finding._id}
                                    className={styles.findingRow}
                                    variants={rowVariants}
                                    initial="hidden"
                                    animate="visible"
                                    transition={{ delay: i * 0.04 }}
                                    onClick={() => setSelectedFinding(finding)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={e => e.key === 'Enter' && setSelectedFinding(finding)}
                                >
                                    {/* Risk dot */}
                                    <div className={`${styles.riskIndicator} ${dotClass(finding.risk_level)}`} />

                                    {/* Resource + categories */}
                                    <div className={styles.findingMain}>
                                        <div className={styles.findingResource}>{resourceName(finding)}</div>
                                        <div className={styles.findingMeta}>
                                            <span className={styles.findingType}>{resourceType(finding)}</span>
                                            {finding.waste_categories.slice(0, 2).map(cat => (
                                                <span key={cat} className={styles.categoryTag} style={categoryTagStyle(cat)}>
                                                    {categoryLabel(cat)}
                                                </span>
                                            ))}
                                            {finding.waste_categories.length > 2 && (
                                                <span className={styles.categoryTag} style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--color-gray-500)' }}>
                                                    +{finding.waste_categories.length - 2}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Risk score */}
                                    <div className={styles.riskScore}>
                                        <div className={styles.riskScoreValue} style={{ color: riskScoreColour(finding.risk_level) }}>
                                            {finding.risk_score}
                                        </div>
                                        <div className={styles.riskScoreLabel}>score</div>
                                    </div>

                                    {/* Risk badge */}
                                    <span className={`${styles.riskBadge} ${riskBadgeClass(finding.risk_level)}`}>
                                        {finding.risk_level}
                                    </span>

                                    {/* Waste cost */}
                                    <div className={`${styles.wasteCost} ${finding.estimated_waste_cost ? '' : styles.wasteCostNa}`}>
                                        {finding.estimated_waste_cost ? fmt$(finding.estimated_waste_cost) : '—'}
                                        {finding.estimated_waste_cost && (
                                            <div style={{ fontSize: '0.6875rem', color: 'var(--color-gray-400)', fontWeight: 400 }}>/mo</div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

export default WasteDetection;
