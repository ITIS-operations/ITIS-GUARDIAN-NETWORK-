/**
 * ITIS GUARDIAN NETWORK — GT012 GPS TRACKER COMMUNICATION PROTOCOL
 * Core Type Definitions & Data Contracts
 */

export const GT012_START_BYTES = Buffer.from([0x78, 0x78]);
export const GT012_STOP_BYTES = Buffer.from([0x0D, 0x0A]);

export enum GT012ProtocolNumber {
  LOGIN_MESSAGE = 0x01,
  LOCATION_DATA = 0x12,
  STATUS_HEARTBEAT = 0x13,
  STRING_INFORMATION = 0x15,
  ALARM_DATA = 0x16,
  GPS_ADDRESS_QUERY = 0x1A,
  SERVER_COMMAND = 0x80
}

export type GT012DeviceHealthStatus = 
  | 'ONLINE' 
  | 'OFFLINE' 
  | 'LOW_BATTERY' 
  | 'POOR_SIGNAL' 
  | 'UNKNOWN';

export type GT012AlarmClassification = 
  | 'DEVICE_HEALTH_ALERT' 
  | 'SAFETY_ALERT' 
  | 'EMERGENCY_CANDIDATE' 
  | 'CRITICAL_EMERGENCY';

export type GT012AlarmType = 
  | 'SOS_PANIC' 
  | 'LOW_BATTERY_WARNING' 
  | 'GEOFENCE_EXIT' 
  | 'GEOFENCE_ENTER' 
  | 'POWER_CUT' 
  | 'VIBRATION_SHOCK' 
  | 'TAMPER_SENSOR' 
  | 'OVERSPEED' 
  | 'NORMAL_STATUS';

export interface GT012PacketHeader {
  startBytes: number[];
  length: number;
  protocolNumber: GT012ProtocolNumber;
  serialNumber: number;
  crc: number;
  isValidCrc: boolean;
  rawBuffer: Buffer;
}

export interface GT012LoginPacket extends GT012PacketHeader {
  protocolNumber: GT012ProtocolNumber.LOGIN_MESSAGE;
  terminalIdentifier: string; // 15-16 digit IMEI
  imeiBcd: string;
}

export interface GT012LocationPacket extends GT012PacketHeader {
  protocolNumber: GT012ProtocolNumber.LOCATION_DATA;
  timestamp: string; // ISO 8601 UTC
  satelliteCount: number;
  latitude: number; // Decimal degrees
  longitude: number; // Decimal degrees
  speedKmh: number;
  courseDegrees: number;
  gpsValid: boolean;
  isRealTime: boolean;
  isDifferentialGps: boolean;
  isPositioned: boolean;
  isWestLongitude: boolean;
  isSouthLatitude: boolean;
  mcc: number; // Mobile Country Code (e.g. 655 for South Africa)
  mnc: number; // Mobile Network Code (e.g. 01 for Vodacom, 10 for MTN)
  lac: number; // Location Area Code
  cellId: number; // Cell Tower ID
}

export interface GT012HeartbeatPacket extends GT012PacketHeader {
  protocolNumber: GT012ProtocolNumber.STATUS_HEARTBEAT;
  terminalStatus: {
    defenseActive: boolean;
    accHigh: boolean;
    charging: boolean;
    gpsTrackingOn: boolean;
    alarmState: string;
  };
  voltageLevel: number; // Raw level 0-6 (0=No power, 6=Full)
  batteryPercentage: number; // 0-100%
  gsmSignalStrength: number; // CSQ 0-31 or dBm
  gsmSignalDbm: number;
  alarmLanguage: string;
}

export interface GT012AlarmPacket extends GT012PacketHeader {
  protocolNumber: GT012ProtocolNumber.ALARM_DATA;
  timestamp: string;
  satelliteCount: number;
  latitude: number;
  longitude: number;
  speedKmh: number;
  courseDegrees: number;
  gpsValid: boolean;
  mcc: number;
  mnc: number;
  lac: number;
  cellId: number;
  terminalStatus: {
    defenseActive: boolean;
    accHigh: boolean;
    charging: boolean;
    gpsTrackingOn: boolean;
  };
  voltageLevel: number;
  batteryPercentage: number;
  gsmSignalDbm: number;
  alarmCode: number;
  alarmType: GT012AlarmType;
  alarmClassification: GT012AlarmClassification;
  requiresIncidentEscalation: boolean;
}

export interface GT012CommandPacket extends GT012PacketHeader {
  protocolNumber: GT012ProtocolNumber.SERVER_COMMAND;
  commandContent: string;
}

export type GT012ParsedPacket = 
  | GT012LoginPacket 
  | GT012LocationPacket 
  | GT012HeartbeatPacket 
  | GT012AlarmPacket 
  | GT012CommandPacket;

// Telemetry state record for device persistence
export interface GT012DeviceTelemetryRecord {
  id: string;
  deviceId: string;
  terminalIdentifier: string; // IMEI
  timestamp: string;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  batteryLevel: number;
  voltage: number;
  gsmSignal: number;
  gpsValidity: boolean;
  satelliteCount: number;
  mcc?: number;
  mnc?: number;
  lac?: number;
  cellId?: number;
  source: 'GT012_GPS' | 'GT012_ALARM' | 'GT012_HEARTBEAT' | 'SIMULATED_GT012';
  isSimulated?: boolean;
}

export interface GT012DeviceHealthRecord {
  deviceId: string;
  terminalIdentifier: string;
  lastHeartbeatAt: string;
  lastLocationAt: string;
  connectivityStatus: GT012DeviceHealthStatus;
  batteryStatus: 'NORMAL' | 'LOW' | 'CRITICAL' | 'CHARGING';
  batteryPercentage: number;
  signalStatus: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'NO_SIGNAL';
  signalDbm: number;
  defenseStatus: 'ARMED' | 'DISARMED';
}

export interface GT012IngestResult {
  success: boolean;
  packetType: string;
  terminalIdentifier?: string;
  deviceId?: string;
  assignedLearnerId?: string;
  assignedLearnerName?: string;
  responseBuffer?: Buffer;
  telemetry?: Partial<GT012DeviceTelemetryRecord>;
  health?: Partial<GT012DeviceHealthRecord>;
  alarmClassification?: GT012AlarmClassification;
  incidentCreated?: boolean;
  incidentId?: string;
  auditEventId?: string;
  error?: string;
}
