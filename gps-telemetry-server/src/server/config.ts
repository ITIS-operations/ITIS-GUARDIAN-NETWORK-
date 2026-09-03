/**
 * GPS Telemetry Server Configuration Module
 */

export interface TelemetryServerConfig {
  env: string;
  host: string;
  httpPort: number;
  tcpPort: number;
  udpPort: number;
  storageMode: 'memory' | 'postgresql';
  database: {
    connectionString?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    ssl?: boolean;
    poolMax?: number;
  };
  security: {
    maxConcurrentTcpConnections: number;
    maxPacketSizeBytes: number;
    deviceIdleTimeoutSeconds: number;
    rateLimitMaxPacketsPerMinute: number;
  };
  integration: {
    coreApiUrl?: string;
    ingestKey?: string;
    dispatchEnabled: boolean;
  };
  simulator: {
    enabled: boolean;
    deviceCount: number;
    intervalMs: number;
  };
}

export function loadConfig(): TelemetryServerConfig {
  const storageMode = (process.env.TELEMETRY_STORAGE_MODE || 'memory').toLowerCase() === 'postgresql'
    ? 'postgresql'
    : 'memory';

  return {
    env: process.env.NODE_ENV || 'development',
    host: process.env.HOST || '0.0.0.0',
    httpPort: parseInt(process.env.PORT || process.env.HTTP_PORT || '8080', 10),
    tcpPort: parseInt(process.env.TCP_PORT || '5000', 10),
    udpPort: parseInt(process.env.UDP_PORT || '5001', 10),
    storageMode,
    database: {
      connectionString: process.env.DATABASE_URL,
      host: process.env.TELEMETRY_DB_HOST || 'localhost',
      port: parseInt(process.env.TELEMETRY_DB_PORT || '5432', 10),
      database: process.env.TELEMETRY_DB_NAME || 'itis_telemetry',
      user: process.env.TELEMETRY_DB_USER || 'telemetry_svc',
      password: process.env.TELEMETRY_DB_PASSWORD || '',
      ssl: process.env.TELEMETRY_DB_SSL === 'true',
      poolMax: parseInt(process.env.TELEMETRY_DB_POOL_MAX || '20', 10)
    },
    security: {
      maxConcurrentTcpConnections: parseInt(
        process.env.DEVICE_CONNECTION_LIMIT || process.env.MAX_CONCURRENT_TCP_CONNECTIONS || '5000',
        10
      ),
      maxPacketSizeBytes: parseInt(process.env.MAX_PACKET_SIZE_BYTES || '2048', 10),
      deviceIdleTimeoutSeconds: parseInt(process.env.DEVICE_IDLE_TIMEOUT_SECONDS || '300', 10),
      rateLimitMaxPacketsPerMinute: parseInt(process.env.RATE_LIMIT_MAX_PACKETS_PER_MINUTE || '60', 10)
    },
    integration: {
      coreApiUrl: process.env.ITIS_CORE_API_URL,
      ingestKey: process.env.ITIS_TELEMETRY_API_KEY || process.env.ITIS_TELEMETRY_INGEST_KEY,
      dispatchEnabled: process.env.ITIS_EVENT_DISPATCH_ENABLED === 'true'
    },
    simulator: {
      enabled: process.env.ENABLE_DEV_SIMULATOR === 'true',
      deviceCount: parseInt(process.env.SIMULATOR_DEVICE_COUNT || '5', 10),
      intervalMs: parseInt(process.env.SIMULATOR_INTERVAL_MS || '5000', 10)
    }
  };
}
