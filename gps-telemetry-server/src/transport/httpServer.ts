import express, { Express, Request, Response } from 'express';
import http from 'http';
import { createHealthRouter } from '../health/healthRoutes.js';
import { ProtocolRegistry } from '../protocol/protocolRegistry.js';
import { TelemetryProcessor } from '../telemetry/telemetryProcessor.js';
import { DeviceAuthenticationService } from '../devices/deviceAuthentication.js';
import { DeviceRegistry } from '../devices/deviceRegistry.js';
import { ITelemetryRepository } from '../storage/telemetryRepository.js';
import { IngestionRateLimiter } from '../security/rateLimiter.js';
import { RawNetworkPacket } from '../types/packet.js';
import { PacketDecoder } from '../protocol/packetDecoder.js';

export class HttpTelemetryServer {
  private app: Express;
  private server: http.Server | null = null;
  private isRunning: boolean = false;

  constructor(
    private host: string,
    private port: number,
    private storageMode: 'memory' | 'postgresql',
    private protocolRegistry: ProtocolRegistry,
    private telemetryProcessor: TelemetryProcessor,
    private authService: DeviceAuthenticationService,
    private deviceRegistry: DeviceRegistry,
    private telemetryRepo: ITelemetryRepository,
    private rateLimiter: IngestionRateLimiter
  ) {
    this.app = express();
    this.configureMiddleware();
    this.configureRoutes();
  }

  private configureMiddleware(): void {
    this.app.use(express.json({ limit: '64kb' }));
    this.app.use(express.raw({ type: 'application/octet-stream', limit: '8kb' }));

    // IP rate limiter
    this.app.use((req: Request, res: Response, next) => {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (!this.rateLimiter.isAllowed(clientIp)) {
        res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED' });
        return;
      }
      next();
    });
  }

  private configureRoutes(): void {
    // 1. Health Probe
    this.app.use(
      createHealthRouter({
        storageMode: this.storageMode,
        version: '1.0.0',
        getActiveSessions: () => this.deviceRegistry.getSessionManager().getActiveSessionCount()
      })
    );

    // 2. HTTP Webhook / Raw Telemetry Ingest
    this.app.post('/api/v1/telemetry/ingest', async (req: Request, res: Response) => {
      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
      const clientPort = req.socket.remotePort || 0;

      let packetData: Buffer;
      if (Buffer.isBuffer(req.body)) {
        packetData = req.body;
      } else if (typeof req.body === 'object') {
        packetData = Buffer.from(JSON.stringify(req.body));
      } else {
        res.status(400).json({ success: false, error: 'INVALID_PAYLOAD' });
        return;
      }

      const rawPacket: RawNetworkPacket = {
        id: `http_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        transport: 'HTTP',
        remoteAddress: clientIp,
        remotePort: clientPort,
        data: packetData,
        receivedAt: new Date()
      };

      const protocol = this.protocolRegistry.identifyProtocol(rawPacket);
      if (!protocol) {
        res.status(400).json({ success: false, error: 'UNRECOGNIZED_PROTOCOL' });
        return;
      }

      const decoded = await PacketDecoder.decodePacket(protocol, rawPacket);
      if (!decoded.success || !decoded.deviceId) {
        res.status(422).json({ success: false, error: decoded.error || 'DECODE_FAILED' });
        return;
      }

      const auth = await this.authService.authenticateDevice(decoded.deviceId);
      if (!auth.allowed) {
        res.status(403).json({ success: false, error: auth.reason });
        return;
      }

      const event = protocol.normalize(decoded);
      if (!event) {
        res.status(422).json({ success: false, error: 'NORMALIZATION_FAILED' });
        return;
      }

      const processResult = await this.telemetryProcessor.processEvent(event);
      res.status(200).json(processResult);
    });

    // 3. Query Device Registry
    this.app.get('/api/v1/devices', async (_req: Request, res: Response) => {
      const devices = await this.deviceRegistry.getRegisteredDevices();
      res.json({ count: devices.length, devices });
    });

    // 4. Query Device Telemetry Track
    this.app.get('/api/v1/devices/:id/telemetry', async (req: Request, res: Response) => {
      const deviceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 500);
      const history = await this.telemetryRepo.getDeviceHistory(deviceId, limit);
      res.json({ deviceId, count: history.length, history });
    });

    // 5. Query Recent Alerts
    this.app.get('/api/v1/alerts', async (req: Request, res: Response) => {
      const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 100);
      const alerts = await this.telemetryRepo.getRecentAlerts(limit);
      res.json({ count: alerts.length, alerts });
    });
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, this.host, () => {
        this.isRunning = true;
        console.log(`[HttpServer] Ingestion & Health REST API listening on http://${this.host}:${this.port}`);
        resolve();
      });

      this.server.on('error', (err) => {
        console.error(`[HttpServer] Error on port ${this.port}:`, err.message);
        if (!this.isRunning) reject(err);
      });
    });
  }

  public async stop(): Promise<void> {
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
