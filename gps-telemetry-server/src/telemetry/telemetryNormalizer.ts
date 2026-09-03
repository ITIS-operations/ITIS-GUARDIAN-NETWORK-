import { DecodedPacketResult } from '../types/packet.js';
import { TelemetryEvent, AlarmClassification } from '../types/telemetry.js';
import { TelemetryValidator } from '../security/validation.js';

export class TelemetryNormalizer {
  /**
   * Normalizes a decoded packet into an authoritative TelemetryEvent.
   * Unsupported fields must remain undefined or null (strictly no fabricated values).
   * 
   * Supported fields:
   * - deviceId
   * - timestamp
   * - latitude
   * - longitude
   * - speed
   * - heading
   * - altitude
   * - accuracy
   * - batteryLevel
   * - signalLevel / gsmSignal
   * - networkStatus
   * - alarmType
   * - sosActive
   */
  public static normalize(
    decoded: DecodedPacketResult<any>,
    protocolName: string
  ): TelemetryEvent | null {
    if (!decoded.success || !decoded.deviceId) {
      return null;
    }

    const payload = (decoded.payload || {}) as Record<string, any>;
    
    // 1. Run strict validation
    const validationReport = TelemetryValidator.validateTelemetryData({
      latitude: payload.latitude,
      longitude: payload.longitude,
      timestamp: payload.timestamp,
      speed: payload.speed,
      heading: payload.heading,
      batteryLevel: payload.batteryLevel
    });

    // 2. Alarm and SOS Panic detection
    let alarmType: AlarmClassification | undefined = payload.alarmType;
    let sosActive = Boolean(payload.sosActive || alarmType === 'SOS_PANIC');
    if (sosActive && !alarmType) {
      alarmType = 'SOS_PANIC';
    }

    // 3. Signal & Network
    const rawSignal = payload.signalLevel ?? payload.gsmSignal;
    const signalLevel = TelemetryValidator.isValidSignalLevel(rawSignal) ? rawSignal : undefined;
    
    let networkStatus: 'ONLINE' | 'STANDBY' | 'ROAMING' | 'DISCONNECTED' | 'UNKNOWN' | undefined = undefined;
    if (typeof payload.networkStatus === 'string') {
      const netStr = payload.networkStatus.toUpperCase();
      if (['ONLINE', 'STANDBY', 'ROAMING', 'DISCONNECTED', 'UNKNOWN'].includes(netStr)) {
        networkStatus = netStr as any;
      }
    }

    // 4. Altitude & Accuracy (strictly do not fabricate)
    const altitude = typeof payload.altitude === 'number' && !isNaN(payload.altitude) ? payload.altitude : undefined;
    const accuracy = typeof payload.accuracy === 'number' && !isNaN(payload.accuracy) ? payload.accuracy : undefined;

    // 5. Validation status
    const validationStatus = validationReport.isValid
      ? (validationReport.warnings.length > 0 ? 'SANITIZED' : 'VALID')
      : 'INVALID';

    return {
      id: `evt_${decoded.deviceId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      deviceId: decoded.deviceId,
      imei: payload.imei || decoded.deviceId,
      protocol: protocolName,
      timestamp: validationReport.sanitizedTimestamp,
      latitude: validationReport.sanitizedLatitude,
      longitude: validationReport.sanitizedLongitude,
      speed: validationReport.sanitizedSpeed,
      heading: TelemetryValidator.isValidHeading(payload.heading) ? payload.heading : undefined,
      accuracy,
      altitude,
      batteryLevel: TelemetryValidator.isValidBatteryLevel(payload.batteryLevel) ? payload.batteryLevel : undefined,
      signalLevel,
      gsmSignal: signalLevel,
      networkStatus,
      ignitionStatus: typeof payload.ignitionStatus === 'boolean' ? payload.ignitionStatus : undefined,
      sosActive,
      alarmType,
      rawPacketReference: decoded.rawPacketRef,
      validationStatus,
      validationErrors: validationReport.errors.length > 0 ? validationReport.errors : undefined,
      metadata: payload.metadata
    };
  }
}

