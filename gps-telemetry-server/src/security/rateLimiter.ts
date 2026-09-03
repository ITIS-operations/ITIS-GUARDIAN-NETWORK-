/**
 * Rate Limiter for Ingestion Channels
 * Prevents Denial-of-Service and runaway tracker flood attacks.
 */

interface RateBucket {
  count: number;
  resetAt: number;
}

export class IngestionRateLimiter {
  private buckets: Map<string, RateBucket> = new Map();
  private maxRequestsPerWindow: number;
  private windowDurationMs: number;

  constructor(maxRequestsPerMinute: number = 60, windowDurationMs: number = 60000) {
    this.maxRequestsPerWindow = maxRequestsPerMinute;
    this.windowDurationMs = windowDurationMs;

    // Periodic sweep of expired rate buckets to avoid memory leaks
    setInterval(() => this.cleanup(), this.windowDurationMs);
  }

  public isAllowed(identifier: string): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(identifier);

    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(identifier, {
        count: 1,
        resetAt: now + this.windowDurationMs
      });
      return true;
    }

    if (bucket.count < this.maxRequestsPerWindow) {
      bucket.count += 1;
      return true;
    }

    return false;
  }

  public getRemaining(identifier: string): number {
    const now = Date.now();
    const bucket = this.buckets.get(identifier);
    if (!bucket || now >= bucket.resetAt) {
      return this.maxRequestsPerWindow;
    }
    return Math.max(0, this.maxRequestsPerWindow - bucket.count);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      if (now >= bucket.resetAt) {
        this.buckets.delete(key);
      }
    }
  }
}
