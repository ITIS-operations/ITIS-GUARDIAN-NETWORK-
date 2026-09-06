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
  rateLimitPacketsPerSec: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
  gracefulShutdownTimeoutMs: number;
  integrationMode: 'IN_PROCESS' | 'REMOTE_HTTP';
  remoteApiUrl?: string;
  remoteServiceKey?: string;
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
    rateLimitPacketsPerSec: overrides?.rateLimitPacketsPerSec ?? parseInt(process.env.RATE_LIMIT_PACKETS_PER_SEC || '10', 10),
    connectionTimeoutMs: overrides?.connectionTimeoutMs ?? parseInt(process.env.CONNECTION_TIMEOUT_MS || '60000', 10),
    idleTimeoutMs: overrides?.idleTimeoutMs ?? parseInt(process.env.IDLE_TIMEOUT_MS || '180000', 10),
    gracefulShutdownTimeoutMs: overrides?.gracefulShutdownTimeoutMs ?? parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS || '10000', 10),

    // Authoritative Gateway Integration Mode
    integrationMode: (overrides?.integrationMode ?? (process.env.INTEGRATION_MODE as any) ?? 'IN_PROCESS'),
    remoteApiUrl: overrides?.remoteApiUrl ?? process.env.ITIS_API_URL,
    remoteServiceKey: overrides?.remoteServiceKey ?? process.env.ITIS_SERVICE_KEY
  };
}
