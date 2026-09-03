import { TelemetryEvent, ProcessedAlertEvent } from '../types/telemetry.js';

export class ItisIntegrationClient {
  private enabled: boolean;
  private coreApiUrl?: string;
  private ingestKey?: string;

  constructor(config: { coreApiUrl?: string; ingestKey?: string; dispatchEnabled: boolean }) {
    this.coreApiUrl = config.coreApiUrl;
    this.ingestKey = config.ingestKey;
    this.enabled = config.dispatchEnabled && !!this.coreApiUrl;
  }

  public async forwardTelemetry(event: TelemetryEvent): Promise<boolean> {
    if (!this.enabled || !this.coreApiUrl) return false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`${this.coreApiUrl}/telemetry/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.ingestKey ? { 'X-Telemetry-Ingest-Key': this.ingestKey } : {})
        },
        body: JSON.stringify(event),
        signal: controller.signal
      });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      // Graceful fallback - standalone telemetry server does not depend on ITIS core
      return false;
    }
  }

  public async forwardAlert(alert: ProcessedAlertEvent): Promise<boolean> {
    if (!this.enabled || !this.coreApiUrl) return false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`${this.coreApiUrl}/telemetry/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.ingestKey ? { 'X-Telemetry-Ingest-Key': this.ingestKey } : {})
        },
        body: JSON.stringify(alert),
        signal: controller.signal
      });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }
}
