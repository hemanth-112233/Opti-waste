/**
 * validate_phase19.ts
 * OptiWaste — Phase 19 API Validation (uses built-in http — no external deps)
 *
 * Validates the Optimization Recommendation Engine:
 *   POST /api/v1/recommendations/generate
 *   GET  /api/v1/recommendations/summary
 *   GET  /api/v1/recommendations
 *   GET  /api/v1/recommendations/:id
 *   PATCH /api/v1/recommendations/:id/status
 *
 * Pre-condition: waste demo data seeded, waste/analyze run (Phase 18 state).
 * Usage: npx ts-node validate_phase19.ts
 */

import { spawn, ChildProcess } from 'child_process';
import * as http from 'http';

const BASE = 'http://localhost:8001';

let passed = 0;
let failed = 0;
const log: string[] = [];

// ── Simple HTTP client ────────────────────────────────────────────────────────
function request(
    method: string,
    path: string,
    body?: any,
    token?: string,
): Promise<{ status: number; data: any }> {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : undefined;
        const options: http.RequestOptions = {
            hostname: 'localhost',
            port: 8001,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        };

        const req = http.request(options, res => {
            let raw = '';
            res.on('data', d => (raw += d));
            res.on('end', () => {
                let data: any;
                try { data = JSON.parse(raw); } catch { data = raw; }
                resolve({ status: res.statusCode ?? 0, data });
            });
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

// ── Test helpers ──────────────────────────────────────────────────────────────
function check(label: string, cond: boolean, detail?: string) {
    if (cond) {
        console.log(`  ✓  ${label}`);
        passed++;
    } else {
        const msg = `  ✗  ${label}${detail ? ' — ' + detail : ''}`;
        console.log(msg);
        log.push(msg);
        failed++;
    }
}

async function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
}

async function waitForServer(tries = 30): Promise<void> {
    for (let i = 0; i < tries; i++) {
        const ok = await new Promise<boolean>(resolve => {
            const req = http.request(
                { hostname: 'localhost', port: 8001, path: '/health', method: 'GET' },
                res => resolve(res.statusCode === 200)
            );
            req.on('error', () => resolve(false));
            req.end();
        });
        if (ok) return;
        await sleep(800);
    }
    throw new Error('Server did not start within time limit.');
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log('[Validator] Starting backend server…');
    const proc: ChildProcess = spawn('node', ['dist/server.js'], {
        cwd: process.cwd(),
        env: { ...process.env },
        stdio: 'pipe',
    });
    proc.on('error', e => { console.error('[Validator] Process error:', e); process.exit(1); });
    proc.stderr?.on('data', (d: Buffer) => process.stderr.write(d));

    await waitForServer();
    console.log('[Validator] Server is up. Running Phase 19 tests…\n');

    // ── Login ─────────────────────────────────────────────────────────────────
    const loginRes = await request('POST', '/api/v1/auth/login', {
        email: 'admin@optiwaste.com',
        password: 'Admin@123',
    });
    check('Login returns 200', loginRes.status === 200);
    const token: string = loginRes.data?.access_token || loginRes.data?.data?.access_token || '';
    check('Access token received', !!token);

    // ── Auth guards ───────────────────────────────────────────────────────────
    console.log('\nAUTH — Unauthenticated requests rejected');
    {
        const r = await request('POST', '/api/v1/recommendations/generate');
        check('POST /generate without token → 401', r.status === 401);
    }
    {
        const r = await request('GET', '/api/v1/recommendations');
        check('GET /recommendations without token → 401', r.status === 401);
    }

    // ── Pre-condition: ensure waste findings ──────────────────────────────────
    console.log('\nPRE-CONDITION — Ensure waste findings exist');
    {
        const r = await request('POST', '/api/v1/waste/analyze', {}, token);
        check('POST /waste/analyze returns 200', r.status === 200);
        check('Waste analysis has findings', (r.data?.data?.totalFindings ?? 0) > 0,
            `totalFindings=${r.data?.data?.totalFindings}`);
    }

    // ── POST /recommendations/generate Run 1 ──────────────────────────────────
    console.log('\nRECOMM API — POST /recommendations/generate (Run 1)');
    let count1 = 0;
    let totalSavings = 0;
    {
        const r = await request('POST', '/api/v1/recommendations/generate', {}, token);
        check('POST /generate returns 200', r.status === 200);
        check('success=true', r.data?.success === true);
        const d = r.data?.data;
        check('totalAssessmentsProcessed present', d?.totalAssessmentsProcessed !== undefined);
        check('totalRecommendationsGenerated present', d?.totalRecommendationsGenerated !== undefined);
        check('estimatedTotalSavings present', d?.estimatedTotalSavings !== undefined);
        check('priorityCounts present', !!d?.priorityCounts);
        check('categoryCounts present', !!d?.categoryCounts);
        count1 = d?.totalRecommendationsGenerated ?? 0;
        totalSavings = d?.estimatedTotalSavings ?? 0;
        check('At least 1 recommendation generated', count1 >= 1, `generated=${count1}`);
        console.log(`     [Generate R1] Assessments: ${d?.totalAssessmentsProcessed}, Recommendations: ${count1}, Savings: $${totalSavings}`);
    }

    // ── POST /recommendations/generate Run 2 — idempotency ───────────────────
    console.log('\nRECOMM API — POST /recommendations/generate (Run 2 — idempotency)');
    {
        const r = await request('POST', '/api/v1/recommendations/generate', {}, token);
        check('POST /generate Run 2 returns 200', r.status === 200);
        const count2 = r.data?.data?.totalRecommendationsGenerated ?? 0;
        check('Same recommendation count on re-run (upsert, no duplicates)',
            count2 === count1, `run1=${count1}, run2=${count2}`);
    }

    // ── GET /recommendations/summary ──────────────────────────────────────────
    console.log('\nRECOMM API — GET /recommendations/summary');
    {
        const r = await request('GET', '/api/v1/recommendations/summary', undefined, token);
        check('GET /summary returns 200', r.status === 200);
        check('success=true', r.data?.success === true);
        const d = r.data?.data;
        check('totalRecommendations present', d?.totalRecommendations !== undefined);
        check('pendingCount present', d?.pendingCount !== undefined);
        check('estimatedTotalSavings present', d?.estimatedTotalSavings !== undefined);
        check('priorityCounts present', !!d?.priorityCounts);
        check('typeCounts present', !!d?.typeCounts);
        console.log(`     [Summary] Total: ${d?.totalRecommendations}, Savings: $${d?.estimatedTotalSavings}`);
    }

    // ── GET /recommendations ─────────────────────────────────────────────────
    console.log('\nRECOMM API — GET /recommendations');
    let firstId: string | undefined;
    {
        const r = await request('GET', '/api/v1/recommendations', undefined, token);
        check('GET /recommendations returns 200', r.status === 200);
        check('success=true', r.data?.success === true);
        check('total field present', r.data?.total !== undefined);
        check('data is array', Array.isArray(r.data?.data));
        const item = r.data?.data?.[0];
        if (item) {
            firstId = item.id ?? (typeof item._id === 'string' ? item._id : String(item._id));
            check('finding has resource', !!item.resource);
            check('finding has recommendation_type', !!item.recommendation_type);
            check('finding has priority', !!item.priority);
            check('finding has predicted_savings', item.predicted_savings !== undefined);
            check('finding has confidence_score', item.confidence_score !== undefined);
            check('finding has recommendation_reason', !!item.recommendation_reason);
            check('finding has savings_basis', !!item.savings_basis);
            check('finding has status', !!item.status);
        } else {
            check('at least one recommendation returned', false, 'empty array');
        }
    }

    // ── GET /recommendations?priority=HIGH ────────────────────────────────────
    console.log('\nRECOMM API — GET /recommendations?priority=HIGH');
    {
        const r = await request('GET', '/api/v1/recommendations?priority=HIGH', undefined, token);
        check('GET /recommendations?priority=HIGH returns 200', r.status === 200);
        const items = r.data?.data ?? [];
        check('All returned items have HIGH priority',
            items.every((x: any) => x.priority === 'HIGH') || r.data?.total === 0,
            `total=${r.data?.total}`);
    }

    // ── GET /recommendations?priority=CRITICAL ────────────────────────────────
    console.log('\nRECOMM API — GET /recommendations?priority=CRITICAL');
    {
        const r = await request('GET', '/api/v1/recommendations?priority=CRITICAL', undefined, token);
        check('GET /recommendations?priority=CRITICAL returns 200', r.status === 200);
    }

    // ── GET /recommendations/:id ──────────────────────────────────────────────
    console.log('\nRECOMM API — GET /recommendations/:id');
    if (firstId) {
        const r = await request('GET', `/api/v1/recommendations/${firstId}`, undefined, token);
        check(`GET /recommendations/${firstId} returns 200`, r.status === 200);
        check('success=true', r.data?.success === true);
        const retId = r.data?.data?.id ?? (typeof r.data?.data?._id === 'string' ? r.data?.data?._id : String(r.data?.data?._id));
        check('Correct recommendation returned', retId === firstId, `returned=${retId}, expected=${firstId}`);
        check('waste_assessment field present', r.data?.data?.waste_assessment !== undefined);
        check('savings_basis field present', !!r.data?.data?.savings_basis);
    }

    // ── GET /recommendations/:id — bad ID → 404 ──────────────────────────────
    console.log('\nRECOMM API — GET /recommendations/:id bad ID → 404');
    {
        const r = await request('GET', '/api/v1/recommendations/not-a-valid-uuid', undefined, token);
        check('Bad ID returns 404', r.status === 404);
    }

    // ── PATCH /recommendations/:id/status ─────────────────────────────────────
    console.log('\nRECOMM API — PATCH /recommendations/:id/status → accepted');
    if (firstId) {
        const r = await request(
            'PATCH', `/api/v1/recommendations/${firstId}/status`,
            { status: 'accepted' }, token
        );
        check('PATCH /status returns 200', r.status === 200);
        check('success=true', r.data?.success === true);
        check('status is now accepted', r.data?.data?.status === 'accepted');
    }

    // ── PATCH with invalid status → 400 ──────────────────────────────────────
    console.log('\nRECOMM API — PATCH invalid status → 400');
    if (firstId) {
        const r = await request(
            'PATCH', `/api/v1/recommendations/${firstId}/status`,
            { status: 'bogus' }, token
        );
        check('Invalid status returns 400', r.status === 400);
    }

    // ── PATCH without token → 401 ─────────────────────────────────────────────
    console.log('\nAUTH — PATCH without token → 401');
    if (firstId) {
        const r = await request(
            'PATCH', `/api/v1/recommendations/${firstId}/status`,
            { status: 'pending' }
        );
        check('PATCH /status without token → 401', r.status === 401);
    }

    // ── Regression: Phase 18 waste APIs untouched ─────────────────────────────
    console.log('\nREGRESSION — Phase 18 waste APIs still functional');
    {
        const r1 = await request('GET', '/api/v1/waste/summary', undefined, token);
        check('GET /waste/summary still returns 200', r1.status === 200);
        const r2 = await request('GET', '/api/v1/waste/findings', undefined, token);
        check('GET /waste/findings still returns 200', r2.status === 200);
    }

    // ── Results ───────────────────────────────────────────────────────────────
    proc.kill();

    console.log('\n════════════════════════════════════════════════════════');
    console.log('  PHASE 19 — API VALIDATION RESULTS');
    console.log('════════════════════════════════════════════════════════');
    console.log(`\n  Total: ${passed + failed}  ✓ Passed: ${passed}  ✗ Failed: ${failed}`);
    if (log.length) {
        console.log('\nFailed tests:');
        log.forEach(l => console.log(l));
    }
    console.log('════════════════════════════════════════════════════════\n');

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('[Validator] Fatal error:', err);
    process.exit(1);
});
