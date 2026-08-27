/**
 * seedWasteDemoData.ts
 * OptiWaste — Phase 18.5: Demo Data Seeding
 *
 * DEVELOPMENT ONLY — never imported by server.ts
 *
 * Run:  npm run seed:waste-demo
 *
 * Safety guarantees:
 *   - Idempotent: identifies demo records by resource_name upsert key
 *   - Never deletes or modifies existing real records
 *   - Running twice produces the same set of demo records
 *
 * Scenarios:
 *   1. HEALTHY        → ~70% CPU/memory — should NOT trigger any waste
 *   2. UNDERUTILIZED  → CPU ~8%, memory ~12%
 *   3. IDLE           → CPU ~1%, stopped, near-zero traffic
 *   4. OVERPROVISIONED→ 32 vCPU / 256 GB, ~4% CPU / ~5% memory
 *   5. UNATTACHED_STORAGE → ebs-volume, disk_read/write ≈ 0
 *   6. STORAGE_WASTE  → 2 TB allocated, ~8% utilisation
 *   7. COST_ANOMALY   → projected 3× monthly, daily spike
 */

import mongoose from 'mongoose';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { CloudProvider } from '../models/CloudProvider';
import { CloudResource } from '../models/CloudResource';
import { ResourceMetric } from '../models/ResourceMetric';
import { CostRecord } from '../models/CostRecord';

// ── Config ─────────────────────────────────────────────────────────────────────

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/optiwaste';
const DEMO_TAG = { demo: true, phase: '18.5' };
const TOTAL_SAMPLES = 36;
const WINDOW_DAYS = 14;

// ── Typed document shapes ──────────────────────────────────────────────────────

interface MetricDoc {
    resource_id: string;
    cpu_utilization: number;
    memory_utilization: number;
    storage_utilization: number;
    network_in: number;
    network_out: number;
    disk_read: number;
    disk_write: number;
    uptime_hours: number;
    instance_state: string;
    metric_timestamp: Date;
}

interface CostDoc {
    resource_id: string;
    provider_id: string;
    billing_period: string;
    daily_cost: number;
    weekly_cost: number;
    monthly_cost: number;
    projected_monthly_cost: number;
    currency: string;
    billing_status: string;
    cost_timestamp: Date;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function jitter(value: number, spread: number): number {
    const r = (Math.random() - 0.5) * 2 * spread;
    return Math.max(0, +(value + r).toFixed(2));
}

function timeRange(count: number, daysBack: number): Date[] {
    const now = Date.now();
    const start = now - daysBack * 24 * 60 * 60 * 1000;
    const step = (now - start) / (count - 1);
    return Array.from({ length: count }, (_, i) => new Date(start + i * step));
}

function billingPeriod(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function upsertProvider(data: {
    account_id: string;
    provider_name: string;
    provider_type: string;
    account_name: string;
    region: string;
}): Promise<string> {
    const doc = await CloudProvider.findOneAndUpdate(
        { account_id: data.account_id },
        {
            $setOnInsert: { _id: crypto.randomUUID(), status: 'active', is_deleted: false },
            $set: { ...data, updated_at: new Date() },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return String(doc!._id);
}

async function upsertResource(data: {
    resource_name: string;
    provider_id: string;
    provider_type: string;
    resource_type: string;
    instance_type: string | null;
    service_name: string;
    region: string;
    availability_zone: string | null;
    cpu: number;
    memory: number;
    storage: number;
    operating_system: string | null;
    status: string;
    owner: string;
    project_name: string;
    environment: string;
    monthly_cost: number;
}): Promise<string> {
    const doc = await CloudResource.findOneAndUpdate(
        { resource_name: data.resource_name },
        {
            $setOnInsert: { _id: crypto.randomUUID(), is_deleted: false, last_synced: new Date(), tags: DEMO_TAG },
            $set: { ...data, updated_at: new Date() },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return String(doc!._id);
}

/** Delete-then-insert for idempotency — only touches this demo resource's metrics. */
async function replaceMetrics(resourceId: string, samples: MetricDoc[]): Promise<void> {
    await ResourceMetric.deleteMany({ resource_id: resourceId });
    await ResourceMetric.insertMany(samples.map(s => ({ _id: crypto.randomUUID(), ...s })));
}

/** Delete-then-insert for idempotency — only touches this demo resource's costs. */
async function replaceCosts(resourceId: string, records: CostDoc[]): Promise<void> {
    await CostRecord.deleteMany({ resource_id: resourceId });
    await CostRecord.insertMany(records.map(r => ({ _id: crypto.randomUUID(), ...r })));
}

// ── Providers ──────────────────────────────────────────────────────────────────

const PROVIDERS = [
    { account_id: 'DEMO-AWS-111111111111', provider_name: 'DEMO AWS Account', provider_type: 'AWS', account_name: 'demo-aws-root', region: 'us-east-1' },
    { account_id: 'DEMO-AZURE-demo0001', provider_name: 'DEMO Azure Sub', provider_type: 'Azure', account_name: 'demo-azure-sub', region: 'eastus' },
    { account_id: 'DEMO-GCP-demo-proj-001', provider_name: 'DEMO GCP Project', provider_type: 'GCP', account_name: 'demo-gcp-project', region: 'us-central1' },
];

// ── Seeder ─────────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
    console.log('[SeedWasteDemoData] Connecting:', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('[SeedWasteDemoData] Connected.\n');

    // -- Providers
    const ids: Record<string, string> = {};
    for (const p of PROVIDERS) {
        ids[p.provider_type] = await upsertProvider(p);
        console.log(`  ✓ Provider ${p.provider_type}: ${ids[p.provider_type]}`);
    }
    const awsId = ids['AWS'], azureId = ids['Azure'], gcpId = ids['GCP'];

    // ── 1. HEALTHY (AWS) — should NOT generate any finding
    {
        const rid = await upsertResource({
            resource_name: 'DEMO-AWS-HEALTHY-01', provider_id: awsId, provider_type: 'AWS',
            resource_type: 'EC2', instance_type: 'm5.xlarge', service_name: 'EC2',
            region: 'us-east-1', availability_zone: 'us-east-1a',
            cpu: 4, memory: 16, storage: 100, operating_system: 'Linux',
            status: 'running', owner: 'demo-team', project_name: 'demo-prod',
            environment: 'Production', monthly_cost: 180.00,
        });
        const ts = timeRange(TOTAL_SAMPLES, WINDOW_DAYS);
        await replaceMetrics(rid, ts.map(t => ({
            resource_id: rid, cpu_utilization: jitter(70, 10), memory_utilization: jitter(65, 8),
            storage_utilization: jitter(55, 5), network_in: jitter(500, 80), network_out: jitter(320, 60),
            disk_read: jitter(25, 5), disk_write: jitter(12, 3), uptime_hours: jitter(720, 10),
            instance_state: 'running', metric_timestamp: t,
        })));
        await replaceCosts(rid, ts.slice(0, 14).map(t => ({
            resource_id: rid, provider_id: awsId, billing_period: billingPeriod(t),
            daily_cost: jitter(6.00, 0.30), weekly_cost: jitter(42.00, 1.50),
            monthly_cost: 180.00, projected_monthly_cost: jitter(182.00, 4.00),
            currency: 'USD', billing_status: 'finalized', cost_timestamp: t,
        })));
        console.log(`  ✓ HEALTHY           ${rid}`);
    }

    // ── 2. UNDERUTILIZED (AWS) — CPU ~8%, memory ~12%
    {
        const rid = await upsertResource({
            resource_name: 'DEMO-AWS-UNDERUTILIZED-01', provider_id: awsId, provider_type: 'AWS',
            resource_type: 'EC2', instance_type: 'c5.2xlarge', service_name: 'EC2',
            region: 'us-east-1', availability_zone: 'us-east-1b',
            cpu: 8, memory: 16, storage: 200, operating_system: 'Linux',
            status: 'running', owner: 'demo-team', project_name: 'demo-dev',
            environment: 'Development', monthly_cost: 280.00,
        });
        const ts = timeRange(TOTAL_SAMPLES, WINDOW_DAYS);
        await replaceMetrics(rid, ts.map(t => ({
            resource_id: rid, cpu_utilization: jitter(8, 2), memory_utilization: jitter(12, 3),
            storage_utilization: jitter(30, 5), network_in: jitter(45, 10), network_out: jitter(20, 8),
            disk_read: jitter(8, 2), disk_write: jitter(4, 1), uptime_hours: jitter(720, 5),
            instance_state: 'running', metric_timestamp: t,
        })));
        await replaceCosts(rid, ts.slice(0, 14).map(t => ({
            resource_id: rid, provider_id: awsId, billing_period: billingPeriod(t),
            daily_cost: jitter(9.33, 0.20), weekly_cost: jitter(65.33, 1.00),
            monthly_cost: 280.00, projected_monthly_cost: jitter(282.00, 3.00),
            currency: 'USD', billing_status: 'finalized', cost_timestamp: t,
        })));
        console.log(`  ✓ UNDERUTILIZED     ${rid}`);
    }

    // ── 3. IDLE (Azure) — CPU ~1%, stopped, near-zero traffic
    {
        const rid = await upsertResource({
            resource_name: 'DEMO-AZURE-IDLE-01', provider_id: azureId, provider_type: 'Azure',
            resource_type: 'VirtualMachine', instance_type: 'Standard_D4s_v3',
            service_name: 'VirtualMachines', region: 'eastus', availability_zone: null,
            cpu: 4, memory: 16, storage: 128, operating_system: 'Windows',
            status: 'stopped', owner: 'demo-ops', project_name: 'demo-legacy',
            environment: 'Staging', monthly_cost: 190.00,
        });
        const ts = timeRange(TOTAL_SAMPLES, WINDOW_DAYS);
        await replaceMetrics(rid, ts.map(t => ({
            resource_id: rid, cpu_utilization: jitter(1, 0.5), memory_utilization: jitter(3, 1),
            storage_utilization: jitter(15, 3), network_in: jitter(0.5, 0.3), network_out: jitter(0.3, 0.2),
            disk_read: jitter(0.2, 0.1), disk_write: jitter(0.1, 0.05), uptime_hours: jitter(24, 4),
            instance_state: 'stopped', metric_timestamp: t,
        })));
        await replaceCosts(rid, ts.slice(0, 14).map(t => ({
            resource_id: rid, provider_id: azureId, billing_period: billingPeriod(t),
            daily_cost: jitter(6.33, 0.20), weekly_cost: jitter(44.33, 1.00),
            monthly_cost: 190.00, projected_monthly_cost: jitter(191.00, 2.00),
            currency: 'USD', billing_status: 'finalized', cost_timestamp: t,
        })));
        console.log(`  ✓ IDLE              ${rid}`);
    }

    // ── 4. OVERPROVISIONED (GCP) — 32 vCPU / 256 GB, ~4% CPU / ~5% memory
    {
        const rid = await upsertResource({
            resource_name: 'DEMO-GCP-OVERPROVISIONED-01', provider_id: gcpId, provider_type: 'GCP',
            resource_type: 'ComputeInstance', instance_type: 'n2-standard-32',
            service_name: 'Compute Engine', region: 'us-central1', availability_zone: 'us-central1-a',
            cpu: 32, memory: 256, storage: 500, operating_system: 'Linux',
            status: 'running', owner: 'demo-data-team', project_name: 'demo-analytics',
            environment: 'Production', monthly_cost: 1500.00,
        });
        const ts = timeRange(TOTAL_SAMPLES, WINDOW_DAYS);
        await replaceMetrics(rid, ts.map(t => ({
            resource_id: rid, cpu_utilization: jitter(4, 1.5), memory_utilization: jitter(5, 2),
            storage_utilization: jitter(20, 4), network_in: jitter(120, 30), network_out: jitter(80, 20),
            disk_read: jitter(15, 4), disk_write: jitter(8, 2), uptime_hours: jitter(720, 5),
            instance_state: 'running', metric_timestamp: t,
        })));
        await replaceCosts(rid, ts.slice(0, 14).map(t => ({
            resource_id: rid, provider_id: gcpId, billing_period: billingPeriod(t),
            daily_cost: jitter(50.00, 1.50), weekly_cost: jitter(350.00, 5.00),
            monthly_cost: 1500.00, projected_monthly_cost: jitter(1510.00, 20.00),
            currency: 'USD', billing_status: 'finalized', cost_timestamp: t,
        })));
        console.log(`  ✓ OVERPROVISIONED   ${rid}`);
    }

    // ── 5. UNATTACHED STORAGE (AWS EBS) — disk_read/write ≈ 0
    {
        const rid = await upsertResource({
            resource_name: 'DEMO-AWS-UNATTACHED-STORAGE-01', provider_id: awsId, provider_type: 'AWS',
            resource_type: 'ebs-volume', instance_type: null, service_name: 'EBS',
            region: 'us-east-1', availability_zone: 'us-east-1c',
            cpu: 0, memory: 0, storage: 500, operating_system: null,
            status: 'available', owner: 'demo-ops', project_name: 'demo-archive',
            environment: 'Development', monthly_cost: 50.00,
        });
        const ts = timeRange(TOTAL_SAMPLES, WINDOW_DAYS);
        await replaceMetrics(rid, ts.map(t => ({
            resource_id: rid, cpu_utilization: 0, memory_utilization: 0,
            storage_utilization: jitter(72, 3),
            network_in: 0, network_out: 0,
            disk_read: jitter(0.05, 0.04), disk_write: jitter(0.03, 0.02),
            uptime_hours: jitter(720, 5), instance_state: 'available', metric_timestamp: t,
        })));
        await replaceCosts(rid, ts.slice(0, 14).map(t => ({
            resource_id: rid, provider_id: awsId, billing_period: billingPeriod(t),
            daily_cost: jitter(1.67, 0.05), weekly_cost: jitter(11.67, 0.20),
            monthly_cost: 50.00, projected_monthly_cost: jitter(50.00, 1.00),
            currency: 'USD', billing_status: 'finalized', cost_timestamp: t,
        })));
        console.log(`  ✓ UNATTACHED STOR.  ${rid}`);
    }

    // ── 6. STORAGE WASTE (Azure) — 2 TB allocated, ~8% utilisation
    {
        const rid = await upsertResource({
            resource_name: 'DEMO-AZURE-STORAGE-WASTE-01', provider_id: azureId, provider_type: 'Azure',
            resource_type: 'ManagedDisk', instance_type: null, service_name: 'Managed Disks',
            region: 'eastus', availability_zone: null,
            cpu: 0, memory: 0, storage: 2048, operating_system: null,
            status: 'running', owner: 'demo-storage', project_name: 'demo-backup',
            environment: 'Production', monthly_cost: 80.00,
        });
        const ts = timeRange(TOTAL_SAMPLES, WINDOW_DAYS);
        await replaceMetrics(rid, ts.map(t => ({
            resource_id: rid, cpu_utilization: 0, memory_utilization: 0,
            storage_utilization: jitter(8, 2),
            network_in: jitter(10, 3), network_out: jitter(5, 2),
            disk_read: jitter(8, 2), disk_write: jitter(3, 1),
            uptime_hours: jitter(720, 5), instance_state: 'running', metric_timestamp: t,
        })));
        await replaceCosts(rid, ts.slice(0, 14).map(t => ({
            resource_id: rid, provider_id: azureId, billing_period: billingPeriod(t),
            daily_cost: jitter(2.67, 0.10), weekly_cost: jitter(18.67, 0.50),
            monthly_cost: 80.00, projected_monthly_cost: jitter(80.00, 2.00),
            currency: 'USD', billing_status: 'finalized', cost_timestamp: t,
        })));
        console.log(`  ✓ STORAGE WASTE     ${rid}`);
    }

    // ── 7. COST ANOMALY (GCP) — projected 3× monthly, large daily spike
    {
        const rid = await upsertResource({
            resource_name: 'DEMO-GCP-COST-ANOMALY-01', provider_id: gcpId, provider_type: 'GCP',
            resource_type: 'CloudFunction', instance_type: null, service_name: 'Cloud Functions',
            region: 'us-central1', availability_zone: null,
            cpu: 2, memory: 4, storage: 50, operating_system: null,
            status: 'running', owner: 'demo-backend', project_name: 'demo-api',
            environment: 'Production', monthly_cost: 120.00,
        });
        const ts = timeRange(TOTAL_SAMPLES, WINDOW_DAYS);
        // Moderate utilisation — anomaly is purely cost-based
        await replaceMetrics(rid, ts.map(t => ({
            resource_id: rid, cpu_utilization: jitter(45, 10), memory_utilization: jitter(50, 8),
            storage_utilization: jitter(35, 5), network_in: jitter(200, 40), network_out: jitter(150, 30),
            disk_read: jitter(10, 3), disk_write: jitter(5, 2), uptime_hours: jitter(720, 5),
            instance_state: 'running', metric_timestamp: t,
        })));
        // 10 baseline + 4 spike records
        const baseCosts: CostDoc[] = ts.slice(0, 10).map(t => ({
            resource_id: rid, provider_id: gcpId, billing_period: billingPeriod(t),
            daily_cost: jitter(4.00, 0.30), weekly_cost: jitter(28.00, 1.00),
            monthly_cost: 120.00, projected_monthly_cost: jitter(122.00, 3.00),
            currency: 'USD', billing_status: 'finalized', cost_timestamp: t,
        }));
        const spikeCosts: CostDoc[] = ts.slice(10, 14).map(t => ({
            resource_id: rid, provider_id: gcpId, billing_period: billingPeriod(t),
            daily_cost: jitter(35.00, 3.00),           // dramatic spike
            weekly_cost: jitter(245.00, 10.00),
            monthly_cost: 120.00,
            projected_monthly_cost: jitter(360.00, 10.00), // 3× monthly → anomaly
            currency: 'USD', billing_status: 'estimated', cost_timestamp: t,
        }));
        await replaceCosts(rid, [...baseCosts, ...spikeCosts]);
        console.log(`  ✓ COST ANOMALY      ${rid}`);
    }

    console.log('\n[SeedWasteDemoData] ✓ All demo records seeded successfully.');
    console.log('[SeedWasteDemoData] → Run: POST /api/v1/waste/analyze to detect waste.\n');
    await mongoose.disconnect();
    process.exit(0);
}

seed().catch(err => {
    console.error('[SeedWasteDemoData] Fatal error:', err);
    process.exit(1);
});
