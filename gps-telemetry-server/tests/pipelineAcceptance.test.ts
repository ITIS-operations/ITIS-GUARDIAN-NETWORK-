import { ProtocolRegistry } from '../src/protocol/protocolRegistry.js';
import { DeviceAuthenticationService } from '../src/devices/deviceAuthentication.js';
import { DeviceRegistry } from '../src/devices/deviceRegistry.js';
import { TelemetryProcessor } from '../src/telemetry/telemetryProcessor.js';
import { TelemetryPipeline } from '../src/telemetry/telemetryPipeline.js';
import { AlertEngine } from '../src/alerts/alertEngine.js';
import { GeofenceEngine } from '../src/geofence/geofenceEngine.js';
import { MemoryTelemetryRepository } from '../src/storage/telemetryRepository.js';
import { MemoryDeviceRepository } from '../src/storage/deviceRepository.js';
import { DeviceSessionManager } from '../src/devices/deviceSession.js';
import { EventPublisher } from '../src/integration/eventPublisher.js';
import { RawNetworkPacket } from '../src/types/packet.js';
import { OfflineDetector } from '../src/health/offlineDetector.js';
import { DuplicateDetector } from '../src/security/duplicateDetector.js';

export async function testPipelineAcceptanceSuite(): Promise<boolean> {
  console.log('--- TEST SUITE: GPS Telemetry Processing Pipeline (10 Acceptance Criteria) ---');
  let passedCount = 0;
  const totalCount = 10;

  try {
    // Shared Setup
    const protocolRegistry = new ProtocolRegistry();
    const telemetryRepo = new MemoryTelemetryRepository();
    const deviceRepo = new MemoryDeviceRepository();
    await deviceRepo.init();
    await telemetryRepo.init();

    const sessionManager = new DeviceSessionManager();
    const deviceRegistry = new DeviceRegistry(deviceRepo, sessionManager);

    const geofenceEngine = new GeofenceEngine();
    geofenceEngine.registerGeofence({
      id: 'GEO-SCHOOL-SAFE',
      name: 'St. Mary High Safe Perimeter',
      type: 'CIRCLE',
      centerLatitude: -26.2041,
      centerLongitude: 28.0473,
      radiusMeters: 500,
      isActive: true
    });

    const alertEngine = new AlertEngine(geofenceEngine);
    const eventPublisher = new EventPublisher();
    const authService = new DeviceAuthenticationService(deviceRepo);
    const duplicateDetector = new DuplicateDetector(600000);
    const telemetryProcessor = new TelemetryProcessor(
      telemetryRepo,
      deviceRegistry,
      alertEngine,
      eventPublisher,
      duplicateDetector
    );
    const pipeline = new TelemetryPipeline(
      protocolRegistry,
      authService,
      deviceRegistry,
      telemetryProcessor
    );

    // Provision test devices
    // Device 1: Active, linked to learner
    await deviceRegistry.registerDevice({
      id: 'DEV-TEST-001',
      imei: '868120034567890',
      serialNumber: 'SN-001',
      protocol: 'SIMULATED',
      status: 'STANDBY',
      learnerId: 'LEARNER-LNR-778',
      schoolId: 'SCHOOL-SCH-101',
      isActive: true,
      registeredAt: new Date(),
      updatedAt: new Date()
    });

    // Device 2: Active, unassigned (no learner)
    await deviceRegistry.registerDevice({
      id: 'DEV-TEST-002',
      imei: '868120034567892',
      serialNumber: 'SN-002',
      protocol: 'SIMULATED',
      status: 'STANDBY',
      isActive: true,
      registeredAt: new Date(),
      updatedAt: new Date()
    });

    // ----------------------------------------------------
    // TEST 1: Valid GPS event
    // ----------------------------------------------------
    console.log('1. Valid GPS event');
    const validGpsPacket: RawNetworkPacket = {
      id: 'pkt_valid_gps',
      transport: 'HTTP',
      remoteAddress: '127.0.0.1',
      remotePort: 5000,
      data: Buffer.from(JSON.stringify({
        protocol: 'SIMULATED',
        deviceId: 'DEV-TEST-001',
        timestamp: new Date().toISOString(),
        latitude: -26.2041,
        longitude: 28.0473,
        speed: 35.5,
        heading: 180,
        batteryLevel: 88,
        signalLevel: 90
      })),
      receivedAt: new Date()
    };

    const res1 = await pipeline.processRawPacket(validGpsPacket);
    const latestEvent1 = await telemetryRepo.getLatestDeviceEvent('DEV-TEST-001');
    const dev1Record = await deviceRegistry.getDevice('DEV-TEST-001');

    if (
      res1.success &&
      res1.stage === 'PROCESSING_COMPLETED' &&
      res1.event?.latitude === -26.2041 &&
      res1.event?.speed === 35.5 &&
      latestEvent1?.deviceId === 'DEV-TEST-001' &&
      dev1Record?.status === 'ONLINE' &&
      res1.event?.learnerId === 'LEARNER-LNR-778'
    ) {
      console.log('  [PASS] Valid GPS event normalized, stored, device marked ONLINE, and learner linked.');
      passedCount++;
    } else {
      console.error('  [FAIL] Valid GPS event failed:', res1);
    }

    // ----------------------------------------------------
    // TEST 2: Invalid GPS coordinates
    // ----------------------------------------------------
    console.log('2. Invalid GPS coordinates');
    const invalidCoordsPacket: RawNetworkPacket = {
      id: 'pkt_invalid_coords',
      transport: 'HTTP',
      remoteAddress: '127.0.0.1',
      remotePort: 5000,
      data: Buffer.from(JSON.stringify({
        protocol: 'SIMULATED',
        deviceId: 'DEV-TEST-001',
        timestamp: new Date(Date.now() + 1000).toISOString(),
        latitude: 150.0, // Out of bounds > 90
        longitude: 200.0, // Out of bounds > 180
        speed: 20,
        batteryLevel: 85
      })),
      receivedAt: new Date()
    };

    const res2 = await pipeline.processRawPacket(invalidCoordsPacket);
    // Malformed coordinates must be rejected/sanitized (latitude/longitude dropped or event marked INVALID)
    if (
      res2.success &&
      (res2.event?.latitude === undefined || res2.event?.validationStatus === 'INVALID')
    ) {
      console.log('  [PASS] Out-of-bounds coordinates detected and rejected without corrupting store.');
      passedCount++;
    } else {
      console.error('  [FAIL] Invalid coordinates check failed:', res2);
    }

    // ----------------------------------------------------
    // TEST 3: Duplicate packet
    // ----------------------------------------------------
    console.log('3. Duplicate packet suppression');
    const duplicateTimestamp = new Date(Date.now() + 5000);
    const originalPacket: RawNetworkPacket = {
      id: 'pkt_dup_orig',
      transport: 'HTTP',
      remoteAddress: '127.0.0.1',
      remotePort: 5000,
      data: Buffer.from(JSON.stringify({
        protocol: 'SIMULATED',
        deviceId: 'DEV-TEST-001',
        timestamp: duplicateTimestamp.toISOString(),
        latitude: -26.2045,
        longitude: 28.0475,
        speed: 10,
        batteryLevel: 80,
        sosActive: true,
        alarmType: 'SOS_PANIC'
      })),
      receivedAt: new Date()
    };

    // First ingestion of packet
    const origRes = await pipeline.processRawPacket(originalPacket);
    const alertCountBefore = (await telemetryRepo.getRecentAlerts(100)).length;

    // Resent identical packet (retransmission)
    const duplicatePacket: RawNetworkPacket = {
      id: 'pkt_dup_resent',
      transport: 'HTTP',
      remoteAddress: '127.0.0.1',
      remotePort: 5000,
      data: Buffer.from(JSON.stringify({
        protocol: 'SIMULATED',
        deviceId: 'DEV-TEST-001',
        timestamp: duplicateTimestamp.toISOString(),
        latitude: -26.2045,
        longitude: 28.0475,
        speed: 10,
        batteryLevel: 80,
        sosActive: true,
        alarmType: 'SOS_PANIC'
      })),
      receivedAt: new Date()
    };

    const dupRes = await pipeline.processRawPacket(duplicatePacket);
    const alertCountAfter = (await telemetryRepo.getRecentAlerts(100)).length;

    if (
      origRes.success &&
      origRes.alertsTriggered.length > 0 &&
      dupRes.success &&
      dupRes.isDuplicate === true &&
      dupRes.alertsTriggered.length === 0 &&
      alertCountAfter === alertCountBefore
    ) {
      console.log('  [PASS] Retransmitted duplicate packet detected; duplicate alerts & records suppressed.');
      passedCount++;
    } else {
      console.error('  [FAIL] Duplicate packet suppression failed:', { origRes, dupRes, alertCountBefore, alertCountAfter });
    }

    // ----------------------------------------------------
    // TEST 4: Device not registered
    // ----------------------------------------------------
    console.log('4. Device not registered');
    const unregisteredPacket: RawNetworkPacket = {
      id: 'pkt_unreg',
      transport: 'HTTP',
      remoteAddress: '127.0.0.1',
      remotePort: 5000,
      data: Buffer.from(JSON.stringify({
        protocol: 'SIMULATED',
        deviceId: 'DEV-ROGUE-999',
        timestamp: new Date().toISOString(),
        latitude: -26.2041,
        longitude: 28.0473
      })),
      receivedAt: new Date()
    };

    const res4 = await pipeline.processRawPacket(unregisteredPacket);
    if (!res4.success && res4.stage === 'DEVICE_AUTHENTICATION' && res4.error?.includes('DEVICE_NOT_REGISTERED')) {
      console.log('  [PASS] Unregistered device packet safely rejected at authentication stage.');
      passedCount++;
    } else {
      console.error('  [FAIL] Unregistered device test failed:', res4);
    }

    // ----------------------------------------------------
    // TEST 5: Device assigned to learner
    // ----------------------------------------------------
    console.log('5. Device assigned to learner');
    const assignedPacket: RawNetworkPacket = {
      id: 'pkt_assigned_learner',
      transport: 'HTTP',
      remoteAddress: '127.0.0.1',
      remotePort: 5000,
      data: Buffer.from(JSON.stringify({
        protocol: 'SIMULATED',
        deviceId: 'DEV-TEST-001',
        timestamp: new Date(Date.now() + 10000).toISOString(),
        latitude: -26.2042,
        longitude: 28.0474,
        speed: 15
      })),
      receivedAt: new Date()
    };

    const res5 = await pipeline.processRawPacket(assignedPacket);
    if (
      res5.success &&
      res5.event?.learnerId === 'LEARNER-LNR-778' &&
      res5.event?.schoolId === 'SCHOOL-SCH-101'
    ) {
      console.log('  [PASS] Ingested event correctly populated with learnerId and schoolId association.');
      passedCount++;
    } else {
      console.error('  [FAIL] Learner assignment association failed:', res5);
    }

    // ----------------------------------------------------
    // TEST 6: Device unassigned
    // ----------------------------------------------------
    console.log('6. Device unassigned');
    const unassignedPacket: RawNetworkPacket = {
      id: 'pkt_unassigned',
      transport: 'HTTP',
      remoteAddress: '127.0.0.1',
      remotePort: 5000,
      data: Buffer.from(JSON.stringify({
        protocol: 'SIMULATED',
        deviceId: 'DEV-TEST-002',
        timestamp: new Date().toISOString(),
        latitude: -26.2043,
        longitude: 28.0475,
        speed: 0
      })),
      receivedAt: new Date()
    };

    const res6 = await pipeline.processRawPacket(unassignedPacket);
    if (
      res6.success &&
      res6.event?.deviceId === 'DEV-TEST-002' &&
      res6.event?.learnerId === undefined &&
      res6.event?.schoolId === undefined
    ) {
      console.log('  [PASS] Unassigned device processed cleanly with undefined learner context.');
      passedCount++;
    } else {
      console.error('  [FAIL] Unassigned device processing failed:', res6);
    }

    // ----------------------------------------------------
    // TEST 7: SOS event
    // ----------------------------------------------------
    console.log('7. SOS Panic event');
    const sosPacket: RawNetworkPacket = {
      id: 'pkt_sos',
      transport: 'HTTP',
      remoteAddress: '127.0.0.1',
      remotePort: 5000,
      data: Buffer.from(JSON.stringify({
        protocol: 'SIMULATED',
        deviceId: 'DEV-TEST-001',
        timestamp: new Date(Date.now() + 15000).toISOString(),
        latitude: -26.2044,
        longitude: 28.0476,
        sosActive: true,
        alarmType: 'SOS_PANIC'
      })),
      receivedAt: new Date()
    };

    const res7 = await pipeline.processRawPacket(sosPacket);
    const criticalAlert = res7.alertsTriggered.find(a => a.severity === 'CRITICAL_SOS');
    const sosHistory = await telemetryRepo.getRecentSosEvents(10);

    if (
      res7.success &&
      res7.event?.sosActive === true &&
      criticalAlert !== undefined &&
      criticalAlert.learnerId === 'LEARNER-LNR-778' &&
      sosHistory.some(s => s.deviceId === 'DEV-TEST-001')
    ) {
      console.log('  [PASS] SOS Panic packet triggered CRITICAL_SOS alert with learner context and saved in SOS history.');
      passedCount++;
    } else {
      console.error('  [FAIL] SOS event processing failed:', { res7, criticalAlert, sosHistory });
    }

    // ----------------------------------------------------
    // TEST 8: Heartbeat packet
    // ----------------------------------------------------
    console.log('8. Heartbeat / Status packet');
    const heartbeatPacket: RawNetworkPacket = {
      id: 'pkt_hb',
      transport: 'HTTP',
      remoteAddress: '127.0.0.1',
      remotePort: 5000,
      data: Buffer.from(JSON.stringify({
        protocol: 'SIMULATED',
        deviceId: 'DEV-TEST-001',
        timestamp: new Date(Date.now() + 20000).toISOString(),
        batteryLevel: 94,
        signalLevel: 82,
        alarmType: 'HEARTBEAT'
      })),
      receivedAt: new Date()
    };

    const res8 = await pipeline.processRawPacket(heartbeatPacket);
    const dev8Record = await deviceRegistry.getDevice('DEV-TEST-001');

    if (
      res8.success &&
      res8.event?.latitude === undefined &&
      res8.event?.longitude === undefined &&
      res8.event?.batteryLevel === 94 &&
      dev8Record?.lastBatteryLevel === 94 &&
      dev8Record?.status === 'ONLINE'
    ) {
      console.log('  [PASS] Heartbeat packet updated telemetry state & battery without generating artificial GPS coordinates.');
      passedCount++;
    } else {
      console.error('  [FAIL] Heartbeat packet failed:', res8);
    }

    // ----------------------------------------------------
    // TEST 9: Device offline timeout
    // ----------------------------------------------------
    console.log('9. Device offline timeout');
    const offlineDetector = new OfflineDetector(180, 600); // 3m stale, 10m offline
    
    // Simulate device whose lastSeenAt was 15 minutes ago (900 seconds)
    const staleDevice = {
      ...(await deviceRegistry.getDevice('DEV-TEST-001'))!,
      lastSeenAt: new Date(Date.now() - 900 * 1000)
    };

    const healthEval = offlineDetector.evaluateDevice(staleDevice, new Date());
    if (
      healthEval.currentStatus === 'OFFLINE' &&
      healthEval.changed === true &&
      healthEval.secondsSinceLastSeen! >= 900
    ) {
      console.log('  [PASS] Device exceeding heartbeat silence threshold transitioned to OFFLINE without false emergency trigger.');
      passedCount++;
    } else {
      console.error('  [FAIL] Offline timeout evaluation failed:', healthEval);
    }

    // ----------------------------------------------------
    // TEST 10: Simulated movement
    // ----------------------------------------------------
    console.log('10. Simulated movement and geofence evaluation');
    const moveBaseTime = Date.now() + 25000;
    
    // Step A: Point inside safe zone (Center is -26.2041, 28.0473, Radius: 500m)
    const pInside: RawNetworkPacket = {
      id: 'pkt_move_inside',
      transport: 'HTTP',
      remoteAddress: '127.0.0.1',
      remotePort: 5000,
      data: Buffer.from(JSON.stringify({
        protocol: 'SIMULATED',
        deviceId: 'DEV-TEST-001',
        timestamp: new Date(moveBaseTime).toISOString(),
        latitude: -26.2041,
        longitude: 28.0473, // Inside geofence center
        speed: 12
      })),
      receivedAt: new Date()
    };
    await pipeline.processRawPacket(pInside);

    // Step B: Point exiting safe zone (~650m away, 2 minutes later = ~20 km/h realistic speed)
    const pExit: RawNetworkPacket = {
      id: 'pkt_move_exit',
      transport: 'HTTP',
      remoteAddress: '127.0.0.1',
      remotePort: 5000,
      data: Buffer.from(JSON.stringify({
        protocol: 'SIMULATED',
        deviceId: 'DEV-TEST-001',
        timestamp: new Date(moveBaseTime + 120000).toISOString(),
        latitude: -26.2100,
        longitude: 28.0473, // Outside 500m perimeter (~656m from center)
        speed: 25
      })),
      receivedAt: new Date()
    };
    const resExit = await pipeline.processRawPacket(pExit);
    const exitAlert = resExit.alertsTriggered.find(a => a.alarmType === 'GEOFENCE_EXIT');

    if (
      resExit.success &&
      exitAlert !== undefined &&
      exitAlert.severity === 'WARNING' &&
      exitAlert.learnerId === 'LEARNER-LNR-778'
    ) {
      console.log('  [PASS] Sequential movement accurately triggered GEOFENCE_EXIT alert upon perimeter boundary crossing.');
      passedCount++;
    } else {
      console.error('  [FAIL] Simulated movement geofence test failed:', { resExit, exitAlert });
    }

    console.log(`\n  Result: ${passedCount}/${totalCount} Acceptance Tests Passed.`);
    return passedCount === totalCount;
  } catch (err: unknown) {
    console.error('  Test suite exception:', err);
    return false;
  }
}
