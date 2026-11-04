/**
 * Automated Verification Script for Phase 4: Frontend & Full User Journey
 * Tests:
 * 1. Static asset serving for index.html, register.html, dashboard.html, CSS and JS
 * 2. Complete end-to-end user journey matching the frontend UI flow
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest({ method, path, body = null, headers = {} }) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const postData = body ? JSON.stringify(body) : null;

    const reqHeaders = {
      ...headers,
      ...(postData
        ? {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          }
        : {}),
    };

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(rawData);
          } catch (e) {
            json = null;
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: json,
            raw: rawData,
          });
        });
      }
    );

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function extractCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return null;
  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const match = cookieStr.match(/token=([^;]+)/);
  return match ? `token=${match[1]}` : null;
}

async function runTests() {
  console.log('========================================================');
  console.log('       RUNNING PHASE 4 FRONTEND JOURNEY TEST SUITE      ');
  console.log('========================================================\n');

  let testsPassed = 0;
  let testsTotal = 0;

  function assert(condition, testName, details = '') {
    testsTotal++;
    if (condition) {
      console.log(`[PASS] Test ${testsTotal}: ${testName}`);
      testsPassed++;
    } else {
      console.error(`[FAIL] Test ${testsTotal}: ${testName}`);
      if (details) console.error(`       Details: ${details}`);
    }
  }

  const ts = Date.now();
  let sessionCookie = null;
  let campaign1Id = null;
  let campaign2Id = null;

  try {
    // 1. Static asset: index.html (Login)
    const indexRes = await makeRequest({ method: 'GET', path: '/' });
    assert(
      indexRes.statusCode === 200 &&
        indexRes.raw.includes('Welcome back') &&
        indexRes.raw.includes('login-form'),
      'GET / serves index.html (Login page)'
    );

    // 2. Static asset: register.html (Registration)
    const registerRes = await makeRequest({ method: 'GET', path: '/register.html' });
    assert(
      registerRes.statusCode === 200 &&
        registerRes.raw.includes('Create an account') &&
        registerRes.raw.includes('register-form'),
      'GET /register.html serves registration page'
    );

    // 3. Static asset: dashboard.html (Dashboard)
    const dashRes = await makeRequest({ method: 'GET', path: '/dashboard.html' });
    assert(
      dashRes.statusCode === 200 &&
        dashRes.raw.includes('Campaign Dashboard') &&
        dashRes.raw.includes('modal-create') &&
        dashRes.raw.includes('modal-edit') &&
        dashRes.raw.includes('modal-delete'),
      'GET /dashboard.html serves dashboard page with all modal dialogs'
    );

    // 4. Static asset: CSS stylesheet
    const cssRes = await makeRequest({ method: 'GET', path: '/css/style.css' });
    assert(
      cssRes.statusCode === 200 && cssRes.raw.includes('--primary: #2563eb;'),
      'GET /css/style.css serves SaaS theme styling'
    );

    // 5. Static assets: Client JavaScript
    const authJsRes = await makeRequest({ method: 'GET', path: '/js/auth.js' });
    const dashJsRes = await makeRequest({ method: 'GET', path: '/js/dashboard.js' });
    assert(
      authJsRes.statusCode === 200 &&
        authJsRes.raw.includes('handleLogin') &&
        dashJsRes.statusCode === 200 &&
        dashJsRes.raw.includes('loadCampaigns'),
      'GET /js/auth.js and /js/dashboard.js serve client application scripts'
    );

    // 6. User Journey: Register new SaaS user
    const regRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: {
        name: 'Sarah Connor',
        email: `sarah_${ts}@example.com`,
        password: 'Resistance2026!',
      },
    });
    sessionCookie = extractCookie(regRes.headers);
    assert(
      regRes.statusCode === 201 && sessionCookie !== null,
      'User journey: Registration succeeds and establishes session cookie'
    );

    // 7. User Journey: Verify dashboard session authentication
    const meRes = await makeRequest({
      method: 'GET',
      path: '/api/auth/me',
      headers: { Cookie: sessionCookie },
    });
    assert(
      meRes.statusCode === 200 && meRes.body.user.name === 'Sarah Connor',
      'User journey: Dashboard verifies active session (/api/auth/me)'
    );

    // 8. User Journey: Initial dashboard stats (0 campaigns)
    const initialStats = await makeRequest({
      method: 'GET',
      path: '/api/campaigns/stats',
      headers: { Cookie: sessionCookie },
    });
    assert(
      initialStats.statusCode === 200 && initialStats.body.data.total === 0,
      'User journey: Dashboard initial metrics load with 0 campaigns'
    );

    // 9. User Journey: Create Campaign 1 (Active)
    const c1Res = await makeRequest({
      method: 'POST',
      path: '/api/campaigns',
      headers: { Cookie: sessionCookie },
      body: { campaign_name: 'Q4 Cyber Blast', status: 'Active' },
    });
    campaign1Id = c1Res.body?.data?.id;
    assert(
      c1Res.statusCode === 201 && c1Res.body.data.status === 'Active',
      'User journey: User creates "Q4 Cyber Blast" via modal flow'
    );

    // 10. User Journey: Create Campaign 2 (Paused)
    const c2Res = await makeRequest({
      method: 'POST',
      path: '/api/campaigns',
      headers: { Cookie: sessionCookie },
      body: { campaign_name: 'Winter Retargeting', status: 'Paused' },
    });
    campaign2Id = c2Res.body?.data?.id;
    assert(
      c2Res.statusCode === 201 && c2Res.body.data.status === 'Paused',
      'User journey: User creates "Winter Retargeting" with status "Paused"'
    );

    // 11. User Journey: Verify dashboard stats updated
    const updatedStats = await makeRequest({
      method: 'GET',
      path: '/api/campaigns/stats',
      headers: { Cookie: sessionCookie },
    });
    assert(
      updatedStats.statusCode === 200 &&
        updatedStats.body.data.total === 2 &&
        updatedStats.body.data.active === 1 &&
        updatedStats.body.data.paused === 1,
      'User journey: Dashboard metrics dynamically updated (Total: 2, Active: 1, Paused: 1)'
    );

    // 12. User Journey: Search campaigns toolbar
    const searchRes = await makeRequest({
      method: 'GET',
      path: '/api/campaigns?search=Cyber',
      headers: { Cookie: sessionCookie },
    });
    assert(
      searchRes.statusCode === 200 &&
        searchRes.body.count === 1 &&
        searchRes.body.data[0].campaign_name === 'Q4 Cyber Blast',
      'User journey: Live search input filters to matching campaign'
    );

    // 13. User Journey: Status filter toolbar
    const filterRes = await makeRequest({
      method: 'GET',
      path: '/api/campaigns?status=Paused',
      headers: { Cookie: sessionCookie },
    });
    assert(
      filterRes.statusCode === 200 &&
        filterRes.body.count === 1 &&
        filterRes.body.data[0].campaign_name === 'Winter Retargeting',
      'User journey: Status filter dropdown isolates "Paused" campaigns'
    );

    // 14. User Journey: Edit Campaign 2 modal flow
    const updateRes = await makeRequest({
      method: 'PUT',
      path: `/api/campaigns/${campaign2Id}`,
      headers: { Cookie: sessionCookie },
      body: { campaign_name: 'Winter Mega Retargeting', status: 'Completed' },
    });
    assert(
      updateRes.statusCode === 200 &&
        updateRes.body.data.campaign_name === 'Winter Mega Retargeting' &&
        updateRes.body.data.status === 'Completed',
      'User journey: Edit modal updates campaign name and marks status "Completed"'
    );

    // 15. User Journey: Delete Campaign 1 confirmation flow
    const deleteRes = await makeRequest({
      method: 'DELETE',
      path: `/api/campaigns/${campaign1Id}`,
      headers: { Cookie: sessionCookie },
    });
    assert(
      deleteRes.statusCode === 200 && deleteRes.body.success === true,
      'User journey: Delete confirmation modal removes campaign'
    );

    // 16. User Journey: Verify table and stats post-deletion
    const postDelStats = await makeRequest({
      method: 'GET',
      path: '/api/campaigns/stats',
      headers: { Cookie: sessionCookie },
    });
    assert(
      postDelStats.statusCode === 200 &&
        postDelStats.body.data.total === 1 &&
        postDelStats.body.data.completed === 1,
      'User journey: Post-delete stats reflect 1 remaining Completed campaign'
    );

    // 17. User Journey: Logout
    const logoutRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/logout',
      headers: { Cookie: sessionCookie },
    });
    assert(
      logoutRes.statusCode === 200,
      'User journey: Logout successfully terminates user session'
    );

    // 18. User Journey: Subsequent access to dashboard API is rejected
    const unauthCheck = await makeRequest({
      method: 'GET',
      path: '/api/auth/me',
      headers: { Cookie: 'token=' },
    });
    assert(
      unauthCheck.statusCode === 401,
      'User journey: Logged-out user rejected with 401 and redirected to login'
    );

    console.log('\n========================================================');
    console.log(`RESULTS: ${testsPassed} / ${testsTotal} tests passed.`);
    console.log('========================================================');

    if (testsPassed === testsTotal) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during test run:', err);
    process.exit(1);
  }
}

runTests();

