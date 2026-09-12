/**
 * =====================================================================
 * ITIS DEDICATED GPS TELEMETRY SERVER - RUNTIME ENTRY POINT
 * Standalone deployment daemon for GPS tracker ingestion
 * =====================================================================
 */

import { loadServerConfig, TelemetryServerConfig } from './config/serverConfig.js';
import { TelemetryServerMetrics, RuntimeLifecycleState } from './transport/types.js';
import { SecurityIsolationEngine } from './security/securityIsolation.js';
import { ConnectionLifecycleManager } from './connection/connectionManager.js';
import { TelemetryGatewayBridge } from './gateway/telemetryGatewayBridge.js';
import { TcpTransportAdapter } from './transport/tcpAdapter.js';
import { UdpTransportAdapter } from './transport/udpAdapter.js';
import { HealthDiagnosticsServer } from './health/healthServer.js';
import { GracefulShutdownManager } from './lifecycle/shutdownManager.js';

export class DedicatedTelemetryServer {
  public readonly config: TelemetryServerConfig;
  public readonly metrics: TelemetryServerMetrics;
  public readonly securityEngine: SecurityIsolationEngine;
  public readonly connectionManager: ConnectionLifecycleManager;
  public readonly gatewayBridge: TelemetryGatewayBridge;
  public readonly tcpAdapter: TcpTransportAdapter;
  public readonly udpAdapter: UdpTransportAdapter;
  public readonly healthServer: HealthDiagnosticsServer;
  public readonly shutdownManager: GracefulShutdownManager;

  private runtimeState: RuntimeLifecycleState = 'INITIALIZING';

  constructor(overrides?: Partial<TelemetryServerConfig>) {
    this.config = loadServerConfig(overrides);

    this.metrics = {
      totalPacketsReceived: 0,
      acceptedPackets: 0,
      rejectedPackets: 0,
      quarantinedPackets: 0,
      rateLimitExceededCount: 0,
      oversizedPacketsCount: 0,
      malformedPacketsCount: 0,
      crcFailuresCount: 0,
      duplicateSuppressedCount: 0,
      unauthorizedDevicesCount: 0,
      connectionErrorsCount: 0,
      activeConnectionsCount: 0,
      peakConnectionsCount: 0,
      startTime: new Date()
    };

    this.securityEngine = new SecurityIsolationEngine(this.config);
    this.connectionManager = new ConnectionLifecycleManager(this.config);
    this.gatewayBridge = new TelemetryGatewayBridge(this.config);

    this.tcpAdapter = new TcpTransportAdapter(
      this.config,
      this.connectionManager,
      this.securityEngine,
      this.gatewayBridge,
      this.metrics
    );

    this.udpAdapter = new UdpTransportAdapter(
      this.config,
      this.securityEngine,
      this.gatewayBridge,
      this.metrics
    );

    this.healthServer = new HealthDiagnosticsServer(
      this.config,
      this.connectionManager,
      this.securityEngine,
      this.metrics,
      () => this.runtimeState
    );

    this.shutdownManager = new GracefulShutdownManager(
      this.config,
      this.connectionManager,
      this.tcpAdapter,
      this.udpAdapter,
      this.healthServer,
      (state) => {
        this.runtimeState = state;
      }
    );
  }

  /**
   * Boot the telemetry server runtime
   */
  public async start(): Promise<void> {
    console.log('\n=============================================================');
    console.log('  ITIS GUARDIAN NETWORK — DEDICATED GPS TELEMETRY SERVER     ');
    console.log('=============================================================');
    console.log(`[Runtime] Mode: ${this.config.integrationMode}`);
    console.log(`[Runtime] Host: ${this.config.host}`);
    console.log(`[Security] Max Connections: ${this.config.maxConnections}`);
    console.log(`[Security] Max Packet Size: ${this.config.maxPacketSizeBytes} bytes`);
    console.log(`[Security] Rate Limit: ${this.config.rateLimitPacketsPerSec} packets/sec`);

    // 1. Start TCP Transport Adapter
    await this.tcpAdapter.start();
    console.log(`[Transport:TCP] Listening on ${this.config.host}:${this.config.tcpPort}`);

    // 2. Start UDP Transport Adapter
    await this.udpAdapter.start();
    console.log(`[Transport:UDP] Listening on ${this.config.host}:${this.config.udpPort}`);

    // 3. Start Health Diagnostics Server
    await this.healthServer.start();
    console.log(`[Health] Diagnostics endpoint active on http://${this.config.host}:${this.config.healthPort}/health`);

    this.runtimeState = 'RUNNING';
    console.log('>>> ITIS DEDICATED TELEMETRY SERVER READY <<<\n');
  }

  /**
   * Stop the server cleanly
   */
  public async stop(): Promise<void> {
    await this.shutdownManager.executeShutdown();
  }

  public getRuntimeState(): RuntimeLifecycleState {
    return this.runtimeState;
  }
}

// Auto-run if executed directly as node main entry point
if (process.argv[1]?.endsWith('telemetry-server/src/index.ts') || process.argv[1]?.endsWith('telemetry-server/dist/index.js')) {
  const server = new DedicatedTelemetryServer();
  server.shutdownManager.registerSignalHandlers();
  server.start().catch((err) => {
    console.error('[Runtime Fatal] Failed to boot telemetry server:', err);
    process.exit(1);
  });
}
