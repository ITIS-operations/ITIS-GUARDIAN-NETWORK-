/**
 * =====================================================================
 * ITIS DEDICATED GPS TELEMETRY SERVER - GATEWAY BRIDGE
 * Reuses authoritative TelemetryGatewayEngine pipeline (Zero duplicated logic)
 * Hardened Service-to-Service Contract with Resilience Queue and Anti-Replay
 * =====================================================================
 */

import crypto from 'crypto';
import { TelemetryServerConfig } from '../config/serverConfig.js';
import { InboundPacketContext } from '../transport/types.js';
import { TelemetryEnvelope, TelemetryIngestionResult, ActiveUserSession } from '../../../src/types.js';
import { telemetryGatewayEngine } from '../../../src/server/telemetryGatewayEngine.js';
import { deviceRegistryEngine } from '../../../src/server/deviceRegistryEngine.js';
import { TelemetryResilienceQueue } from './telemetryResilienceQueue.js';
import {
  InternalTelemetryIngestRequest,
  InternalTelemetryIngestResponse,
  InternalDeviceHealthUpdateRequest,
  InternalDeviceHealthUpdateResponse,
  InternalDeviceConnectionStateRequest,
  InternalDeviceConnectionStateResponse,
  InternalHeartbeatRequest,
  InternalHeartbeatResponse,
  InternalPacketAckStatusRequest,
  InternalPacketAckStatusResponse,
  InternalServerDiagnosticsResponse,
  TelemetryRetryQueueItem
} from '../../../src/server/telemetryIntegration/telemetryIntegrationTypes.js';

export interface GatewayBridgeResult {
  accepted: boolean;
  deviceId?: string;
  protocol?: string;
  ackRequired: boolean;
  ackPayload?: string;
  duplicate?: boolean;
  suppressed?: boolean;
  error?: string;
  status: string;
  diagnosticCode?: string;
  rawEnvelope?: TelemetryEnvelope;
  engineResult?: TelemetryIngestionResult;
  bufferedForRetry?: boolean;
}

export class TelemetryGatewayBridge {
  private config: TelemetryServerConfig;
  public readonly resilienceQueue: TelemetryResilienceQueue;

  // Authoritative system actor context for the dedicated ingestion daemon (strictly TECHNICIAN role, NEVER FOUNDER)
  private readonly daemonActor: ActiveUserSession = {
    id: 'srv-telemetry-daemon-01',
    name: 'ITIS Dedicated GPS Telemetry Ingestion Daemon',
    role: 'TECHNICIAN',
    email: 'telemetry-daemon@service.itis.gov.za',
    schoolId: 'system',
    token: 'itis-daemon-authenticated-internal-token'
  };

  constructor(config: TelemetryServerConfig) {
    this.config = config;
    this.resilienceQueue = new TelemetryResilienceQueue({
      maxCapacity: config.maxRetryQueueSize,
      initialBackoffMs: config.retryBackoffMs,
      maxAttempts: config.maxRetryAttempts
    });

    // Wire retry forwarder for bounded queue drain
    this.resilienceQueue.setForwarder(async (item: TelemetryRetryQueueItem) => {
      return this.forwardRetryItem(item);
    });
  }

  /**
   * Helper to sign request headers for remote authoritative Core
   */
  private buildSignedHeaders(method: string, path: string, body: any, customIdempotencyKey?: string): Record<string, string> {
    const serviceId = this.config.serviceId || 'itis-telemetry-server-01';
    const timestamp = new Date().toISOString();
    const payloadStr = typeof body === 'string' ? body : JSON.stringify(body || {});

    const signatureString = `${timestamp}:${method.toUpperCase()}:${path}:${payloadStr}`;
    const secret = this.config.serviceSecret || 'itis-srv-hmac-secret-389f41b2';
    const signature = crypto.createHmac('sha256', secret).update(signatureString).digest('hex');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-ITIS-Service-Id': serviceId,
      'X-ITIS-Timestamp': timestamp,
      'X-ITIS-Signature': signature
    };

    if (this.config.serviceKey) {
      headers['Authorization'] = `Bearer ${this.config.serviceKey}`;
    }

    if (customIdempotencyKey) {
      headers['Idempotency-Key'] = customIdempotencyKey;
    }

    return headers;
  }

  /**
   * Forward inbound packet to authoritative Telemetry Pipeline
   */
  public async processPacket(context: InboundPacketContext): Promise<GatewayBridgeResult> {
    const rawPacketPayload = context.rawString || context.rawBuffer.toString('hex');

    const envelope: TelemetryEnvelope = {
      rawPacket: rawPacketPayload,
      transportType: context.transport,
      receivedAt: context.receivedAt.toISOString(),
      remoteAddress: context.remoteAddress,
      remotePort: context.remotePort,
      connectionId: context.connectionId
    };

    // Deterministic Idempotency Key
    const hash = crypto.createHash('sha256').update(rawPacketPayload).digest('hex');
    const idempotencyKey = `IDEMP:${context.transport}:${hash.slice(0, 24)}`;

    // Mode 1: IN_PROCESS (Direct Authoritative In-Process Integration)
    if (this.config.integrationMode === 'IN_PROCESS' || !this.config.remoteApiUrl) {
      try {
        const engineResult = await telemetryGatewayEngine.ingestTelemetryPacket(envelope, this.daemonActor);
        
        return {
          accepted: engineResult.accepted,
          deviceId: engineResult.deviceId || engineResult.itisDeviceId,
          protocol: engineResult.protocol,
          ackRequired: engineResult.ackRequired || Boolean(engineResult.ackPayload),
          ackPayload: engineResult.ackPayload,
          duplicate: engineResult.duplicate,
          suppressed: engineResult.duplicate,
          error: engineResult.error,
          status: engineResult.status,
          diagnosticCode: engineResult.diagnosticCode,
          rawEnvelope: envelope,
          engineResult
        };
      } catch (err: any) {
        return {
          accepted: false,
          ackRequired: false,
          error: `GATEWAY_ENGINE_EXCEPTION: ${err.message || 'Unknown processing error'}`,
          status: 'ERROR'
        };
      }
    }

    // Mode 2: REMOTE_HTTP (Decoupled Integration over Secure Authoritative API Contract)
    const ingestPath = '/api/internal/telemetry/ingest';
    const endpointUrl = `${this.config.remoteApiUrl}${ingestPath}`;
    const requestBody: InternalTelemetryIngestRequest = {
      serviceId: this.config.serviceId || 'itis-telemetry-server-01',
      envelope,
      idempotencyKey,
      timestamp: new Date().toISOString()
    };

    const signedHeaders = this.buildSignedHeaders('POST', ingestPath, requestBody, idempotencyKey);

    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: signedHeaders,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const remoteResult = (await response.json()) as InternalTelemetryIngestResponse;
        return {
          accepted: remoteResult.accepted,
          deviceId: remoteResult.deviceId || remoteResult.itisDeviceId,
          protocol: remoteResult.protocol,
          ackRequired: remoteResult.ackRequired,
          ackPayload: remoteResult.ackPayload,
          duplicate: remoteResult.duplicate,
          suppressed: remoteResult.suppressed,
          error: remoteResult.errorCode || remoteResult.message,
          status: remoteResult.accepted ? 'ACCEPTED' : (remoteResult.duplicate ? 'DUPLICATE' : 'REJECTED'),
          diagnosticCode: remoteResult.diagnosticCode,
          rawEnvelope: envelope,
          engineResult: remoteResult.engineResult
        };
      }

      // If remote returned 5xx or temporary unavailability -> Enqueue to Resilience Queue
      if (response.status >= 500) {
        const { item } = this.resilienceQueue.enqueue(envelope, idempotencyKey);
        return {
          accepted: true,
          deviceId: envelope.deviceIdentifier,
          ackRequired: true,
          bufferedForRetry: true,
          status: 'BUFFERED_FOR_RETRY',
          error: `REMOTE_CORE_UNAVAILABLE_${response.status}: Queued for retry (Attempt ${item.attempts})`,
          rawEnvelope: envelope
        };
      }

      // 4xx Client/Security Error
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      return {
        accepted: false,
        ackRequired: false,
        error: errorData.error || `HTTP_${response.status}`,
        status: 'REJECTED',
        rawEnvelope: envelope
      };
    } catch (err: any) {
      // Network failure / Connection timeout -> Controlled Enqueue to Resilience Queue
      const { item } = this.resilienceQueue.enqueue(envelope, idempotencyKey);
      return {
        accepted: true,
        deviceId: envelope.deviceIdentifier,
        ackRequired: true,
        bufferedForRetry: true,
        status: 'BUFFERED_FOR_RETRY',
        error: `NETWORK_FAILURE: ${err.message || 'Remote API unreachable'}. Buffered in bounded queue.`,
        rawEnvelope: envelope
      };
    }
  }

  /**
   * Forward retry item from resilience queue
   */
  private async forwardRetryItem(item: TelemetryRetryQueueItem): Promise<{ success: boolean; duplicate?: boolean; error?: string }> {
    if (this.config.integrationMode === 'IN_PROCESS' || !this.config.remoteApiUrl) {
      try {
        const res = await telemetryGatewayEngine.ingestTelemetryPacket(item.envelope, this.daemonActor);
        return { success: res.accepted, duplicate: res.duplicate };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    const ingestPath = '/api/internal/telemetry/ingest';
    const endpointUrl = `${this.config.remoteApiUrl}${ingestPath}`;
    const requestBody: InternalTelemetryIngestRequest = {
      serviceId: this.config.serviceId || 'itis-telemetry-server-01',
      envelope: item.envelope,
      idempotencyKey: item.idempotencyKey,
      timestamp: new Date().toISOString()
    };

    const headers = this.buildSignedHeaders('POST', ingestPath, requestBody, item.idempotencyKey);

    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data = (await response.json()) as InternalTelemetryIngestResponse;
        return { success: data.accepted || data.duplicate, duplicate: data.duplicate };
      }

      return { success: false, error: `HTTP_${response.status}` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Report device health update to authoritative core
   */
  public async reportDeviceHealth(data: Omit<InternalDeviceHealthUpdateRequest, 'serviceId'>): Promise<InternalDeviceHealthUpdateResponse> {
    const serviceId = this.config.serviceId || 'itis-telemetry-server-01';
    const payload: InternalDeviceHealthUpdateRequest = { ...data, serviceId };

    if (this.config.integrationMode === 'IN_PROCESS' || !this.config.remoteApiUrl) {
      const device = deviceRegistryEngine.getDeviceById(data.trackerDeviceId);
      if (!device) {
        throw new Error(`Device '${data.trackerDeviceId}' not found in registry`);
      }
      if (data.batteryPercentage !== undefined) {
        device.batteryStatus.percentage = data.batteryPercentage;
        device.batteryStatus.healthStatus = data.batteryPercentage < 20 ? 'LOW' : 'NORMAL';
      }
      device.lastCommunicationTimestamp = data.timestamp;
      const healthState = deviceRegistryEngine.calculateDeviceHealthState(device);
      return {
        success: true,
        trackerDeviceId: data.trackerDeviceId,
        itisDeviceId: device.itisDeviceId,
        healthState,
        updatedAt: new Date().toISOString()
      };
    }

    const path = '/api/internal/telemetry/device-health';
    const headers = this.buildSignedHeaders('POST', path, payload);
    const res = await fetch(`${this.config.remoteApiUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Device health report failed (${res.status}): ${err}`);
    }

    return res.json() as Promise<InternalDeviceHealthUpdateResponse>;
  }

  /**
   * Report tracker connection state to authoritative core
   */
  public async reportConnectionState(data: Omit<InternalDeviceConnectionStateRequest, 'serviceId'>): Promise<InternalDeviceConnectionStateResponse> {
    const serviceId = this.config.serviceId || 'itis-telemetry-server-01';
    const payload: InternalDeviceConnectionStateRequest = { ...data, serviceId };

    if (this.config.integrationMode === 'IN_PROCESS' || !this.config.remoteApiUrl) {
      const device = deviceRegistryEngine.getDeviceById(data.trackerDeviceId);
      if (device) {
        device.connectionStatus = data.status === 'CONNECTED' ? 'ONLINE' : 'STANDBY';
        deviceRegistryEngine.calculateDeviceHealthState(device);
      }
      return {
        success: true,
        trackerDeviceId: data.trackerDeviceId,
        itisDeviceId: device?.itisDeviceId,
        recordedStatus: data.status,
        timestamp: new Date().toISOString()
      };
    }

    const path = '/api/internal/telemetry/connection-state';
    const headers = this.buildSignedHeaders('POST', path, payload);
    const res = await fetch(`${this.config.remoteApiUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Connection state report failed (${res.status}): ${err}`);
    }

    return res.json() as Promise<InternalDeviceConnectionStateResponse>;
  }

  /**
   * Send heartbeat to authoritative core
   */
  public async sendHeartbeat(data: Omit<InternalHeartbeatRequest, 'serviceId'>): Promise<InternalHeartbeatResponse> {
    const serviceId = this.config.serviceId || 'itis-telemetry-server-01';
    const payload: InternalHeartbeatRequest = { ...data, serviceId };

    if (this.config.integrationMode === 'IN_PROCESS' || !this.config.remoteApiUrl) {
      return {
        status: 'OK',
        coreTimestamp: new Date().toISOString(),
        serviceId,
        synchronized: true,
        timeSkewMs: 0
      };
    }

    const path = '/api/internal/telemetry/heartbeat';
    const headers = this.buildSignedHeaders('POST', path, payload);
    const res = await fetch(`${this.config.remoteApiUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Heartbeat failed (${res.status}): ${err}`);
    }

    return res.json() as Promise<InternalHeartbeatResponse>;
  }

  /**
   * Report packet acknowledgement delivery status
   */
  public async reportAckStatus(data: Omit<InternalPacketAckStatusRequest, 'serviceId'>): Promise<InternalPacketAckStatusResponse> {
    const serviceId = this.config.serviceId || 'itis-telemetry-server-01';
    const payload: InternalPacketAckStatusRequest = { ...data, serviceId };

    if (this.config.integrationMode === 'IN_PROCESS' || !this.config.remoteApiUrl) {
      return {
        success: true,
        trackerDeviceId: data.trackerDeviceId,
        acknowledged: data.deliveryStatus === 'DELIVERED',
        timestamp: new Date().toISOString()
      };
    }

    const path = '/api/internal/telemetry/ack-status';
    const headers = this.buildSignedHeaders('POST', path, payload);
    const res = await fetch(`${this.config.remoteApiUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ack status report failed (${res.status}): ${err}`);
    }

    return res.json() as Promise<InternalPacketAckStatusResponse>;
  }

  /**
   * Request authoritative diagnostics
   */
  public async getDiagnostics(): Promise<InternalServerDiagnosticsResponse> {
    if (this.config.integrationMode === 'IN_PROCESS' || !this.config.remoteApiUrl) {
      const gatewayStatus = telemetryGatewayEngine.getGatewayStatus();
      return {
        success: true,
        serviceIdentity: {
          serviceId: this.config.serviceId || 'itis-telemetry-server-01',
          serviceRole: 'TELEMETRY_SERVICE',
          serviceName: 'ITIS Dedicated GPS Telemetry Ingestion Node',
          authenticatedVia: 'INTERNAL_DIRECT',
          authenticatedAt: new Date().toISOString()
        },
        coreGatewayMetrics: {
          totalIngested: gatewayStatus.metrics.totalIngested,
          totalAccepted: gatewayStatus.metrics.totalAccepted,
          totalRejected: gatewayStatus.metrics.totalRejected,
          totalDuplicates: gatewayStatus.metrics.totalDuplicates,
          totalQuarantined: gatewayStatus.metrics.totalQuarantined
        },
        serverUptimeSeconds: Math.floor(process.uptime()),
        evaluatedAt: new Date().toISOString()
      };
    }

    const path = '/api/internal/telemetry/diagnostics';
    const headers = this.buildSignedHeaders('GET', path, {});
    const res = await fetch(`${this.config.remoteApiUrl}${path}`, {
      method: 'GET',
      headers
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Diagnostics request failed (${res.status}): ${err}`);
    }

    return res.json() as Promise<InternalServerDiagnosticsResponse>;
  }
}
