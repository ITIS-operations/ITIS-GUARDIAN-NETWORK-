import dgram from 'dgram';
import { RawNetworkPacket } from '../types/packet.js';
import { ProtocolRegistry } from '../protocol/protocolRegistry.js';
import { PacketDecoder } from '../protocol/packetDecoder.js';
import { PacketEncoder } from '../protocol/packetEncoder.js';
import { TelemetryProcessor } from '../telemetry/telemetryProcessor.js';
import { DeviceAuthenticationService } from '../devices/deviceAuthentication.js';
import { IngestionRateLimiter } from '../security/rateLimiter.js';
import { TelemetryValidator } from '../security/validation.js';

export class UdpTelemetryServer {
  private socket: dgram.Socket | null = null;
  private isRunning: boolean = false;

  constructor(
    private host: string,
    private port: number,
    private protocolRegistry: ProtocolRegistry,
    private telemetryProcessor: TelemetryProcessor,
    private authService: DeviceAuthenticationService,
    private rateLimiter: IngestionRateLimiter
  ) {}

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = dgram.createSocket('udp4');

      this.socket.on('error', (err) => {
        console.error(`[UdpServer] Error on port ${this.port}:`, err.message);
        if (!this.isRunning) reject(err);
      });

      this.socket.on('message', async (msg, rinfo) => {
        const remoteIp = rinfo.address;
        const remotePort = rinfo.port;

        // Rate limit check
        if (!this.rateLimiter.isAllowed(remoteIp)) {
          return;
        }

        if (!TelemetryValidator.isValidPacketSize(msg)) {
          return;
        }

        const rawPacket: RawNetworkPacket = {
          id: `udp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          transport: 'UDP',
          remoteAddress: remoteIp,
          remotePort: remotePort,
          data: msg,
          receivedAt: new Date()
        };

        // 1. Identify Protocol
        const protocol = this.protocolRegistry.identifyProtocol(rawPacket);
        if (!protocol) {
          return;
        }

        // 2. Decode Packet
        const decoded = await PacketDecoder.decodePacket(protocol, rawPacket);
        if (!decoded.success || !decoded.deviceId) {
          return;
        }

        // 3. Authenticate Device
        const auth = await this.authService.authenticateDevice(decoded.deviceId);
        if (!auth.allowed) {
          return;
        }

        // 4. Normalize and Process Telemetry
        const event = protocol.normalize(decoded);
        if (event) {
          await this.telemetryProcessor.processEvent(event);
        }

        // 5. Send Acknowledgment if required
        if (decoded.requiresAck && this.socket) {
          const ackData = decoded.ackData || PacketEncoder.encodeAck(protocol, decoded);
          if (ackData) {
            this.socket.send(ackData, remotePort, remoteIp);
          }
        }
      });

      this.socket.bind(this.port, this.host, () => {
        this.isRunning = true;
        console.log(`[UdpServer] Listening for GPS Tracker UDP datagrams on ${this.host}:${this.port}`);
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.socket) {
        this.socket.close(() => {
          this.isRunning = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
