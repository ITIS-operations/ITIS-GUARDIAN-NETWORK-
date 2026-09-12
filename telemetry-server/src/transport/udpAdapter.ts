/**
 * =====================================================================
 * ITIS DEDICATED GPS TELEMETRY SERVER - UDP ADAPTER
 * Controlled datagram reception for low-overhead IoT GPS trackers
 * =====================================================================
 */

import dgram, { Socket } from 'dgram';
import crypto from 'crypto';
import { TelemetryServerConfig } from '../config/serverConfig.js';
import { SecurityIsolationEngine } from '../security/securityIsolation.js';
import { TelemetryGatewayBridge } from '../gateway/telemetryGatewayBridge.js';
import { InboundPacketContext, TelemetryServerMetrics } from './types.js';

export class UdpTransportAdapter {
  private config: TelemetryServerConfig;
  private securityEngine: SecurityIsolationEngine;
  private gatewayBridge: TelemetryGatewayBridge;
  private metrics: TelemetryServerMetrics;

  private socket?: Socket;
  private isListening = false;

  constructor(
    config: TelemetryServerConfig,
    securityEngine: SecurityIsolationEngine,
    gatewayBridge: TelemetryGatewayBridge,
    metrics: TelemetryServerMetrics
  ) {
    this.config = config;
    this.securityEngine = securityEngine;
    this.gatewayBridge = gatewayBridge;
    this.metrics = metrics;
  }

  /**
   * Start listening on configured UDP port
   */
  public async start(): Promise<void> {
    if (this.isListening) return;

    return new Promise((resolve, reject) => {
      this.socket = dgram.createSocket('udp4');

      this.socket.on('error', (err) => {
        console.error('[UdpAdapter] Socket error:', err);
        if (!this.isListening) {
          reject(err);
        }
      });

      this.socket.on('message', async (msg, rinfo) => {
        await this.handleDatagram(msg, rinfo);
      });

      this.socket.bind(this.config.udpPort, this.config.host, () => {
        this.isListening = true;
        resolve();
      });
    });
  }

  /**
   * Stop the UDP socket
   */
  public async stop(): Promise<void> {
    if (!this.socket || !this.isListening) return;

    return new Promise((resolve) => {
      this.isListening = false;
      this.socket?.close(() => {
        resolve();
      });
    });
  }

  /**
   * Process an inbound UDP datagram
   */
  private async handleDatagram(msg: Buffer, rinfo: dgram.RemoteInfo): Promise<void> {
    this.metrics.totalPacketsReceived++;
    const connectionId = `udp-${crypto.randomUUID()}`;

    // 1. Packet Size Guard
    const sizeCheck = this.securityEngine.checkPacketSize(msg);
    if (!sizeCheck.allowed) {
      this.metrics.oversizedPacketsCount++;
      this.metrics.rejectedPackets++;
      this.securityEngine.quarantineMalformedPacket(
        {
          transport: 'UDP',
          connectionId,
          remoteAddress: rinfo.address,
          remotePort: rinfo.port,
          receivedAt: new Date(),
          rawBuffer: msg,
          rawString: ''
        },
        sizeCheck.reason || 'OVERSIZED_UDP_DATAGRAM'
      );
      return;
    }

    // 2. Rate Limiting Check
    const rateCheck = this.securityEngine.checkRateLimit(rinfo.address);
    if (!rateCheck.allowed) {
      this.metrics.rateLimitExceededCount++;
      this.metrics.rejectedPackets++;
      this.securityEngine.quarantineMalformedPacket(
        {
          transport: 'UDP',
          connectionId,
          remoteAddress: rinfo.address,
          remotePort: rinfo.port,
          receivedAt: new Date(),
          rawBuffer: msg,
          rawString: ''
        },
        `UDP_RATE_LIMIT_EXCEEDED: ${rateCheck.currentRps} packets/sec`
      );
      return;
    }

    // 3. Construct context
    // Determine if binary (e.g. GT012) or string (ASCII / JSON)
    const isBinary = msg.length >= 2 && msg[0] === 0x78 && msg[1] === 0x78;
    const rawString = isBinary ? msg.toString('hex') : msg.toString('utf8').trim();

    const context: InboundPacketContext = {
      transport: 'UDP',
      connectionId,
      remoteAddress: rinfo.address,
      remotePort: rinfo.port,
      receivedAt: new Date(),
      rawBuffer: msg,
      rawString
    };

    // 4. Ingest through authoritative gateway bridge
    try {
      const bridgeResult = await this.gatewayBridge.processPacket(context);

      if (bridgeResult.accepted) {
        this.metrics.acceptedPackets++;
        this.securityEngine.recordSuccessfulPacket(rinfo.address);
      } else {
        this.metrics.rejectedPackets++;

        if (bridgeResult.diagnosticCode === 'MALFORMED_PACKET') {
          this.metrics.malformedPacketsCount = (this.metrics.malformedPacketsCount || 0) + 1;
          this.securityEngine.recordMalformedPacket(rinfo.address);
        } else if (bridgeResult.diagnosticCode === 'CRC_INVALID') {
          this.metrics.crcFailuresCount = (this.metrics.crcFailuresCount || 0) + 1;
          this.securityEngine.recordMalformedPacket(rinfo.address);
        } else if (bridgeResult.diagnosticCode === 'DUPLICATE_PACKET') {
          this.metrics.duplicateSuppressedCount = (this.metrics.duplicateSuppressedCount || 0) + 1;
          this.securityEngine.recordDuplicate(rinfo.address);
        } else if (bridgeResult.diagnosticCode === 'DEVICE_NOT_REGISTERED' || bridgeResult.diagnosticCode === 'INVALID_DEVICE_PROTOCOL_COMBINATION') {
          this.metrics.unauthorizedDevicesCount = (this.metrics.unauthorizedDevicesCount || 0) + 1;
        }

        this.securityEngine.quarantineMalformedPacket(
          context,
          bridgeResult.error || `UDP_REJECTED: ${bridgeResult.status}`
        );
      }

      // 5. Downlink ACK via UDP Datagram if required
      if (bridgeResult.ackRequired && bridgeResult.ackPayload && this.socket) {
        const ackBuffer = isBinary
          ? Buffer.from(bridgeResult.ackPayload, 'hex')
          : Buffer.from(bridgeResult.ackPayload, 'utf8');

        this.socket.send(ackBuffer, rinfo.port, rinfo.address, (err) => {
          if (err) {
            console.error('[UdpAdapter] Failed to send UDP ACK:', err);
          }
        });
      }
    } catch (err: any) {
      this.metrics.rejectedPackets++;
      this.securityEngine.quarantineMalformedPacket(
        context,
        `UDP_INSPECTION_CRASH_PREVENTED: ${err.message || 'Unknown error'}`
      );
    }
  }

  public getListening(): boolean {
    return this.isListening;
  }
}
