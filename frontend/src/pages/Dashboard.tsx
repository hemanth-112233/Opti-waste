import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import {
    Server, DollarSign,
    Cloud, PlayCircle, TrendingDown,
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { format, parseISO } from 'date-fns';

import { ResourceService } from '../api/resources';
import { MetricService } from '../api/metrics';
import { CostService } from '../api/costs';
import { ProviderService } from '../api/providers';
import { useAuthStore } from '../store/useAuthStore';

import GlassStatCard from '../components/ui/GlassStatCard';
import ChartContainer from '../components/ui/ChartContainer';
import GlassCard from '../components/ui/GlassCard';
import GlassTable from '../components/ui/GlassTable';
import EmptyState from '../components/ui/EmptyState';

// ── Import shared motion system (Step 1) ──────────────────────────────────────
import {
    spring,
    fadeUp,
    staggerContainer,
    reduceMotion,
} from '../lib/motionSystem';

import styles from './Dashboard.module.css';
import OptiWasteCloudVisual from '../components/visuals/OptiWasteCloudVisual';

// ── Apple System color palette for charts ─────────────────────────────────────
const COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#5856D6', '#AF52DE', '#FF2D55'];

// ── Framer Motion container variants (uses shared stagger preset) ─────────────
const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.07, delayChildren: 0.04 },
    },
};

const itemVariants = {
    hidden: fadeUp.hidden,
    show: { ...fadeUp.visible, transition: reduceMotion(spring.standard) },
};

// ── Custom Glass Tooltip ──────────────────────────────────────────────────────
const GlassTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={reduceMotion({ duration: 0.12 })}
            style={{
                background: 'var(--lg-surface-solid)',
                backdropFilter: 'var(--lg-blur-md)',
                WebkitBackdropFilter: 'var(--lg-blur-md)',
                border: '1px solid var(--lg-border-bright)',
                borderRadius: 'var(--radius-lg)',
                padding: '0.65rem 0.9rem',
                boxShadow: 'var(--lg-shadow-float)',
                fontSize: '0.8rem',
                color: 'var(--color-gray-900)',
                pointerEvents: 'none',
                minWidth: 110,
            }}
        >
            {label && (
                <div style={{
                    fontWeight: 600, marginBottom: 4,
                    color: 'var(--color-gray-500)',
                    fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                    {label}
                </div>
            )}
            {payload.map((entry: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
                    <span style={{ color: 'var(--color-gray-500)', fontSize: '0.77rem' }}>{entry.name}:</span>
                    <span style={{ fontWeight: 650, color: 'var(--color-gray-900)' }}>
                        {typeof entry.value === 'number' && entry.name?.toLowerCase().includes('cost')
                            ? `$${entry.value.toFixed(2)}`
                            : entry.value}
                    </span>
                </div>
            ))}
        </motion.div>
    );
};

// ── CWRI Ring SVG — null-safe: score=null shows '—' with empty ring ──────────
const CWRIRing: React.FC<{ score: number | null; color: string }> = ({ score, color }) => {
    const reducedMotion = useReducedMotion();
    const effective = score ?? 0;
    const [displayed, setDisplayed] = useState(0);
    useEffect(() => {
        if (reducedMotion) { setDisplayed(effective); return; }
        const t = setTimeout(() => setDisplayed(effective), 120);
        return () => clearTimeout(t);
    }, [effective, reducedMotion]);

    const r = 48;
    const circ = 2 * Math.PI * r;
    const filled = circ * (displayed / 100);

    return (
        <motion.svg
            width="116" height="116" viewBox="0 0 120 120"
            className={styles.cwriRing}
            animate={reducedMotion ? {} : {
                filter: [
                    `drop-shadow(0 0 6px ${color}33)`,
                    `drop-shadow(0 0 14px ${color}55)`,
                    `drop-shadow(0 0 6px ${color}33)`,
                ],
            }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        >
            {/* Ambient glow */}
            <circle cx="60" cy="60" r={r}
                fill="none" stroke={color} strokeWidth="16" opacity={0.08} />
            {/* Track */}
            <circle cx="60" cy="60" r={r}
                fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="10" />
            {/* Progress ring */}
            <circle
                cx="60" cy="60" r={r}
                fill="none"
                stroke={color}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${filled} ${circ - filled}`}
                strokeDashoffset={circ * 0.25}
                style={{ transition: reducedMotion ? undefined : 'stroke-dasharray 1.3s cubic-bezier(0.34,1.20,0.64,1)' }}
            />
            <text x="60" y="56" textAnchor="middle"
                fill={score !== null ? 'var(--color-gray-900)' : 'var(--color-gray-400)'}
                fontSize="20" fontWeight="700"
                fontFamily="-apple-system,BlinkMacSystemFont,'SF Pro Display',Inter,sans-serif">
                {score ?? '—'}
            </text>
            <text x="60" y="71" textAnchor="middle"
                fill="var(--color-gray-400)" fontSize="10" fontWeight="500"
                fontFamily="-apple-system,sans-serif">/ 100</text>
        </motion.svg>
    );
};

// ── Mini Stat Panel (lightweight secondary KPI) ───────────────────────────────
const MiniStat: React.FC<{
    label: string;
    value: string | number;
    sub?: string;
}> = ({ label, value, sub }) => (
    <div className={styles.miniStatPanel}>
        <div className={styles.miniStatEyebrow}>{label}</div>
        <div className={styles.miniStatValue}>{value}</div>
        {sub && <div className={styles.miniStatSub}>{sub}</div>}
    </div>
);

// ── Dashboard ─────────────────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
    const { user } = useAuthStore();
    const firstName = (() => {
        if (!user?.name) return null;
        const first = user.name.trim().split(/\s+/)[0];
        return first.includes('-') ? null : first;
    })();

    // ── All existing API hooks preserved unchanged ──────────────────────────
    const { data: resSummary, isLoading: loadingRes } = useQuery({
        queryKey: ['resourceSummary'], queryFn: () => ResourceService.getDashboardSummary(),
    });
    const { data: metricSummary, isLoading: loadingMet } = useQuery({
        queryKey: ['metricSummary'], queryFn: () => MetricService.getDashboardSummary(),
    });
    const { data: costSummary, isLoading: loadingCost } = useQuery({
        queryKey: ['costSummary'], queryFn: () => CostService.getDashboardSummary(),
    });
    const { data: providers, isLoading: loadingProv } = useQuery({
        queryKey: ['providers'], queryFn: () => ProviderService.getAll(0, 50),
    });
    const { data: resources } = useQuery({
        queryKey: ['resources'], queryFn: () => ResourceService.getAll(0, 500),
    });
    const { data: metricHistory } = useQuery({
        queryKey: ['metricHistory'], queryFn: () => MetricService.getAll(0, 100),
    });
    const { data: costHistory } = useQuery({
        queryKey: ['costHistory'], queryFn: () => CostService.getAll(0, 100),
    });

    // ── Derived data ────────────────────────────────────────────────────────
    // CWRI score — null when metricSummary is absent (avoids fabricated ?? 50 fallback)
    const cwriScore: number | null = useMemo(() => {
        if (!metricSummary) return null;
        const avgCpu = metricSummary.avg_cpu_utilization;
        const avgMem = metricSummary.avg_memory_utilization;
        if (avgCpu == null && avgMem == null) return null;
        const utilization = ((avgCpu ?? 0) + (avgMem ?? 0)) / 2;
        return Math.round(Math.max(5, Math.min(95, 100 - utilization * 0.8)));
    }, [metricSummary]);

    const cwriColor = cwriScore === null ? '#8A8A8F' : cwriScore < 35 ? '#34C759' : cwriScore < 65 ? '#FF9500' : '#FF3B30';
    const cwriStatusClass = cwriScore === null ? styles.cwriStatusNeutral : cwriScore < 35 ? styles.cwriStatusLow : cwriScore < 65 ? styles.cwriStatusMedium : styles.cwriStatusHigh;
    const cwriLabel = cwriScore === null ? '● Awaiting Data' : cwriScore < 35 ? '● Low Risk' : cwriScore < 65 ? '● Moderate Risk' : '● High Risk';

    const resourceDistData = useMemo(() => {
        if (!resources?.length) return [];
        const acc: Record<string, number> = {};
        resources.forEach((r: any) => { const k = r.resource_type || 'Unknown'; acc[k] = (acc[k] || 0) + 1; });
        return Object.keys(acc).map(k => ({ name: k, value: acc[k] }));
    }, [resources]);

    const regionDistData = useMemo(() => {
        if (!resources?.length) return [];
        const acc: Record<string, number> = {};
        resources.forEach((r: any) => { const k = r.region || 'Unknown'; acc[k] = (acc[k] || 0) + 1; });
        return Object.keys(acc).map(k => ({ name: k, value: acc[k] }));
    }, [resources]);

    const providerCostData = useMemo(() => {
        if (!costSummary?.cost_by_provider) return [];
        return costSummary.cost_by_provider.map((c: any) => ({
            name: c._id || 'Unknown',
            cost: c.provider_total || 0,
        }));
    }, [costSummary]);

    const trendMetricsData = useMemo(() => {
        if (!metricHistory?.length) return [];
        return [...metricHistory]
            .sort((a, b) => new Date(a.metric_timestamp).getTime() - new Date(b.metric_timestamp).getTime())
            .map((m: any) => ({
                time: format(parseISO(m.metric_timestamp), 'HH:mm'),
                cpu: m.cpu_utilization || 0,
                memory: m.memory_utilization || 0,
            }));
    }, [metricHistory]);

    const costTrendData = useMemo(() => {
        if (!costHistory?.length) return [];
        return [...costHistory]
            .sort((a, b) => new Date(a.cost_timestamp || a.created_at).getTime() - new Date(b.cost_timestamp || b.created_at).getTime())
            .map((c: any) => ({
                time: format(parseISO(c.cost_timestamp || c.created_at), 'MM/dd'),
                cost: c.daily_cost || 0,
            }));
    }, [costHistory]);

    const topResources = costSummary?.highest_cost_resources?.slice(0, 5) || [];
    // null = API not yet returned data; 0 = real zero from backend
    const totalMonthlyCost: number | null = costSummary?.total_monthly_cost ?? null;

    // Returns '—' for null (no data), formatted currency for real values
    const fmt$ = (n: number | null) =>
        n !== null
            ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
            : '—';

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className={styles.dashboardContainer}
        >
            {/* ── Hero environment: visual + hero text + CWRI panel ────────── */}
            <div className={styles.heroEnvironment}>
                {/* Atmospheric cloud visual — sits behind all glass content */}
                <OptiWasteCloudVisual
                    compact
                    predictedSavings={totalMonthlyCost ?? 0}
                    actualSavings={totalMonthlyCost ?? 0}
                    wasteDetected={cwriScore !== null && cwriScore >= 50}
                    className={styles.heroVisualLayer}
                />

                {/* Two-column content above the cloud visual */}
                <div className={styles.heroContent}>

                    {/* ── LEFT: Greeting text */}
                    <div className={styles.heroLeft}>
                        <motion.header variants={itemVariants} className={styles.heroSection}>
                            <div className={styles.heroEyebrow}>Cloud FinOps Intelligence</div>
                            <h1 className={styles.heroTitle}>
                                {firstName ? `Good morning, ${firstName}.` : 'Cloud Overview'}
                            </h1>
                            <p className={styles.heroSubtitle}>
                                Your cloud activity and financial intelligence for today.
                            </p>
                        </motion.header>
                    </div>

                    {/* ── RIGHT: CWRI horizontal glass panel — 3-column layout */}
                    <div className={styles.heroRight}>
                        <motion.div variants={itemVariants}>
                            <div className={styles.cwriPanel}>

                                {/* Col 1 — title + context description */}
                                <div className={styles.cwriLeft}>
                                    <p className={styles.cwriLabel}>Cloud Waste Risk Index</p>
                                    <p className={styles.cwriMeta}>
                                        {metricSummary
                                            ? 'Risk assessed from current CPU & memory utilization readings.'
                                            : 'Risk assessment will appear when resource telemetry is available.'}
                                    </p>
                                </div>

                                {/* Col 2 — large numeric score */}
                                <div className={styles.cwriCenter}>
                                    <div className={styles.cwriScoreCenter} style={{ color: cwriColor }}>
                                        {cwriScore ?? '—'}
                                    </div>
                                    <div className={styles.cwriScoreSub}>/ 100</div>
                                    <span className={`${styles.cwriStatus} ${cwriStatusClass}`}>
                                        {cwriLabel}
                                    </span>
                                </div>

                                {/* Col 3 — ring + mini stats */}
                                <div className={styles.cwriRight}>
                                    <CWRIRing score={cwriScore} color={cwriColor} />
                                    <div className={styles.cwriStats}>
                                        <div className={styles.cwriStat}>
                                            <span className={styles.cwriStatValue}>
                                                {metricSummary?.avg_cpu_utilization != null
                                                    ? `${Math.round(metricSummary.avg_cpu_utilization * 10) / 10}%`
                                                    : '—'}
                                            </span>
                                            <span className={styles.cwriStatLabel}>Avg CPU</span>
                                        </div>
                                        <div className={styles.cwriStat}>
                                            <span className={styles.cwriStatValue}>
                                                {metricSummary?.avg_memory_utilization != null
                                                    ? `${Math.round(metricSummary.avg_memory_utilization * 10) / 10}%`
                                                    : '—'}
                                            </span>
                                            <span className={styles.cwriStatLabel}>Avg Memory</span>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* ── Primary KPI Cards ──────────────────────────────────────── */}
            <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className={styles.gridCards}
            >
                {[
                    {
                        title: 'Monthly Cost', color: 'blue' as const,
                        value: fmt$(totalMonthlyCost),
                        icon: DollarSign, loading: loadingCost,
                        // No month-over-month API data — trend omitted
                    },
                    {
                        title: 'Total Resources', color: 'purple' as const,
                        value: resSummary?.total_resources || 0,
                        icon: Server, loading: loadingRes,
                    },
                    {
                        title: 'Running Instances', color: 'green' as const,
                        value: metricSummary?.running_instances_metrics || 0,
                        icon: PlayCircle, loading: loadingMet,
                    },
                    {
                        title: 'Active Providers', color: 'gray' as const,
                        value: providers ? providers.length : 0,
                        icon: Cloud, loading: loadingProv,
                    },
                ].map(card => (
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

            {/* ── Intelligence Triptych ─────────────────────────────────── */}
            <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>Spend Intelligence</span>
            </div>
            <motion.div variants={itemVariants} className={styles.triptych}>
                <MiniStat
                    label="Daily Average"
                    value={totalMonthlyCost !== null ? `$${(totalMonthlyCost / 30).toFixed(2)}` : '—'}
                    sub="Avg daily spend across all providers"
                />
                <MiniStat
                    label="Potential Savings"
                    value="—"
                    sub="Connect cost optimization module to unlock savings forecasts."
                />
                <MiniStat
                    label="Utilization Score"
                    value={
                        metricSummary?.avg_cpu_utilization != null || metricSummary?.avg_memory_utilization != null
                            ? `${Math.round(((metricSummary.avg_cpu_utilization ?? 0) + (metricSummary.avg_memory_utilization ?? 0)) / 2)}%`
                            : '—'
                    }
                    sub="Avg compute utilization (CPU + Memory)"
                />
            </motion.div>

            {/* ── Separator ─────────────────────────────────────────────── */}
            <div className={styles.dividerRow}>
                <div className={styles.dividerLine} />
                <span className={styles.dividerLabel}>Cost & Performance Trends</span>
                <div className={styles.dividerLine} />
            </div>

            {/* ── Main Charts ────────────────────────────────────────────── */}
            <motion.div
                className={styles.gridCharts}
                variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.1 } } }}
                initial="hidden"
                animate="show"
            >
                <motion.div variants={itemVariants}>
                    <ChartContainer title="Daily Cost Trajectory" description="Aggregated trailing costs">
                        {!costTrendData.length && !loadingCost ? (
                            <EmptyState message="No cost pipelines detected." />
                        ) : (
                            <LineChart data={costTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                                <XAxis dataKey="time" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                <Tooltip content={<GlassTooltip />} cursor={{ stroke: 'rgba(0,0,0,0.06)', strokeWidth: 1 }} />
                                <Line
                                    type="monotone" name="Daily Cost ($)" dataKey="cost"
                                    stroke="#007AFF" strokeWidth={2.5} dot={false}
                                    activeDot={{ r: 5, fill: '#007AFF', stroke: '#fff', strokeWidth: 2 }}
                                />
                            </LineChart>
                        )}
                    </ChartContainer>
                </motion.div>
                <motion.div variants={itemVariants}>
                    <ChartContainer title="Compute Telemetry" description="Live CPU & Memory utilization">
                        {!trendMetricsData.length && !loadingMet ? (
                            <EmptyState message="No telemetry recorded." />
                        ) : (
                            <AreaChart data={trendMetricsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#34C759" stopOpacity={0.30} />
                                        <stop offset="95%" stopColor="#34C759" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#AF52DE" stopOpacity={0.30} />
                                        <stop offset="95%" stopColor="#AF52DE" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                                <XAxis dataKey="time" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                <Tooltip content={<GlassTooltip />} />
                                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: '0.78rem' }} />
                                <Area type="monotone" name="CPU %" dataKey="cpu" stroke="#34C759" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" />
                                <Area type="monotone" name="Memory %" dataKey="memory" stroke="#AF52DE" strokeWidth={2} fillOpacity={1} fill="url(#colorMem)" />
                            </AreaChart>
                        )}
                    </ChartContainer>
                </motion.div>
            </motion.div>

            {/* ── Separator ─────────────────────────────────────────────── */}
            <div className={styles.dividerRow}>
                <div className={styles.dividerLine} />
                <span className={styles.dividerLabel}>Distribution & Topology</span>
                <div className={styles.dividerLine} />
            </div>

            {/* ── Small Charts ───────────────────────────────────────────── */}
            <motion.div
                className={styles.gridChartsSmall}
                variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.10, delayChildren: 0.08 } } }}
                initial="hidden"
                animate="show"
            >
                <motion.div variants={itemVariants}>
                    <ChartContainer title="By Service Class" height={240} loading={loadingRes}>
                        {!resourceDistData.length ? <EmptyState message="No deployments." /> : (
                            <PieChart>
                                <Pie
                                    data={resourceDistData} cx="50%" cy="50%"
                                    innerRadius={55} outerRadius={78} paddingAngle={3}
                                    dataKey="value" stroke="none"
                                >
                                    {resourceDistData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                                </Pie>
                                <Tooltip content={<GlassTooltip />} />
                                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: '0.75rem' }} />
                            </PieChart>
                        )}
                    </ChartContainer>
                </motion.div>
                <motion.div variants={itemVariants}>
                    <ChartContainer title="Global Regions" height={240} loading={loadingRes}>
                        {!regionDistData.length ? <EmptyState message="No regions detected." /> : (
                            <BarChart data={regionDistData} layout="vertical" margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(0,0,0,0.025)' }} />
                                <Bar dataKey="value" name="Resources" radius={[0, 6, 6, 0]}>
                                    {regionDistData.map((_: any, idx: number) => <Cell key={idx} fill={COLORS[(idx + 1) % COLORS.length]} />)}
                                </Bar>
                            </BarChart>
                        )}
                    </ChartContainer>
                </motion.div>
                <motion.div variants={itemVariants}>
                    <ChartContainer title="Cost by Provider" height={240} loading={loadingCost}>
                        {!providerCostData.length ? <EmptyState message="No bills." /> : (
                            <PieChart>
                                <Pie
                                    data={providerCostData} cx="50%" cy="50%"
                                    outerRadius={78} dataKey="cost" paddingAngle={3} stroke="none"
                                >
                                    {providerCostData.map((_: any, idx: number) => <Cell key={idx} fill={COLORS[(idx + 2) % COLORS.length]} />)}
                                </Pie>
                                <Tooltip content={<GlassTooltip />} formatter={(v: any) => `$${Number(v).toFixed(2)}`} />
                                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: '0.75rem' }} />
                            </PieChart>
                        )}
                    </ChartContainer>
                </motion.div>
            </motion.div>

            {/* ── Top Resources Table ────────────────────────────────────── */}
            <motion.div variants={itemVariants} className={styles.bottomSection}>
                <GlassCard className={styles.tableCard}>
                    <div className={styles.tableHeader}>
                        <div>
                            <h3 className={styles.tableTitle}>Top 5 Most Expensive Resources</h3>
                            <p className={styles.tableDesc}>Tracked by descending monthly billing rates.</p>
                        </div>
                        <TrendingDown
                            size={17}
                            style={{ color: 'var(--color-system-orange)', marginTop: 4, flexShrink: 0 }}
                        />
                    </div>
                    <GlassTable
                        columns={[
                            {
                                key: 'id', header: 'Resource ID',
                                render: (item) => (
                                    <span style={{
                                        fontFamily: 'monospace',
                                        color: 'var(--color-system-blue)',
                                        fontSize: '0.82rem',
                                    }}>
                                        {item.id.substring(0, 16)}…
                                    </span>
                                ),
                            },
                            {
                                key: 'resource_name', header: 'Entity',
                                render: (item) => item.resource_name || 'N/A',
                            },
                            {
                                key: 'monthly_cost', header: 'Monthly', align: 'right',
                                render: (item) =>
                                    `$${parseFloat(item.monthly_cost).toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}`,
                            },
                        ]}
                        data={topResources}
                        keyExtractor={(item) => item.id}
                        loading={loadingCost}
                        emptyMessage="No costly resources found yet."
                    />
                </GlassCard>
            </motion.div>

        </motion.div>
    );
};

export default Dashboard;
