import { TelemetryNormalizer } from '../src/telemetry/telemetryNormalizer.js';
import { TelemetryValidator } from '../src/security/validation.js';
import { LocationProcessor } from '../src/telemetry/locationProcessor.js';
import { DecodedPacketResult } from '../src/types/packet.js';
import { TelemetryEvent } from '../src/types/telemetry.js';

export async function testTelemetrySuite(): Promise<boolean> {
  console.log('--- Running Telemetry Test Suite ---');
  let passed = true;

  // Test 1: Normalizer mapping & boundary preservation
  const decodedResult: DecodedPacketResult<any> = {
    success: true,
    protocolName: 'TEST_PROTO',
    deviceId: 'DEV-SIM-001',
    rawPacketRef: 'ref_1',
    payload: {
      latitude: -25.7592,
      longitude: 28.2340,
      speed: 45.2,
      heading: 180,
      batteryLevel: 85,
      sosActive: false
    }
  };

  const event = TelemetryNormalizer.normalize(decodedResult, 'TEST_PROTO');
  if (
    event &&
    event.deviceId === 'DEV-SIM-001' &&
    event.latitude === -25.7592 &&
    event.speed === 45.2 &&
    event.batteryLevel === 85 &&
    event.sosActive === false
  ) {
    console.log('✓ Test 1: Telemetry event normalized accurately');
  } else {
    console.error('✗ Test 1: Normalized telemetry mismatch', event);
    passed = false;
  }

  // Test 2: Validation rejection of out-of-bounds coordinate
  const invalidLat = TelemetryValidator.isValidLatitude(120.5); // Lat cannot exceed 90
  const invalidLng = TelemetryValidator.isValidLongitude(-200.0); // Lng cannot exceed 180
  if (!invalidLat && !invalidLng) {
    console.log('✓ Test 2: Out-of-bounds coordinates successfully rejected');
  } else {
    console.error('✗ Test 2: Out-of-bounds coordinates accepted');
    passed = false;
  }

  // Test 3: LocationProcessor teleportation / impossible jump filter
  const locationProcessor = new LocationProcessor();
  const event1: TelemetryEvent = {
    id: 'evt_1',
    deviceId: 'DEV-SIM-001',
    protocol: 'TEST',
    timestamp: new Date(Date.now() - 60000), // 1 minute ago
    latitude: -25.7500,
    longitude: 28.2300
  };
  const event2Teleport: TelemetryEvent = {
    id: 'evt_2',
    deviceId: 'DEV-SIM-001',
    protocol: 'TEST',
    timestamp: new Date(),
    latitude: -33.9249, // Cape Town (~1300km away in 1 minute!)
    longitude: 18.4241
  };

  locationProcessor.sanitizeLocation(event1);
  const teleportCheck = locationProcessor.sanitizeLocation(event2Teleport);
  if (!teleportCheck.valid && teleportCheck.reason?.includes('IMPOSSIBLE_SPEED_ANOMALY')) {
    console.log('✓ Test 3: Impossible coordinate jump anomaly detected and dropped');
  } else {
    console.error('✗ Test 3: Teleport anomaly not caught', teleportCheck);
    passed = false;
  }

  return passed;
}
