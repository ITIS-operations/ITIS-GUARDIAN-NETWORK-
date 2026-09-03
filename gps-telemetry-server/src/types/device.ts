/**
 * Device metadata, session, and authentication records.
 */

export type DeviceState = 'UNREGISTERED' | 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED' | 'LOST' | 'RETIRED' | 'FAULT';
export type DeviceConnectivityStatus = 'ONLINE' | 'STANDBY' | 'STALE' | 'OFFLINE' | 'DISCONNECTED' | 'DEGRADED' | 'TAMPERED';

export interface DeviceRecord {
  id: string;
  trackerDeviceId?: string;
  imei: string;
  serialNumber: string;
  protocol: string;
  model?: string;
  firmwareVersion?: string;
  learnerId?: string; // Optional linkage to ITIS Learner UUID
  schoolId?: string;
  deviceState?: DeviceState;
  status: DeviceConnectivityStatus;
  lastSeenAt?: Date;
  lastKnownLatitude?: number;
  lastKnownLongitude?: number;
  lastBatteryLevel?: number;
  lastGsmSignal?: number;
  isActive: boolean;
  registeredAt: Date;
  updatedAt: Date;
}

export interface DeviceSession {
  sessionId: string;
  deviceId: string;
  imei: string;
  protocol: string;
  remoteAddress: string;
  remotePort: number;
  connectedAt: Date;
  lastPacketAt: Date;
  packetCount: number;
  authenticated: boolean;
  socketRef?: unknown; // Socket reference handle
}

export interface DeviceAuthResult {
  allowed: boolean;
  reason?: string;
  device?: DeviceRecord;
}
