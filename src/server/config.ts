/**
 * ==============================================================================
 * ITIS GUARDIAN NETWORK — CENTRAL SERVER CONFIGURATION & PRODUCTION VALIDATOR
 * ==============================================================================
 * Enforces strict environment-driven configuration, fail-closed production checks,
 * secret masking, and clean decoupling between Web/API and Dedicated Telemetry.
 */

export interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database: string;
  user: string;
  hasPassword: boolean;
  sslRequired: boolean;
  isSocket: boolean;
  provider: 'POSTGRESQL';
}

export interface TelemetryServerRuntimeConfig {
  standaloneHost: string;
  tcpPort: number;
  udpPort: number;
  healthPort: number;
  enabledInCurrentProcess: boolean;
}

export interface ServerConfig {
  env: 'development' | 'production' | 'test';
  isProduction: boolean;
  isTest: boolean;
  isVercel: boolean;
  port: number;
  database: DatabaseConfig;
  telemetry: TelemetryServerRuntimeConfig;
  sessionSecretConfigured: boolean;
}

export interface ConfigValidationResult {
  valid: boolean;
  environment: string;
  errors: string[];
  warnings: string[];
  sanitizedConfig: Record<string, any>;
}

export function resolveDatabaseConnectionString(env: Record<string, string | undefined> = process.env): string {
  return (
    env.DATABASE_URL ||
    env.POSTGRES_URL ||
    env.POSTGRES_PRISMA_URL ||
    env.POSTGRESQL_URL ||
    env.POSTGRES_URL_NON_POOLING ||
    env.DATABASE_PRIVATE_URL ||
    ''
  ).trim();
}

export function loadServerConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const nodeEnv = (env.NODE_ENV || 'development').toLowerCase();
  const envType: 'development' | 'production' | 'test' =
    nodeEnv === 'production' ? 'production' : nodeEnv === 'test' ? 'test' : 'development';

  const isProduction = envType === 'production';
  const isTest = envType === 'test';
  const isVercel = Boolean(env.VERCEL || env.VERCEL_ENV || env.NOW_REGION);
  const port = parseInt(env.PORT || '3000', 10);

  const connString = resolveDatabaseConnectionString(env);
  const host = (
    env.SQL_HOST ||
    env.PGHOST ||
    env.POSTGRES_HOST ||
    env.DB_HOST ||
    ''
  ).trim();

  const database = (
    env.SQL_DB_NAME ||
    env.PGDATABASE ||
    env.POSTGRES_DATABASE ||
    env.DB_NAME ||
    (isProduction ? '' : 'cloud_sql_development_database')
  ).trim();

  const user = (
    env.SQL_USER ||
    env.SQL_ADMIN_USER ||
    env.PGUSER ||
    env.POSTGRES_USER ||
    env.DB_USER ||
    (isProduction ? '' : 'ai_studio_app_user')
  ).trim();

  const rawPassword =
    env.SQL_PASSWORD ||
    env.SQL_ADMIN_PASSWORD ||
    env.PGPASSWORD ||
    env.POSTGRES_PASSWORD ||
    env.DB_PASSWORD ||
    '';

  const hasPassword = Boolean(rawPassword && rawPassword.length > 0);
  const rawPort = env.SQL_PORT || env.PGPORT || env.POSTGRES_PORT || env.DB_PORT;
  const dbPort = rawPort ? parseInt(rawPort, 10) : 5432;

  const isSocket = host.startsWith('/');
  const isLocal = host === '127.0.0.1' || host.toLowerCase() === 'localhost';
  const disableSsl =
    env.PGSSLMODE === 'disable' ||
    env.PGSSL_MODE === 'disable' ||
    env.DISABLE_SSL === 'true';

  const sslRequired = connString
    ? !connString.includes('localhost') && !connString.includes('127.0.0.1') && !disableSsl
    : !isSocket && !isLocal && !disableSsl;

  return {
    env: envType,
    isProduction,
    isTest,
    isVercel,
    port,
    database: {
      connectionString: connString ? '[CONFIGURED]' : undefined,
      host: host || (connString ? undefined : isProduction ? undefined : '127.0.0.1'),
      port: dbPort,
      database,
      user,
      hasPassword,
      sslRequired,
      isSocket,
      provider: 'POSTGRESQL'
    },
    telemetry: {
      standaloneHost: env.TELEMETRY_HOST || '0.0.0.0',
      tcpPort: parseInt(env.TELEMETRY_TCP_PORT || '5023', 10),
      udpPort: parseInt(env.TELEMETRY_UDP_PORT || '5024', 10),
      healthPort: parseInt(env.TELEMETRY_HEALTH_PORT || '9090', 10),
      enabledInCurrentProcess: env.ENABLE_EMBEDDED_TELEMETRY_SERVER === 'true'
    },
    sessionSecretConfigured: Boolean(env.SESSION_SECRET && env.SESSION_SECRET.length >= 32)
  };
}

/**
 * Validates server configuration.
 * IN PRODUCTION: Fails closed if essential settings or database configurations are missing.
 * IN DEVELOPMENT/TEST: Allows non-blocking defaults to facilitate local development and automated testing.
 */
export function validateServerConfig(env: Record<string, string | undefined> = process.env): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const config = loadServerConfig(env);
  const connString = resolveDatabaseConnectionString(env);

  const hasDbConfig = Boolean(
    connString ||
    env.SQL_HOST ||
    env.PGHOST ||
    env.POSTGRES_HOST ||
    env.DB_HOST
  );

  if (config.isProduction) {
    // 1. Production database configuration must be present
    if (!hasDbConfig) {
      errors.push(
        'PRODUCTION_CONFIG_FATAL: Neither DATABASE_URL nor discrete PostgreSQL parameters (PGHOST / SQL_HOST) are set. Production requires an authoritative PostgreSQL database.'
      );
    }

    // 2. If using discrete connection parameters, password must not be empty
    if (!connString && hasDbConfig) {
      const isSocket = Boolean(env.SQL_HOST?.startsWith('/') || env.PGHOST?.startsWith('/'));
      if (!isSocket && !config.database.hasPassword) {
        errors.push(
          'PRODUCTION_CONFIG_FATAL: Database password (PGPASSWORD or SQL_PASSWORD) must be provided for production TCP connections.'
        );
      }
      if (!config.database.database) {
        errors.push(
          'PRODUCTION_CONFIG_FATAL: Database name (PGDATABASE or SQL_DB_NAME) must be specified in production.'
        );
      }
    }

    // 3. Vercel Serverless Check
    if (config.isVercel && config.telemetry.enabledInCurrentProcess) {
      errors.push(
        'PRODUCTION_CONFIG_FATAL: Cannot run embedded TCP/UDP telemetry server in a Vercel serverless runtime. Dedicated GPS server must be deployed to a persistent container/VM.'
      );
    }
  } else {
    // Development or test notices
    if (!hasDbConfig) {
      warnings.push(
        'DEVELOPMENT NOTICE: No external DATABASE_URL supplied; using development environment defaults.'
      );
    }
  }

  const sanitizedConfig = {
    env: config.env,
    isProduction: config.isProduction,
    isVercel: config.isVercel,
    port: config.port,
    database: {
      provider: config.database.provider,
      connectionMode: connString ? 'CONNECTION_STRING_URI' : config.database.isSocket ? 'UNIX_SOCKET' : 'TCP',
      sslRequired: config.database.sslRequired,
      hasPassword: config.database.hasPassword,
      hasConnectionString: Boolean(connString)
    },
    telemetry: {
      enabledInCurrentProcess: config.telemetry.enabledInCurrentProcess,
      tcpPort: config.telemetry.tcpPort,
      udpPort: config.telemetry.udpPort,
      healthPort: config.telemetry.healthPort
    }
  };

  return {
    valid: errors.length === 0,
    environment: config.env,
    errors,
    warnings,
    sanitizedConfig
  };
}

/**
 * Ensures production configuration is valid. If invalid in production, throws a fail-closed error.
 */
export function assertProductionConfiguration(): void {
  const validation = validateServerConfig();
  if (!validation.valid) {
    console.error('\n=============================================================');
    console.error('  [FATAL ERROR] PRODUCTION CONFIGURATION VALIDATION FAILED   ');
    console.error('=============================================================');
    for (const err of validation.errors) {
      console.error(`  - ${err}`);
    }
    console.error('=============================================================\n');
    throw new Error(
      `Server startup halted due to ${validation.errors.length} fatal configuration error(s). See logs for details.`
    );
  }
}
