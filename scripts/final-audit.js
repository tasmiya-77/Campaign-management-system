/**
 * Comprehensive Final Audit Script for Campaign Management System
 * Executes all 15 audit tests + security verifications against the running system.
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
  return {
    raw: cookieStr,
    cookieHeader: match ? `token=${match[1]}` : null,
    isHttpOnly: cookieStr.toLowerCase().includes('httponly'),
    isSameSiteStrict: cookieStr.toLowerCase().includes('samesite=strict'),
  };
}

async function runAudit() {
  console.log('================================================================');
  console.log('       CAMPAIGN MANAGEMENT SYSTEM - COMPREHENSIVE FINAL AUDIT   ');
  console.log('================================================================\n');

  let auditPassed = 0;
  let auditTotal = 0;

  function report(condition, requirementName, details = '') {
    auditTotal++;
    if (condition) {
      console.log(`[AUDIT PASS] #${auditTotal}: ${requirementName}`);
      auditPassed++;
    } else {
      console.error(`[AUDIT FAIL] #${auditTotal}: ${requirementName}`);
      if (details) console.error(`             Details: ${details}`);
    }
  }

  const ts = Date.now();
  let cookieUserA = null;
  let cookieUserB = null;
  let userACampaignId = null;
  let userBCampaignId = null;

  try {
    // -------------------------------------------------------------
    // 1. User Registration
    // -------------------------------------------------------------
    const regRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: {
        name: 'Audit User Alpha',
        email: `alpha_${ts}@audit.com`,
        password: 'ValidPassword123!',
      },
    });
    const cookieDataA = extractCookie(regRes.headers);
    cookieUserA = cookieDataA?.cookieHeader;

    report(
      regRes.statusCode === 201 &&
        regRes.body.success === true &&
        regRes.body.user.email === `alpha_${ts}@audit.com` &&
        !regRes.body.user.password &&
        cookieDataA.isHttpOnly &&
        cookieDataA.isSameSiteStrict,
      '1. User registration succeeds with 201 Created and secure HTTP-only cookie'
    );

    // -------------------------------------------------------------
    // 2. Duplicate Email Prevention
    // -------------------------------------------------------------
    const dupRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: {
        name: 'Imposter Alpha',
        email: `alpha_${ts}@audit.com`,
        password: 'AnotherPassword123!',
      },
    });
    report(
      dupRes.statusCode === 409 && dupRes.body.success === false,
      '2. Duplicate email registration rejected with 409 Conflict'
    );

    // -------------------------------------------------------------
    // 3. Login with Valid Credentials
    // -------------------------------------------------------------
    const loginRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: {
        email: `alpha_${ts}@audit.com`,
        password: 'ValidPassword123!',
      },
    });
    report(
      loginRes.statusCode === 200 &&
        loginRes.body.success === true &&
        loginRes.body.user.email === `alpha_${ts}@audit.com` &&
        !loginRes.body.user.password,
      '3. Login with valid credentials succeeds with 200 OK and safe user payload'
    );

    // -------------------------------------------------------------
    // 4. Login with Invalid Credentials
    // -------------------------------------------------------------
    const badLoginRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: {
        email: `alpha_${ts}@audit.com`,
        password: 'WrongPassword999!',
      },
    });
    report(
      badLoginRes.statusCode === 401 && badLoginRes.body.success === false,
      '4. Login with invalid credentials rejected with 401 Unauthorized'
    );

    // -------------------------------------------------------------
    // 5. Protected Dashboard Access (/api/auth/me)
    // -------------------------------------------------------------
    const meRes = await makeRequest({
      method: 'GET',
      path: '/api/auth/me',
      headers: { Cookie: cookieUserA },
    });
    const unauthMeRes = await makeRequest({
      method: 'GET',
      path: '/api/auth/me',
    });
    report(
      meRes.statusCode === 200 && unauthMeRes.statusCode === 401,
      '5. Protected dashboard access verified (200 with session, 401 without)'
    );

    // -------------------------------------------------------------
    // 6. User Logout
    // -------------------------------------------------------------
    const logoutRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/logout',
      headers: { Cookie: cookieUserA },
    });
    const logoutCookie = logoutRes.headers['set-cookie'];
    const cleared = logoutCookie && (logoutCookie[0].includes('Expires=Thu, 01 Jan 1970') || logoutCookie[0].includes('Max-Age=0'));
    report(
      logoutRes.statusCode === 200 && cleared,
      '6. User logout succeeds with 200 OK and clears session cookie'
    );

    // Re-login to continue testing User A's campaign capabilities
    const reloginRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: {
        email: `alpha_${ts}@audit.com`,
        password: 'ValidPassword123!',
      },
    });
    cookieUserA = extractCookie(reloginRes.headers)?.cookieHeader;

    // -------------------------------------------------------------
    // 7. Create Campaign
    // -------------------------------------------------------------
    const createRes1 = await makeRequest({
      method: 'POST',
      path: '/api/campaigns',
      headers: { Cookie: cookieUserA },
      body: { campaign_name: 'Summer Outreach', status: 'Active' },
    });
    userACampaignId = createRes1.body?.data?.id;

    const createRes2 = await makeRequest({
      method: 'POST',
      path: '/api/campaigns',
      headers: { Cookie: cookieUserA },
      body: { campaign_name: 'Autumn Clearance', status: 'Paused' },
    });

    report(
      createRes1.statusCode === 201 &&
        createRes1.body.data.campaign_name === 'Summer Outreach' &&
        createRes1.body.data.status === 'Active' &&
        createRes2.statusCode === 201,
      '7. Create campaigns succeeds with 201 Created and persisted values'
    );

    // -------------------------------------------------------------
    // 8. Display Campaigns
    // -------------------------------------------------------------
    const listRes = await makeRequest({
      method: 'GET',
      path: '/api/campaigns',
      headers: { Cookie: cookieUserA },
    });
    report(
      listRes.statusCode === 200 && listRes.body.count === 2,
      '8. Display campaigns lists all user-created records (count = 2)'
    );

    // -------------------------------------------------------------
    // 9. Update Campaign
    // -------------------------------------------------------------
    const updateRes = await makeRequest({
      method: 'PUT',
      path: `/api/campaigns/${userACampaignId}`,
      headers: { Cookie: cookieUserA },
      body: { campaign_name: 'Summer Mega Outreach', status: 'Completed' },
    });
    report(
      updateRes.statusCode === 200 &&
        updateRes.body.data.campaign_name === 'Summer Mega Outreach' &&
        updateRes.body.data.status === 'Completed',
      '9. Update campaign successfully modifies name and status'
    );

    // -------------------------------------------------------------
    // 10. Delete Campaign
    // -------------------------------------------------------------
    const deleteRes = await makeRequest({
      method: 'DELETE',
      path: `/api/campaigns/${createRes2.body.data.id}`,
      headers: { Cookie: cookieUserA },
    });
    const verifyDel = await makeRequest({
      method: 'GET',
      path: `/api/campaigns/${createRes2.body.data.id}`,
      headers: { Cookie: cookieUserA },
    });
    report(
      deleteRes.statusCode === 200 && verifyDel.statusCode === 404,
      '10. Delete campaign removes record permanently (subsequent GET returns 404)'
    );

    // -------------------------------------------------------------
    // 11. Search Campaigns
    // -------------------------------------------------------------
    const searchRes = await makeRequest({
      method: 'GET',
      path: '/api/campaigns?search=Mega',
      headers: { Cookie: cookieUserA },
    });
    report(
      searchRes.statusCode === 200 &&
        searchRes.body.count === 1 &&
        searchRes.body.data[0].campaign_name === 'Summer Mega Outreach',
      '11. Search campaigns filters by name substring (?search=Mega)'
    );

    // -------------------------------------------------------------
    // 12. Dashboard Statistics
    // -------------------------------------------------------------
    const statsRes = await makeRequest({
      method: 'GET',
      path: '/api/campaigns/stats',
      headers: { Cookie: cookieUserA },
    });
    report(
      statsRes.statusCode === 200 &&
        statsRes.body.data.total === 1 &&
        statsRes.body.data.completed === 1 &&
        statsRes.body.data.active === 0,
      '12. Dashboard statistics accurately aggregates live user data'
    );

    // -------------------------------------------------------------
    // 13. Campaign Ownership Isolation
    // -------------------------------------------------------------
    // Register User B (Beta)
    const regBRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: {
        name: 'Audit User Beta',
        email: `beta_${ts}@audit.com`,
        password: 'ValidPassword123!',
      },
    });
    cookieUserB = extractCookie(regBRes.headers)?.cookieHeader;

    const bCampaign = await makeRequest({
      method: 'POST',
      path: '/api/campaigns',
      headers: { Cookie: cookieUserB },
      body: { campaign_name: "Beta Confidential", status: 'Active' },
    });
    userBCampaignId = bCampaign.body?.data?.id;

    // User A attempts to read User B's campaign
    const crossRead = await makeRequest({
      method: 'GET',
      path: `/api/campaigns/${userBCampaignId}`,
      headers: { Cookie: cookieUserA },
    });
    // User A attempts to edit User B's campaign
    const crossEdit = await makeRequest({
      method: 'PUT',
      path: `/api/campaigns/${userBCampaignId}`,
      headers: { Cookie: cookieUserA },
      body: { campaign_name: 'Stolen' },
    });
    // User A attempts to delete User B's campaign
    const crossDelete = await makeRequest({
      method: 'DELETE',
      path: `/api/campaigns/${userBCampaignId}`,
      headers: { Cookie: cookieUserA },
    });

    report(
      crossRead.statusCode === 404 &&
        crossEdit.statusCode === 404 &&
        crossDelete.statusCode === 404,
      '13. Campaign ownership isolation prevents unauthorized cross-user Read/Update/Delete (404)'
    );

    // -------------------------------------------------------------
    // 14. Empty Database / User Without Campaigns Handling
    // -------------------------------------------------------------
    // Register User C (Charlie) with 0 campaigns
    const regCRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: {
        name: 'Charlie Empty',
        email: `charlie_${ts}@audit.com`,
        password: 'ValidPassword123!',
      },
    });
    const cookieUserC = extractCookie(regCRes.headers)?.cookieHeader;

    const emptyStats = await makeRequest({
      method: 'GET',
      path: '/api/campaigns/stats',
      headers: { Cookie: cookieUserC },
    });
    const emptyList = await makeRequest({
      method: 'GET',
      path: '/api/campaigns',
      headers: { Cookie: cookieUserC },
    });

    report(
      emptyStats.statusCode === 200 &&
        emptyStats.body.data.total === 0 &&
        emptyStats.body.data.active === 0 &&
        emptyList.statusCode === 200 &&
        emptyList.body.count === 0 &&
        Array.isArray(emptyList.body.data),
      '14. Empty database handling gracefully returns zeroes and empty arrays without errors'
    );

    // -------------------------------------------------------------
    // 15. Invalid Input Handling
    // -------------------------------------------------------------
    const invalidIdRes = await makeRequest({
      method: 'GET',
      path: '/api/campaigns/invalid_id_format',
      headers: { Cookie: cookieUserA },
    });
    const invalidStatusRes = await makeRequest({
      method: 'POST',
      path: '/api/campaigns',
      headers: { Cookie: cookieUserA },
      body: { campaign_name: 'Test', status: 'HackedStatus' },
    });
    const emptyNameRes = await makeRequest({
      method: 'POST',
      path: '/api/campaigns',
      headers: { Cookie: cookieUserA },
      body: { campaign_name: '   ', status: 'Active' },
    });

    report(
      invalidIdRes.statusCode === 400 &&
        invalidStatusRes.statusCode === 400 &&
        emptyNameRes.statusCode === 400,
      '15. Invalid input handling properly rejects malformed requests with 400 Bad Request'
    );

    // -------------------------------------------------------------
    // Security Verification: SQL Injection & JWT Tampering
    // -------------------------------------------------------------
    const sqliSearch = await makeRequest({
      method: 'GET',
      path: "/api/campaigns?search=' OR '1'='1",
      headers: { Cookie: cookieUserA },
    });
    const tamperedJwt = await makeRequest({
      method: 'GET',
      path: '/api/auth/me',
      headers: { Cookie: 'token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature' },
    });

    report(
      sqliSearch.statusCode === 200 &&
        sqliSearch.body.count === 0 &&
        tamperedJwt.statusCode === 401,
      'SECURITY: SQL injection safely neutralized via parameterization & tampered JWT rejected'
    );

    console.log('\n================================================================');
    console.log(`FINAL AUDIT RESULTS: ${auditPassed} / ${auditTotal} requirements verified.`);
    console.log('================================================================');

    if (auditPassed === auditTotal) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal audit failure:', err);
    process.exit(1);
  }
}

runAudit();

