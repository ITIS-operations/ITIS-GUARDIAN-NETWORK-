import { TelemetryEvent, ProcessedAlertEvent } from '../types/telemetry.js';
import { DeviceRecord } from '../types/device.js';

export class AlarmProcessor {
  /**
   * Evaluates technical and telemetry alarms (low battery, power cut, tamper, speed limit).
   */
  public processAlarm(event: TelemetryEvent, device?: DeviceRecord | null): ProcessedAlertEvent | null {
    if (!event.alarmType || event.alarmType === 'ROUTINE_PING' || event.alarmType === 'HEARTBEAT' || event.alarmType === 'SOS_PANIC') {
      // Check for implicit low battery if not explicitly alarmed
      if (event.batteryLevel !== undefined && event.batteryLevel <= 15) {
        return {
          id: `alert_bat_${event.deviceId}_${Date.now()}`,
          deviceId: event.deviceId,
          imei: event.imei || device?.imei,
          learnerId: device?.learnerId,
          schoolId: device?.schoolId,
          alarmType: 'LOW_BATTERY',
          severity: event.batteryLevel <= 5 ? 'CRITICAL_SOS' : 'WARNING',
          timestamp: event.timestamp,
          latitude: event.latitude,
          longitude: event.longitude,
          speed: event.speed,
          batteryLevel: event.batteryLevel,
          description: `Device ${event.deviceId} reporting critical battery level: ${event.batteryLevel}%`,
          acknowledged: false
        };
      }
      return null;
    }

    let severity: 'INFO' | 'WARNING' | 'CRITICAL_SOS' = 'WARNING';
    let description = `Alarm ${event.alarmType} triggered by ${event.deviceId}`;

    switch (event.alarmType) {
      case 'LOW_BATTERY':
        severity = event.batteryLevel !== undefined && event.batteryLevel <= 5 ? 'CRITICAL_SOS' : 'WARNING';
        description = `Low battery alert (${event.batteryLevel ?? 'unknown'}%) on device ${event.deviceId}`;
        break;
      case 'TAMPER_SENSOR':
        severity = 'CRITICAL_SOS';
        description = `Tamper sensor trip detected on device ${event.deviceId}`;
        break;
      case 'POWER_CUT':
        severity = 'WARNING';
        description = `External power disconnected on device ${event.deviceId}`;
        break;
      case 'SPEED_EXCEEDED':
        severity = 'WARNING';
        description = `Speed limit exceeded (${event.speed ?? 'unknown'} km/h) by device ${event.deviceId}`;
        break;
      case 'FALL_DETECTED':
        severity = 'CRITICAL_SOS';
        description = `Impact / fall detected by device accelerometer on ${event.deviceId}`;
        break;
      default:
        severity = 'INFO';
        description = `Event ${event.alarmType} reported by device ${event.deviceId}`;
        break;
    }

    return {
      id: `alert_${event.alarmType.toLowerCase()}_${event.deviceId}_${Date.now()}`,
      deviceId: event.deviceId,
      imei: event.imei || device?.imei,
      learnerId: device?.learnerId,
      schoolId: device?.schoolId,
      alarmType: event.alarmType,
      severity,
      timestamp: event.timestamp,
      latitude: event.latitude,
      longitude: event.longitude,
      speed: event.speed,
      batteryLevel: event.batteryLevel,
      description,
      acknowledged: false
    };
  }
}
