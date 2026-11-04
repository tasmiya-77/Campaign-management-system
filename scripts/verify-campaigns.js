/**
 * Automated Verification Script for Phase 3: Campaign Management APIs
 * Tests:
 * 1. Authentication enforcement on all campaign endpoints (401)
 * 2. User registration and session setup for User A and User B
 * 3. Campaign creation with default and specified statuses (POST /api/campaigns)
 * 4. List user campaigns (GET /api/campaigns)
 * 5. Search campaigns by name (GET /api/campaigns?search=...)
 * 6. Filter campaigns by status (GET /api/campaigns?status=Active)
 * 7. Dashboard stats calculation (GET /api/campaigns/stats)
 * 8. Retrieve single campaign (GET /api/campaigns/:id)
 * 9. Update campaign details (PUT /api/campaigns/:id)
 * 10. Delete campaign (DELETE /api/campaigns/:id)
 * 11. STRICT OWNERSHIP ISOLATION:
 *     - User A cannot view User B's campaign
 *     - User A cannot edit User B's campaign
 *     - User A cannot delete User B's campaign
 *     - User B's stats are completely isolated from User A
 * 12. Input validation tests (invalid ID, missing name, invalid status)
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
            json = rawData;
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: json,
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
  console.log('       RUNNING PHASE 3 CAMPAIGN API TEST SUITE          ');
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
  let cookieUserA = null;
  let cookieUserB = null;
  let userACampaign1Id = null;
  let userACampaign2Id = null;
  let userACampaign3Id = null;
  let userACampaign4Id = null;
  let userBCampaign1Id = null;

  try {
    // 1. Unauthenticated security check: GET /api/campaigns
    const unauthGet = await makeRequest({ method: 'GET', path: '/api/campaigns' });
    assert(
      unauthGet.statusCode === 401,
      'Unauthenticated GET /api/campaigns rejected with 401',
      JSON.stringify(unauthGet.body)
    );

    // 2. Unauthenticated security check: POST /api/campaigns
    const unauthPost = await makeRequest({
      method: 'POST',
      path: '/api/campaigns',
      body: { campaign_name: 'Hacker' },
    });
    assert(
      unauthPost.statusCode === 401,
      'Unauthenticated POST /api/campaigns rejected with 401',
      JSON.stringify(unauthPost.body)
    );

    // 3. Register User A
    const regA = await makeRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: {
        name: 'Alice Manager',
        email: `alice_${ts}@example.com`,
        password: 'Password123!',
      },
    });
    cookieUserA = extractCookie(regA.headers);
    assert(
      regA.statusCode === 201 && cookieUserA !== null,
      'User A (Alice) registered and session cookie acquired'
    );

    // 4. Register User B
    const regB = await makeRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: {
        name: 'Bob Director',
        email: `bob_${ts}@example.com`,
        password: 'Password123!',
      },
    });
    cookieUserB = extractCookie(regB.headers);
    assert(
      regB.statusCode === 201 && cookieUserB !== null,
      'User B (Bob) registered and session cookie acquired'
    );

    // 5. Validation: Missing campaign_name
    const badCreate = await makeRequest({
      method: 'POST',
      path: '/api/campaigns',
      headers: { Cookie: cookieUserA },
      body: { status: 'Active' },
    });
    assert(
      badCreate.statusCode === 400,
      'POST /api/campaigns without name rejected with 400 Bad Request',
      JSON.stringify(badCreate.body)
    );

    // 6. Validation: Invalid status value
    const badStatus = await makeRequest({
      method: 'POST',
      path: '/api/campaigns',
      headers: { Cookie: cookieUserA },
      body: { campaign_name: 'Test', status: 'UnknownStatus' },
    });
    assert(
      badStatus.statusCode === 400,
      'POST /api/campaigns with invalid status rejected with 400 Bad Request',
      JSON.stringify(badStatus.body)
    );

    // 7. User A creates Campaign 1 (Default status -> Active)
    const c1 = await makeRequest({
      method: 'POST',
      path: '/api/campaigns',
      headers: { Cookie: cookieUserA },
      body: { campaign_name: 'Summer Sale' },
    });
    userACampaign1Id = c1.body?.data?.id;
    assert(
      c1.statusCode === 201 &&
        c1.body.success === true &&
        c1.body.data.campaign_name === 'Summer Sale' &&
        c1.body.data.status === 'Active',
      'User A creates Campaign 1 with default status "Active"',
      JSON.stringify(c1.body)
    );

    // 8. User A creates Campaign 2 (Paused)
    const c2 = await makeRequest({
      method: 'POST',
      path: '/api/campaigns',
      headers: { Cookie: cookieUserA },
      body: { campaign_name: 'Winter Clearance', status: 'Paused' },
    });
    userACampaign2Id = c2.body?.data?.id;
    assert(
      c2.statusCode === 201 && c2.body.data.status === 'Paused',
      'User A creates Campaign 2 with status "Paused"'
    );

    // 9. User A creates Campaign 3 (Completed)
    const c3 = await makeRequest({
      method: 'POST',
      path: '/api/campaigns',
      headers: { Cookie: cookieUserA },
      body: { campaign_name: 'Black Friday Blitz', status: 'Completed' },
    });
    userACampaign3Id = c3.body?.data?.id;
    assert(
      c3.statusCode === 201 && c3.body.data.status === 'Completed',
      'User A creates Campaign 3 with status "Completed"'
    );

    // 10. User A creates Campaign 4 (Active)
    const c4 = await makeRequest({
      method: 'POST',
      path: '/api/campaigns',
      headers: { Cookie: cookieUserA },
      body: { campaign_name: 'Spring Launch', status: 'Active' },
    });
    userACampaign4Id = c4.body?.data?.id;
    assert(
      c4.statusCode === 201 && c4.body.data.status === 'Active',
      'User A creates Campaign 4 with status "Active"'
    );

    // 11. User B creates Campaign B1 (Active)
    const cb1 = await makeRequest({
      method: 'POST',
      path: '/api/campaigns',
      headers: { Cookie: cookieUserB },
      body: { campaign_name: "Bob's Secret Campaign", status: 'Active' },
    });
    userBCampaign1Id = cb1.body?.data?.id;
    assert(
      cb1.statusCode === 201 && cb1.body.data.campaign_name === "Bob's Secret Campaign",
      "User B creates Bob's Secret Campaign"
    );

    // 12. GET /api/campaigns for User A
    const listA = await makeRequest({
      method: 'GET',
      path: '/api/campaigns',
      headers: { Cookie: cookieUserA },
    });
    const userAIds = listA.body?.data?.map((c) => c.id) || [];
    assert(
      listA.statusCode === 200 &&
        listA.body.count === 4 &&
        !userAIds.includes(userBCampaign1Id),
      "User A lists campaigns: returns 4 items and DOES NOT contain User B's campaign",
      JSON.stringify(listA.body)
    );

    // 13. Search campaigns by name: ?search=Summer
    const searchRes = await makeRequest({
      method: 'GET',
      path: '/api/campaigns?search=Summer',
      headers: { Cookie: cookieUserA },
    });
    assert(
      searchRes.statusCode === 200 &&
        searchRes.body.count === 1 &&
        searchRes.body.data[0].campaign_name === 'Summer Sale',
      'Search ?search=Summer returns exactly 1 matched campaign',
      JSON.stringify(searchRes.body)
    );

    // 14. Filter campaigns by status: ?status=Active
    const filterRes = await makeRequest({
      method: 'GET',
      path: '/api/campaigns?status=Active',
      headers: { Cookie: cookieUserA },
    });
    assert(
      filterRes.statusCode === 200 &&
        filterRes.body.count === 2 &&
        filterRes.body.data.every((c) => c.status === 'Active'),
      'Filter ?status=Active returns only the 2 Active campaigns',
      JSON.stringify(filterRes.body)
    );

    // 15. Dashboard statistics: GET /api/campaigns/stats for User A
    const statsA = await makeRequest({
      method: 'GET',
      path: '/api/campaigns/stats',
      headers: { Cookie: cookieUserA },
    });
    assert(
      statsA.statusCode === 200 &&
        statsA.body.data.total === 4 &&
        statsA.body.data.active === 2 &&
        statsA.body.data.paused === 1 &&
        statsA.body.data.completed === 1,
      'User A dashboard stats match: total 4, active 2, paused 1, completed 1',
      JSON.stringify(statsA.body)
    );

    // 16. Dashboard statistics: GET /api/campaigns/stats for User B
    const statsB = await makeRequest({
      method: 'GET',
      path: '/api/campaigns/stats',
      headers: { Cookie: cookieUserB },
    });
    assert(
      statsB.statusCode === 200 &&
        statsB.body.data.total === 1 &&
        statsB.body.data.active === 1 &&
        statsB.body.data.paused === 0 &&
        statsB.body.data.completed === 0,
      'User B dashboard stats isolated: total 1, active 1, paused 0, completed 0',
      JSON.stringify(statsB.body)
    );

    // 17. GET /api/campaigns/:id for own campaign
    const getOwn = await makeRequest({
      method: 'GET',
      path: `/api/campaigns/${userACampaign1Id}`,
      headers: { Cookie: cookieUserA },
    });
    assert(
      getOwn.statusCode === 200 && getOwn.body.data.campaign_name === 'Summer Sale',
      'User A retrieves own campaign by ID successfully'
    );

    // 18. STRICT OWNERSHIP: User A tries to GET User B's campaign
    const getOther = await makeRequest({
      method: 'GET',
      path: `/api/campaigns/${userBCampaign1Id}`,
      headers: { Cookie: cookieUserA },
    });
    assert(
      getOther.statusCode === 404,
      "STRICT OWNERSHIP: User A cannot read User B's campaign (returns 404 Not Found)",
      JSON.stringify(getOther.body)
    );

    // 19. PUT /api/campaigns/:id (Update own campaign)
    const updateOwn = await makeRequest({
      method: 'PUT',
      path: `/api/campaigns/${userACampaign1Id}`,
      headers: { Cookie: cookieUserA },
      body: { campaign_name: 'Summer Mega Sale', status: 'Paused' },
    });
    assert(
      updateOwn.statusCode === 200 &&
        updateOwn.body.data.campaign_name === 'Summer Mega Sale' &&
        updateOwn.body.data.status === 'Paused',
      'User A updates own campaign name and status successfully',
      JSON.stringify(updateOwn.body)
    );

    // 20. STRICT OWNERSHIP: User A tries to update User B's campaign
    const updateOther = await makeRequest({
      method: 'PUT',
      path: `/api/campaigns/${userBCampaign1Id}`,
      headers: { Cookie: cookieUserA },
      body: { campaign_name: 'Hacked by Alice' },
    });
    assert(
      updateOther.statusCode === 404,
      "STRICT OWNERSHIP: User A cannot update User B's campaign (returns 404 Not Found)",
      JSON.stringify(updateOther.body)
    );

    // Verify User B's campaign is still intact
    const verifyB = await makeRequest({
      method: 'GET',
      path: `/api/campaigns/${userBCampaign1Id}`,
      headers: { Cookie: cookieUserB },
    });
    assert(
      verifyB.body.data.campaign_name === "Bob's Secret Campaign",
      "User B's campaign name remained unmodified after User A attempt"
    );

    // 21. STRICT OWNERSHIP: User A tries to delete User B's campaign
    const deleteOther = await makeRequest({
      method: 'DELETE',
      path: `/api/campaigns/${userBCampaign1Id}`,
      headers: { Cookie: cookieUserA },
    });
    assert(
      deleteOther.statusCode === 404,
      "STRICT OWNERSHIP: User A cannot delete User B's campaign (returns 404 Not Found)",
      JSON.stringify(deleteOther.body)
    );

    // 22. DELETE /api/campaigns/:id (Delete own campaign)
    const deleteOwn = await makeRequest({
      method: 'DELETE',
      path: `/api/campaigns/${userACampaign2Id}`,
      headers: { Cookie: cookieUserA },
    });
    assert(
      deleteOwn.statusCode === 200 && deleteOwn.body.success === true,
      'User A deletes own campaign (Campaign 2) successfully',
      JSON.stringify(deleteOwn.body)
    );

    // Verify deletion: GET /api/campaigns/:id now returns 404
    const checkDeleted = await makeRequest({
      method: 'GET',
      path: `/api/campaigns/${userACampaign2Id}`,
      headers: { Cookie: cookieUserA },
    });
    assert(
      checkDeleted.statusCode === 404,
      'Deleted campaign returns 404 Not Found on subsequent GET'
    );

    // 23. Invalid ID format handling
    const badIdReq = await makeRequest({
      method: 'GET',
      path: '/api/campaigns/abc_not_an_id',
      headers: { Cookie: cookieUserA },
    });
    assert(
      badIdReq.statusCode === 400,
      'Request with non-numeric campaign ID returns 400 Bad Request',
      JSON.stringify(badIdReq.body)
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
