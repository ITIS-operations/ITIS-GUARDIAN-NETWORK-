import pg from 'pg';

const { Pool } = pg;

function getPoolConfig(): pg.PoolConfig {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
    return {
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
  }

  const host = process.env.SQL_HOST || '127.0.0.1';
  const database = process.env.SQL_DB_NAME || 'postgres';
  const user = process.env.SQL_ADMIN_USER || 'postgres';
  const password = process.env.SQL_ADMIN_PASSWORD || '';
  const port = process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432;

  return {
    host,
    database,
    user,
    password,
    port,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
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

export async function isPostgresConnected(): Promise<boolean> {
  try {
    const res = await pool.query('SELECT 1 as alive');
    return res.rows.length > 0 && res.rows[0].alive === 1;
  } catch (e) {
    console.error('[PostgreSQL Health Check Failed]', e);
    return false;
  }
}
