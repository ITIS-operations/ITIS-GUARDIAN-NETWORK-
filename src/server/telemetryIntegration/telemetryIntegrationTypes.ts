/**
 * ==============================================================================
 * ITIS GUARDIAN NETWORK — SECURE TELEMETRY INTEGRATION CONTRACT TYPES
 * Sovereign service-to-service interfaces between Dedicated Telemetry Server
 * and ITIS Authoritative Core.
 * ==============================================================================
 */

import { TelemetryEnvelope, TelemetryIngestionResult } from '../../types.js';

/**
 * Service Authentication Credentials and Identity
 */
export interface ServiceAuthIdentity {
  serviceId: string;
  serviceRole: 'TELEMETRY_SERVICE';
  serviceName: string;
  authenticatedVia: 'SIGNATURE' | 'BEARER_TOKEN' | 'INTERNAL_DIRECT';
  authenticatedAt: string;
}

export interface SignedServiceHeaders {
  'x-itis-service-id': string;
  'x-itis-timestamp': string;
  'x-itis-signature'?: string;
  'authorization'?: string;
  'idempotency-key'?: string;
  'content-type'?: string;
}

/**
 * 1. Telemetry Ingestion Contract
 */
export interface InternalTelemetryIngestRequest {
  serviceId: string;
  envelope: TelemetryEnvelope;
  idempotencyKey?: string;
  timestamp: string; // ISO-8601
  metadata?: Record<string, any>;
}

export interface InternalTelemetryIngestResponse {
  success: boolean;
  accepted: boolean;
  duplicate: boolean;
  suppressed: boolean;
  deviceId?: string;
  itisDeviceId?: string;
  protocol?: string;
  packetType?: string;
  ackRequired: boolean;
  ackPayload?: string;
  diagnosticCode?: string;
  errorCode?: string;
  message?: string;
  processedAt: string;
  idempotencyKey?: string;
  engineResult?: TelemetryIngestionResult;
}

/**
 * 2. Device Health Update Contract
 */
export interface InternalDeviceHealthUpdateRequest {
  serviceId: string;
  trackerDeviceId: string;
  timestamp: string;
  batteryPercentage?: number;
  voltage?: number;
  gsmSignalStrength?: number;
  gpsSatelliteCount?: number;
  temperatureCelsius?: number;
  tamperAlert?: boolean;
  networkStatus?: 'CONNECTED' | 'ROAMING' | 'SEARCHING' | 'OFFLINE';
}

export interface InternalDeviceHealthUpdateResponse {
  success: boolean;
  trackerDeviceId: string;
  itisDeviceId?: string;
  healthState: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'OFFLINE' | 'SUSPENDED' | 'RETIRED' | 'ONLINE' | 'STALE';
  batteryHealth?: 'NORMAL' | 'LOW' | 'CRITICAL';
  updatedAt: string;
  message?: string;
}

/**
 * 3. Device Connection State Contract
 */
export interface InternalDeviceConnectionStateRequest {
  serviceId: string;
  trackerDeviceId: string;
  connectionId: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'IDLE' | 'TIMEOUT' | 'ERROR';
  transport: 'TCP' | 'UDP';
  remoteAddress: string;
  remotePort?: number;
  timestamp: string;
  disconnectReason?: string;
}

export interface InternalDeviceConnectionStateResponse {
  success: boolean;
  trackerDeviceId: string;
  itisDeviceId?: string;
  recordedStatus: string;
  timestamp: string;
  message?: string;
}

/**
 * 4. Heartbeat Contract
 */
export interface InternalHeartbeatRequest {
  serviceId: string;
  timestamp: string;
  uptimeSeconds: number;
  activeConnections: number;
  trackedDevicesCount: number;
  recentPacketsReceived: number;
  bufferUsageBytes?: number;
  retryQueueSize?: number;
}

export interface InternalHeartbeatResponse {
  status: 'OK' | 'DEGRADED' | 'MAINTENANCE';
  coreTimestamp: string;
  serviceId: string;
  synchronized: boolean;
  timeSkewMs: number;
}

/**
 * 5. Packet Acknowledgement Status Contract
 */
export interface InternalPacketAckStatusRequest {
  serviceId: string;
  trackerDeviceId: string;
  packetSequence?: number | string;
  ackPayload: string;
  deliveryStatus: 'DELIVERED' | 'DISPATCH_FAILED' | 'SOCKET_CLOSED' | 'TIMEOUT';
  dispatchedAt: string;
  roundTripTimeMs?: number;
}

export interface InternalPacketAckStatusResponse {
  success: boolean;
  trackerDeviceId: string;
  acknowledged: boolean;
  timestamp: string;
  message?: string;
}

/**
 * 6. Server Diagnostics Contract
 */
export interface InternalServerDiagnosticsRequest {
  serviceId: string;
  timestamp: string;
  metrics: {
    totalPacketsReceived: number;
    totalPacketsIngested: number;
    totalPacketsRejected: number;
    totalDuplicatesSuppressed: number;
    totalRetriesAttempted: number;
    currentRetryQueueSize: number;
    activeSocketConnections: number;
    peakSocketConnections: number;
  };
}

export interface InternalServerDiagnosticsResponse {
  success: boolean;
  serviceIdentity: ServiceAuthIdentity;
  coreGatewayMetrics: {
    totalIngested: number;
    totalAccepted: number;
    totalRejected: number;
    totalDuplicates: number;
    totalQuarantined: number;
  };
  serverUptimeSeconds: number;
  evaluatedAt: string;
}

/**
 * Idempotency Record
 */
export interface IdempotencyRecord {
  key: string;
  fingerprint: string;
  response: InternalTelemetryIngestResponse;
  firstProcessedAt: number;
  lastHitAt: number;
  hitCount: number;
}

/**
 * Resilience & Retry Types
 */
export interface TelemetryRetryQueueItem {
  id: string;
  idempotencyKey: string;
  envelope: TelemetryEnvelope;
  enqueuedAt: number;
  attempts: number;
  nextRetryAt: number;
  lastError?: string;
  priority: 'CRITICAL' | 'NORMAL';
}

export interface RetryQueueMetrics {
  currentQueueSize: number;
  maxCapacity: number;
  totalEnqueued: number;
  totalSuccessfullyRetried: number;
  totalDroppedDueToCapacity: number;
  oldestItemAgeMs: number;
  isProcessing: boolean;
}
