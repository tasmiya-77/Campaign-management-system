/**
 * Automated Verification Script for Phase 2: Authentication
 * Tests:
 * 1. User registration (valid)
 * 2. Duplicate registration prevention (409)
 * 3. Validation failures (400)
 * 4. Login with invalid password (401)
 * 5. Login with valid credentials (200 + HTTP-only cookie)
 * 6. Access /api/auth/me with valid session (200)
 * 7. Access /api/auth/me without session (401)
 * 8. User logout and cookie clearance (200)
 * 9. Access /api/auth/me after logout (401)
 * 10. Login rate limiting (429)
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
  // May be array or string
  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const match = cookieStr.match(/token=([^;]+)/);
  return {
    raw: cookieStr,
    token: match ? match[1] : null,
  };
}

async function runTests() {
  console.log('========================================================');
  console.log('       RUNNING PHASE 2 AUTHENTICATION TEST SUITE        ');
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

  const timestamp = Date.now();
  const testUser = {
    name: 'Senior Developer',
    email: `dev_${timestamp}@example.com`,
    password: 'SecurePassword123!',
  };

  let authCookieHeader = null;

  try {
    // 1. Validation error: Missing name
    const valRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: { email: 'bad@example.com', password: '123' },
    });
    assert(
      valRes.statusCode === 400 && valRes.body.success === false,
      'Validation failure returns HTTP 400 Bad Request',
      JSON.stringify(valRes.body)
    );

    // 2. User registration
    const regRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: testUser,
    });
    const regCookie = extractCookie(regRes.headers);
    assert(
      regRes.statusCode === 201 &&
        regRes.body.success === true &&
        regRes.body.user.email === testUser.email &&
        !regRes.body.user.password &&
        regCookie !== null,
      'User registration returns HTTP 201, safe user object, and sets HTTP-only cookie',
      JSON.stringify({ status: regRes.statusCode, body: regRes.body, cookie: regCookie })
    );

    // 3. Duplicate email registration
    const dupRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: testUser,
    });
    assert(
      dupRes.statusCode === 409 && dupRes.body.success === false,
      'Duplicate email registration returns HTTP 409 Conflict',
      JSON.stringify(dupRes.body)
    );

    // 4. Login with invalid password
    const badPassRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: testUser.email, password: 'WrongPassword999!' },
    });
    assert(
      badPassRes.statusCode === 401 && badPassRes.body.success === false,
      'Login with invalid password returns HTTP 401 Unauthorized',
      JSON.stringify(badPassRes.body)
    );

    // 5. Login with valid credentials
    const loginRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: testUser.email, password: testUser.password },
    });
    const loginCookie = extractCookie(loginRes.headers);
    assert(
      loginRes.statusCode === 200 &&
        loginRes.body.success === true &&
        loginRes.body.user.email === testUser.email &&
        !loginRes.body.user.password &&
        loginCookie &&
        loginCookie.raw.includes('HttpOnly'),
      'Valid login returns HTTP 200 and sets HttpOnly cookie without password exposure',
      JSON.stringify({ status: loginRes.statusCode, body: loginRes.body, cookie: loginCookie })
    );

    if (loginCookie) {
      authCookieHeader = `token=${loginCookie.token}`;
    }

    // 6. Access /api/auth/me with valid session cookie
    const meRes = await makeRequest({
      method: 'GET',
      path: '/api/auth/me',
      headers: { Cookie: authCookieHeader },
    });
    assert(
      meRes.statusCode === 200 &&
        meRes.body.success === true &&
        meRes.body.user.email === testUser.email &&
        !meRes.body.user.password,
      'GET /api/auth/me returns 200 and authenticated user profile',
      JSON.stringify(meRes.body)
    );

    // 7. Access /api/auth/me without cookie
    const unauthMeRes = await makeRequest({
      method: 'GET',
      path: '/api/auth/me',
    });
    assert(
      unauthMeRes.statusCode === 401 && unauthMeRes.body.success === false,
      'GET /api/auth/me without token returns HTTP 401 Unauthorized',
      JSON.stringify(unauthMeRes.body)
    );

    // 8. Logout
    const logoutRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/logout',
      headers: { Cookie: authCookieHeader },
    });
    const logoutCookie = logoutRes.headers['set-cookie'];
    const cookieCleared = logoutCookie && (logoutCookie[0].includes('Expires=Thu, 01 Jan 1970') || logoutCookie[0].includes('Max-Age=0'));
    assert(
      logoutRes.statusCode === 200 && logoutRes.body.success === true && cookieCleared,
      'POST /api/auth/logout returns HTTP 200 and clears authentication cookie',
      JSON.stringify({ body: logoutRes.body, cookie: logoutCookie })
    );

    // 9. Access /api/auth/me with cleared cookie
    const postLogoutMeRes = await makeRequest({
      method: 'GET',
      path: '/api/auth/me',
      headers: { Cookie: 'token=' },
    });
    assert(
      postLogoutMeRes.statusCode === 401,
      'GET /api/auth/me after logout returns HTTP 401 Unauthorized',
      JSON.stringify(postLogoutMeRes.body)
    );

    // 10. Rate limiting test on login
    console.log('\n--- Testing Rate Limiter (triggering 5 rapid requests) ---');
    let rateLimited = false;
    for (let i = 0; i < 6; i++) {
      const res = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: 'rate_limit_test@example.com', password: 'bad' },
      });
      if (res.statusCode === 429) {
        rateLimited = true;
        console.log(`Rate limit triggered on attempt ${i + 1} with HTTP 429`);
        break;
      }
    }
    assert(
      rateLimited,
      'Rate limiter protects /api/auth/login with HTTP 429 Too Many Requests',
      'Rate limit did not trigger within 6 attempts'
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
