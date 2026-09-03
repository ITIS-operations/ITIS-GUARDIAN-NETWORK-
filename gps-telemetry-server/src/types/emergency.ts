/**
 * ITIS GUARDIAN NETWORK — GPS TRACKER EMERGENCY & SOS DEFINITIONS
 */

export type EmergencyType =
  | 'SOS_PANIC'
  | 'MANUAL_BEACON'
  | 'GEOFENCE_BREACH'
  | 'FALL_DETECTED'
  | 'TAMPER_ALERT'
  | 'LOW_BATTERY_CRITICAL';

export type EmergencySeverity = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL_SOS';

export type EmergencyProcessingStatus =
  | 'CREATED'
  | 'CORRELATED_UPDATE'
  | 'REJECTED_UNKNOWN_DEVICE'
  | 'REJECTED_UNASSIGNED_LEARNER'
  | 'REJECTED_MALFORMED'
  | 'SUPPRESSED_DUPLICATE';

export interface EmergencyEvent {
  id: string;
  deviceId: string;
  imei?: string;
  learnerId?: string;
  learnerName?: string;
  schoolId?: string;
  schoolName?: string;
  guardianName?: string;
  guardianMobile?: string;
  emergencyType: EmergencyType;
  severity: EmergencySeverity;
  timestamp: Date;
  latitude?: number;
  longitude?: number;
  speed?: number;
  batteryLevel?: number;
  signalQuality?: number;
  status: EmergencyProcessingStatus;
  incidentId?: string;
  isExistingIncidentUpdate?: boolean;
  notes: string[];
  rawPacketRef?: string;
}

export interface GuardianNotificationPayload {
  notificationId: string;
  recipientMobile: string;
  recipientName: string;
  learnerId: string;
  learnerName: string;
  schoolName?: string;
  emergencyType: EmergencyType;
  timestamp: Date;
  latitude?: number;
  longitude?: number;
  batteryLevel?: number;
  mapTrackingUrl?: string;
  messageText: string;
}

export type NotificationProviderType =
  | 'SIMULATED_NOTIFICATION'
  | 'SMS_PROVIDER'
  | 'EMAIL_PROVIDER'
  | 'PUSH_PROVIDER';

export interface NotificationDeliveryResult {
  success: boolean;
  deliveryId: string;
  provider: NotificationProviderType;
  timestamp: Date;
  status: 'DELIVERED' | 'QUEUED' | 'FAILED';
  error?: string;
}
