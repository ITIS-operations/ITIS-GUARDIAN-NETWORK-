const http = require('http');
const pg = require('pg');
const fs = require('fs');

function resolveCloudSqlSocket() {
  if (process.env.SQL_HOST && process.env.SQL_HOST.startsWith('/')) {
    return process.env.SQL_HOST;
  }
  const socketDirs = ['/app/cloudsql', '/cloudsql'];
  for (const baseDir of socketDirs) {
    try {
      if (fs.existsSync(baseDir)) {
        const entries = fs.readdirSync(baseDir);
        for (const entry of entries) {
          const candidatePath = `${baseDir}/${entry}`;
          if (fs.statSync(candidatePath).isDirectory()) {
            return candidatePath;
          }
        }
      }
    } catch {}
  }
  return null;
}

const socketPath = resolveCloudSqlSocket();
const host = socketPath || process.env.SQL_HOST || process.env.PGHOST;
const database = process.env.SQL_DB_NAME || process.env.PGDATABASE || 'cloud_sql_development_database';
const user = process.env.SQL_USER || process.env.SQL_ADMIN_USER || process.env.PGUSER || 'ai_studio_app_user';
const password = process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD || process.env.PGPASSWORD || '';

const pool = new pg.Pool({
  host,
  database,
  user,
  password,
  max: 5,
  connectionTimeoutMillis: 5000
});

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method,
      headers: {
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers
      }
    }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(buf); } catch { json = buf; }
        resolve({ status: res.statusCode, data: json });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const testResults = [];

function record(num, name, passed, details) {
  testResults.push({ num, name, passed, details });
  const statusStr = passed ? '[PASS]' : '[FAIL]';
  console.log(`${statusStr} TEST ${num}: ${name}`);
  console.log(`  Details: ${details}`);
}

async function runAcceptanceSuite() {
  console.log('================================================================');
  console.log('ITIS GUARDIAN NETWORK — POST-CONNECTION BROWSER PERSISTENCE SUITE');
  console.log('Authoritative PostgreSQL Cloud SQL Instance');
  console.log('================================================================\n');

  // STEP 1: FOUNDER LOGIN
  let founderToken = '';
  const currentFounderPass = 'FounderAuthoritativePass@2026!';
  try {
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'founder@itis365.co.za',
      password: currentFounderPass
    });
    const pass = loginRes.status === 200 &&
      loginRes.data?.user?.role === 'FOUNDER_EXECUTIVE' &&
      loginRes.data?.user?.email === 'founder@itis365.co.za' &&
      !!loginRes.data?.token;
    founderToken = loginRes.data?.token;
    record(1, 'FOUNDER LOGIN', pass, `HTTP ${loginRes.status} | Role: ${loginRes.data?.user?.role} | Token: ${founderToken?.slice(0, 20)}...`);
  } catch (err) {
    record(1, 'FOUNDER LOGIN', false, err.message);
  }

  // STEP 2: BROWSER REFRESH
  try {
    const sessionRes = await request('GET', '/api/auth/session', null, {
      Authorization: `Bearer ${founderToken}`
    });
    const pass = sessionRes.status === 200 &&
      sessionRes.data?.user?.id === 'USR-SUPER-001' &&
      sessionRes.data?.user?.role === 'FOUNDER_EXECUTIVE';
    record(2, 'BROWSER REFRESH (GET /api/auth/session)', pass, `HTTP ${sessionRes.status} | User: ${sessionRes.data?.user?.email} (${sessionRes.data?.user?.role})`);
  } catch (err) {
    record(2, 'BROWSER REFRESH (GET /api/auth/session)', false, err.message);
  }

  // STEP 3: FOUNDER PASSWORD UPDATE
  const newFounderPass = 'NewFounderSecurePassword2026!';
  try {
    const prevRow = await pool.query('SELECT password_hash, password_salt, must_change_password FROM users WHERE id = $1;', ['USR-SUPER-001']);
    const prevHash = prevRow.rows[0]?.password_hash;

    const changeRes = await request('POST', '/api/founder/update-password', {
      newPassword: newFounderPass,
      confirmPassword: newFounderPass
    }, {
      Authorization: `Bearer ${founderToken}`
    });

    const newRow = await pool.query('SELECT password_hash, password_salt, must_change_password FROM users WHERE id = $1;', ['USR-SUPER-001']);
    const newHash = newRow.rows[0]?.password_hash;
    const mustChange = newRow.rows[0]?.must_change_password;

    const pass = changeRes.status === 200 &&
      prevHash !== newHash &&
      mustChange === false;

    record(3, 'FOUNDER PASSWORD UPDATE', pass, `HTTP ${changeRes.status} | Hash Changed: ${prevHash?.slice(0, 10)}... -> ${newHash?.slice(0, 10)}... | must_change_password: ${mustChange}`);
  } catch (err) {
    record(3, 'FOUNDER PASSWORD UPDATE', false, err.message);
  }

  // STEP 4: LOGOUT
  try {
    const logoutRes = await request('POST', '/api/auth/logout', null, {
      Authorization: `Bearer ${founderToken}`
    });
    const pass = logoutRes.status === 200 && logoutRes.data?.success === true;
    record(4, 'LOGOUT', pass, `HTTP ${logoutRes.status} | Message: ${logoutRes.data?.message}`);
  } catch (err) {
    record(4, 'LOGOUT', false, err.message);
  }

  // STEP 5: RELOGIN
  try {
    const reloginRes = await request('POST', '/api/auth/login', {
      email: 'founder@itis365.co.za',
      password: newFounderPass
    });
    founderToken = reloginRes.data?.token;

    // Verify session row in PostgreSQL
    const sessRow = await pool.query('SELECT token, user_id, role, expires_at FROM sessions WHERE token = $1;', [founderToken]);
    const pass = reloginRes.status === 200 &&
      reloginRes.data?.user?.role === 'FOUNDER_EXECUTIVE' &&
      sessRow.rows.length === 1 &&
      sessRow.rows[0].user_id === 'USR-SUPER-001';

    record(5, 'RELOGIN WITH NEW PASSWORD', pass, `HTTP ${reloginRes.status} | Session in PostgreSQL: ${sessRow.rows.length === 1} | Token: ${founderToken?.slice(0, 20)}...`);
  } catch (err) {
    record(5, 'RELOGIN WITH NEW PASSWORD', false, err.message);
  }

  // STEP 6: CREATE TEST USER
  let createdUserId = '';
  let createdUserEmail = `inspector.test.${Date.now().toString().slice(-4)}@itis.safety.za`;
  let tempUserPass = 'TempOfficerPassword2026!';
  try {
    const createRes = await request('POST', '/api/users', {
      email: createdUserEmail,
      firstName: 'Audit',
      surname: 'Inspector',
      role: 'GOVERNMENT_AUDITOR',
      department: 'National Child Safety Inspectorate',
      organization: 'Department of Basic Education',
      password: tempUserPass
    }, {
      Authorization: `Bearer ${founderToken}`
    });

    createdUserId = createRes.data?.id || createRes.data?.user?.id;
    const pgUser = await pool.query('SELECT id, email, role, account_status, must_change_password FROM users WHERE id = $1;', [createdUserId]);
    const pass = createRes.status === 201 &&
      pgUser.rows.length === 1 &&
      pgUser.rows[0].must_change_password === true;

    record(6, 'CREATE TEST USER', pass, `HTTP ${createRes.status} | User ID: ${createdUserId} | must_change_password: ${pgUser.rows[0]?.must_change_password}`);
  } catch (err) {
    record(6, 'CREATE TEST USER', false, err.message);
  }

  // STEP 7: REFRESH USER REGISTRY
  try {
    const listRes = await request('GET', '/api/users', null, {
      Authorization: `Bearer ${founderToken}`
    });
    const users = Array.isArray(listRes.data) ? listRes.data : (listRes.data?.users || []);
    const found = users.some(u => u.id === createdUserId);
    const pass = listRes.status === 200 && found;
    record(7, 'REFRESH USER REGISTRY', pass, `HTTP ${listRes.status} | Total Users: ${users.length} | Created User Visible: ${found}`);
  } catch (err) {
    record(7, 'REFRESH USER REGISTRY', false, err.message);
  }

  // STEP 8: LOGOUT FOUNDER
  try {
    const logoutRes = await request('POST', '/api/auth/logout', null, {
      Authorization: `Bearer ${founderToken}`
    });
    const pass = logoutRes.status === 200;
    record(8, 'LOGOUT FOUNDER', pass, `HTTP ${logoutRes.status} | Session Revoked: ${pass}`);
  } catch (err) {
    record(8, 'LOGOUT FOUNDER', false, err.message);
  }

  // STEP 9: LOGIN AS NEW USER
  let newUserToken = '';
  try {
    const newUserLogin = await request('POST', '/api/auth/login', {
      email: createdUserEmail,
      password: tempUserPass
    });

    newUserToken = newUserLogin.data?.token;
    const mustChange = newUserLogin.data?.user?.mustChangePassword;
    const pass = newUserLogin.status === 200 &&
      newUserLogin.data?.user?.role === 'GOVERNMENT_AUDITOR' &&
      mustChange === true &&
      !!newUserToken;

    record(9, 'LOGIN AS NEW USER (TEMP PASSWORD)', pass, `HTTP ${newUserLogin.status} | Role: ${newUserLogin.data?.user?.role} | mustChangePassword: ${mustChange}`);
  } catch (err) {
    record(9, 'LOGIN AS NEW USER (TEMP PASSWORD)', false, err.message);
  }

  // STEP 10: CHANGE NEW USER PASSWORD
  const permanentUserPass = 'PermanentOfficerPassword2026!';
  try {
    const beforeRow = await pool.query('SELECT password_hash, must_change_password FROM users WHERE id = $1;', [createdUserId]);
    const beforeHash = beforeRow.rows[0]?.password_hash;

    const changeRes = await request('POST', '/api/auth/change-password', {
      newPassword: permanentUserPass,
      confirmPassword: permanentUserPass
    }, {
      Authorization: `Bearer ${newUserToken}`
    });

    const afterRow = await pool.query('SELECT password_hash, must_change_password FROM users WHERE id = $1;', [createdUserId]);
    const afterHash = afterRow.rows[0]?.password_hash;
    const afterMustChange = afterRow.rows[0]?.must_change_password;

    const pass = changeRes.status === 200 &&
      beforeHash !== afterHash &&
      afterMustChange === false;

    record(10, 'CHANGE NEW USER PASSWORD', pass, `HTTP ${changeRes.status} | Hash Changed: ${beforeHash !== afterHash} | must_change_password: ${afterMustChange}`);
  } catch (err) {
    record(10, 'CHANGE NEW USER PASSWORD', false, err.message);
  }

  // STEP 11: LOGOUT AND RELOGIN AS NEW USER WITH PERMANENT PASSWORD
  try {
    // Attempt login with new permanent password
    const reloginNewUser = await request('POST', '/api/auth/login', {
      email: createdUserEmail,
      password: permanentUserPass
    });

    newUserToken = reloginNewUser.data?.token;
    const mustChange = reloginNewUser.data?.user?.mustChangePassword;
    const pass = reloginNewUser.status === 200 &&
      reloginNewUser.data?.user?.role === 'GOVERNMENT_AUDITOR' &&
      mustChange === false &&
      !!newUserToken;

    record(11, 'LOGOUT AND RELOGIN AS NEW USER (PERMANENT PASS)', pass, `HTTP ${reloginNewUser.status} | Role: ${reloginNewUser.data?.user?.role} | mustChangePassword: ${mustChange}`);
  } catch (err) {
    record(11, 'LOGOUT AND RELOGIN AS NEW USER (PERMANENT PASS)', false, err.message);
  }

  // STEP 12: FINAL REFRESH TEST (Multiple session introspections)
  try {
    const r1 = await request('GET', '/api/auth/session', null, { Authorization: `Bearer ${newUserToken}` });
    const r2 = await request('GET', '/api/auth/session', null, { Authorization: `Bearer ${newUserToken}` });
    const r3 = await request('GET', '/api/auth/session', null, { Authorization: `Bearer ${newUserToken}` });

    const pass = r1.status === 200 && r2.status === 200 && r3.status === 200 &&
      r1.data?.user?.id === createdUserId &&
      r3.data?.user?.id === createdUserId;

    record(12, 'FINAL REFRESH TEST (MULTIPLE SESSION RESTORES)', pass, `Refresh 1: HTTP ${r1.status} | Refresh 2: HTTP ${r2.status} | Refresh 3: HTTP ${r3.status} | Active User: ${r3.data?.user?.id}`);
  } catch (err) {
    record(12, 'FINAL REFRESH TEST (MULTIPLE SESSION RESTORES)', false, err.message);
  }

  // Clean up Founder password back to the authoritative state if needed
  try {
    await request('POST', '/api/founder/update-password', {
      newPassword: 'FounderAuthoritativePass@2026!',
      confirmPassword: 'FounderAuthoritativePass@2026!'
    }, {
      Authorization: `Bearer ${founderToken}`
    });
  } catch {}

  console.log('\n================================================================');
  const allPassed = testResults.every(t => t.passed);
  console.log(`ACCEPTANCE SUMMARY: ${testResults.filter(t => t.passed).length}/${testResults.length} TESTS PASSED`);
  console.log('================================================================\n');

  await pool.end();
}

runAcceptanceSuite().catch(console.error);
