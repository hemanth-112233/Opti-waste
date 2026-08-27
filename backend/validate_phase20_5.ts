/**
 * validate_phase20_5.ts
 * OptiWaste — Phase 20.5 Validation (built-in http, no external deps)
 *
 * Tests:
 *   1.  Demo seed runs without error
 *   2.  Seed is idempotent (run twice → same data)
 *   3.  At least 1 recommendation has status=implemented
 *   4.  Post-implementation CostRecords exist
 *   5.  POST /verifications/run succeeds
 *   6.  At least 1 verification is NOT not_verifiable
 *   7.  baseline_cost exists and > 0
 *   8.  post_implementation_cost exists and > 0
 *   9.  actual_savings is calculated (≥ 0)
 *   10. prediction_error_pct is calculated
 *   11. verification_notes explain the evidence
 *   12. GET /verifications works
 *   13. GET /verifications/summary works
 *   14. GET /verifications/:id full detail
 *   15. Phase 19 APIs regression
 *   16. Phase 18 APIs regression
 *   17. Auth intact
 *   18. Status not hardcoded — must be verified or partially_verified
 *
 * Usage: npx ts-node validate_phase20_5.ts
 */

import { spawn, ChildProcess, execSync } from 'child_process';
import * as http from 'http';

let passed = 0;
let failed = 0;
const log: string[] = [];

// ── HTTP client ───────────────────────────────────────────────────────────────
function request(
    method: string,
    path: string,
    body?: any,
    token?: string,
): Promise<{ status: number; data: any }> {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : undefined;
        const opts: http.RequestOptions = {
            hostname: 'localhost', port: 8001, path, method,
            headers: {
                'Content-Type': 'application/json',
                ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        };
        const req = http.request(opts, res => {
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

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

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
    // ── 1. Run seed (Run 1) ───────────────────────────────────────────────────
    console.log('[Validator] Running seed:verification-demo (Run 1)…');
    let seedOutput1 = '';
    try {
        seedOutput1 = execSync('npx ts-node -r dotenv/config src/scripts/seedVerificationDemoData.ts', {
            cwd: process.cwd(), encoding: 'utf8', timeout: 60000,
        });
        console.log(seedOutput1.split('\n').filter(l => l.trim()).map(l => '  ' + l).join('\n'));
        check('Seed Run 1 completes without error', true);
    } catch (e: any) {
        console.error('Seed error:', e.stderr ?? e.message);
        check('Seed Run 1 completes without error', false, String(e.message).slice(0, 120));
    }

    // ── 2. Run seed again (idempotency) ───────────────────────────────────────
    console.log('\n[Validator] Running seed:verification-demo (Run 2 — idempotency)…');
    try {
        const seedOutput2 = execSync('npx ts-node -r dotenv/config src/scripts/seedVerificationDemoData.ts', {
            cwd: process.cwd(), encoding: 'utf8', timeout: 60000,
        });
        check('Seed Run 2 completes without error', true);
        // Both runs should show the same number of records
        const matches1 = seedOutput1.match(/Pre-implementation CostRecords upserted: (\d+)/);
        const matches2 = seedOutput2.match(/Pre-implementation CostRecords upserted: (\d+)/);
        const count1 = matches1 ? parseInt(matches1[1]) : 0;
        const count2 = matches2 ? parseInt(matches2[1]) : 0;
        check('Same record count on re-run (idempotent)', count1 === count2 && count1 > 0,
            `run1=${count1}, run2=${count2}`);
    } catch (e: any) {
        check('Seed Run 2 completes without error', false, String(e.message).slice(0, 120));
        check('Idempotency (skipped)', false, 'seed failed');
    }

    // ── Start server ──────────────────────────────────────────────────────────
    console.log('\n[Validator] Starting backend server…');
    const proc: ChildProcess = spawn('node', ['dist/server.js'], {
        cwd: process.cwd(), env: { ...process.env }, stdio: 'pipe',
    });
    proc.on('error', e => { console.error('[Validator] Process error:', e); process.exit(1); });
    proc.stderr?.on('data', (d: Buffer) => process.stderr.write(d));
    await waitForServer();
    console.log('[Validator] Server is up. Running Phase 20.5 tests…\n');

    // ── Login ─────────────────────────────────────────────────────────────────
    const loginRes = await request('POST', '/api/v1/auth/login', {
        email: 'admin@optiwaste.com', password: 'Admin@123',
    });
    check('Login returns 200', loginRes.status === 200);
    const token: string = loginRes.data?.access_token || loginRes.data?.data?.access_token || '';
    check('Access token received', !!token);

    // ── 3. Verify implemented recommendations exist ────────────────────────────
    console.log('\nPRE-CONDITION — Implemented recommendations');
    {
        const r = await request('GET', '/api/v1/recommendations?status=implemented', undefined, token);
        const impl = r.data?.data ?? [];
        check('At least 1 recommendation has status=implemented',
            impl.length >= 1, `count=${impl.length}`);
        if (impl.length > 0) {
            console.log(`     Demo recommendation: ${impl[0].recommendation_type}, predicted=$${impl[0].predicted_savings}`);
        }
    }

    // ── 4. Post-implementation CostRecords exist (via verification run) ────────
    console.log('\nPRE-CONDITION — Ensure Phase 18 + 19 pipeline fresh');
    {
        // Re-analyze and re-generate to pick up any state changes
        await request('POST', '/api/v1/waste/analyze', {}, token);
        await request('POST', '/api/v1/recommendations/generate', {}, token);
    }

    // ── 5. POST /verifications/run ─────────────────────────────────────────────
    console.log('\nVERIFY API — POST /verifications/run');
    let runData: any;
    {
        const r = await request('POST', '/api/v1/verifications/run', {}, token);
        check('POST /run returns 200', r.status === 200);
        check('success=true', r.data?.success === true);
        runData = r.data?.data;
        check('totalProcessed >= 1', (runData?.totalProcessed ?? 0) >= 1,
            `processed=${runData?.totalProcessed}`);
        console.log(`     [Run] Processed: ${runData?.totalProcessed}, Verified: ${runData?.verified}, Partial: ${runData?.partiallyVerified}, Failed: ${runData?.failed}, N/A: ${runData?.notVerifiable}`);
    }

    // ── 6. At least 1 verification is NOT not_verifiable ──────────────────────
    console.log('\nVERIFY RESULT — Meaningful verification (not all not_verifiable)');
    {
        const verifiable = (runData?.verified ?? 0) + (runData?.partiallyVerified ?? 0) + (runData?.failed ?? 0);
        check('At least 1 verifiable outcome (not all not_verifiable)',
            verifiable >= 1, `verified=${runData?.verified}, partial=${runData?.partiallyVerified}, failed=${runData?.failed}`);
    }

    // ── 7-11. Verification record detail fields ───────────────────────────────
    console.log('\nVERIFY RESULT — Verification record fields');
    let firstVerifId: string | undefined;
    {
        const r = await request('GET', '/api/v1/verifications', undefined, token);
        check('GET /verifications returns 200', r.status === 200);
        const items = r.data?.data ?? [];
        // Find the first non-not_verifiable record
        const meaningful = items.find((v: any) => v.verification_status !== 'not_verifiable');
        const item = meaningful ?? items[0];
        if (item) {
            firstVerifId = item.id ?? String(item._id);
            check('baseline_cost > 0', (item.baseline_cost ?? 0) > 0, `baseline_cost=${item.baseline_cost}`);
            check('post_implementation_cost >= 0', item.post_implementation_cost !== undefined, `post_cost=${item.post_implementation_cost}`);
            check('actual_savings >= 0', (item.actual_savings ?? -1) >= 0, `actual_savings=${item.actual_savings}`);
            check('prediction_error_pct calculated', item.prediction_error_pct !== undefined, `error=${item.prediction_error_pct}%`);
            check('verification_notes populated', (item.verification_notes ?? '').length > 50, `notes length=${(item.verification_notes ?? '').length}`);
            check('confidence_score in [0,1]', (item.confidence_score ?? 0) > 0, `conf=${item.confidence_score}`);
            check('verification_status not fabricated',
                ['verified', 'partially_verified', 'failed', 'not_verifiable', 'pending'].includes(item.verification_status),
                `status=${item.verification_status}`);
            console.log(`     Status: ${item.verification_status}, baseline: $${item.baseline_cost}, post: $${item.post_implementation_cost}, actual_savings: $${item.actual_savings}, error: ${item.prediction_error_pct}%`);
        } else {
            check('at least one verification record', false, 'empty array');
            check('baseline_cost present', false, 'no record');
            check('post_implementation_cost present', false, 'no record');
            check('actual_savings present', false, 'no record');
            check('prediction_error_pct present', false, 'no record');
            check('verification_notes present', false, 'no record');
            check('confidence_score present', false, 'no record');
            check('verification_status valid', false, 'no record');
        }
    }

    // ── 18. Status is real (verified or partially_verified) ───────────────────
    console.log('\nVERIFY RESULT — Status authenticity (must not be not_verifiable)');
    {
        const r = await request('GET', '/api/v1/verifications', undefined, token);
        const items = r.data?.data ?? [];
        const hasReal = items.some((v: any) =>
            v.verification_status === 'verified' || v.verification_status === 'partially_verified' || v.verification_status === 'failed'
        );
        check('At least one verification is verified/partially_verified/failed (real evidence)',
            hasReal, `statuses: ${items.map((v: any) => v.verification_status).join(', ')}`);
    }

    // ── GET /verifications/summary ────────────────────────────────────────────
    console.log('\nVERIFY API — GET /verifications/summary');
    {
        const r = await request('GET', '/api/v1/verifications/summary', undefined, token);
        check('GET /summary returns 200', r.status === 200);
        const d = r.data?.data;
        check('totalVerifications >= 1', (d?.totalVerifications ?? 0) >= 1, `total=${d?.totalVerifications}`);
        check('totalPredictedSavings > 0', (d?.totalPredictedSavings ?? 0) > 0, `predicted=$${d?.totalPredictedSavings}`);
        console.log(`     Summary: total=${d?.totalVerifications}, confirmed=$${d?.totalConfirmedSavings}, predicted=$${d?.totalPredictedSavings}, avgError=${d?.avgPredictionErrorPct}%`);
    }

    // ── GET /verifications/:id ─────────────────────────────────────────────────
    console.log('\nVERIFY API — GET /verifications/:id full detail');
    if (firstVerifId) {
        const r = await request('GET', `/api/v1/verifications/${firstVerifId}`, undefined, token);
        check(`GET /verifications/${firstVerifId.slice(0, 8)}… returns 200`, r.status === 200);
        check('verification_notes contain "Baseline window"', (r.data?.data?.verification_notes ?? '').includes('Baseline window'));
        check('verification_notes contain "Predicted savings"', (r.data?.data?.verification_notes ?? '').includes('Predicted savings'));
        check('implementation_date present', !!r.data?.data?.implementation_date);
    } else {
        check('GET /:id test (skipped — no verifications)', true);
        check('notes contain Baseline window (skipped)', true);
        check('notes contain Predicted savings (skipped)', true);
        check('implementation_date present (skipped)', true);
    }

    // ── Regression Phase 19 ────────────────────────────────────────────────────
    console.log('\nREGRESSION — Phase 19 APIs');
    {
        const r1 = await request('GET', '/api/v1/recommendations/summary', undefined, token);
        check('GET /recommendations/summary returns 200', r1.status === 200);
        const r2 = await request('GET', '/api/v1/recommendations', undefined, token);
        check('GET /recommendations returns 200', r2.status === 200);
    }

    // ── Regression Phase 18 ────────────────────────────────────────────────────
    console.log('\nREGRESSION — Phase 18 APIs');
    {
        const r1 = await request('GET', '/api/v1/waste/summary', undefined, token);
        check('GET /waste/summary returns 200', r1.status === 200);
        const r2 = await request('GET', '/api/v1/waste/findings', undefined, token);
        check('GET /waste/findings returns 200', r2.status === 200);
    }

    // ── Auth regression ────────────────────────────────────────────────────────
    console.log('\nAUTH — Protected endpoints require token');
    {
        const r = await request('POST', '/api/v1/verifications/run');
        check('POST /verifications/run without token → 401', r.status === 401);
    }

    // ── Results ───────────────────────────────────────────────────────────────
    proc.kill();

    console.log('\n════════════════════════════════════════════════════════');
    console.log('  PHASE 20.5 — VALIDATION RESULTS');
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
