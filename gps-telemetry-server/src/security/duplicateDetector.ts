import crypto from 'crypto';
import { TelemetryEvent } from '../types/telemetry.js';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  fingerprint: string;
  reason?: string;
  previousSeenAt?: Date;
}

interface CachedFingerprintEntry {
  fingerprint: string;
  deviceId: string;
  timestampMs: number;
  seenAt: Date;
  alarmType?: string;
  sosActive?: boolean;
}

/**
 * High-Performance Sliding Window Duplicate Packet Detector
 * 
 * Prevents:
 * 1. Duplicate emergency alerts from retransmitted packets
 * 2. Redundant location history entries from duplicate frames
 * 3. Repetitive SOS panic triggers from unacknowledged ACK retry bursts
 * 
 * Preserves:
 * Legitimate stationary telemetry where timestamps or sequence numbers have advanced.
 */
export class DuplicateDetector {
  private cache: Map<string, CachedFingerprintEntry> = new Map();
  private maxCacheSize: number;
  private deduplicationWindowMs: number;
  private lastProcessedTimestampByDevice: Map<string, { timestampMs: number; lat?: number; lng?: number; alarm?: string }> = new Map();

  constructor(
    deduplicationWindowMs: number = 600000, // 10 minutes sliding window
    maxCacheSize: number = 10000
  ) {
    this.deduplicationWindowMs = deduplicationWindowMs;
    this.maxCacheSize = maxCacheSize;
  }

  /**
   * Generates a deterministic signature for a telemetry event or raw packet payload.
   */
  public generateFingerprint(event: {
    deviceId: string;
    timestamp: Date | number;
    latitude?: number;
    longitude?: number;
    speed?: number;
    heading?: number;
    batteryLevel?: number;
    alarmType?: string;
    sosActive?: boolean;
    rawPacketReference?: string;
  }): string {
    const ts = event.timestamp instanceof Date ? event.timestamp.getTime() : new Date(event.timestamp).getTime();
    const latStr = event.latitude != null ? event.latitude.toFixed(6) : 'null';
    const lngStr = event.longitude != null ? event.longitude.toFixed(6) : 'null';
    const alarmStr = event.alarmType || (event.sosActive ? 'SOS' : 'none');
    const batStr = event.batteryLevel != null ? String(event.batteryLevel) : 'null';
    const rawRef = event.rawPacketReference || '';

    const rawSignature = `${event.deviceId}|${ts}|${latStr}|${lngStr}|${alarmStr}|${batStr}|${rawRef}`;
    return crypto.createHash('sha256').update(rawSignature).digest('hex').substring(0, 32);
  }

  /**
   * Checks if an incoming event is a duplicate.
   */
  public checkDuplicate(event: TelemetryEvent): DuplicateCheckResult {
    const fingerprint = this.generateFingerprint(event);
    const now = Date.now();
    const eventTimeMs = event.timestamp.getTime();

    // 1. Check exact fingerprint in cache
    const existing = this.cache.get(fingerprint);
    if (existing) {
      if (now - existing.seenAt.getTime() <= this.deduplicationWindowMs) {
        return {
          isDuplicate: true,
          fingerprint,
          reason: `DUPLICATE_PACKET_FINGERPRINT_MATCH: Identical packet payload received at ${existing.seenAt.toISOString()}`,
          previousSeenAt: existing.seenAt
        };
      }
    }

    // 2. Check device's last processed packet for exact timestamp collision with identical spatial/alarm payload
    const lastDeviceState = this.lastProcessedTimestampByDevice.get(event.deviceId);
    if (lastDeviceState) {
      const isIdenticalTime = lastDeviceState.timestampMs === eventTimeMs;
      const isIdenticalCoords = lastDeviceState.lat === event.latitude && lastDeviceState.lng === event.longitude;
      const isIdenticalAlarm = lastDeviceState.alarm === (event.alarmType || (event.sosActive ? 'SOS' : 'none'));

      if (isIdenticalTime && isIdenticalCoords && isIdenticalAlarm) {
        return {
          isDuplicate: true,
          fingerprint,
          reason: `DUPLICATE_TIMESTAMP_POSITION_REPLAY: Identical timestamp (${event.timestamp.toISOString()}) and coordinates already recorded`,
          previousSeenAt: new Date(lastDeviceState.timestampMs)
        };
      }
    }

    return {
      isDuplicate: false,
      fingerprint
    };
  }

  /**
   * Records a successfully processed event into the deduplication window cache.
   */
  public recordEvent(event: TelemetryEvent, fingerprint?: string): void {
    const fp = fingerprint || this.generateFingerprint(event);
    const eventTimeMs = event.timestamp.getTime();

    // Clean expired items if cache exceeds bound
    if (this.cache.size >= this.maxCacheSize) {
      this.evictExpiredEntries();
    }

    this.cache.set(fp, {
      fingerprint: fp,
      deviceId: event.deviceId,
      timestampMs: eventTimeMs,
      seenAt: new Date(),
      alarmType: event.alarmType,
      sosActive: event.sosActive
    });

    this.lastProcessedTimestampByDevice.set(event.deviceId, {
      timestampMs: eventTimeMs,
      lat: event.latitude,
      lng: event.longitude,
      alarm: event.alarmType || (event.sosActive ? 'SOS' : 'none')
    });
  }

  private evictExpiredEntries(): void {
    const now = Date.now();
    for (const [key, val] of this.cache.entries()) {
      if (now - val.seenAt.getTime() > this.deduplicationWindowMs) {
        this.cache.delete(key);
      }
    }
  }

  public reset(): void {
    this.cache.clear();
    this.lastProcessedTimestampByDevice.clear();
  }
}
