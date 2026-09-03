import net from 'net';
import { RawNetworkPacket } from '../types/packet.js';
import { ProtocolRegistry } from '../protocol/protocolRegistry.js';
import { PacketDecoder } from '../protocol/packetDecoder.js';
import { PacketEncoder } from '../protocol/packetEncoder.js';
import { TelemetryProcessor } from '../telemetry/telemetryProcessor.js';
import { DeviceSessionManager } from '../devices/deviceSession.js';
import { DeviceAuthenticationService } from '../devices/deviceAuthentication.js';
import { ConnectionGuard } from '../security/connectionGuard.js';
import { IngestionRateLimiter } from '../security/rateLimiter.js';
import { TelemetryValidator } from '../security/validation.js';

export class TcpTelemetryServer {
  private server: net.Server | null = null;
  private isRunning: boolean = false;
  private idleCheckTimer: NodeJS.Timeout | null = null;

  constructor(
    private host: string,
    private port: number,
    private protocolRegistry: ProtocolRegistry,
    private telemetryProcessor: TelemetryProcessor,
    private sessionManager: DeviceSessionManager,
    private authService: DeviceAuthenticationService,
    private connectionGuard: ConnectionGuard,
    private rateLimiter: IngestionRateLimiter,
    private idleTimeoutSeconds: number = 300
  ) {}

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => this.handleConnection(socket));

      this.server.on('error', (err) => {
        console.error(`[TcpServer] Error on port ${this.port}:`, err.message);
        if (!this.isRunning) reject(err);
      });

      this.server.listen(this.port, this.host, () => {
        this.isRunning = true;
        console.log(`[TcpServer] Listening for GPS Tracker TCP packets on ${this.host}:${this.port}`);
        
        // Start periodic sweep for idle connections
        this.idleCheckTimer = setInterval(() => this.sweepIdleConnections(), 30000);
        resolve();
      });
    });
  }

  private handleConnection(socket: net.Socket): void {
    const remoteIp = socket.remoteAddress || 'unknown';
    const remotePort = socket.remotePort || 0;
    const connectionId = `tcp_${remoteIp}_${remotePort}_${Date.now()}`;

    const guard = this.connectionGuard.registerConnection(connectionId, remoteIp, remotePort);
    if (!guard.allowed) {
      console.warn(`[TcpServer] Rejected connection from ${remoteIp}: ${guard.reason}`);
      socket.destroy();
      return;
    }

    let currentSessionId: string | null = null;
    let packetBuffer = Buffer.alloc(0);

    socket.on('data', async (chunk) => {
      this.connectionGuard.recordActivity(connectionId);

      // Rate limit check
      if (!this.rateLimiter.isAllowed(remoteIp)) {
        console.warn(`[TcpServer] Rate limit exceeded for IP: ${remoteIp}`);
        return;
      }

      // Safeguard against gigantic memory buffer overflow attacks
      if (packetBuffer.length + chunk.length > 8192) {
        console.warn(`[TcpServer] Buffer overflow protection triggered from ${remoteIp}. Resetting buffer.`);
        packetBuffer = Buffer.alloc(0);
        return;
      }

      packetBuffer = Buffer.concat([packetBuffer, chunk]);

      const rawPacket: RawNetworkPacket = {
        id: `pkt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        transport: 'TCP',
        remoteAddress: remoteIp,
        remotePort: remotePort,
        data: packetBuffer,
        receivedAt: new Date()
      };

      // 1. Identify Protocol
      const protocol = this.protocolRegistry.identifyProtocol(rawPacket);
      if (!protocol) {
        // Unknown protocol or partial frame, keep buffering if reasonable
        return;
      }

      // Reset packet buffer once matched
      packetBuffer = Buffer.alloc(0);

      // 2. Decode Packet
      const decoded = await PacketDecoder.decodePacket(protocol, rawPacket);
      if (!decoded.success || !decoded.deviceId) {
        return;
      }

      // 3. Authenticate / Validate Device
      const auth = await this.authService.authenticateDevice(decoded.deviceId);
      if (!auth.allowed) {
        console.warn(`[TcpServer] Unauthorized device packet: ${decoded.deviceId} (${auth.reason})`);
        return;
      }

      // 4. Update / Create Session
      if (!currentSessionId) {
        const session = this.sessionManager.createSession({
          deviceId: decoded.deviceId,
          imei: auth.device?.imei || decoded.deviceId,
          protocol: protocol.protocolName,
          remoteAddress: remoteIp,
          remotePort: remotePort,
          socketRef: socket
        });
        currentSessionId = session.sessionId;
        this.sessionManager.setAuthenticated(currentSessionId, true);
      }
      this.sessionManager.recordPacket(currentSessionId);

      // 5. Normalize and Process Telemetry
      const event = protocol.normalize(decoded);
      if (event) {
        await this.telemetryProcessor.processEvent(event);
      }

      // 6. Send Acknowledgment if required by hardware protocol
      if (decoded.requiresAck) {
        const ackData = decoded.ackData || PacketEncoder.encodeAck(protocol, decoded);
        if (ackData && socket.writable) {
          socket.write(ackData);
        }
      }
    });

    socket.on('error', (err) => {
      console.warn(`[TcpServer] Socket error from ${remoteIp}:`, TelemetryValidator.sanitizeLog(err.message));
    });

    socket.on('close', () => {
      this.connectionGuard.unregisterConnection(connectionId);
      if (currentSessionId) {
        this.sessionManager.removeSession(currentSessionId);
      }
    });
  }

  private sweepIdleConnections(): void {
    const idleIds = this.connectionGuard.getIdleConnections(this.idleTimeoutSeconds);
    if (idleIds.length > 0) {
      console.log(`[TcpServer] Sweeping ${idleIds.length} idle tracker connections`);
    }
  }

  public async stop(): Promise<void> {
    if (this.idleCheckTimer) clearInterval(this.idleCheckTimer);
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.isRunning = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
