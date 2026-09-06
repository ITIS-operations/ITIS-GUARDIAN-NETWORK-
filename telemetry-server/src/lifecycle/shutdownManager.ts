/**
 * =====================================================================
 * ITIS DEDICATED GPS TELEMETRY SERVER - GRACEFUL SHUTDOWN MANAGER
 * Coordinates drain sequences, listener closure, and process termination
 * =====================================================================
 */

import { TelemetryServerConfig } from '../config/serverConfig.js';
import { ConnectionLifecycleManager } from '../connection/connectionManager.js';
import { TcpTransportAdapter } from '../transport/tcpAdapter.js';
import { UdpTransportAdapter } from '../transport/udpAdapter.js';
import { HealthDiagnosticsServer } from '../health/healthServer.js';
import { RuntimeLifecycleState } from '../transport/types.js';

export class GracefulShutdownManager {
  private config: TelemetryServerConfig;
  private connectionManager: ConnectionLifecycleManager;
  private tcpAdapter: TcpTransportAdapter;
  private udpAdapter: UdpTransportAdapter;
  private healthServer: HealthDiagnosticsServer;
  private setRuntimeState: (state: RuntimeLifecycleState) => void;
  private isShuttingDown = false;

  constructor(
    config: TelemetryServerConfig,
    connectionManager: ConnectionLifecycleManager,
    tcpAdapter: TcpTransportAdapter,
    udpAdapter: UdpTransportAdapter,
    healthServer: HealthDiagnosticsServer,
    setRuntimeState: (state: RuntimeLifecycleState) => void
  ) {
    this.config = config;
    this.connectionManager = connectionManager;
    this.tcpAdapter = tcpAdapter;
    this.udpAdapter = udpAdapter;
    this.healthServer = healthServer;
    this.setRuntimeState = setRuntimeState;
  }

  /**
   * Register system signal listeners (SIGTERM, SIGINT)
   */
  public registerSignalHandlers(): void {
    const handleSignal = (signal: string) => {
      console.log(`\n[ShutdownManager] Received ${signal}. Initiating graceful shutdown sequence...`);
      this.executeShutdown()
        .then(() => {
          console.log('[ShutdownManager] Graceful shutdown completed cleanly.');
          process.exit(0);
        })
        .catch((err) => {
          console.error('[ShutdownManager] Error during shutdown:', err);
          process.exit(1);
        });
    };

    process.on('SIGTERM', () => handleSignal('SIGTERM'));
    process.on('SIGINT', () => handleSignal('SIGINT'));
  }

  /**
   * Execute controlled shutdown sequence across all subsystems
   */
  public async executeShutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.setRuntimeState('STOPPING');
    console.log('[ShutdownManager] Step 1: Stopping inbound transport listeners (TCP/UDP)...');

    // 1. Stop accepting new inbound transport connections
    await Promise.allSettled([
      this.tcpAdapter.stop(),
      this.udpAdapter.stop()
    ]);

    // 2. Drain and cleanly terminate active client sockets
    console.log(`[ShutdownManager] Step 2: Draining active client connections (Deadline: ${this.config.gracefulShutdownTimeoutMs}ms)...`);
    const closedSockets = await this.connectionManager.drainAllConnections(
      this.config.gracefulShutdownTimeoutMs
    );
    console.log(`[ShutdownManager] Drained ${closedSockets} active connection(s).`);

    // 3. Stop health server
    console.log('[ShutdownManager] Step 3: Stopping health diagnostics server...');
    await this.healthServer.stop();

    this.connectionManager.stop();
    this.setRuntimeState('STOPPED');
  }

  public getIsShuttingDown(): boolean {
    return this.isShuttingDown;
  }
}
