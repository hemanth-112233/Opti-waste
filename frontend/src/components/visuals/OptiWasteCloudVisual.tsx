/**
 * OptiWasteCloudVisual.tsx — Step 5: True 3D Cloud Hero
 *
 * PSEUDO-3D DEPTH TECHNIQUE (no Three.js):
 *   The cloud now has FIVE distinct depth layers working together to create
 *   a convincing volumetric appearance:
 *
 *   Layer 0 — Floor shadow     (blurred dark ellipse below cloud = elevation)
 *   Layer 1 — Back atmospheric (large, heavy blur, blue-gray haze behind cloud)
 *   Layer 2 — Main cloud body  (blue-lavender, feColorMatrix + shadow filter)
 *   Layer 3 — Inner gradient   (radial lavender depth)
 *   Layer 4 — Phase tint       (state-based amber/green overlay)
 *   Layer 5 — Front highlight  (bright white top-lobes = sunlit surface)
 *   Layer 6 — Directional glow (top-right white patch = single light source)
 *   Layer 7 — Moving light globe
 *   Layer 8 — Energy wave ring (animated dashed orbit = telemetry field)
 *   Layer 9 — Specular + sweep + text
 *
 * Each node also has an elevation shadow ellipse (floating = 3D perceived depth).
 *
 * SVG coordinate rule: ALL filtered <g> elements use ABSOLUTE cx coordinates
 * (cx = CX + b.cx) to prevent Framer Motion CSS transform / SVG filter region
 * offset bug identified in Step 4D.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    motion,
    useMotionValue,
    useTransform,
    useReducedMotion,
    AnimatePresence,
} from 'framer-motion';
import { spring } from '../../lib/motionSystem';
import styles from './OptiWasteCloudVisual.module.css';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OptiWasteCloudVisualProps {
    predictedSavings?: number;
    actualSavings?: number;
    wasteDetected?: boolean;
    compact?: boolean;
    className?: string;
}

type WavePhase = 'idle' | 'waste' | 'optimizing' | 'saved';

// ─── Layout constants ─────────────────────────────────────────────────────────

const VW = 640;
const VH = 460;
const CX = VW / 2;        // 320
const CY = VH * 0.435;   // ~200

// ─── Satellites ───────────────────────────────────────────────────────────────

const SATELLITES = [
    { id: 'compute', label: 'CPU', angle: -90, r: 215 },
    { id: 'storage', label: 'Storage', angle: -28, r: 215 },
    { id: 'database', label: 'DB', angle: 38, r: 215 },
    { id: 'network', label: 'NET', angle: 98, r: 215 },
    { id: 'container', label: 'K8S', angle: 155, r: 215 },
    { id: 'vm', label: 'VM', angle: 215, r: 215 },
] as const;

const WASTE_IDX = 2;
const DEG = (a: number) => (a * Math.PI) / 180;
const satPos = (angle: number, r: number) => ({
    x: CX + Math.cos(DEG(angle)) * r,
    y: CY + Math.sin(DEG(angle)) * r,
});

const FLOAT_CFG = [
    { xA: 4, yA: 7, dur: 6.2, del: 0.0, orb: 3 },
    { xA: 5, yA: 4, dur: 5.5, del: 1.1, orb: 4 },
    { xA: 3, yA: 7, dur: 6.8, del: 1.8, orb: 3 },
    { xA: 6, yA: 3, dur: 5.8, del: 0.6, orb: 5 },
    { xA: 4, yA: 6, dur: 7.2, del: 2.2, orb: 3 },
    { xA: 6, yA: 4, dur: 5.2, del: 0.9, orb: 4 },
];

const PHASE_LABELS: Record<WavePhase, string | null> = {
    idle: null, waste: 'WASTE DETECTED', optimizing: 'OPTIMIZING', saved: 'SAVINGS +',
};
const PHASE_DUR: Record<WavePhase, number> = {
    idle: 9000, waste: 2800, optimizing: 2800, saved: 2200,
};
const PHASE_ORDER: WavePhase[] = ['idle', 'waste', 'optimizing', 'saved'];

// ─── Cloud blobs ──────────────────────────────────────────────────────────────

const CLOUD_BLOBS = [
    { cx: 0, cy: 32, rx: 148, ry: 82, op: 0.95 },
    { cx: -108, cy: 14, rx: 82, ry: 68, op: 0.90 },
    { cx: 112, cy: 8, rx: 86, ry: 70, op: 0.90 },
    { cx: 8, cy: -52, rx: 96, ry: 74, op: 0.92 },
    { cx: -132, cy: -20, rx: 72, ry: 62, op: 0.86 },
    { cx: 136, cy: -18, rx: 74, ry: 63, op: 0.86 },
    { cx: -62, cy: -105, rx: 54, ry: 44, op: 0.82 },
    { cx: 70, cy: -104, rx: 56, ry: 45, op: 0.82 },
];

// Subset of upper blobs only — used for the front highlight (sunlit top surface)
const FRONT_BLOBS = [
    { cx: 8, cy: -52, rx: 96 * 0.72, ry: 74 * 0.72 },
    { cx: -62, cy: -105, rx: 54 * 0.68, ry: 44 * 0.68 },
    { cx: 70, cy: -104, rx: 56 * 0.68, ry: 45 * 0.68 },
    { cx: -132, cy: -20, rx: 72 * 0.60, ry: 62 * 0.60 },
    { cx: 136, cy: -18, rx: 74 * 0.60, ry: 63 * 0.60 },
];

const SR = 22;

// ─── SVG Node Icons ───────────────────────────────────────────────────────────

const NodeIcon: React.FC<{
    nodeId: string; iconColor: string;
    wasteColor: string; isWaste: boolean; phase: WavePhase;
}> = ({ nodeId, iconColor, wasteColor, isWaste, phase }) => {
    const c = (isWaste && phase !== 'idle') ? wasteColor : iconColor;
    const fO = (isWaste && phase !== 'idle') ? 0.45 : 0.28;
    switch (nodeId) {
        case 'compute':
            return (
                <g stroke={c} strokeWidth={1.25} fill="none" strokeLinecap="round">
                    <rect x="-5" y="-5" width="10" height="10" rx="1.4" />
                    <rect x="-2.2" y="-2.2" width="4.4" height="4.4" rx="0.6"
                        fill={c} fillOpacity={fO} stroke="none" />
                    <line x1="-2" y1="-5" x2="-2" y2="-7.2" />
                    <line x1="2" y1="-5" x2="2" y2="-7.2" />
                    <line x1="-2" y1="5" x2="-2" y2="7.2" />
                    <line x1="2" y1="5" x2="2" y2="7.2" />
                    <line x1="-5" y1="-2" x2="-7.2" y2="-2" />
                    <line x1="-5" y1="2" x2="-7.2" y2="2" />
                    <line x1="5" y1="-2" x2="7.2" y2="-2" />
                    <line x1="5" y1="2" x2="7.2" y2="2" />
                </g>
            );
        case 'storage':
            return (
                <g stroke={c} strokeWidth={1.25} fill="none">
                    <ellipse cx="0" cy="-4" rx="6" ry="2" />
                    <ellipse cx="0" cy="-4" rx="6" ry="2" fill={c} fillOpacity={fO * 0.8} stroke="none" />
                    <line x1="-6" y1="-4" x2="-6" y2="2" />
                    <line x1="6" y1="-4" x2="6" y2="2" />
                    <ellipse cx="0" cy="2" rx="6" ry="2" />
                    <ellipse cx="0" cy="2" rx="6" ry="2" fill={c} fillOpacity={fO * 0.5} stroke="none" />
                    <line x1="-2.5" y1="-4" x2="2.5" y2="-4" strokeWidth={2} stroke={c} />
                </g>
            );
        case 'database':
            return (
                <g stroke={c} strokeWidth={1.25} fill="none">
                    <ellipse cx="0" cy="-5" rx="5.2" ry="1.8" />
                    <ellipse cx="0" cy="-5" rx="5.2" ry="1.8" fill={c} fillOpacity={fO} stroke="none" />
                    <line x1="-5.2" y1="-5" x2="-5.2" y2="4.5" />
                    <line x1="5.2" y1="-5" x2="5.2" y2="4.5" />
                    <ellipse cx="0" cy="4.5" rx="5.2" ry="1.8" />
                    <ellipse cx="0" cy="-0.5" rx="5.2" ry="1.8" />
                </g>
            );
        case 'network':
            return (
                <g fill={c} strokeLinecap="round">
                    <circle cx="0" cy="-6" r="2.2" fillOpacity={0.85} />
                    <circle cx="-5.5" cy="4" r="2" fillOpacity={0.85} />
                    <circle cx="5.5" cy="4" r="2" fillOpacity={0.85} />
                    <line x1="0" y1="-3.8" x2="-4.2" y2="2.2" stroke={c} strokeWidth={1.25} fill="none" />
                    <line x1="0" y1="-3.8" x2="4.2" y2="2.2" stroke={c} strokeWidth={1.25} fill="none" />
                    <line x1="-3.5" y1="4" x2="3.5" y2="4" stroke={c} strokeWidth={1.25} fill="none" />
                </g>
            );
        case 'container': {
            const angles = [0, 60, 120, 180, 240, 300];
            return (
                <g fill="none" stroke={c} strokeWidth={1.25} strokeLinejoin="round">
                    <polygon points={angles.map(a => {
                        const r = DEG(a);
                        return `${Math.cos(r) * 7},${Math.sin(r) * 7}`;
                    }).join(' ')} />
                    <circle cx="0" cy="0" r="2.5" fill={c} fillOpacity={fO} stroke="none" />
                    {angles.map(a => {
                        const r = DEG(a);
                        return (
                            <line key={a}
                                x1={Math.cos(r) * 2.5} y1={Math.sin(r) * 2.5}
                                x2={Math.cos(r) * 7} y2={Math.sin(r) * 7}
                            />
                        );
                    })}
                </g>
            );
        }
        case 'vm':
            return (
                <g fill="none" stroke={c} strokeWidth={1.25} strokeLinecap="round">
                    <rect x="-6.5" y="-5.5" width="13" height="8.5" rx="1.5" />
                    <line x1="-2.5" y1="3" x2="-2.5" y2="5.5" />
                    <line x1="2.5" y1="3" x2="2.5" y2="5.5" />
                    <line x1="-4" y1="5.5" x2="4" y2="5.5" />
                    <line x1="-4" y1="-2.5" x2="-0.5" y2="-2.5" strokeOpacity={0.55} />
                    <line x1="-4" y1="-0.5" x2="2" y2="-0.5" strokeOpacity={0.55} />
                </g>
            );
        default:
            return null;
    }
};

// ─── SatelliteNode ────────────────────────────────────────────────────────────

const SatelliteNode: React.FC<{
    nodeId: string; label: string;
    bx: number; by: number;
    cfg: typeof FLOAT_CFG[number];
    isWaste: boolean; phase: WavePhase;
    reducedMotion: boolean;
}> = ({ nodeId, label, bx, by, cfg, isWaste, phase, reducedMotion }) => {
    const iconColor = 'rgba(55,62,105,0.80)';
    const wasteColor = phase === 'optimizing' || phase === 'saved'
        ? 'rgba(28,142,52,0.92)' : 'rgba(192,88,0,0.92)';

    return (
        <motion.g
            animate={reducedMotion ? {} : {
                x: [0, cfg.xA, cfg.orb, -cfg.xA, -cfg.orb * 0.6, 0],
                y: [0, -cfg.yA, cfg.orb * 0.5, cfg.yA * 0.8, -cfg.orb * 0.4, 0],
            }}
            transition={reducedMotion ? {} : {
                duration: cfg.dur, delay: cfg.del, repeat: Infinity, ease: 'easeInOut',
            }}
            style={{ willChange: 'transform' }}
        >
            <g transform={`translate(${bx}, ${by})`}>
                {/* ── Elevation shadow — node "floats" above environment */}
                <ellipse cx={0} cy={SR + 6} rx={SR + 3} ry={5}
                    fill="rgba(70,80,160,0.14)"
                    style={{ filter: 'blur(4px)' }}
                />

                {/* Waste pulse ring */}
                {/* Waste pulse ring — cx/cy explicit at 0,0 since parent <g> is already translated */}
                <AnimatePresence>
                    {isWaste && (phase === 'waste' || phase === 'optimizing') && (
                        <motion.circle cx={0} cy={0} r={SR + 10} fill="none"
                            stroke={phase === 'optimizing' ? 'rgba(52,199,89,0.55)' : 'rgba(255,149,0,0.60)'}
                            strokeWidth={1.6}
                            initial={{ opacity: 0, scale: 0.7 }}
                            animate={reducedMotion ? { opacity: 0.5 } : {
                                opacity: [0.2, 0.78, 0.2], scale: [0.86, 1.18, 0.86],
                            }}
                            exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.35 } }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                    )}
                </AnimatePresence>

                {/* Glass halo */}
                <circle r={SR + 4} fill="rgba(255,255,255,0.18)"
                    stroke="rgba(255,255,255,0.32)" strokeWidth={0.8} />

                {/* Main glass body */}
                <motion.circle r={SR}
                    fill={isWaste && phase !== 'idle'
                        ? phase === 'saved' ? 'rgba(232,255,240,0.82)' : 'rgba(255,247,236,0.82)'
                        : 'rgba(255,255,255,0.82)'}
                    stroke="rgba(255,255,255,0.94)" strokeWidth={1.5}
                    style={{ filter: 'url(#satShadow)' }}
                    whileHover={reducedMotion ? {} : { scale: 1.10 }}
                    transition={spring.snappy}
                />

                {/* Specular top highlight */}
                <ellipse cx={0} cy={-SR * 0.38} rx={SR * 0.62} ry={SR * 0.22}
                    fill="rgba(255,255,255,0.74)" />

                {/* SVG icon */}
                <NodeIcon
                    nodeId={nodeId} iconColor={iconColor}
                    wasteColor={wasteColor} isWaste={isWaste} phase={phase}
                />

                {/* Label */}
                <text y={SR + 16} textAnchor="middle"
                    fontSize={7.5} fontWeight={600}
                    fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, sans-serif"
                    fill="rgba(55,62,105,0.52)" letterSpacing={0.9}>
                    {label}
                </text>

                {/* Waste dot */}
                <AnimatePresence>
                    {isWaste && phase === 'waste' && (
                        <motion.circle cx={SR - 3} cy={-SR + 3} r={5}
                            fill="rgba(255,149,0,0.94)" stroke="rgba(255,255,255,0.95)" strokeWidth={1.6}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={reducedMotion ? { scale: 1 } : { scale: [0.8, 1.2, 0.8], opacity: 1 }}
                            exit={{ scale: 0, opacity: 0, transition: { duration: 0.3 } }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        />
                    )}
                </AnimatePresence>
                <AnimatePresence>
                    {isWaste && phase === 'optimizing' && (
                        <motion.circle cx={SR - 3} cy={-SR + 3} r={5}
                            fill="rgba(52,199,89,0.90)" stroke="rgba(255,255,255,0.95)" strokeWidth={1.6}
                            initial={{ scale: 0 }} animate={{ scale: 1 }}
                            exit={{ scale: 0, transition: { duration: 0.25 } }}
                            transition={spring.snappy}
                        />
                    )}
                </AnimatePresence>
            </g>
        </motion.g>
    );
};

// ─── Particle ─────────────────────────────────────────────────────────────────

const Particle: React.FC<{
    x1: number; y1: number; x2: number; y2: number;
    dur: number; delay: number;
    color?: string; size?: number;
    reducedMotion: boolean;
}> = ({ x1, y1, x2, y2, dur, delay, color = 'rgba(120,135,215,0.72)', size = 2.4, reducedMotion }) => {
    if (reducedMotion) return null;
    // Wrap in motion.g to animate position via transform — avoids undefined cx/cy
    // on the underlying <circle> element when Framer Motion applies x/y motion values.
    return (
        <motion.g
            animate={{ x: [x1, x2], y: [y1, y2], opacity: [0, 0.92, 0.92, 0] }}
            // scale on the group works fine and avoids the DOM attribute issue
            initial={{ x: x1, y: y1, opacity: 0 }}
            transition={{ duration: dur, delay, repeat: Infinity, ease: 'easeInOut' }}
        >
            <circle cx={0} cy={0} r={size} fill={color} filter="url(#pGlow)" />
        </motion.g>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────

const OptiWasteCloudVisual: React.FC<OptiWasteCloudVisualProps> = ({
    predictedSavings: _predictedSavings = 130.07,
    actualSavings: _actualSavings = 99.80,
    compact = false,
    className,
}) => {
    const reducedMotion = useReducedMotion() ?? false;

    const [phase, setPhase] = useState<WavePhase>('idle');
    useEffect(() => {
        if (reducedMotion) return;
        let idx = 0;
        let timer: ReturnType<typeof setTimeout>;
        const advance = () => {
            idx = (idx + 1) % PHASE_ORDER.length;
            const next = PHASE_ORDER[idx];
            setPhase(next);
            timer = setTimeout(advance, PHASE_DUR[next]);
        };
        timer = setTimeout(advance, PHASE_DUR.idle);
        return () => clearTimeout(timer);
    }, [reducedMotion]);

    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    const foreX = useTransform(mouseX, [-1, 1], [-12, 12]);
    const foreY = useTransform(mouseY, [-1, 1], [-12, 12]);
    const midX = useTransform(mouseX, [-1, 1], [-6, 6]);
    const midY = useTransform(mouseY, [-1, 1], [-6, 6]);
    const bgX = useTransform(mouseX, [-1, 1], [-2, 2]);
    const bgY = useTransform(mouseY, [-1, 1], [-2, 2]);

    const containerRef = useRef<HTMLDivElement>(null);
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (reducedMotion) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        mouseX.set(((e.clientX - rect.left) / rect.width) * 2 - 1);
        mouseY.set(((e.clientY - rect.top) / rect.height) * 2 - 1);
    }, [reducedMotion, mouseX, mouseY]);
    const handleMouseLeave = useCallback(() => {
        mouseX.set(0); mouseY.set(0);
    }, [mouseX, mouseY]);

    const sats = SATELLITES.map(s => ({ ...s, ...satPos(s.angle, s.r) }));
    const wasteNode = sats[WASTE_IDX];

    const cloudTint =
        phase === 'waste' ? 'rgba(255,149,0,0.16)' :
            phase === 'optimizing' ? 'rgba(52,199,89,0.14)' :
                phase === 'saved' ? 'rgba(52,199,89,0.10)' :
                    'rgba(165,180,255,0.06)';

    return (
        <div
            ref={containerRef}
            className={`${styles.root} ${className ?? ''}`}
            aria-hidden="true" role="presentation"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            {/* ── CSS atmospheric blobs ────────────────────────── */}
            <motion.div className={styles.atmosphericLayer} style={{ x: bgX, y: bgY }}>
                <div className={styles.atmosphereBlob1} />
                <div className={styles.atmosphereBlob2} />
                <div className={styles.atmosphereBlob3} />
            </motion.div>

            {/* ── Main SVG ─────────────────────────────────────── */}
            <motion.svg
                viewBox={`0 0 ${VW} ${VH}`}
                className={styles.svgCanvas}
                style={{ x: midX, y: midY }}
                preserveAspectRatio="xMidYMid meet"
                aria-hidden="true"
            >
                <defs>
                    {/* ─── MAIN CLOUD FILTER
                        blur → threshold → shadow → outer glow → feMerge
                        Produces white cloud + blue-lavender shadow beneath */}
                    <filter id="cloudFilter" x="-55%" y="-65%" width="210%" height="230%"
                        colorInterpolationFilters="sRGB">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="15" result="blobBlur" />
                        <feColorMatrix in="blobBlur" type="matrix"
                            values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 24 -9"
                            result="cloudMask" />
                        <feOffset in="cloudMask" dx="0" dy="22" result="shadowShifted" />
                        <feGaussianBlur in="shadowShifted" stdDeviation="24" result="shadowBlurred" />
                        <feColorMatrix in="shadowBlurred" type="matrix"
                            values="0 0 0 0 0.36  0 0 0 0 0.42  0 0 0 0 0.80  0 0 0 0.32 0"
                            result="shadow" />
                        <feGaussianBlur in="cloudMask" stdDeviation="38" result="glowBlurred" />
                        <feColorMatrix in="glowBlurred" type="matrix"
                            values="0 0 0 0 0.48  0 0 0 0 0.55  0 0 0 0 0.90  0 0 0 0.18 0"
                            result="outerGlow" />
                        <feMerge>
                            <feMergeNode in="outerGlow" />
                            <feMergeNode in="shadow" />
                            <feMergeNode in="cloudMask" />
                        </feMerge>
                    </filter>

                    {/* BACK ATMOSPHERIC CLOUD — very heavy blur, no threshold
                        Creates the hazy blue depth environment behind the main cloud */}
                    <filter id="atmosFilter" x="-60%" y="-60%" width="220%" height="220%">
                        <feGaussianBlur stdDeviation="32" />
                    </filter>

                    {/* FRONT HIGHLIGHT CLOUD — tight threshold, bright white
                        Simulates sunlight catching the top surface of the cloud */}
                    <filter id="cloudHighlightFilter" x="-40%" y="-45%" width="180%" height="190%"
                        colorInterpolationFilters="sRGB">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b" />
                        <feColorMatrix in="b" type="matrix"
                            values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 28 -14"
                            result="mask" />
                        <feComposite in="SourceGraphic" in2="mask" operator="in" />
                    </filter>

                    {/* Phase tint filter (plain threshold for coloured overlays) */}
                    <filter id="cloudTintFilter" x="-30%" y="-30%" width="160%" height="160%"
                        colorInterpolationFilters="sRGB">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="15" result="b" />
                        <feColorMatrix in="b" type="matrix"
                            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -9"
                            result="mask" />
                        <feComposite in="SourceGraphic" in2="mask" operator="in" />
                    </filter>

                    {/* Satellite node shadow */}
                    <filter id="satShadow" x="-40%" y="-40%" width="180%" height="180%">
                        <feDropShadow dx={0} dy={4} stdDeviation={7} floodColor="rgba(60,70,140,0.14)" />
                        <feDropShadow dx={0} dy={1} stdDeviation={2.5} floodColor="rgba(0,0,0,0.06)" />
                    </filter>

                    {/* Particle glow */}
                    <filter id="pGlow" x="-120%" y="-120%" width="340%" height="340%">
                        <feGaussianBlur stdDeviation={1.8} result="b" />
                        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>

                    {/* Cloud inner gradient — deep lavender to bright lavender-white */}
                    <radialGradient id="cloudGrad" cx="48%" cy="38%" r="56%">
                        <stop offset="0%" stopColor="rgba(215,225,255,0.96)" />
                        <stop offset="45%" stopColor="rgba(195,210,252,0.82)" />
                        <stop offset="100%" stopColor="rgba(170,188,248,0.45)" />
                    </radialGradient>

                    {/* Waste / opt particle gradients */}
                    <linearGradient id="optGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(52,199,89,0.00)" />
                        <stop offset="50%" stopColor="rgba(52,199,89,0.65)" />
                        <stop offset="100%" stopColor="rgba(52,199,89,0.00)" />
                    </linearGradient>
                    <linearGradient id="wasteGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(255,149,0,0.00)" />
                        <stop offset="50%" stopColor="rgba(255,149,0,0.62)" />
                        <stop offset="100%" stopColor="rgba(255,149,0,0.00)" />
                    </linearGradient>
                </defs>

                {/* ── Connection lines (node → cloud edge) ──────── */}
                <g>
                    {sats.map((s, i) => {
                        const isW = i === WASTE_IDX && phase !== 'idle';
                        const dx = s.x - CX, dy = s.y - CY;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const ef = 158 / dist;
                        return (
                            <line key={s.id}
                                x1={s.x} y1={s.y}
                                x2={CX + dx * ef} y2={CY + dy * ef}
                                stroke={isW
                                    ? (phase === 'waste' ? 'rgba(255,149,0,0.55)' : 'rgba(52,199,89,0.58)')
                                    : 'rgba(140,158,218,0.28)'}
                                strokeWidth={isW ? 2.0 : 1.2}
                                strokeDasharray={isW ? '0' : '4 9'}
                                opacity={isW ? 1 : 0.75}
                            />
                        );
                    })}
                </g>

                {/* Animated waste/opt pulse overlay */}
                {!reducedMotion && phase !== 'idle' && (() => {
                    const dx = wasteNode.x - CX, dy = wasteNode.y - CY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const ef = 158 / dist;
                    return (
                        <motion.line
                            x1={wasteNode.x} y1={wasteNode.y}
                            x2={CX + dx * ef} y2={CY + dy * ef}
                            stroke={phase === 'waste' ? 'url(#wasteGrad)' : 'url(#optGrad)'}
                            strokeWidth={3}
                            animate={{ opacity: [0.3, 1.0, 0.3] }}
                            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                        />
                    );
                })()}

                {/* ── Inbound particles ──────────────────────────── */}
                {sats.map((s, i) => {
                    const dx = s.x - CX, dy = s.y - CY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const ef = 158 / dist;
                    return (
                        <Particle key={`in-${i}`}
                            x1={s.x} y1={s.y}
                            x2={CX + dx * ef} y2={CY + dy * ef}
                            dur={3.0 + i * 0.30} delay={i * 0.70}
                            color={i === WASTE_IDX && phase === 'waste'
                                ? 'rgba(255,149,0,0.88)'
                                : i === WASTE_IDX && phase === 'optimizing'
                                    ? 'rgba(52,199,89,0.88)'
                                    : 'rgba(120,138,215,0.78)'}
                            reducedMotion={reducedMotion}
                        />
                    );
                })}

                {/* Outbound particles (cloud → node) */}
                {sats.map((s, i) => {
                    const dx = s.x - CX, dy = s.y - CY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const ef = 158 / dist;
                    return (
                        <Particle key={`out-${i}`}
                            x1={CX + dx * ef} y1={CY + dy * ef}
                            x2={s.x} y2={s.y}
                            dur={4.5 + i * 0.22} delay={i * 0.52 + 0.45}
                            color="rgba(100,118,200,0.50)" size={2.0}
                            reducedMotion={reducedMotion}
                        />
                    );
                })}

                {/* Internal cloud particles — 14 traces orbiting the cloud volume */}
                {[...Array(14)].map((_, i) => {
                    const baseAngle = (i / 14) * 360;
                    const r1 = 38 + (i % 4) * 22;
                    const r2 = r1 - 18;
                    const sweep = 30 + (i % 3) * 12;
                    return (
                        <Particle key={`int-${i}`}
                            x1={CX + Math.cos(DEG(baseAngle)) * r1}
                            y1={CY + Math.sin(DEG(baseAngle)) * r1}
                            x2={CX + Math.cos(DEG(baseAngle + sweep)) * r2}
                            y2={CY + Math.sin(DEG(baseAngle + sweep)) * r2}
                            dur={2.2 + i * 0.26} delay={i * 0.35}
                            color="rgba(195,210,255,0.60)" size={1.5}
                            reducedMotion={reducedMotion}
                        />
                    );
                })}

                {/* ══════════════════════════════════════════════════
                    3D CLOUD HERO — five depth layers
                    ══════════════════════════════════════════════════ */}
                <motion.g
                    animate={reducedMotion ? {} : {
                        x: [0, 4, 0, -3, 0],
                        y: [0, -10, 3, 8, 0],
                    }}
                    transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ transformOrigin: `${CX}px ${CY}px` }}
                >
                    {/* ── LAYER 0: FLOOR SHADOW ──────────────────────
                        A blurred dark ellipse below the cloud signals
                        that it is FLOATING above the environment.       */}
                    <ellipse
                        cx={CX} cy={CY + 130}
                        rx={182} ry={28}
                        fill="rgba(80,90,160,0.18)"
                        style={{ filter: 'blur(16px)' }}
                    />

                    {/* ── LAYER 1: BACK ATMOSPHERIC HAZE ────────────
                        Large, heavily blurred blue-gray shapes behind
                        the main cloud = deep atmospheric volume.        */}
                    <g filter="url(#atmosFilter)" opacity={0.72}>
                        {CLOUD_BLOBS.map((b, i) => (
                            <ellipse key={i}
                                cx={CX + b.cx * 1.12} cy={CY + b.cy * 1.1}
                                rx={b.rx * 1.28} ry={b.ry * 1.28}
                                fill="rgba(158,178,250,0.48)"
                                opacity={b.op * 0.68}
                            />
                        ))}
                    </g>

                    {/* ── LAYER 2: MAIN CLOUD BODY ───────────────────
                        Blue-lavender fill with shadow + ambient glow.   */}
                    <g filter="url(#cloudFilter)">
                        {CLOUD_BLOBS.map((b, i) => (
                            <ellipse key={i}
                                cx={CX + b.cx} cy={CY + b.cy}
                                rx={b.rx} ry={b.ry}
                                fill="rgba(198,214,250,0.90)"
                                opacity={b.op}
                            />
                        ))}
                    </g>

                    {/* ── LAYER 3: INNER GRADIENT FILL ──────────────
                        Radial blue-lavender gradient towards center.    */}
                    <g filter="url(#cloudTintFilter)">
                        {CLOUD_BLOBS.map((b, i) => (
                            <ellipse key={i}
                                cx={CX + b.cx * 0.82} cy={CY + b.cy * 0.82}
                                rx={b.rx * 0.78} ry={b.ry * 0.78}
                                fill="url(#cloudGrad)"
                                opacity={b.op * 0.58}
                            />
                        ))}
                    </g>

                    {/* ── LAYER 4: PHASE TINT ────────────────────────
                        Amber for waste, green for optimization.         */}
                    <AnimatePresence>
                        <motion.g key={phase}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 1.2 }}
                        >
                            <g filter="url(#cloudTintFilter)">
                                {CLOUD_BLOBS.map((b, i) => (
                                    <ellipse key={i}
                                        cx={CX + b.cx} cy={CY + b.cy}
                                        rx={b.rx} ry={b.ry}
                                        fill={cloudTint} opacity={b.op * 0.85}
                                    />
                                ))}
                            </g>
                        </motion.g>
                    </AnimatePresence>

                    {/* ── LAYER 5: FRONT HIGHLIGHT CLOUD ────────────
                        Bright white top-lobes = sunlight catching the
                        cloud's upper surface. Creates volumetric depth. */}
                    <g filter="url(#cloudHighlightFilter)" opacity={0.55}>
                        {FRONT_BLOBS.map((b, i) => (
                            <ellipse key={i}
                                cx={CX + b.cx} cy={CY + b.cy + 8}
                                rx={b.rx} ry={b.ry}
                                fill="rgba(248,252,255,0.95)"
                            />
                        ))}
                    </g>

                    {/* ── LAYER 6: DIRECTIONAL LIGHT PATCH ──────────
                        Bright soft ellipse top-right → simulates a
                        single overhead-right directional light source.  */}
                    <ellipse
                        cx={CX + 85} cy={CY - 90}
                        rx={120} ry={55}
                        fill="rgba(255,255,255,0.30)"
                        style={{ filter: 'blur(24px)' }}
                    />

                    {/* ── LAYER 7: MOVING LIGHT GLOBE ───────────────
                        Wrapped in motion.g so position is animated via CSS transform
                        (x/y), NOT via SVG cx/cy attribute mutation (which causes
                        "Expected length, undefined" errors when Framer Motion
                        interpolates between keyframes before first paint). */}
                    {!reducedMotion && (
                        <motion.g
                            animate={{
                                x: [CX - 55, CX + 60, CX + 18, CX - 55],
                                y: [CY - 14, CY + 10, CY - 26, CY - 14],
                            }}
                            initial={{ x: CX - 55, y: CY - 14 }}
                            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            <motion.circle
                                cx={0} cy={0} r={60}
                                fill="rgba(255,255,255,0.35)"
                                style={{ filter: 'blur(16px)' }}
                                // Use scale instead of r to avoid SVG attribute mutation
                                // which produces "Expected length, undefined" errors.
                                // Scale ratios: 44/60 ≈ 0.73, 66/60 = 1.1
                                animate={{ scale: [1, 0.73, 1.1, 1], opacity: [0.28, 0.50, 0.30, 0.28] }}
                                transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
                            />
                        </motion.g>
                    )}

                    {/* ── LAYER 8: ENERGY WAVE RING ─────────────────
                        Slowly rotating dashed orbit circle — simulates
                        a cloud telemetry / force-field boundary.        */}
                    {!reducedMotion && (
                        <motion.circle
                            cx={CX} cy={CY} r={155}
                            fill="none"
                            stroke="rgba(175,195,255,0.22)"
                            strokeWidth={1.2}
                            strokeDasharray="10 22"
                            animate={{ rotate: [0, 360] }}
                            transition={{ duration: 32, repeat: Infinity, ease: 'linear' }}
                            style={{ transformOrigin: `${CX}px ${CY}px` }}
                        />
                    )}
                    {/* Second energy ring, opposite direction, slightly different radius */}
                    {!reducedMotion && (
                        <motion.circle
                            cx={CX} cy={CY} r={172}
                            fill="none"
                            stroke="rgba(160,185,255,0.14)"
                            strokeWidth={0.8}
                            strokeDasharray="6 28"
                            animate={{ rotate: [360, 0] }}
                            transition={{ duration: 48, repeat: Infinity, ease: 'linear' }}
                            style={{ transformOrigin: `${CX}px ${CY}px` }}
                        />
                    )}

                    {/* ── Top specular highlight edge */}
                    <ellipse cx={CX + 6} cy={CY - 88}
                        rx={100} ry={24}
                        fill="rgba(255,255,255,0.62)"
                        style={{ filter: 'blur(8px)' }}
                    />

                    {/* ── Light sweep across cloud body (periodic) */}
                    {!reducedMotion && (
                        <motion.rect
                            x={CX - 185} y={CY - 122}
                            width={36} height={238}
                            fill="rgba(255,255,255,0.22)"
                            rx={6}
                            animate={{ x: [CX - 185, CX + 185] }}
                            transition={{
                                duration: 1.8, repeat: Infinity, repeatDelay: 10,
                                ease: [0.25, 0.46, 0.45, 0.94],
                            }}
                            style={{ clipPath: `ellipse(168px 98px at ${CX}px ${CY}px)` }}
                        />
                    )}

                    {/* ── OPTIWASTE / CLOUD INTELLIGENCE — mixed weight */}
                    <text x={CX} y={CY + 18} textAnchor="middle"
                        fontSize={13} letterSpacing={4.2}
                        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, sans-serif">
                        <tspan fontWeight={800} fill="rgba(36,46,96,0.52)">OPTI</tspan>
                        <tspan fontWeight={400} fill="rgba(58,70,118,0.42)">WASTE</tspan>
                    </text>
                    <text x={CX} y={CY + 36} textAnchor="middle"
                        fontSize={8} fontWeight={500} letterSpacing={2.2}
                        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, sans-serif"
                        fill="rgba(58,70,118,0.30)">
                        CLOUD INTELLIGENCE
                    </text>
                </motion.g>

                {/* ── Satellite Nodes (foreground parallax layer) ── */}
                <motion.g style={{ x: foreX, y: foreY }}>
                    {sats.map((s, i) => (
                        <SatelliteNode
                            key={s.id}
                            nodeId={s.id} label={s.label}
                            bx={s.x} by={s.y}
                            cfg={FLOAT_CFG[i]}
                            isWaste={i === WASTE_IDX}
                            phase={phase}
                            reducedMotion={reducedMotion}
                        />
                    ))}
                </motion.g>

                {/* ── Phase label pill above DB node ─────────────── */}
                <AnimatePresence>
                    {PHASE_LABELS[phase] && !reducedMotion && (
                        <motion.g key={phase}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.28 }}
                        >
                            <rect
                                x={wasteNode.x - 60} y={wasteNode.y - SR - 42}
                                width={120} height={22} rx={11}
                                fill={phase === 'waste' ? 'rgba(255,149,0,0.16)' : 'rgba(52,199,89,0.15)'}
                                stroke={phase === 'waste' ? 'rgba(255,149,0,0.36)' : 'rgba(52,199,89,0.34)'}
                                strokeWidth={1}
                            />
                            <text
                                x={wasteNode.x} y={wasteNode.y - SR - 28}
                                textAnchor="middle" dominantBaseline="central"
                                fontSize={7.5} fontWeight={700} letterSpacing={1.2}
                                fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, sans-serif"
                                fill={phase === 'waste' ? 'rgba(192,88,0,0.92)' : 'rgba(28,142,52,0.90)'}
                            >
                                {PHASE_LABELS[phase]}
                            </text>
                        </motion.g>
                    )}
                </AnimatePresence>
            </motion.svg>

            {/* ── Foreground HTML badges (standalone/dashboard mode) */}
            {!compact && (
                <motion.div className={styles.foregroundLayer} style={{ x: foreX, y: foreY }}>
                    <AnimatePresence>
                        {phase !== 'idle' && (
                            <motion.div
                                className={styles.wasteBadge}
                                initial={{ opacity: 0, scale: 0.84 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.84 }}
                                transition={spring.standard}
                                style={{
                                    background: phase === 'waste'
                                        ? 'rgba(255,149,0,0.12)' : 'rgba(52,199,89,0.11)',
                                    borderColor: phase === 'waste'
                                        ? 'rgba(255,149,0,0.28)' : 'rgba(52,199,89,0.26)',
                                }}
                            >
                                <motion.span className={styles.wasteDot}
                                    style={{
                                        background: phase === 'waste'
                                            ? 'var(--color-system-orange)' : 'var(--color-system-green)',
                                    }}
                                    animate={reducedMotion ? {} : { scale: [1, 1.3, 1], opacity: [1, 0.55, 1] }}
                                    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                                />
                                <span className={styles.wasteText}>
                                    {phase === 'waste' ? 'Waste Detected' :
                                        phase === 'optimizing' ? 'Optimizing…' : 'Savings'}
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}
        </div>
    );
};

export default OptiWasteCloudVisual;
