/**
 * =====================================================================
 * ITIS DEDICATED GPS TELEMETRY SERVER - TCP ADAPTER
 * Dedicated streaming runtime for persistent GPS tracker sockets
 * =====================================================================
 */

import net, { Server, Socket } from 'net';
import crypto from 'crypto';
import { TelemetryServerConfig } from '../config/serverConfig.js';
import { ConnectionLifecycleManager } from '../connection/connectionManager.js';
import { SecurityIsolationEngine } from '../security/securityIsolation.js';
import { TelemetryGatewayBridge } from '../gateway/telemetryGatewayBridge.js';
import { StreamingProtocolFramer } from '../protocols/protocolAdapter.js';
import { InboundPacketContext, TelemetryServerMetrics } from './types.js';

export class TcpTransportAdapter {
  private config: TelemetryServerConfig;
  private connectionManager: ConnectionLifecycleManager;
  private securityEngine: SecurityIsolationEngine;
  private gatewayBridge: TelemetryGatewayBridge;
  private metrics: TelemetryServerMetrics;

  private server?: Server;
  private isListening = false;

  // Stream accumulation buffers per socket: connectionId -> Buffer
  private socketBuffers: Map<string, Buffer> = new Map();

  constructor(
    config: TelemetryServerConfig,
    connectionManager: ConnectionLifecycleManager,
    securityEngine: SecurityIsolationEngine,
    gatewayBridge: TelemetryGatewayBridge,
    metrics: TelemetryServerMetrics
  ) {
    this.config = config;
    this.connectionManager = connectionManager;
    this.securityEngine = securityEngine;
    this.gatewayBridge = gatewayBridge;
    this.metrics = metrics;
  }

  /**
   * Start the TCP server listener
   */
  public async start(): Promise<void> {
    if (this.isListening) return;

    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => this.handleNewConnection(socket));

      this.server.on('error', (err) => {
        console.error('[TcpAdapter] Server error:', err);
        if (!this.isListening) {
          reject(err);
        }
      });

      this.server.listen(this.config.tcpPort, this.config.host, () => {
        this.isListening = true;
        resolve();
      });
    });
  }

  /**
   * Stop the TCP server listener
   */
  public async stop(): Promise<void> {
    if (!this.server || !this.isListening) return;

    return new Promise((resolve) => {
      this.isListening = false;
      this.server?.close(() => {
        this.socketBuffers.clear();
        resolve();
      });
    });
  }

  /**
   * Handle an incoming TCP socket
   */
  private handleNewConnection(socket: Socket): void {
    const connectionId = `tcp-${crypto.randomUUID()}`;
    const remoteAddress = socket.remoteAddress || 'unknown';
    const remotePort = socket.remotePort || 0;

    // 1. Enforce Connection Limits
    const limitCheck = this.connectionManager.canAcceptConnection();
    if (!limitCheck.allowed) {
      this.securityEngine.quarantineMalformedPacket(
        {
          transport: 'TCP',
          connectionId,
          remoteAddress,
          remotePort,
          receivedAt: new Date(),
          rawBuffer: Buffer.alloc(0),
          rawString: ''
        },
        limitCheck.reason || 'CONNECTION_LIMIT_EXCEEDED'
      );
      socket.destroy();
      return;
    }

    // 2. Register active connection
    this.connectionManager.registerConnection(
      connectionId,
      'TCP',
      remoteAddress,
      remotePort,
      socket
    );
    this.metrics.activeConnectionsCount = this.connectionManager.getActiveCount();
    if (this.metrics.activeConnectionsCount > this.metrics.peakConnectionsCount) {
      this.metrics.peakConnectionsCount = this.metrics.activeConnectionsCount;
    }

    // Configure socket timeout
    socket.setTimeout(this.config.connectionTimeoutMs);

    // 3. Socket event handlers
    socket.on('data', async (chunk: Buffer) => {
      await this.handleSocketData(connectionId, socket, chunk);
    });

    socket.on('timeout', () => {
      socket.end();
      socket.destroy();
      this.cleanupSocket(connectionId);
    });

    socket.on('error', (err) => {
      this.metrics.connectionErrorsCount = (this.metrics.connectionErrorsCount || 0) + 1;
      this.cleanupSocket(connectionId);
    });

    socket.on('close', () => {
      this.cleanupSocket(connectionId);
    });
  }

  /**
   * Process raw byte chunks arriving from an active socket
   */
  private async handleSocketData(connectionId: string, socket: Socket, chunk: Buffer): Promise<void> {
    this.connectionManager.touchConnection(connectionId);
    const remoteAddress = socket.remoteAddress || 'unknown';
    const remotePort = socket.remotePort || 0;

    // 1. Rate Limiting Check
    const rateCheck = this.securityEngine.checkRateLimit(remoteAddress);
    if (!rateCheck.allowed) {
      this.metrics.rateLimitExceededCount++;
      this.securityEngine.quarantineMalformedPacket(
        {
          transport: 'TCP',
          connectionId,
          remoteAddress,
          remotePort,
          receivedAt: new Date(),
          rawBuffer: chunk,
          rawString: ''
        },
        `RATE_LIMIT_EXCEEDED: ${rateCheck.currentRps} packets/sec`
      );
      return;
    }

    // 2. Accumulate incoming chunks into connection buffer
    const existing = this.socketBuffers.get(connectionId) || Buffer.alloc(0);
    const combined = Buffer.concat([existing, chunk]);

    // 3. Buffer & Packet Size Guard
    const bufferCheck = this.securityEngine.checkBufferedData(combined);
    if (!bufferCheck.allowed || combined.length > this.config.maxPacketSizeBytes) {
      this.metrics.oversizedPacketsCount++;
      this.metrics.rejectedPackets++;
      const reason = !bufferCheck.allowed
        ? bufferCheck.reason!
        : `OVERSIZED_TCP_BUFFER: ${combined.length} bytes exceeds ${this.config.maxPacketSizeBytes} bytes`;

      this.securityEngine.quarantineMalformedPacket(
        {
          transport: 'TCP',
          connectionId,
          remoteAddress,
          remotePort,
          receivedAt: new Date(),
          rawBuffer: combined,
          rawString: ''
        },
        reason
      );
      this.socketBuffers.delete(connectionId);
      socket.destroy();
      this.cleanupSocket(connectionId);
      return;
    }

    // 4. Extract discrete framed packets from byte stream
    const { frames, remainder } = StreamingProtocolFramer.extractFrames(combined);
    this.socketBuffers.set(connectionId, remainder);

    // 5. Ingest each discrete framed packet through authoritative bridge
    for (const frame of frames) {
      this.metrics.totalPacketsReceived++;

      const context: InboundPacketContext = {
        transport: 'TCP',
        connectionId,
        remoteAddress,
        remotePort,
        receivedAt: new Date(),
        rawBuffer: frame.rawBuffer,
        rawString: frame.rawString
      };

      try {
        const bridgeResult = await this.gatewayBridge.processPacket(context);

        if (bridgeResult.accepted) {
          this.metrics.acceptedPackets++;
          this.securityEngine.recordSuccessfulPacket(remoteAddress);
          if (bridgeResult.deviceId) {
            this.connectionManager.identifyDevice(connectionId, bridgeResult.deviceId);
          }
        } else {
          this.metrics.rejectedPackets++;

          if (bridgeResult.diagnosticCode === 'MALFORMED_PACKET') {
            this.metrics.malformedPacketsCount = (this.metrics.malformedPacketsCount || 0) + 1;
            this.securityEngine.recordMalformedPacket(remoteAddress);
          } else if (bridgeResult.diagnosticCode === 'CRC_INVALID') {
            this.metrics.crcFailuresCount = (this.metrics.crcFailuresCount || 0) + 1;
            this.securityEngine.recordMalformedPacket(remoteAddress);
          } else if (bridgeResult.diagnosticCode === 'DUPLICATE_PACKET') {
            this.metrics.duplicateSuppressedCount = (this.metrics.duplicateSuppressedCount || 0) + 1;
            this.securityEngine.recordDuplicate(remoteAddress);
          } else if (bridgeResult.diagnosticCode === 'DEVICE_NOT_REGISTERED' || bridgeResult.diagnosticCode === 'INVALID_DEVICE_PROTOCOL_COMBINATION') {
            this.metrics.unauthorizedDevicesCount = (this.metrics.unauthorizedDevicesCount || 0) + 1;
          }

          this.securityEngine.quarantineMalformedPacket(
            context,
            bridgeResult.error || `REJECTED: ${bridgeResult.status}`
          );
        }

        // 6. Immediate Downlink ACK Transmission
        if (bridgeResult.ackRequired && bridgeResult.ackPayload) {
          const ackBuffer = frame.protocolHint === 'GT012'
            ? Buffer.from(bridgeResult.ackPayload, 'hex')
            : Buffer.from(bridgeResult.ackPayload, 'utf8');

          socket.write(ackBuffer);
        }
      } catch (err: any) {
        this.metrics.rejectedPackets++;
        this.securityEngine.quarantineMalformedPacket(
          context,
          `INSPECTION_CRASH_PREVENTED: ${err.message || 'Unknown error'}`
        );
      }
    }
  }

  private cleanupSocket(connectionId: string): void {
    this.socketBuffers.delete(connectionId);
    this.connectionManager.unregisterConnection(connectionId);
    this.metrics.activeConnectionsCount = this.connectionManager.getActiveCount();
  }

  public getListening(): boolean {
    return this.isListening;
  }
}
