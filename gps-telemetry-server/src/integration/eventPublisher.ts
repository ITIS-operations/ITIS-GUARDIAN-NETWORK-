import { EventEmitter } from 'events';
import { TelemetryEvent, ProcessedAlertEvent } from '../types/telemetry.js';
import { ItisIntegrationClient } from './itisIntegrationClient.js';

export class EventPublisher extends EventEmitter {
  constructor(private itisClient?: ItisIntegrationClient) {
    super();
  }

  public async publishTelemetry(event: TelemetryEvent): Promise<void> {
    this.emit('telemetry', event);
    if (this.itisClient) {
      await this.itisClient.forwardTelemetry(event);
    }
  }

  public async publishAlert(alert: ProcessedAlertEvent): Promise<void> {
    this.emit('alert', alert);
    if (this.itisClient) {
      await this.itisClient.forwardAlert(alert);
    }
  }
}
