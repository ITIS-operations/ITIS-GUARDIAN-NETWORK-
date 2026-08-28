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
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    return {
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
  }

  const socketPath = resolveCloudSqlSocket();
  const host = socketPath || process.env.SQL_HOST || process.env.PGHOST;
  const database = process.env.SQL_DB_NAME || process.env.PGDATABASE || 'cloud_sql_development_database';
  const user = process.env.SQL_USER || process.env.SQL_ADMIN_USER || process.env.PGUSER || 'ai_studio_app_user';
  const password = process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD || process.env.PGPASSWORD || '';
  const port = process.env.SQL_PORT
    ? parseInt(process.env.SQL_PORT, 10)
    : process.env.PGPORT
    ? parseInt(process.env.PGPORT, 10)
    : undefined;

  const config: pg.PoolConfig = {
    host,
    database,
    user,
    password,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };

  if (port !== undefined) {
    config.port = port;
  }

  return config;
}

export const pool = new Pool(getPoolConfig());

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]', err);
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
    msg.includes('timeout')
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

