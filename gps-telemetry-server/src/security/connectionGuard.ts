/**
 * Connection Guard
 * Enforces socket limits, connection tracking, IP concurrency bounds, and idle timeouts.
 */

export interface ConnectionMetadata {
  id: string;
  ip: string;
  port: number;
  connectedAt: Date;
  lastActivityAt: Date;
}

export class ConnectionGuard {
  private activeConnections: Map<string, ConnectionMetadata> = new Map();
  private ipConnectionCounts: Map<string, number> = new Map();
  private maxGlobalConnections: number;
  private maxPerIpConnections: number;

  constructor(maxGlobal: number = 5000, maxPerIp: number = 50) {
    this.maxGlobalConnections = maxGlobal;
    this.maxPerIpConnections = maxPerIp;
  }

  public registerConnection(connectionId: string, ip: string, port: number): { allowed: boolean; reason?: string } {
    if (this.activeConnections.size >= this.maxGlobalConnections) {
      return { allowed: false, reason: 'GLOBAL_CONNECTION_CAPACITY_REACHED' };
    }

    const currentIpCount = this.ipConnectionCounts.get(ip) || 0;
    if (currentIpCount >= this.maxPerIpConnections) {
      return { allowed: false, reason: 'PER_IP_CONCURRENCY_LIMIT_EXCEEDED' };
    }

    const now = new Date();
    this.activeConnections.set(connectionId, {
      id: connectionId,
      ip,
      port,
      connectedAt: now,
      lastActivityAt: now
    });
    this.ipConnectionCounts.set(ip, currentIpCount + 1);

    return { allowed: true };
  }

  public recordActivity(connectionId: string): void {
    const conn = this.activeConnections.get(connectionId);
    if (conn) {
      conn.lastActivityAt = new Date();
    }
  }

  public unregisterConnection(connectionId: string): void {
    const conn = this.activeConnections.get(connectionId);
    if (conn) {
      const currentIpCount = this.ipConnectionCounts.get(conn.ip) || 1;
      if (currentIpCount <= 1) {
        this.ipConnectionCounts.delete(conn.ip);
      } else {
        this.ipConnectionCounts.set(conn.ip, currentIpCount - 1);
      }
      this.activeConnections.delete(connectionId);
    }
  }

  public getActiveCount(): number {
    return this.activeConnections.size;
  }

  public getIdleConnections(timeoutSeconds: number): string[] {
    const threshold = Date.now() - (timeoutSeconds * 1000);
    const idleIds: string[] = [];

    for (const [id, conn] of this.activeConnections.entries()) {
      if (conn.lastActivityAt.getTime() < threshold) {
        idleIds.push(id);
      }
    }
    return idleIds;
  }
}
