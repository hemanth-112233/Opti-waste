// Test all authenticated endpoints using a fresh login via pure Node.js HTTP
// Run: npx ts-node test-endpoints.ts
import https from 'https';
import http from 'http';

const BASE = 'http://localhost:8001/api/v1';

function req(method: string, path: string, body?: object, token?: string): Promise<{ status: number; data: any }> {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE + path);
        const bodyStr = body ? JSON.stringify(body) : '';
        const options: http.RequestOptions = {
            hostname: url.hostname,
            port: url.port || 80,
            path: url.pathname + url.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(bodyStr),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        };
        const r = http.request(options, (res) => {
            let raw = '';
            res.on('data', chunk => raw += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode ?? 0, data: JSON.parse(raw) }); }
                catch { resolve({ status: res.statusCode ?? 0, data: raw }); }
            });
        });
        r.on('error', reject);
        if (bodyStr) r.write(bodyStr);
        r.end();
    });
}

const P = (v: boolean, name: string, detail = '') => {
    console.log(`  ${v ? '✓ PASS' : '✗ FAIL'}: ${name}${detail ? ' — ' + detail : ''}`);
    if (!v) process.exitCode = 1;
};

(async () => {
    console.log('\n=== Test A: Signup (Yasin) ===');
    const a = await req('POST', '/auth/signup', { name: 'Yasin Kumar', email: 'yasin127@gmail.com', password: 'Password123!' });
    P(a.status === 201 || (a.status === 400 && a.data?.code === 'CONFLICT'), 'Signup 201 or already-exists 400', `got ${a.status}`);

    console.log('\n=== Test B: Login (email field) ===');
    const b = await req('POST', '/auth/login', { email: 'yasin127@gmail.com', password: 'Password123!' });
    P(b.status === 200, 'Login 200', `got ${b.status}`);
    P(b.data?.success === true, 'Login success:true');
    P(!!b.data?.access_token, 'Login has access_token');
    P(!!b.data?.refresh_token, 'Login has refresh_token');
    P(b.data?.user?.name === 'Yasin Kumar', 'Login user.name=Yasin Kumar', `got "${b.data?.user?.name}"`);
    P(b.data?.user?.email === 'yasin127@gmail.com', 'Login user.email');
    P(b.data?.user?.role === 'User', 'Login user.role=User', `got "${b.data?.user?.role}"`);
    P(!b.data?.user?.password_hash, 'No password_hash in response');
    const token1 = b.data?.access_token;
    const refresh1 = b.data?.refresh_token;

    console.log('\n=== Test C: GET /auth/me ===');
    const c = await req('GET', '/auth/me', undefined, token1);
    P(c.status === 200, '/me 200', `got ${c.status}`);
    P(c.data?.success === true, '/me success:true');
    P(c.data?.user?.name === 'Yasin Kumar', '/me user.name=Yasin Kumar', `got "${c.data?.user?.name}"`);
    P(!c.data?.user?.password_hash, '/me no password_hash');

    console.log('\n=== Test D: Dashboard APIs ===');
    const d1 = await req('GET', '/resources/dashboard/summary', undefined, token1);
    P(d1.status === 200, 'Resource summary 200', `got ${d1.status}`);

    const d2 = await req('GET', '/metrics/dashboard', undefined, token1);
    P(d2.status === 200, 'Metrics dashboard 200', `got ${d2.status}`);

    const d3 = await req('GET', '/costs/dashboard', undefined, token1);
    P(d3.status === 200, 'Costs dashboard 200', `got ${d3.status}`);

    const d4 = await req('GET', '/providers', undefined, token1);
    P(d4.status === 200, 'Providers 200', `got ${d4.status}`);

    const d5 = await req('GET', '/resources', undefined, token1);
    P(d5.status === 200, 'Resources 200', `got ${d5.status}`);

    console.log('\n=== Test E: Refresh Token ===');
    const e = await req('POST', '/auth/refresh', { refresh_token: refresh1 });
    P(e.status === 200, 'Refresh 200', `got ${e.status}`);
    P(!!e.data?.access_token, 'Refresh new access_token');
    P(e.data?.user?.name === 'Yasin Kumar', 'Refresh user.name', `got "${e.data?.user?.name}"`);

    console.log('\n=== Test F: 401 without token ===');
    const f = await req('GET', '/resources');
    P(f.status === 401, '401 without token', `got ${f.status}`);

    console.log('\n=== Test G: Logout ===');
    const g = await req('POST', '/auth/logout', {}, token1);
    P(g.status === 200, 'Logout 200', `got ${g.status}`);
    P(g.data?.success === true, 'Logout success:true');

    console.log('\n=== Test H: User Switching ===');
    await req('POST', '/auth/signup', { name: 'Test User', email: 'testuser@optiwaste.com', password: 'Password456!' });
    const h1 = await req('POST', '/auth/login', { email: 'testuser@optiwaste.com', password: 'Password456!' });
    P(h1.status === 200, 'User2 login 200', `got ${h1.status}`);
    const token2 = h1.data?.access_token;

    const me1 = await req('GET', '/auth/me', undefined, token1);
    const me2 = await req('GET', '/auth/me', undefined, token2);
    P(me1.data?.user?.name === 'Yasin Kumar', 'Token1 /me = Yasin Kumar', `got "${me1.data?.user?.name}"`);
    P(me2.data?.user?.name === 'Test User', 'Token2 /me = Test User', `got "${me2.data?.user?.name}"`);
    P(me1.data?.user?.name !== me2.data?.user?.name, 'User isolation confirmed');

    console.log('\n=== Dashboard Data Check ===');
    console.log('Resource summary:', JSON.stringify(d1.data));
    console.log('Metrics:', JSON.stringify({ avg_cpu: d2.data?.avg_cpu_utilization, avg_mem: d2.data?.avg_memory_utilization }));
    console.log('Costs:', JSON.stringify({ monthly: d3.data?.total_monthly_cost }));
    console.log('Providers count:', d4.data?.total ?? 0);

    console.log('\n========================================');
    console.log(process.exitCode === 1 ? 'SOME TESTS FAILED' : 'ALL TESTS PASSED');
    console.log('========================================\n');
})();
