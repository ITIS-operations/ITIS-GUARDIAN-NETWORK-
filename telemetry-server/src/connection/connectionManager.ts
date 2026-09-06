/**
 * =====================================================================
 * ITIS DEDICATED GPS TELEMETRY SERVER - CONNECTION LIFECYCLE MANAGER
 * Concurrency boundaries, idle timers, and device mapping
 * =====================================================================
 */

import { Socket } from 'net';
import { TelemetryServerConfig } from '../config/serverConfig.js';
import { ClientConnectionRecord } from '../transport/types.js';

export class ConnectionLifecycleManager {
  private config: TelemetryServerConfig;
  private connections: Map<string, ClientConnectionRecord> = new Map();
  private deviceToConnectionMap: Map<string, string> = new Map();
  private idleCheckInterval?: NodeJS.Timeout;
  private peakConnections = 0;

  constructor(config: TelemetryServerConfig) {
    this.config = config;
    this.startIdleMonitor();
  }

  /**
   * Evaluate whether a new connection can be accepted under configured limits
   */
  public canAcceptConnection(): { allowed: boolean; reason?: string } {
    if (this.connections.size >= this.config.maxConnections) {
      return {
        allowed: false,
        reason: `CONNECTION_LIMIT_EXCEEDED: Active connections (${this.connections.size}) has reached maximum ceiling (${this.config.maxConnections})`
      };
    }
    return { allowed: true };
  }

  /**
   * Register an incoming client socket
   */
  public registerConnection(
    connectionId: string,
    transport: 'TCP' | 'UDP',
    remoteAddress: string,
    remotePort: number,
    socket?: Socket
  ): ClientConnectionRecord {
    const record: ClientConnectionRecord = {
      id: connectionId,
      socket,
      transport,
      remoteAddress,
      remotePort,
      connectedAt: new Date(),
      lastPacketAt: new Date(),
      packetsReceived: 0,
      isClosed: false
    };

    this.connections.set(connectionId, record);
    if (this.connections.size > this.peakConnections) {
      this.peakConnections = this.connections.size;
    }

    return record;
  }

  /**
   * Record that a packet was received for this connection
   */
  public touchConnection(connectionId: string): void {
    const record = this.connections.get(connectionId);
    if (record) {
      record.lastPacketAt = new Date();
      record.packetsReceived++;
    }
  }

  /**
   * Bind an authenticated / verified device ID to the active connection
   */
  public identifyDevice(connectionId: string, deviceId: string): void {
    const record = this.connections.get(connectionId);
    if (record) {
      record.identifiedDeviceId = deviceId;
      this.deviceToConnectionMap.set(deviceId, connectionId);
    }
  }

  /**
   * Remove a connection upon socket closure or error
   */
  public unregisterConnection(connectionId: string): void {
    const record = this.connections.get(connectionId);
    if (record) {
      record.isClosed = true;
      if (record.identifiedDeviceId) {
        this.deviceToConnectionMap.delete(record.identifiedDeviceId);
      }
      this.connections.delete(connectionId);
    }
  }

  /**
   * Send data to a specific connection
   */
  public sendDownlink(connectionId: string, payload: string | Buffer): boolean {
    const record = this.connections.get(connectionId);
    if (!record || record.isClosed || !record.socket) {
      return false;
    }

    try {
      record.socket.write(payload);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Background idle timeout sweep
   */
  private startIdleMonitor(): void {
    this.idleCheckInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, record] of this.connections.entries()) {
        const idleDuration = now - record.lastPacketAt.getTime();
        if (idleDuration > this.config.idleTimeoutMs) {
          if (record.socket && !record.isClosed) {
            try {
              record.socket.end();
              record.socket.destroy();
            } catch (err) {
              // Ignore socket destruction errors during eviction
            }
          }
          this.unregisterConnection(id);
        }
      }
    }, 15000);
  }

  /**
   * Drains and terminates all active connections cleanly
   */
  public async drainAllConnections(timeoutMs: number): Promise<number> {
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
    }

    const closedCount = this.connections.size;
    const promises: Promise<void>[] = [];

    for (const [id, record] of this.connections.entries()) {
      if (record.socket && !record.isClosed) {
        promises.push(
          new Promise<void>((resolve) => {
            try {
              record.socket?.end(() => {
                record.socket?.destroy();
                resolve();
              });
            } catch {
              resolve();
            }
          })
        );
      }
      this.unregisterConnection(id);
    }

    // Wait for all sockets to close up to timeoutMs
    const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
    await Promise.race([Promise.all(promises), timeoutPromise]);

    this.connections.clear();
    this.deviceToConnectionMap.clear();
    return closedCount;
  }

  /**
   * Sanitized diagnostics
   */
  public getActiveCount(): number {
    return this.connections.size;
  }

  public getPeakCount(): number {
    return this.peakConnections;
  }

  public getConnection(connectionId: string): ClientConnectionRecord | undefined {
    return this.connections.get(connectionId);
  }

  public stop(): void {
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
    }
  }
}
