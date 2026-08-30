import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;

export function resolveCloudSqlSocket(): string | null {
  if (process.env.SQL_HOST && process.env.SQL_HOST.startsWith('/')) {
    return process.env.SQL_HOST;
  }

  // Check standard Cloud SQL socket mount locations in Cloud Run / AI Studio container
  const socketDirs = ['/app/cloudsql', '/cloudsql'];
  for (const baseDir of socketDirs) {
    try {
      if (fs.existsSync(baseDir)) {
        const entries = fs.readdirSync(baseDir);
        for (const entry of entries) {
          const candidatePath = `${baseDir}/${entry}`;
          try {
            if (fs.statSync(candidatePath).isDirectory()) {
              return candidatePath;
            }
          } catch {}
        }
      }
    } catch {}
  }
  return null;
}

function getPoolConfig(): pg.PoolConfig {
  const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_REGION);
  const connString = (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRESQL_URL ||
    process.env.DATABASE_PRIVATE_URL ||
    ''
  ).trim();

  // If a standard connection string is provided (e.g. from Vercel Postgres, Neon, Cloud SQL public IP/proxy, Supabase)
  if (connString && (connString.startsWith('postgres://') || connString.startsWith('postgresql://'))) {
    const isLocalhost = connString.includes('localhost') || connString.includes('127.0.0.1');
    const disableSsl =
      process.env.PGSSLMODE === 'disable' ||
      process.env.PGSSL_MODE === 'disable' ||
      process.env.DISABLE_SSL === 'true';
    const requireSsl = !isLocalhost && !disableSsl;

    const config: pg.PoolConfig = {
      connectionString: connString,
      max: isVercel ? 5 : 20,
      idleTimeoutMillis: isVercel ? 10000 : 30000,
      connectionTimeoutMillis: 15000,
    };

    if (requireSsl) {
      config.ssl = { rejectUnauthorized: false };
    }

    return config;
  }

  const socketPath = resolveCloudSqlSocket();
  const host = (
    socketPath ||
    process.env.SQL_HOST ||
    process.env.PGHOST ||
    process.env.POSTGRES_HOST ||
    process.env.DB_HOST ||
    ''
  ).trim();

  const database = (
    process.env.SQL_DB_NAME ||
    process.env.PGDATABASE ||
    process.env.POSTGRES_DATABASE ||
    process.env.DB_NAME ||
    'cloud_sql_development_database'
  ).trim();

  const user = (
    process.env.SQL_USER ||
    process.env.SQL_ADMIN_USER ||
    process.env.PGUSER ||
    process.env.POSTGRES_USER ||
    process.env.DB_USER ||
    'ai_studio_app_user'
  ).trim();

  const password = (
    process.env.SQL_PASSWORD ||
    process.env.SQL_ADMIN_PASSWORD ||
    process.env.PGPASSWORD ||
    process.env.POSTGRES_PASSWORD ||
    process.env.DB_PASSWORD ||
    ''
  );

  const rawPort =
    process.env.SQL_PORT ||
    process.env.PGPORT ||
    process.env.POSTGRES_PORT ||
    process.env.DB_PORT;

  const port = rawPort ? parseInt(rawPort, 10) : undefined;

  const isSocket = host.startsWith('/');
  const isLocal = host === '127.0.0.1' || host.toLowerCase() === 'localhost';
  const disableSsl =
    process.env.PGSSLMODE === 'disable' ||
    process.env.PGSSL_MODE === 'disable' ||
    process.env.DISABLE_SSL === 'true';
  const requireSsl = !isSocket && !isLocal && !disableSsl;

  const config: pg.PoolConfig = {
    host: host || (isSocket ? undefined : '127.0.0.1'),
    database,
    user,
    password,
    max: isVercel ? 5 : 20,
    idleTimeoutMillis: isVercel ? 10000 : 30000,
    connectionTimeoutMillis: 15000,
  };

  if (port !== undefined && !isNaN(port)) {
    config.port = port;
  }

  if (requireSsl) {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}

// Global caching for serverless environments (e.g. Vercel)
declare global {
  // eslint-disable-next-line no-var
  var __itisPgPool: pg.Pool | undefined;
}

export const pool: pg.Pool = globalThis.__itisPgPool || new Pool(getPoolConfig());

if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
  globalThis.__itisPgPool = pool;
}

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]', err.message);
});

export async function query<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (duration > 500) {
      console.warn(`[PostgreSQL Slow Query] ${duration}ms: ${text.slice(0, 100)}`);
    }
    return res;
  } catch (error) {
    console.error(`[PostgreSQL Query Error]: ${text.slice(0, 100)}`, error);
    throw error;
  }
}

export type DatabaseErrorCategory =
  | 'DATABASE_URL_MISSING'
  | 'DATABASE_CONNECTION_REFUSED'
  | 'DATABASE_AUTH_FAILED'
  | 'DATABASE_SSL_ERROR'
  | 'DATABASE_TIMEOUT'
  | 'DATABASE_PERMISSION_DENIED'
  | 'DATABASE_QUERY_FAILED';

export function classifyDatabaseError(error: any): { category: DatabaseErrorCategory; message: string } {
  if (!error) {
    return { category: 'DATABASE_QUERY_FAILED', message: 'Unknown database error' };
  }

  const code = error.code || '';
  const msg = (error.message || '').toLowerCase();

  if (msg.includes('database_url') || msg.includes('missing database') || msg.includes('database_url is not configured')) {
    return { category: 'DATABASE_URL_MISSING', message: 'DATABASE_URL is not configured in environment variables' };
  }

  if (code === 'ECONNREFUSED' || msg.includes('econnrefused') || msg.includes('connection refused')) {
    return { category: 'DATABASE_CONNECTION_REFUSED', message: 'Connection refused by database host or port' };
  }

  if (code === '28P01' || code === '28000' || msg.includes('password authentication failed') || msg.includes('auth failed')) {
    return { category: 'DATABASE_AUTH_FAILED', message: 'Authentication failed for specified database credentials' };
  }

  if (msg.includes('ssl') || msg.includes('tlsv1') || msg.includes('certificate') || msg.includes('handshake')) {
    return { category: 'DATABASE_SSL_ERROR', message: 'SSL/TLS negotiation or certificate handshake error' };
  }

  if (code === 'ETIMEDOUT' || msg.includes('timeout') || msg.includes('timed out')) {
    return { category: 'DATABASE_TIMEOUT', message: 'Connection timed out while reaching database host' };
  }

  if (code === '42501' || msg.includes('permission denied') || msg.includes('must be owner')) {
    return { category: 'DATABASE_PERMISSION_DENIED', message: 'Permission denied for requested database object or schema' };
  }

  return { category: 'DATABASE_QUERY_FAILED', message: error.message || 'Database query execution failed' };
}

export function isDatabaseConnectionError(error: any): boolean {
  if (!error) return false;
  const code = error.code;
  const msg = (error.message || '').toLowerCase();

  return (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === '57P01' ||
    code === '57P02' ||
    code === '57P03' ||
    code === '28P01' ||
    code === '28000' ||
    msg.includes('econnrefused') ||
    msg.includes('connection terminated') ||
    msg.includes('connection refused') ||
    msg.includes('database_unavailable') ||
    msg.includes('database unavailable') ||
    msg.includes('failed to connect') ||
    msg.includes('socket not found') ||
    msg.includes('timeout') ||
    msg.includes('database_url is not configured')
  );
}

export async function isPostgresConnected(): Promise<boolean> {
  try {
    const res = await pool.query('SELECT 1 as alive');
    return res.rows.length > 0 && res.rows[0].alive === 1;
  } catch (e) {
    console.error('[PostgreSQL Health Check Failed]', e);
    return false;
  }
}

/**
 * Executes a callback within a managed PostgreSQL transaction with automatic BEGIN, COMMIT, and ROLLBACK.
 */
export async function withTransaction<T>(callback: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rbError) {
      console.error('[PostgreSQL Transaction Rollback Failed]', rbError);
    }
    throw error;
  } finally {
    client.release();
  }
}

export type ConnectionMode =
  | 'UNIX_SOCKET_CLOUDSQL'
  | 'REMOTE_TCP_URI'
  | 'REMOTE_TCP_DISCRETE'
  | 'LOCAL_TCP';

export function determineConnectionMode(): {
  mode: ConnectionMode;
  hostType: 'UNIX_SOCKET' | 'REMOTE_TCP' | 'LOCAL';
  sslRequired: boolean;
  databaseConfigured: boolean;
} {
  const connString = (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRESQL_URL ||
    ''
  ).trim();

  if (connString) {
    const isLocalhost = connString.includes('localhost') || connString.includes('127.0.0.1');
    const disableSsl =
      process.env.PGSSLMODE === 'disable' ||
      process.env.PGSSL_MODE === 'disable' ||
      process.env.DISABLE_SSL === 'true';
    return {
      mode: isLocalhost ? 'LOCAL_TCP' : 'REMOTE_TCP_URI',
      hostType: isLocalhost ? 'LOCAL' : 'REMOTE_TCP',
      sslRequired: !isLocalhost && !disableSsl,
      databaseConfigured: true
    };
  }

  const socketPath = resolveCloudSqlSocket();
  const host = (
    socketPath ||
    process.env.SQL_HOST ||
    process.env.PGHOST ||
    process.env.POSTGRES_HOST ||
    ''
  ).trim();

  const isSocket = host.startsWith('/');
  const isLocal = host === '127.0.0.1' || host.toLowerCase() === 'localhost';
  const disableSsl =
    process.env.PGSSLMODE === 'disable' ||
    process.env.PGSSL_MODE === 'disable' ||
    process.env.DISABLE_SSL === 'true';

  let mode: ConnectionMode = 'LOCAL_TCP';
  let hostType: 'UNIX_SOCKET' | 'REMOTE_TCP' | 'LOCAL' = 'LOCAL';

  if (isSocket) {
    mode = 'UNIX_SOCKET_CLOUDSQL';
    hostType = 'UNIX_SOCKET';
  } else if (!isLocal && host) {
    mode = 'REMOTE_TCP_DISCRETE';
    hostType = 'REMOTE_TCP';
  }

  return {
    mode,
    hostType,
    sslRequired: !isSocket && !isLocal && !disableSsl,
    databaseConfigured: Boolean(connString || host || socketPath)
  };
}


