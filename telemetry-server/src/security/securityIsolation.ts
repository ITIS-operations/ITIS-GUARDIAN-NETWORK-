/**
 * =====================================================================
 * ITIS DEDICATED GPS TELEMETRY SERVER - SECURITY ISOLATION
 * Packet boundary guards, rate limiters, and quarantine containment
 * =====================================================================
 */

import { TelemetryServerConfig } from '../config/serverConfig.js';
import { InboundPacketContext } from '../transport/types.js';

export interface QuarantinedPacket {
  id: string;
  timestamp: string;
  transport: 'TCP' | 'UDP';
  remoteAddress: string;
  remotePort: number;
  reason: string;
  rawSnippetHex: string;
  byteLength: number;
}

export class SecurityIsolationEngine {
  private config: TelemetryServerConfig;
  private quarantinedPackets: QuarantinedPacket[] = [];
  private readonly maxQuarantineHistory = 200;

  // Rate limiting map: key = IP address or connectionId -> array of timestamps
  private rateLimitMap: Map<string, number[]> = new Map();

  constructor(config: TelemetryServerConfig) {
    this.config = config;
  }

  /**
   * Validate that the incoming raw packet does not exceed strict payload size limits
   */
  public checkPacketSize(buffer: Buffer): { allowed: boolean; reason?: string } {
    if (buffer.length > this.config.maxPacketSizeBytes) {
      return {
        allowed: false,
        reason: `OVERSIZED_PACKET: Received ${buffer.length} bytes (maximum allowed: ${this.config.maxPacketSizeBytes} bytes)`
      };
    }
    if (buffer.length === 0) {
      return {
        allowed: false,
        reason: 'EMPTY_PACKET: 0 bytes received'
      };
    }
    return { allowed: true };
  }

  /**
   * Sliding window rate limiter per connection or IP address
   */
  public checkRateLimit(key: string): { allowed: boolean; currentRps: number } {
    const now = Date.now();
    const windowMs = 1000;
    const history = this.rateLimitMap.get(key) || [];
    
    // Prune entries older than 1 second
    const recent = history.filter(ts => now - ts < windowMs);
    
    if (recent.length >= this.config.rateLimitPacketsPerSec) {
      this.rateLimitMap.set(key, recent);
      return { allowed: false, currentRps: recent.length };
    }

    recent.push(now);
    this.rateLimitMap.set(key, recent);
    return { allowed: true, currentRps: recent.length };
  }

  /**
   * Safely isolate a malformed packet without throwing or crashing the transport
   */
  public quarantineMalformedPacket(
    context: InboundPacketContext,
    reason: string
  ): QuarantinedPacket {
    const hexSnippet = context.rawBuffer.slice(0, 32).toString('hex');
    const item: QuarantinedPacket = {
      id: `QR-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      transport: context.transport,
      remoteAddress: context.remoteAddress,
      remotePort: context.remotePort,
      reason,
      rawSnippetHex: hexSnippet,
      byteLength: context.rawBuffer.length
    };

    this.quarantinedPackets.unshift(item);
    if (this.quarantinedPackets.length > this.maxQuarantineHistory) {
      this.quarantinedPackets.pop();
    }

    return item;
  }

  /**
   * Periodic cleanup of stale rate-limiting maps
   */
  public pruneRateLimitCache(): void {
    const now = Date.now();
    for (const [key, timestamps] of this.rateLimitMap.entries()) {
      const active = timestamps.filter(ts => now - ts < 2000);
      if (active.length === 0) {
        this.rateLimitMap.delete(key);
      } else {
        this.rateLimitMap.set(key, active);
      }
    }
  }

  /**
   * Retrieve sanitized quarantine metrics (Zero secrets exposed)
   */
  public getQuarantineStats(): { totalQuarantined: number; recentReasons: string[] } {
    return {
      totalQuarantined: this.quarantinedPackets.length,
      recentReasons: this.quarantinedPackets.slice(0, 5).map(q => q.reason)
    };
  }

  public getQuarantinedList(): readonly QuarantinedPacket[] {
    return this.quarantinedPackets;
  }
}
