import { TelemetryEvent, ProcessedAlertEvent } from '../types/telemetry.js';
import { DeviceRecord } from '../types/device.js';
import { SOSProcessor } from './sosProcessor.js';
import { AlarmProcessor } from './alarmProcessor.js';
import { GeofenceEngine } from '../geofence/geofenceEngine.js';

export class AlertEngine {
  private sosProcessor = new SOSProcessor();
  private alarmProcessor = new AlarmProcessor();

  constructor(private geofenceEngine: GeofenceEngine) {}

  /**
   * Evaluates an incoming normalized telemetry event for all alert types.
   */
  public evaluateAlerts(event: TelemetryEvent, device?: DeviceRecord | null): ProcessedAlertEvent[] {
    const alerts: ProcessedAlertEvent[] = [];

    // 1. Check SOS Trigger
    const sosAlert = this.sosProcessor.processSOS(event, device);
    if (sosAlert) {
      alerts.push(sosAlert);
    }

    // 2. Check Device Alarms (Tamper, Low Battery, etc.)
    const alarmAlert = this.alarmProcessor.processAlarm(event, device);
    if (alarmAlert && (!sosAlert || alarmAlert.alarmType !== sosAlert.alarmType)) {
      alerts.push(alarmAlert);
    }

    // 3. Evaluate Geofence Breaches (if coordinates are present)
    if (event.latitude != null && event.longitude != null) {
      const geofenceResults = this.geofenceEngine.evaluate(event.deviceId, event.latitude, event.longitude);

      for (const result of geofenceResults) {
        if (result.event === 'EXIT') {
          alerts.push({
            id: `alert_geo_exit_${event.deviceId}_${Date.now()}`,
            deviceId: event.deviceId,
            imei: event.imei || device?.imei,
            learnerId: device?.learnerId,
            schoolId: device?.schoolId,
            alarmType: 'GEOFENCE_EXIT',
            severity: 'WARNING',
            timestamp: event.timestamp,
            latitude: event.latitude,
            longitude: event.longitude,
            speed: event.speed,
            batteryLevel: event.batteryLevel,
            description: `Safe perimeter breach: device ${event.deviceId} exited geofence '${result.geofenceName}'`,
            acknowledged: false
          });
        } else if (result.event === 'ENTER') {
          alerts.push({
            id: `alert_geo_enter_${event.deviceId}_${Date.now()}`,
            deviceId: event.deviceId,
            imei: event.imei || device?.imei,
            learnerId: device?.learnerId,
            schoolId: device?.schoolId,
            alarmType: 'GEOFENCE_ENTER',
            severity: 'INFO',
            timestamp: event.timestamp,
            latitude: event.latitude,
            longitude: event.longitude,
            speed: event.speed,
            batteryLevel: event.batteryLevel,
            description: `Safe perimeter arrival: device ${event.deviceId} entered geofence '${result.geofenceName}'`,
            acknowledged: false
          });
        }
      }
    }

    return alerts;
  }
}
