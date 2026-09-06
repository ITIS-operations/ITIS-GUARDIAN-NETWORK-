/**
 * =====================================================================
 * ITIS DEDICATED GPS TELEMETRY SERVER - GATEWAY BRIDGE
 * Reuses authoritative TelemetryGatewayEngine pipeline (Zero duplicated logic)
 * =====================================================================
 */

import { TelemetryServerConfig } from '../config/serverConfig.js';
import { InboundPacketContext } from '../transport/types.js';
import { TelemetryEnvelope, TelemetryIngestionResult, ActiveUserSession } from '../../../src/types.js';
import { telemetryGatewayEngine } from '../../../src/server/telemetryGatewayEngine.js';

export interface GatewayBridgeResult {
  accepted: boolean;
  deviceId?: string;
  protocol?: string;
  ackRequired: boolean;
  ackPayload?: string;
  error?: string;
  status: string;
  rawEnvelope?: TelemetryEnvelope;
  engineResult?: TelemetryIngestionResult;
}

export class TelemetryGatewayBridge {
  private config: TelemetryServerConfig;

  // Authoritative system actor context for the dedicated ingestion daemon
  private readonly daemonActor: ActiveUserSession = {
    id: 'usr-telemetry-daemon-01',
    name: 'ITIS Dedicated GPS Telemetry Ingestion Daemon',
    role: 'TECHNICIAN',
    email: 'telemetry-daemon@itis.gov.za',
    schoolId: 'system',
    token: 'itis-daemon-authenticated-internal-token'
  };

  constructor(config: TelemetryServerConfig) {
    this.config = config;
  }

  /**
   * Forward inbound packet to authoritative TelemetryGatewayEngine
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

    // Mode 1: IN_PROCESS (Direct authoritative engine invocation)
    if (this.config.integrationMode === 'IN_PROCESS' || !this.config.remoteApiUrl) {
      try {
        const engineResult = await telemetryGatewayEngine.ingestTelemetryPacket(envelope, this.daemonActor);
        
        return {
          accepted: engineResult.accepted,
          deviceId: engineResult.deviceId || engineResult.itisDeviceId,
          protocol: engineResult.protocol,
          ackRequired: engineResult.ackRequired || Boolean(engineResult.ackPayload),
          ackPayload: engineResult.ackPayload,
          error: engineResult.error,
          status: engineResult.status,
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

    // Mode 2: REMOTE_HTTP (For decoupled external deployments forwarding to central backend)
    try {
      const response = await fetch(`${this.config.remoteApiUrl}/api/telemetry/gateway/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.remoteServiceKey ? { 'Authorization': `Bearer ${this.config.remoteServiceKey}` } : {})
        },
        body: JSON.stringify(envelope)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          accepted: false,
          ackRequired: false,
          error: `REMOTE_GATEWAY_HTTP_${response.status}: ${errorText}`,
          status: 'HTTP_ERROR'
        };
      }

      const remoteResult = (await response.json()) as TelemetryIngestionResult;
      return {
        accepted: remoteResult.accepted,
        deviceId: remoteResult.ingestedRecord?.deviceId,
        protocol: remoteResult.ingestedRecord?.protocol,
        ackRequired: remoteResult.downlinkAck?.requiresAck || false,
        ackPayload: remoteResult.downlinkAck?.payload,
        error: remoteResult.error,
        status: remoteResult.status,
        rawEnvelope: envelope,
        engineResult: remoteResult
      };
    } catch (err: any) {
      return {
        accepted: false,
        ackRequired: false,
        error: `REMOTE_GATEWAY_COMMUNICATION_FAILURE: ${err.message || 'Network error'}`,
        status: 'NETWORK_ERROR'
      };
    }
  }
}
