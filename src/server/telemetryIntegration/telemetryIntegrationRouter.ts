/**
 * ==============================================================================
 * ITIS GUARDIAN NETWORK — INTERNAL TELEMETRY INTEGRATION ROUTER
 * Authoritative Server-to-Server Endpoints for Dedicated Telemetry Server
 * ==============================================================================
 */

import express from 'express';
import { telemetryGatewayEngine } from '../telemetryGatewayEngine.js';
import { deviceRegistryEngine } from '../deviceRegistryEngine.js';
import { db } from '../dbStore.js';
import { telemetrySecurityEngine } from './telemetrySecurityEngine.js';
import { telemetryIdempotencyEngine } from './telemetryIdempotencyEngine.js';
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
  InternalServerDiagnosticsResponse
} from './telemetryIntegrationTypes.js';

export const telemetryIntegrationRouter = express.Router();

/**
 * Common service authentication middleware
 */
function authenticateService(req: express.Request, res: express.Response, next: express.NextFunction) {
  const validation = telemetrySecurityEngine.validateServiceRequest({
    headers: req.headers,
    method: req.method,
    path: req.originalUrl || req.url,
    body: req.body,
    ipAddress: req.ip || req.socket?.remoteAddress || '127.0.0.1'
  });

  if (!validation.valid) {
    return res.status(validation.statusCode).json({
      success: false,
      errorCode: validation.errorCode,
      error: validation.error
    });
  }

  // Attach identity and dedicated service actor to request
  (req as any).serviceIdentity = validation.identity;
  (req as any).serviceActor = validation.actor;
  next();
}

/**
 * 1. TELEMETRY INGESTION ENDPOINT
 * POST /api/internal/telemetry/ingest
 */
telemetryIntegrationRouter.post('/ingest', authenticateService, async (req, res) => {
  try {
    const body = req.body as InternalTelemetryIngestRequest;
    const actor = (req as any).serviceActor;
    const identity = (req as any).serviceIdentity;

    const envelope = body.envelope;
    const rawIdempKey = req.headers['idempotency-key'] || body.idempotencyKey;
    const customKey = Array.isArray(rawIdempKey) ? rawIdempKey[0] : rawIdempKey;

    // Generate idempotency identifiers
    const { idempotencyKey, fingerprint } = telemetryIdempotencyEngine.generateFingerprint(envelope, customKey);

    // Check idempotency cache first
    const existing = telemetryIdempotencyEngine.check(idempotencyKey, fingerprint);
    if (existing) {
      const suppressedResponse = telemetryIdempotencyEngine.createSuppressedResponse(existing);
      return res.status(200).json(suppressedResponse);
    }

    // Ingest through Authoritative Pipeline
    const engineResult = await telemetryGatewayEngine.ingestTelemetryPacket(envelope, actor);

    // If engine flagged it as duplicate through its internal protocol cache
    if (engineResult.duplicate) {
      const duplicateResponse: InternalTelemetryIngestResponse = {
        success: false,
        accepted: false,
        duplicate: true,
        suppressed: true,
        deviceId: engineResult.deviceId || engineResult.itisDeviceId,
        itisDeviceId: engineResult.itisDeviceId,
        protocol: engineResult.protocol,
        packetType: engineResult.packetType,
        ackRequired: engineResult.ackRequired,
        ackPayload: engineResult.ackPayload,
        diagnosticCode: 'DUPLICATE_PACKET',
        errorCode: 'DUPLICATE_PACKET',
        message: 'DUPLICATE_PACKET: Authoritative duplicate suppressed.',
        processedAt: new Date().toISOString(),
        idempotencyKey,
        engineResult
      };

      telemetryIdempotencyEngine.store(idempotencyKey, fingerprint, duplicateResponse);
      return res.status(200).json(duplicateResponse);
    }

    // Authoritative Success / Ingestion Response
    const responsePayload: InternalTelemetryIngestResponse = {
      success: engineResult.accepted,
      accepted: engineResult.accepted,
      duplicate: false,
      suppressed: false,
      deviceId: engineResult.deviceId || engineResult.itisDeviceId,
      itisDeviceId: engineResult.itisDeviceId,
      protocol: engineResult.protocol,
      packetType: engineResult.packetType,
      ackRequired: engineResult.ackRequired || Boolean(engineResult.ackPayload),
      ackPayload: engineResult.ackPayload,
      diagnosticCode: engineResult.diagnosticCode,
      errorCode: engineResult.errorCode,
      message: engineResult.error || (engineResult.accepted ? 'TELEMETRY_INGESTION_ACCEPTED' : 'TELEMETRY_INGESTION_REJECTED'),
      processedAt: new Date().toISOString(),
      idempotencyKey,
      engineResult
    };

    // Store in idempotency engine for subsequent retries
    if (engineResult.accepted) {
      telemetryIdempotencyEngine.store(idempotencyKey, fingerprint, responsePayload);
    }

    // Log authorized service access
    telemetrySecurityEngine.logServiceAccess(identity, 'TELEMETRY_INGEST', {
      deviceId: responsePayload.deviceId,
      accepted: responsePayload.accepted,
      protocol: responsePayload.protocol,
      idempotencyKey
    });

    return res.status(responsePayload.accepted ? 200 : 422).json(responsePayload);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      accepted: false,
      duplicate: false,
      suppressed: false,
      ackRequired: false,
      errorCode: 'INTERNAL_GATEWAY_ERROR',
      error: `INTERNAL_GATEWAY_ERROR: ${err.message}`,
      processedAt: new Date().toISOString()
    });
  }
});

/**
 * 2. DEVICE HEALTH UPDATE ENDPOINT
 * POST /api/internal/telemetry/device-health
 */
telemetryIntegrationRouter.post('/device-health', authenticateService, async (req, res) => {
  try {
    const body = req.body as InternalDeviceHealthUpdateRequest;
    const identity = (req as any).serviceIdentity;

    if (!body.trackerDeviceId) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST: trackerDeviceId is required.'
      });
    }

    // Authoritative Device Lookup (Zero duplicated database)
    const device = deviceRegistryEngine.getDeviceById(body.trackerDeviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        trackerDeviceId: body.trackerDeviceId,
        error: `DEVICE_NOT_FOUND: Device '${body.trackerDeviceId}' is not registered in ITIS Registry.`
      });
    }

    // Update battery status if provided
    if (body.batteryPercentage !== undefined) {
      device.batteryStatus.percentage = Math.max(0, Math.min(100, body.batteryPercentage));
      device.batteryStatus.healthStatus = device.batteryStatus.percentage < 20 ? 'LOW' : 'NORMAL';
    }
    if (body.voltage !== undefined) {
      device.batteryStatus.voltage = body.voltage;
    }
    if (body.networkStatus) {
      device.networkStatus = body.networkStatus === 'OFFLINE' ? 'DISCONNECTED' : body.networkStatus;
    }

    device.lastCommunicationTimestamp = body.timestamp || new Date().toISOString();
    device.updatedAt = new Date().toISOString();

    // Calculate authoritative health state
    const healthState = deviceRegistryEngine.calculateDeviceHealthState(device);

    // Audit device health update
    db.logAuditEvent({
      actionType: 'DEVICE_HEALTH_RECORDED',
      actorUserId: `srv-${identity.serviceId}`,
      actorName: identity.serviceName,
      actorRole: 'TECHNICIAN',
      targetEntity: 'DEVICE',
      targetId: device.itisDeviceId,
      details: {
        trackerDeviceId: body.trackerDeviceId,
        healthState,
        batteryPercentage: body.batteryPercentage,
        voltage: body.voltage,
        gsmSignalStrength: body.gsmSignalStrength,
        temperatureCelsius: body.temperatureCelsius,
        tamperAlert: body.tamperAlert
      },
      ipAddress: '127.0.0.1'
    });

    const response: InternalDeviceHealthUpdateResponse = {
      success: true,
      trackerDeviceId: body.trackerDeviceId,
      itisDeviceId: device.itisDeviceId,
      healthState,
      batteryHealth: device.batteryStatus.healthStatus as any,
      updatedAt: device.updatedAt
    };

    return res.json(response);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: `DEVICE_HEALTH_UPDATE_FAILED: ${err.message}`
    });
  }
});

/**
 * 3. DEVICE CONNECTION STATE ENDPOINT
 * POST /api/internal/telemetry/connection-state
 */
telemetryIntegrationRouter.post('/connection-state', authenticateService, async (req, res) => {
  try {
    const body = req.body as InternalDeviceConnectionStateRequest;
    const identity = (req as any).serviceIdentity;

    if (!body.trackerDeviceId || !body.status) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST: trackerDeviceId and status are required.'
      });
    }

    const device = deviceRegistryEngine.getDeviceById(body.trackerDeviceId);
    const itisDeviceId = device ? device.itisDeviceId : undefined;

    if (device) {
      if (body.status === 'CONNECTED') {
        device.connectionStatus = 'ONLINE';
        device.lastCommunicationTimestamp = body.timestamp || new Date().toISOString();
      } else if (body.status === 'DISCONNECTED' || body.status === 'TIMEOUT') {
        device.connectionStatus = 'STANDBY';
      }
      device.updatedAt = new Date().toISOString();
      deviceRegistryEngine.calculateDeviceHealthState(device);
    }

    // Log authoritative connection audit
    db.logAuditEvent({
      actionType: 'DEVICE_CONNECTION_STATE_RECORDED',
      actorUserId: `srv-${identity.serviceId}`,
      actorName: identity.serviceName,
      actorRole: 'TECHNICIAN',
      targetEntity: 'DEVICE',
      targetId: itisDeviceId || body.trackerDeviceId,
      details: {
        trackerDeviceId: body.trackerDeviceId,
        connectionId: body.connectionId,
        status: body.status,
        transport: body.transport,
        remoteAddress: body.remoteAddress,
        remotePort: body.remotePort,
        disconnectReason: body.disconnectReason
      },
      ipAddress: '127.0.0.1'
    });

    const response: InternalDeviceConnectionStateResponse = {
      success: true,
      trackerDeviceId: body.trackerDeviceId,
      itisDeviceId,
      recordedStatus: body.status,
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: `CONNECTION_STATE_UPDATE_FAILED: ${err.message}`
    });
  }
});

/**
 * 4. HEARTBEAT ENDPOINT
 * POST /api/internal/telemetry/heartbeat
 */
telemetryIntegrationRouter.post('/heartbeat', authenticateService, async (req, res) => {
  try {
    const body = req.body as InternalHeartbeatRequest;
    const identity = (req as any).serviceIdentity;

    const requestTime = new Date(body.timestamp).getTime();
    const now = Date.now();
    const timeSkewMs = Math.abs(now - requestTime);

    // Audit heartbeat event
    db.logAuditEvent({
      actionType: 'HEARTBEAT_RECEIVED',
      actorUserId: `srv-${identity.serviceId}`,
      actorName: identity.serviceName,
      actorRole: 'TECHNICIAN',
      targetEntity: 'TELEMETRY_SERVICE',
      targetId: identity.serviceId,
      details: {
        uptimeSeconds: body.uptimeSeconds,
        activeConnections: body.activeConnections,
        trackedDevicesCount: body.trackedDevicesCount,
        recentPacketsReceived: body.recentPacketsReceived,
        timeSkewMs
      },
      ipAddress: '127.0.0.1'
    });

    const response: InternalHeartbeatResponse = {
      status: 'OK',
      coreTimestamp: new Date().toISOString(),
      serviceId: identity.serviceId,
      synchronized: timeSkewMs < 5000,
      timeSkewMs
    };

    return res.json(response);
  } catch (err: any) {
    return res.status(500).json({
      status: 'DEGRADED',
      error: `HEARTBEAT_FAILED: ${err.message}`
    });
  }
});

/**
 * 5. PACKET ACKNOWLEDGEMENT STATUS ENDPOINT
 * POST /api/internal/telemetry/ack-status
 */
telemetryIntegrationRouter.post('/ack-status', authenticateService, async (req, res) => {
  try {
    const body = req.body as InternalPacketAckStatusRequest;
    const identity = (req as any).serviceIdentity;

    if (!body.trackerDeviceId || !body.deliveryStatus) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST: trackerDeviceId and deliveryStatus are required.'
      });
    }

    db.logAuditEvent({
      actionType: 'ACK_STATUS_RECORDED',
      actorUserId: `srv-${identity.serviceId}`,
      actorName: identity.serviceName,
      actorRole: 'TECHNICIAN',
      targetEntity: 'TELEMETRY_SERVICE',
      targetId: body.trackerDeviceId,
      details: {
        trackerDeviceId: body.trackerDeviceId,
        deliveryStatus: body.deliveryStatus,
        packetSequence: body.packetSequence,
        roundTripTimeMs: body.roundTripTimeMs
      },
      ipAddress: '127.0.0.1'
    });

    const response: InternalPacketAckStatusResponse = {
      success: true,
      trackerDeviceId: body.trackerDeviceId,
      acknowledged: body.deliveryStatus === 'DELIVERED',
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: `ACK_STATUS_UPDATE_FAILED: ${err.message}`
    });
  }
});

/**
 * 6. SERVER DIAGNOSTICS ENDPOINT
 * GET & POST /api/internal/telemetry/diagnostics
 */
telemetryIntegrationRouter.all('/diagnostics', authenticateService, async (req, res) => {
  try {
    const identity = (req as any).serviceIdentity;
    const gatewayStatus = telemetryGatewayEngine.getGatewayStatus();

    const response: InternalServerDiagnosticsResponse = {
      success: true,
      serviceIdentity: identity,
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

    return res.json(response);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: `DIAGNOSTICS_FAILED: ${err.message}`
    });
  }
});
