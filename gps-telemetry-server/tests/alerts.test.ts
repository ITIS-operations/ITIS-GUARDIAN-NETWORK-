import { AlertEngine } from '../src/alerts/alertEngine.js';
import { GeofenceEngine } from '../src/geofence/geofenceEngine.js';
import { TelemetryEvent } from '../src/types/telemetry.js';
import { DeviceRecord } from '../src/types/device.js';

export async function testAlertsSuite(): Promise<boolean> {
  console.log('--- Running Alerts Test Suite ---');
  let passed = true;

  const geofenceEngine = new GeofenceEngine();
  const alertEngine = new AlertEngine(geofenceEngine);

  const device: DeviceRecord = {
    id: 'DEV-001',
    imei: '868120034567890',
    serialNumber: 'SN-001',
    protocol: 'TEST',
    learnerId: 'LEARNER-UUID-1234',
    schoolId: 'SCH-PTA-01',
    status: 'ONLINE',
    isActive: true,
    registeredAt: new Date(),
    updatedAt: new Date()
  };

  // Test 1: SOS Panic Trigger produces CRITICAL_SOS alert
  const sosEvent: TelemetryEvent = {
    id: 'evt_sos',
    deviceId: 'DEV-001',
    protocol: 'TEST',
    timestamp: new Date(),
    latitude: -25.7592,
    longitude: 28.2340,
    sosActive: true,
    alarmType: 'SOS_PANIC'
  };

  const alerts = alertEngine.evaluateAlerts(sosEvent, device);
  const sosAlert = alerts.find((a) => a.alarmType === 'SOS_PANIC');

  if (sosAlert && sosAlert.severity === 'CRITICAL_SOS' && sosAlert.learnerId === 'LEARNER-UUID-1234') {
    console.log('✓ Test 1: SOS trigger generated CRITICAL_SOS alert with learner linkage');
  } else {
    console.error('✗ Test 1: SOS alert generation failed', alerts);
    passed = false;
  }

  // Test 2: Low battery warning (<15%)
  const lowBatEvent: TelemetryEvent = {
    id: 'evt_bat',
    deviceId: 'DEV-001',
    protocol: 'TEST',
    timestamp: new Date(),
    batteryLevel: 10
  };

  const batAlerts = alertEngine.evaluateAlerts(lowBatEvent, device);
  const batAlert = batAlerts.find((a) => a.alarmType === 'LOW_BATTERY');

  if (batAlert && batAlert.severity === 'WARNING' && batAlert.batteryLevel === 10) {
    console.log('✓ Test 2: Low battery generated WARNING alert');
  } else {
    console.error('✗ Test 2: Low battery alert failed', batAlerts);
    passed = false;
  }

  return passed;
}
