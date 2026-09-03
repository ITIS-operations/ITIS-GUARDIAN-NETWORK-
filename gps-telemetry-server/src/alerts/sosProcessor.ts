import { TelemetryEvent, ProcessedAlertEvent } from '../types/telemetry.js';
import { DeviceRecord } from '../types/device.js';

export class SOSProcessor {
  /**
   * Evaluates if a telemetry event represents an active SOS emergency trigger.
   */
  public processSOS(event: TelemetryEvent, device?: DeviceRecord | null): ProcessedAlertEvent | null {
    if (!event.sosActive && event.alarmType !== 'SOS_PANIC') {
      return null;
    }

    return {
      id: `alert_sos_${event.deviceId}_${Date.now()}`,
      deviceId: event.deviceId,
      imei: event.imei || device?.imei,
      learnerId: device?.learnerId,
      schoolId: device?.schoolId,
      alarmType: 'SOS_PANIC',
      severity: 'CRITICAL_SOS',
      timestamp: event.timestamp,
      latitude: event.latitude,
      longitude: event.longitude,
      speed: event.speed,
      batteryLevel: event.batteryLevel,
      description: `CRITICAL SOS Beacon activated by hardware device ${event.deviceId}${device?.learnerId ? ` (Learner: ${device.learnerId})` : ''}`,
      acknowledged: false
    };
  }
}
