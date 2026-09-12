/**
 * =====================================================================
 * ITIS DEDICATED GPS TELEMETRY SERVER - RESILIENCE QUEUE
 * Bounded Queue, Exponential Backoff with Jitter, and Spool Persistence
 * =====================================================================
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { TelemetryEnvelope } from '../../../src/types.js';
import {
  TelemetryRetryQueueItem,
  RetryQueueMetrics
} from '../../../src/server/telemetryIntegration/telemetryIntegrationTypes.js';

export interface ResilienceQueueConfig {
  maxCapacity: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  backoffMultiplier: number;
  maxAttempts: number;
  spoolFilePath?: string;
}

export class TelemetryResilienceQueue {
  private queue: TelemetryRetryQueueItem[] = [];
  private readonly config: ResilienceQueueConfig;
  private readonly spoolFile: string;

  // Metrics
  private totalEnqueued = 0;
  private totalSuccessfullyRetried = 0;
  private totalDroppedDueToCapacity = 0;
  private isProcessing = false;
  private flushTimer: NodeJS.Timeout | null = null;

  // Forwarding function injected from bridge
  private forwarder?: (item: TelemetryRetryQueueItem) => Promise<{ success: boolean; duplicate?: boolean; error?: string }>;

  constructor(config?: Partial<ResilienceQueueConfig>) {
    this.config = {
      maxCapacity: config?.maxCapacity ?? parseInt(process.env.MAX_RETRY_QUEUE_SIZE || '500', 10),
      initialBackoffMs: config?.initialBackoffMs ?? 500,
      maxBackoffMs: config?.maxBackoffMs ?? 30000,
      backoffMultiplier: config?.backoffMultiplier ?? 2.0,
      maxAttempts: config?.maxAttempts ?? 10,
      spoolFilePath: config?.spoolFilePath
    };

    // Safe spool persistence location
    const spoolDir = path.resolve(process.cwd(), '.telemetry-spool');
    if (!fs.existsSync(spoolDir)) {
      try {
        fs.mkdirSync(spoolDir, { recursive: true });
      } catch {
        // Fallback to memory-only if disk unavailable
      }
    }
    this.spoolFile = this.config.spoolFilePath || path.join(spoolDir, 'retry_queue_spool.json');

    this.restoreFromSpool();
    this.startWorker();
  }

  public setForwarder(forwarder: (item: TelemetryRetryQueueItem) => Promise<{ success: boolean; duplicate?: boolean; error?: string }>): void {
    this.forwarder = forwarder;
  }

  /**
   * Enqueue a packet with bounded capacity enforcement
   */
  public enqueue(envelope: TelemetryEnvelope, customKey?: string, isCritical = false): {
    enqueued: boolean;
    queueSize: number;
    droppedOldest: boolean;
    item: TelemetryRetryQueueItem;
  } {
    const rawPacket = envelope.rawPacket || '';
    const hash = crypto.createHash('sha256').update(rawPacket).digest('hex');
    const deviceId = envelope.deviceIdentifier || 'DEV-TRACKER';
    const idempotencyKey = customKey || `IDEMP:${deviceId}:${hash.slice(0, 24)}`;

    const priority: 'CRITICAL' | 'NORMAL' = isCritical || rawPacket.includes('SOS') || rawPacket.includes('ALARM') ? 'CRITICAL' : 'NORMAL';

    let droppedOldest = false;

    // Bounded queue enforcement
    if (this.queue.length >= this.config.maxCapacity) {
      if (priority === 'CRITICAL') {
        // Drop oldest NORMAL packet to preserve critical SOS
        const normalIdx = this.queue.findIndex(i => i.priority === 'NORMAL');
        if (normalIdx >= 0) {
          this.queue.splice(normalIdx, 1);
          this.totalDroppedDueToCapacity++;
          droppedOldest = true;
        } else {
          // If queue is completely full of critical items, drop oldest critical
          this.queue.shift();
          this.totalDroppedDueToCapacity++;
          droppedOldest = true;
        }
      } else {
        // Drop oldest normal item
        this.queue.shift();
        this.totalDroppedDueToCapacity++;
        droppedOldest = true;
      }
    }

    const item: TelemetryRetryQueueItem = {
      id: `retry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      idempotencyKey,
      envelope,
      enqueuedAt: Date.now(),
      attempts: 1,
      nextRetryAt: Date.now() + this.calculateBackoff(1),
      priority
    };

    this.queue.push(item);
    this.totalEnqueued++;
    this.saveToSpool();

    return {
      enqueued: true,
      queueSize: this.queue.length,
      droppedOldest,
      item
    };
  }

  /**
   * Calculate exponential backoff with ±20% jitter
   */
  public calculateBackoff(attempts: number): number {
    const exponential = Math.min(
      this.config.maxBackoffMs,
      this.config.initialBackoffMs * Math.pow(this.config.backoffMultiplier, attempts - 1)
    );
    // Jitter between 0.8 and 1.2
    const jitter = 0.8 + Math.random() * 0.4;
    return Math.floor(exponential * jitter);
  }

  /**
   * Background retry worker
   */
  private startWorker(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(async () => {
      await this.processPendingRetries();
    }, 1000);
    this.flushTimer.unref();
  }

  public stopWorker(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Process retries for all due items
   */
  public async processPendingRetries(): Promise<number> {
    if (this.isProcessing || !this.forwarder || this.queue.length === 0) {
      return 0;
    }

    this.isProcessing = true;
    let processedCount = 0;
    const now = Date.now();

    try {
      // Find items ready for retry
      const readyIndices: number[] = [];
      for (let i = 0; i < this.queue.length; i++) {
        if (this.queue[i].nextRetryAt <= now) {
          readyIndices.push(i);
        }
      }

      for (const idx of readyIndices) {
        const item = this.queue[idx];
        if (!item) continue;

        try {
          const res = await this.forwarder(item);
          if (res.success || res.duplicate) {
            // Successfully delivered or duplicate suppressed
            this.totalSuccessfullyRetried++;
            processedCount++;
            // Remove item
            this.queue.splice(this.queue.indexOf(item), 1);
          } else {
            // Failed retry -> increment attempt count and backoff
            item.attempts++;
            item.lastError = res.error;
            if (item.attempts >= this.config.maxAttempts) {
              // Exceeded max attempts -> remove from retry queue
              this.queue.splice(this.queue.indexOf(item), 1);
            } else {
              item.nextRetryAt = Date.now() + this.calculateBackoff(item.attempts);
            }
          }
        } catch (err: any) {
          item.attempts++;
          item.lastError = err.message;
          item.nextRetryAt = Date.now() + this.calculateBackoff(item.attempts);
        }
      }

      if (processedCount > 0) {
        this.saveToSpool();
      }
    } finally {
      this.isProcessing = false;
    }

    return processedCount;
  }

  /**
   * Save queue state to persistent spool
   */
  private saveToSpool(): void {
    try {
      fs.writeFileSync(this.spoolFile, JSON.stringify(this.queue.slice(0, 100), null, 2), 'utf8');
    } catch {
      // Non-blocking disk warning
    }
  }

  /**
   * Restore queue state from persistent spool
   */
  private restoreFromSpool(): void {
    try {
      if (fs.existsSync(this.spoolFile)) {
        const data = fs.readFileSync(this.spoolFile, 'utf8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          this.queue = parsed;
        }
      }
    } catch {
      this.queue = [];
    }
  }

  /**
   * Clear queue (for tests)
   */
  public clear(): void {
    this.queue = [];
    try {
      if (fs.existsSync(this.spoolFile)) {
        fs.unlinkSync(this.spoolFile);
      }
    } catch {
      // Non-blocking
    }
  }

  /**
   * Retrieve queue diagnostic metrics
   */
  public getMetrics(): RetryQueueMetrics {
    const oldest = this.queue.length > 0 ? Date.now() - this.queue[0].enqueuedAt : 0;
    return {
      currentQueueSize: this.queue.length,
      maxCapacity: this.config.maxCapacity,
      totalEnqueued: this.totalEnqueued,
      totalSuccessfullyRetried: this.totalSuccessfullyRetried,
      totalDroppedDueToCapacity: this.totalDroppedDueToCapacity,
      oldestItemAgeMs: oldest,
      isProcessing: this.isProcessing
    };
  }

  public getQueue(): readonly TelemetryRetryQueueItem[] {
    return this.queue;
  }
}
