/**
 * ==============================================================================
 * ITIS GUARDIAN NETWORK — TELEMETRY IDEMPOTENCY ENGINE
 * Deduplication, Idempotency-Key Caching, and Anti-Duplicate Enforcement
 * ==============================================================================
 */

import crypto from 'crypto';
import { TelemetryEnvelope } from '../../types.js';
import {
  IdempotencyRecord,
  InternalTelemetryIngestResponse
} from './telemetryIntegrationTypes.js';

export class TelemetryIdempotencyEngine {
  private readonly records = new Map<string, IdempotencyRecord>();
  private readonly ttlMs: number;

  // Metrics
  private totalChecked = 0;
  private totalDuplicatesSuppressed = 0;

  constructor(ttlMs = 3_600_000) { // 1-hour default TTL
    this.ttlMs = ttlMs;

    // Background sweep every 10 minutes
    setInterval(() => this.sweepExpired(), 600_000).unref();
  }

  /**
   * Derive or format a unique idempotency fingerprint for an ingestion envelope
   */
  public generateFingerprint(envelope: TelemetryEnvelope, customKey?: string): {
    idempotencyKey: string;
    fingerprint: string;
  } {
    const rawPacket = envelope.rawPacket || '';
    const hash = crypto.createHash('sha256').update(rawPacket).digest('hex');
    const device = envelope.deviceIdentifier || 'DEV-TRACKER';
    const transport = envelope.transportType || 'TCP';

    const fingerprint = `FP:${transport}:${device}:${hash}`;
    const idempotencyKey = customKey || `IDEMP:${device}:${hash.slice(0, 24)}`;

    return { idempotencyKey, fingerprint };
  }

  /**
   * Check if an idempotency key or fingerprint has already been processed
   */
  public check(idempotencyKey: string, fingerprint: string): IdempotencyRecord | null {
    this.totalChecked++;
    this.cleanExpiredKey(idempotencyKey);
    this.cleanExpiredKey(fingerprint);

    const record = this.records.get(idempotencyKey) || this.records.get(fingerprint);
    if (record) {
      record.hitCount++;
      record.lastHitAt = Date.now();
      this.totalDuplicatesSuppressed++;
      return record;
    }

    return null;
  }

  /**
   * Store processed ingestion response for idempotent re-delivery
   */
  public store(idempotencyKey: string, fingerprint: string, response: InternalTelemetryIngestResponse): void {
    const now = Date.now();
    const record: IdempotencyRecord = {
      key: idempotencyKey,
      fingerprint,
      response,
      firstProcessedAt: now,
      lastHitAt: now,
      hitCount: 1
    };

    this.records.set(idempotencyKey, record);
    if (fingerprint !== idempotencyKey) {
      this.records.set(fingerprint, record);
    }
  }

  /**
   * Build an idempotent suppressed response from cached record
   */
  public createSuppressedResponse(record: IdempotencyRecord): InternalTelemetryIngestResponse {
    return {
      ...record.response,
      duplicate: true,
      suppressed: true,
      message: 'DUPLICATE_INGESTION_SUPPRESSED: Packet previously ingested and verified. Authoritative duplicate suppressed.',
      processedAt: new Date().toISOString(),
      idempotencyKey: record.key
    };
  }

  /**
   * Periodic garbage collection of expired entries
   */
  private cleanExpiredKey(key: string): void {
    const entry = this.records.get(key);
    if (entry && Date.now() - entry.firstProcessedAt > this.ttlMs) {
      this.records.delete(key);
    }
  }

  public sweepExpired(): number {
    const now = Date.now();
    let swept = 0;
    for (const [key, record] of this.records.entries()) {
      if (now - record.firstProcessedAt > this.ttlMs) {
        this.records.delete(key);
        swept++;
      }
    }
    return swept;
  }

  /**
   * Reset cache for isolated test execution
   */
  public clear(): void {
    this.records.clear();
    this.totalChecked = 0;
    this.totalDuplicatesSuppressed = 0;
  }

  /**
   * Get diagnostic statistics
   */
  public getMetrics(): {
    activeRecords: number;
    totalChecked: number;
    totalDuplicatesSuppressed: number;
    ttlMs: number;
  } {
    return {
      activeRecords: this.records.size,
      totalChecked: this.totalChecked,
      totalDuplicatesSuppressed: this.totalDuplicatesSuppressed,
      ttlMs: this.ttlMs
    };
  }
}

export const telemetryIdempotencyEngine = new TelemetryIdempotencyEngine();
