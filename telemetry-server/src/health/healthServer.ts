/**
 * =====================================================================
 * ITIS DEDICATED GPS TELEMETRY SERVER - HEALTH & DIAGNOSTICS SERVER
 * Safe internal status endpoint exposing zero credentials or device secrets
 * =====================================================================
 */

import http, { Server, IncomingMessage, ServerResponse } from 'http';
import { TelemetryServerConfig } from '../config/serverConfig.js';
import { ConnectionLifecycleManager } from '../connection/connectionManager.js';
import { SecurityIsolationEngine } from '../security/securityIsolation.js';
import { TelemetryServerMetrics, RuntimeLifecycleState } from '../transport/types.js';

export class HealthDiagnosticsServer {
  private config: TelemetryServerConfig;
  private connectionManager: ConnectionLifecycleManager;
  private securityEngine: SecurityIsolationEngine;
  private metrics: TelemetryServerMetrics;
  private getRuntimeState: () => RuntimeLifecycleState;

  private server?: Server;
  private isListening = false;

  constructor(
    config: TelemetryServerConfig,
    connectionManager: ConnectionLifecycleManager,
    securityEngine: SecurityIsolationEngine,
    metrics: TelemetryServerMetrics,
    getRuntimeState: () => RuntimeLifecycleState
  ) {
    this.config = config;
    this.connectionManager = connectionManager;
    this.securityEngine = securityEngine;
    this.metrics = metrics;
    this.getRuntimeState = getRuntimeState;
  }

  /**
   * Start the health diagnostics HTTP server
   */
  public async start(): Promise<void> {
    if (this.isListening) return;

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (err) => {
        console.error('[HealthServer] HTTP Server error:', err);
        if (!this.isListening) {
          reject(err);
        }
      });

      this.server.listen(this.config.healthPort, this.config.host, () => {
        this.isListening = true;
        resolve();
      });
    });
  }

  /**
   * Stop the health HTTP server
   */
  public async stop(): Promise<void> {
    if (!this.server || !this.isListening) return;

    return new Promise((resolve) => {
      this.isListening = false;
      this.server?.close(() => {
        resolve();
      });
    });
  }

  /**
   * Safe status payload builder (Guaranteed zero credentials / zero PII)
   */
  public getHealthSnapshot() {
    const uptimeSeconds = Math.floor((Date.now() - this.metrics.startTime.getTime()) / 1000);
    const quarantineStats = this.securityEngine.getQuarantineStats();
    const currentState = this.getRuntimeState();

    return {
      status: currentState === 'RUNNING' ? 'HEALTHY' : currentState,
      runtimeState: currentState,
      uptimeSeconds,
      timestamp: new Date().toISOString(),
      ports: {
        tcp: this.config.tcpPort,
        udp: this.config.udpPort,
        health: this.config.healthPort
      },
      connections: {
        active: this.connectionManager.getActiveCount(),
        peak: this.connectionManager.getPeakCount(),
        maxAllowed: this.config.maxConnections
      },
      packets: {
        total: this.metrics.totalPacketsReceived,
        accepted: this.metrics.acceptedPackets,
        rejected: this.metrics.rejectedPackets,
        quarantined: quarantineStats.totalQuarantined,
        rateLimitExceeded: this.metrics.rateLimitExceededCount,
        oversized: this.metrics.oversizedPacketsCount
      },
      security: {
        limitsEnforced: true,
        maxPacketSizeBytes: this.config.maxPacketSizeBytes,
        rateLimitPacketsPerSec: this.config.rateLimitPacketsPerSec,
        idleTimeoutMs: this.config.idleTimeoutMs,
        zeroSecretsExposed: true
      }
    };
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = req.url?.split('?')[0] || '/';

    if (url === '/' || url === '/health' || url === '/diagnostics' || url === '/status') {
      const payload = this.getHealthSnapshot();
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(payload, null, 2));
      return;
    }

    // 404 for any unexpected route
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'NOT_FOUND', path: url }));
  }

  public getListening(): boolean {
    return this.isListening;
  }
}
