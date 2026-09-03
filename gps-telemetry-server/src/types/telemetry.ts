/**
 * Normalized ITIS Telemetry Event and Alert Definitions.
 */

export type AlarmClassification =
  | 'SOS_PANIC'
  | 'LOW_BATTERY'
  | 'POWER_CUT'
  | 'TAMPER_SENSOR'
  | 'GEOFENCE_EXIT'
  | 'GEOFENCE_ENTER'
  | 'SPEED_EXCEEDED'
  | 'FALL_DETECTED'
  | 'HEARTBEAT'
  | 'ROUTINE_PING';

export interface TelemetryEvent {
  id: string;
  deviceId: string;
  imei?: string;
  protocol: string;
  timestamp: Date;
  latitude?: number;
  longitude?: number;
  speed?: number; // km/h
  heading?: number; // degrees 0-360
  accuracy?: number; // meters
  altitude?: number; // meters
  batteryLevel?: number; // percentage 0-100
  signalLevel?: number; // GSM signal level / percentage 0-100
  gsmSignal?: number; // alias for signalLevel
  networkStatus?: 'ONLINE' | 'STANDBY' | 'ROAMING' | 'DISCONNECTED' | 'UNKNOWN';
  ignitionStatus?: boolean;
  sosActive?: boolean;
  alarmType?: AlarmClassification;
  rawPacketReference?: string;
  learnerId?: string;
  schoolId?: string;
  learnerName?: string;
  validationStatus?: 'VALID' | 'SANITIZED' | 'INVALID';
  validationErrors?: string[];
  isDuplicate?: boolean;
  duplicateReason?: string;
  metadata?: Record<string, unknown>;
}

export interface GeofenceDefinition {
  id: string;
  schoolId?: string;
  name: string;
  type: 'CIRCLE' | 'POLYGON';
  centerLatitude?: number;
  centerLongitude?: number;
  radiusMeters?: number;
  polygonCoordinates?: Array<{ latitude: number; longitude: number }>;
  isActive: boolean;
}

export interface GeofenceEvaluationResult {
  geofenceId: string;
  geofenceName: string;
  isInside: boolean;
  event?: 'ENTER' | 'EXIT' | 'NONE';
  distanceToCenterMeters?: number;
}

export interface ProcessedAlertEvent {
  id: string;
  deviceId: string;
  imei?: string;
  learnerId?: string;
  schoolId?: string;
  alarmType: AlarmClassification;
  severity: 'INFO' | 'WARNING' | 'CRITICAL_SOS';
  timestamp: Date;
  latitude?: number;
  longitude?: number;
  speed?: number;
  batteryLevel?: number;
  description: string;
  acknowledged: boolean;
}
