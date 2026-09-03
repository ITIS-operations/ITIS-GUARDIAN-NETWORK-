import { TelemetryEvent, ProcessedAlertEvent } from '../types/telemetry.js';
import { ITelemetryRepository } from '../storage/telemetryRepository.js';
import { DeviceRegistry } from '../devices/deviceRegistry.js';
import { AlertEngine } from '../alerts/alertEngine.js';
import { LocationProcessor } from './locationProcessor.js';
import { EventPublisher } from '../integration/eventPublisher.js';
import { DuplicateDetector } from '../security/duplicateDetector.js';

export interface TelemetryProcessingResult {
  success: boolean;
  event?: TelemetryEvent;
  alertsTriggered: ProcessedAlertEvent[];
  isDuplicate?: boolean;
  duplicateReason?: string;
  error?: string;
}

/**
 * Core Telemetry Processing Engine
 * 
 * Flow:
 * 1. Duplicate Packet Protection (Suppresses duplicate alerts and redundant track records)
 * 2. Device Metadata & Learner Association Lookup
 * 3. Spatial & Speed Sanity Check (Filters out-of-bounds, (0,0) fixes, impossible jumps)
 * 4. Persistence (Storage in repository)
 * 5. Device State Update (Updates ONLINE status, lastSeenAt, battery, GSM)
 * 6. Alert & SOS Detection (Escalates panic, low battery, tamper, geofence breaches)
 * 7. Upstream Integration Publishing (Dispatches to ITIS event bus)
 */
export class TelemetryProcessor {
  private locationProcessor = new LocationProcessor();
  private duplicateDetector: DuplicateDetector;

  constructor(
    private telemetryRepo: ITelemetryRepository,
    private deviceRegistry: DeviceRegistry,
    private alertEngine: AlertEngine,
    private eventPublisher: EventPublisher,
    duplicateDetector?: DuplicateDetector
  ) {
    this.duplicateDetector = duplicateDetector || new DuplicateDetector();
  }

  public async processEvent(event: TelemetryEvent): Promise<TelemetryProcessingResult> {
    try {
      // 1. Device Lookup & Association
      const device = await this.deviceRegistry.getDevice(event.deviceId);
      if (device) {
        if (device.learnerId) event.learnerId = device.learnerId;
        if (device.schoolId) event.schoolId = device.schoolId;
      }

      // 2. Duplicate Packet Check
      const dupCheck = this.duplicateDetector.checkDuplicate(event);
      if (dupCheck.isDuplicate) {
        event.isDuplicate = true;
        event.duplicateReason = dupCheck.reason;

        // Duplicate detected: safe suppression.
        // We do NOT create duplicate alerts, do NOT append redundant history,
        // but still acknowledge receipt to the tracker hardware.
        return {
          success: true,
          event,
          alertsTriggered: [],
          isDuplicate: true,
          duplicateReason: dupCheck.reason
        };
      }

      // Record valid non-duplicate event in cache
      this.duplicateDetector.recordEvent(event, dupCheck.fingerprint);

      // 3. Location Sanity & Anomaly Processing
      const locSanity = this.locationProcessor.sanitizeLocation(event);
      if (!locSanity.valid) {
        console.warn(`[TelemetryProcessor] Dropping coordinate for device ${event.deviceId}: ${locSanity.reason}`);
        event.latitude = undefined;
        event.longitude = undefined;
      }

      // 4. Persist normalized telemetry event
      await this.telemetryRepo.saveEvent(event);

      // 5. Update device connectivity & latest state
      if (device) {
        await this.deviceRegistry.updateConnectivity(device.id, 'ONLINE', {
          lat: event.latitude,
          lng: event.longitude,
          battery: event.batteryLevel,
          gsm: event.gsmSignal ?? event.signalLevel
        });
      }

      // 6. Evaluate alerts & SOS triggers
      const alerts = this.alertEngine.evaluateAlerts(event, device);
      for (const alert of alerts) {
        await this.telemetryRepo.saveAlert(alert);
        await this.eventPublisher.publishAlert(alert);
      }

      // 7. Publish telemetry stream event upstream
      await this.eventPublisher.publishTelemetry(event);

      return {
        success: true,
        event,
        alertsTriggered: alerts,
        isDuplicate: false
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        alertsTriggered: [],
        error: `Telemetry processing failure: ${msg}`
      };
    }
  }

  public getDuplicateDetector(): DuplicateDetector {
    return this.duplicateDetector;
  }
}
