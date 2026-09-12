/**
 * =====================================================================
 * ITIS DEDICATED GPS TELEMETRY SERVER - CONFIGURATION
 * Non-privileged default ports and hardened boundary constraints
 * =====================================================================
 */

export interface TelemetryServerConfig {
  host: string;
  tcpPort: number;
  udpPort: number;
  healthPort: number;
  nodeEnv: string;
  logLevel: string;
  maxConnections: number;
  maxPacketSizeBytes: number;
  maxBufferedDataBytes: number;
  rateLimitPacketsPerSec: number;
  perDeviceRateLimitPerMin: number;
  malformedPacketThreshold: number;
  duplicateStormThreshold: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
  gracefulShutdownTimeoutMs: number;
  integrationMode: 'IN_PROCESS' | 'REMOTE_HTTP';
  remoteApiUrl?: string;
  remoteServiceKey?: string;
  serviceId?: string;
  serviceKey?: string;
  serviceSecret?: string;
  maxRetryQueueSize?: number;
  retryBackoffMs?: number;
  maxRetryAttempts?: number;
}

export function loadServerConfig(overrides?: Partial<TelemetryServerConfig>): TelemetryServerConfig {
  return {
    // Network binding (defaulting to safe unprivileged ports)
    host: overrides?.host ?? process.env.HOST ?? '0.0.0.0',
    tcpPort: overrides?.tcpPort ?? parseInt(process.env.TCP_PORT || '5023', 10),
    udpPort: overrides?.udpPort ?? parseInt(process.env.UDP_PORT || '5024', 10),
    healthPort: overrides?.healthPort ?? parseInt(process.env.HEALTH_PORT || '8092', 10),

    // Environment
    nodeEnv: overrides?.nodeEnv ?? process.env.NODE_ENV ?? 'production',
    logLevel: overrides?.logLevel ?? process.env.LOG_LEVEL ?? 'info',

    // Hardened Security Limits
    maxConnections: overrides?.maxConnections ?? parseInt(process.env.MAX_CONNECTIONS || '500', 10),
    maxPacketSizeBytes: overrides?.maxPacketSizeBytes ?? parseInt(process.env.MAX_PACKET_SIZE_BYTES || '2048', 10),
    maxBufferedDataBytes: overrides?.maxBufferedDataBytes ?? parseInt(process.env.MAX_BUFFERED_DATA_BYTES || '8192', 10),
    rateLimitPacketsPerSec: overrides?.rateLimitPacketsPerSec ?? parseInt(process.env.RATE_LIMIT_PACKETS_PER_SEC || '10', 10),
    perDeviceRateLimitPerMin: overrides?.perDeviceRateLimitPerMin ?? parseInt(process.env.PER_DEVICE_RATE_LIMIT_PER_MIN || '120', 10),
    malformedPacketThreshold: overrides?.malformedPacketThreshold ?? parseInt(process.env.MALFORMED_PACKET_THRESHOLD || '5', 10),
    duplicateStormThreshold: overrides?.duplicateStormThreshold ?? parseInt(process.env.DUPLICATE_STORM_THRESHOLD || '10', 10),
    connectionTimeoutMs: overrides?.connectionTimeoutMs ?? parseInt(process.env.CONNECTION_TIMEOUT_MS || '60000', 10),
    idleTimeoutMs: overrides?.idleTimeoutMs ?? parseInt(process.env.IDLE_TIMEOUT_MS || '180000', 10),
    gracefulShutdownTimeoutMs: overrides?.gracefulShutdownTimeoutMs ?? parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS || '10000', 10),

    // Authoritative Gateway Integration Mode
    integrationMode: (overrides?.integrationMode ?? (process.env.INTEGRATION_MODE as any) ?? 'IN_PROCESS'),
    remoteApiUrl: overrides?.remoteApiUrl ?? process.env.ITIS_CORE_API_URL ?? process.env.ITIS_API_URL,
    remoteServiceKey: overrides?.remoteServiceKey ?? process.env.ITIS_TELEMETRY_SERVICE_KEY ?? process.env.ITIS_SERVICE_KEY,
    serviceId: overrides?.serviceId ?? process.env.ITIS_TELEMETRY_SERVICE_ID ?? 'itis-telemetry-server-01',
    serviceKey: overrides?.serviceKey ?? process.env.ITIS_TELEMETRY_SERVICE_KEY ?? process.env.ITIS_SERVICE_KEY ?? 'itis-srv-key-telemetry-sec-01',
    serviceSecret: overrides?.serviceSecret ?? process.env.ITIS_TELEMETRY_SERVICE_SECRET ?? 'itis-srv-hmac-secret-389f41b2',
    maxRetryQueueSize: overrides?.maxRetryQueueSize ?? parseInt(process.env.MAX_RETRY_QUEUE_SIZE || '500', 10),
    retryBackoffMs: overrides?.retryBackoffMs ?? parseInt(process.env.RETRY_BACKOFF_MS || '500', 10),
    maxRetryAttempts: overrides?.maxRetryAttempts ?? parseInt(process.env.MAX_RETRY_ATTEMPTS || '10', 10)
  };
}
