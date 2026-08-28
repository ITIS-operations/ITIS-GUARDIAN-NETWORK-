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
const port = process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : (process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : undefined);

const poolConfig = {
  host,
  database,
  user,
  password,
  max: 5,
  connectionTimeoutMillis: 5000
};
if (port !== undefined) {
  poolConfig.port = port;
}

const pool = new pg.Pool(poolConfig);

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

async function runLiveVerification() {
  console.log('================================================================');
  console.log('ITIS GUARDIAN NETWORK — LIVE DATABASE CONNECTION VERIFICATION');
  console.log('Testing against Authoritative PostgreSQL Database');
  console.log('Database Host/Socket:', host);
  console.log('Database Name:', database);
  console.log('Database User:', user);
  console.log('================================================================\n');

  let passedCount = 0;
  const results = [];

  function record(testNum, title, passed, details) {
    if (passed) passedCount++;
    results.push({ testNum, title, passed, details });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] TEST ${testNum}: ${title}`);
    console.log(`  Details: ${details}\n`);
  }

  // -------------------------------------------------------------
  // TEST 1: GET /api/health
  // -------------------------------------------------------------
  try {
    const health = await request('GET', '/api/health');
    const isHealthy = health.status === 200 && health.data?.status === 'HEALTHY' && health.data?.databaseProvider === 'POSTGRESQL';
    record(1, 'GET /api/health', isHealthy, `HTTP ${health.status} | Provider: ${health.data?.databaseProvider} | Status: ${health.data?.status}`);
  } catch (err) {
    record(1, 'GET /api/health', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 2: Founder login using currently registered password
  // -------------------------------------------------------------
  let founderToken = '';
  let activeFounderPass = '';
  const possiblePasswords = [
    'FounderAuthoritativePass@2026!',
    'NewFounderSecurePassword2026!',
    'Password123!'
  ];

  try {
    let loginRes = null;
    for (const p of possiblePasswords) {
      const res = await request('POST', '/api/auth/login', {
        email: 'founder@itis365.co.za',
        password: p
      });
      if (res.status === 200) {
        loginRes = res;
        activeFounderPass = p;
        break;
      }
    }

    const isFounderOk = loginRes && loginRes.status === 200 && loginRes.data?.user?.role === 'FOUNDER_EXECUTIVE' && !!loginRes.data?.token;
    founderToken = loginRes?.data?.token;
    record(2, 'Founder Login via Live HTTP Endpoint', isFounderOk, `HTTP ${loginRes?.status} | Role: ${loginRes?.data?.user?.role} | Token: ${founderToken?.slice(0, 20)}...`);
  } catch (err) {
    record(2, 'Founder Login via Live HTTP Endpoint', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 3: Immediately query PostgreSQL and verify the session exists
  // -------------------------------------------------------------
  try {
    const sessPg = await pool.query('SELECT * FROM sessions WHERE token = $1;', [founderToken]);
    const exists = sessPg.rows.length === 1 && sessPg.rows[0].user_id === 'USR-SUPER-001';
    record(3, 'Verify Session in PostgreSQL Database', exists, `Rows: ${sessPg.rows.length} | User ID: ${sessPg.rows[0]?.user_id} | Expires: ${sessPg.rows[0]?.expires_at}`);
  } catch (err) {
    record(3, 'Verify Session in PostgreSQL Database', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 4: Refresh browser / session validation
  // -------------------------------------------------------------
  try {
    const sessionRes = await request('GET', '/api/auth/session', null, { Authorization: `Bearer ${founderToken}` });
    const isSessionValid = sessionRes.status === 200 && sessionRes.data?.user?.id === 'USR-SUPER-001';
    record(4, 'Session Introspection via GET /api/auth/session', isSessionValid, `HTTP ${sessionRes.status} | User: ${sessionRes.data?.user?.name} (${sessionRes.data?.user?.id})`);
  } catch (err) {
    record(4, 'Session Introspection via GET /api/auth/session', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 5: Change Founder password
  // -------------------------------------------------------------
  const updatedFounderPass = activeFounderPass === 'FounderAuthoritativePass@2026!'
    ? 'NewFounderSecurePassword2026!'
    : 'FounderAuthoritativePass@2026!';
  try {
    const beforeUser = await pool.query('SELECT password_hash, password_salt FROM users WHERE id = $1;', ['USR-SUPER-001']);
    const beforeHash = beforeUser.rows[0]?.password_hash;

    const updateRes = await request('POST', '/api/founder/update-password', {
      newPassword: updatedFounderPass,
      confirmPassword: updatedFounderPass
    }, { Authorization: `Bearer ${founderToken}` });
    const afterUser = await pool.query('SELECT password_hash, password_salt FROM users WHERE id = $1;', ['USR-SUPER-001']);
    const afterHash = afterUser.rows[0]?.password_hash;

    const hashChanged = updateRes.status === 200 && afterHash !== beforeHash && !!afterHash;
    record(5, 'Update Founder Password & Verify PostgreSQL users Table', hashChanged, `HTTP ${updateRes.status} | Hash Changed: ${beforeHash?.slice(0, 10)}... -> ${afterHash?.slice(0, 10)}...`);
  } catch (err) {
    record(5, 'Update Founder Password & Verify PostgreSQL users Table', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 6: Logout and login using the new password
  // -------------------------------------------------------------
  try {
    await request('POST', '/api/auth/logout', null, { Authorization: `Bearer ${founderToken}` });
    const newLoginRes = await request('POST', '/api/auth/login', {
      email: 'founder@itis365.co.za',
      password: updatedFounderPass
    });
    const reLoginOk = newLoginRes.status === 200 && !!newLoginRes.data?.token;
    founderToken = newLoginRes.data?.token;
    record(6, 'Founder Login with Newly Changed Password', reLoginOk, `HTTP ${newLoginRes.status} | New Token: ${founderToken?.slice(0, 20)}...`);
  } catch (err) {
    record(6, 'Founder Login with Newly Changed Password', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 7: Create exactly ONE test user
  // -------------------------------------------------------------
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const testUserEmail = `audit.officer.${randomSuffix}@itis.safety.za`;
  let createdUserId = '';
  let createdUserPass = 'TestOfficer@Pass2026!';
  try {
    const createRes = await request('POST', '/api/users', {
      email: testUserEmail,
      name: `Inspector Sipho Sithole ${randomSuffix}`,
      firstName: 'Sipho',
      surname: 'Sithole',
      mobileNumber: `+2782${randomSuffix}123`,
      role: 'GOVERNMENT_AUDITOR',
      department: 'National Child Safety Inspectorate',
      organization: 'Department of Basic Education',
      password: createdUserPass
    }, { Authorization: `Bearer ${founderToken}` });

    createdUserId = createRes.data?.id || createRes.data?.user?.id;
    const pgUserCheck = await pool.query('SELECT id, email, role FROM users WHERE id = $1;', [createdUserId]);
    const userInDb = createRes.status === 201 && pgUserCheck.rows.length === 1;
    record(7, 'Create Exactly ONE Test User & Verify PostgreSQL users Table', userInDb, `HTTP ${createRes.status} | User ID: ${createdUserId} | DB Row Found: ${pgUserCheck.rows.length === 1}`);
  } catch (err) {
    record(7, 'Create Exactly ONE Test User & Verify PostgreSQL users Table', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 8: Logout and login as the new user
  // -------------------------------------------------------------
  let testUserToken = '';
  try {
    const testLoginRes = await request('POST', '/api/auth/login', {
      email: testUserEmail,
      password: createdUserPass
    });
    const testLoginOk = testLoginRes.status === 200 && testLoginRes.data?.user?.id === createdUserId;
    testUserToken = testLoginRes.data?.token;
    record(8, 'Login as Newly Created Test User', testLoginOk, `HTTP ${testLoginRes.status} | User ID: ${testLoginRes.data?.user?.id} | Token: ${testUserToken?.slice(0, 20)}...`);
  } catch (err) {
    record(8, 'Login as Newly Created Test User', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 9: Refresh user registry
  // -------------------------------------------------------------
  try {
    const usersListRes = await request('GET', '/api/users', null, { Authorization: `Bearer ${founderToken}` });
    const userList = Array.isArray(usersListRes.data) ? usersListRes.data : (usersListRes.data?.users || []);
    const userFound = usersListRes.status === 200 && userList.some(u => u.id === createdUserId);
    record(9, 'Refresh User Registry via GET /api/users', userFound, `HTTP ${usersListRes.status} | Total Users: ${userList.length} | New User Present: ${userFound}`);
  } catch (err) {
    record(9, 'Refresh User Registry via GET /api/users', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 10: Process Durability Verification
  // -------------------------------------------------------------
  try {
    const durabilityFounder = await pool.query('SELECT id, email, role FROM users WHERE id = $1;', ['USR-SUPER-001']);
    const durabilityTestUser = await pool.query('SELECT id, email, role FROM users WHERE id = $1;', [createdUserId]);
    const durabilityPassed = durabilityFounder.rows.length === 1 && durabilityTestUser.rows.length === 1;
    record(10, 'PostgreSQL Database Durability Verification', durabilityPassed, `Founder Record Intact: ${durabilityFounder.rows.length === 1} | New Test User Intact: ${durabilityTestUser.rows.length === 1}`);
  } catch (err) {
    record(10, 'PostgreSQL Database Durability Verification', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST 11: Verify zero live route dependence on dbStore.ts
  // -------------------------------------------------------------
  try {
    const serverCode = fs.readFileSync('server.ts', 'utf8');
    const usesDbStore = serverCode.includes("from './src/server/dbStore") || serverCode.includes("from './src/server/dbStore.js'");
    const usesInMemory = serverCode.includes("InMemoryDataRepository");
    const zeroFallback = !usesDbStore && !usesInMemory;
    record(11, 'Zero Live Route Dependence on dbStore.ts / In-Memory Store', zeroFallback, `server.ts imports dbStore: ${usesDbStore} | imports InMemory: ${usesInMemory}`);
  } catch (err) {
    record(11, 'Zero Live Route Dependence on dbStore.ts / In-Memory Store', false, err.message);
  }

  console.log('================================================================');
  console.log(`LIVE DATABASE ACCEPTANCE SUMMARY: ${passedCount}/11 TESTS PASSED`);
  console.log('================================================================');

  await pool.end();
  if (passedCount !== 11) {
    process.exit(1);
  }
}

runLiveVerification().catch(err => {
  console.error('[Verification Fatal Error]', err);
  pool.end();
  process.exit(1);
});
