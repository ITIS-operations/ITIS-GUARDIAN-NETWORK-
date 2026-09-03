import { ProtocolRegistry } from '../src/protocol/protocolRegistry.js';
import { DeviceAuthenticationService } from '../src/devices/deviceAuthentication.js';
import { DeviceRegistry } from '../src/devices/deviceRegistry.js';
import { MemoryDeviceRepository } from '../src/storage/deviceRepository.js';
import { DeviceSessionManager } from '../src/devices/deviceSession.js';
import { GuardianNotificationService } from '../src/notifications/guardianNotificationService.js';
import { EmergencyEventPipeline } from '../src/emergency/emergencyEventPipeline.js';
import { RawNetworkPacket } from '../src/types/packet.js';

export async function testEmergencyAcceptanceSuite(): Promise<boolean> {
  console.log('--- TEST SUITE: GPS Tracker SOS and Emergency Event Pipeline (8 Acceptance Tests) ---');
  let passedCount = 0;
  const totalCount = 8;

  try {
    // 1. Setup Shared Test Fixtures
    const protocolRegistry = new ProtocolRegistry();
    const deviceRepo = new MemoryDeviceRepository();
    await deviceRepo.init();

    const sessionManager = new DeviceSessionManager();
    const deviceRegistry = new DeviceRegistry(deviceRepo, sessionManager);
    const authService = new DeviceAuthenticationService(deviceRepo);
    const notificationService = new GuardianNotificationService();

    const emergencyPipeline = new EmergencyEventPipeline(
      protocolRegistry,
      authService,
      deviceRegistry,
      notificationService
    );

    // Register a valid active device linked to learner
    const REGISTERED_DEVICE_ID = 'DEV-SOS-001';
    const REGISTERED_LEARNER_ID = 'LRN-ALICE-7788';
    const SCHOOL_ID = 'SCH-PRETORIA-01';

    await deviceRegistry.registerDevice({
      id: REGISTERED_DEVICE_ID,
      imei: '868120034567899',
      serialNumber: 'SN-SOS-001',
      protocol: 'SIMULATED',
      status: 'STANDBY',
      learnerId: REGISTERED_LEARNER_ID,
      schoolId: SCHOOL_ID,
      isActive: true,
      registeredAt: new Date(),
      updatedAt: new Date()
    });

    let createdIncidentId = '';

    // ----------------------------------------------------
    // TEST 1: Valid SOS from registered device -> emergency event created
    // ----------------------------------------------------
    console.log('1. Valid SOS from registered device -> emergency event created');
    const validSosPacket: RawNetworkPacket = {
      id: 'pkt_sos_001',
      transport: 'HTTP',
      remoteAddress: '127.0.0.1',
      remotePort: 5050,
      data: Buffer.from(
        JSON.stringify({
          protocol: 'SIMULATED',
          deviceId: REGISTERED_DEVICE_ID,
          timestamp: new Date().toISOString(),
          latitude: -25.7592,
          longitude: 28.2340,
          speed: 0,
          heading: 180,
          accuracy: 4.5,
          batteryLevel: 88,
          sosActive: true,
          alarmType: 'SOS_PANIC'
        })
      ),
      receivedAt: new Date()
    };

    const res1 = await emergencyPipeline.processRawEmergencyPacket(validSosPacket);
    if (
      res1.success &&
      res1.status === 'CREATED' &&
      res1.emergencyEvent &&
      res1.emergencyEvent.emergencyType === 'SOS_PANIC' &&
      res1.incident &&
      res1.incident.status === 'ACTIVE_ALARM'
    ) {
      createdIncidentId = res1.incident.id;
      console.log(`   PASS: Emergency event ${res1.emergencyEvent.id} and Incident ${createdIncidentId} created.`);
      passedCount++;
    } else {
      console.error('   FAIL: Emergency event was not created for valid SOS packet.', res1);
    }

    // ----------------------------------------------------
    // TEST 2: Learner identified correctly
    // ----------------------------------------------------
    console.log('2. Learner identified correctly');
    if (
      res1.incident &&
      res1.incident.learnerId === REGISTERED_LEARNER_ID &&
      res1.emergencyEvent?.learnerId === REGISTERED_LEARNER_ID
    ) {
      console.log(`   PASS: Learner ID '${REGISTERED_LEARNER_ID}' successfully linked to SOS event.`);
      passedCount++;
    } else {
      console.error('   FAIL: Learner ID did not match registered learner.', res1.incident?.learnerId);
    }

    // ----------------------------------------------------
    // TEST 3: Incident enters Command Centre queue
    // ----------------------------------------------------
    console.log('3. Incident enters Command Centre queue');
    const unassignedQueue = emergencyPipeline.getUnassignedQueue();
    const queuedIncident = unassignedQueue.find((inc) => inc.id === createdIncidentId);

    if (
      queuedIncident &&
      queuedIncident.status === 'ACTIVE_ALARM' &&
      queuedIncident.primaryOfficerId === undefined
    ) {
      console.log(`   PASS: Incident ${createdIncidentId} is present in Unassigned Queue with status 'ACTIVE_ALARM'.`);
      passedCount++;
    } else {
      console.error('   FAIL: Incident not found in Unassigned Queue.', unassignedQueue);
    }

    // ----------------------------------------------------
    // TEST 4: Command officer claims incident
    // ----------------------------------------------------
    console.log('4. Command officer claims incident');
    const officer1 = { id: 'usr-off-001', name: 'Officer Sarah Khumalo', role: 'COMMAND_OPERATOR' };
    const claimedInc = emergencyPipeline.claimIncident(createdIncidentId, officer1);

    const unassignedAfterClaim = emergencyPipeline.getUnassignedQueue();
    const isNowAssigned = !unassignedAfterClaim.some((i) => i.id === createdIncidentId);

    if (
      claimedInc.primaryOfficerId === officer1.id &&
      claimedInc.primaryOfficerName === officer1.name &&
      isNowAssigned
    ) {
      console.log(`   PASS: Officer ${officer1.name} claimed incident; removed from Unassigned Queue.`);
      passedCount++;
    } else {
      console.error('   FAIL: Incident claiming failed.', claimedInc);
    }

    // ----------------------------------------------------
    // TEST 5: Repeated SOS packet -> no duplicate incident
    // ----------------------------------------------------
    console.log('5. Repeated SOS packet -> no duplicate incident');
    const repeatedSosPacket: RawNetworkPacket = {
      id: 'pkt_sos_002_retransmit',
      transport: 'HTTP',
      remoteAddress: '127.0.0.1',
      remotePort: 5050,
      data: Buffer.from(
        JSON.stringify({
          protocol: 'SIMULATED',
          deviceId: REGISTERED_DEVICE_ID,
          timestamp: new Date().toISOString(),
          latitude: -25.7594,
          longitude: 28.2345,
          speed: 1.2,
          heading: 185,
          accuracy: 3.8,
          batteryLevel: 87,
          sosActive: true,
          alarmType: 'SOS_PANIC'
        })
      ),
      receivedAt: new Date()
    };

    const res5 = await emergencyPipeline.processRawEmergencyPacket(repeatedSosPacket);
    const activeIncidentsAfterRetransmit = emergencyPipeline.getActiveIncidents();
    const incidentsForLearner = activeIncidentsAfterRetransmit.filter(
      (i) => i.learnerId === REGISTERED_LEARNER_ID
    );

    if (
      res5.success &&
      res5.isExistingIncidentUpdate &&
      res5.status === 'CORRELATED_UPDATE' &&
      res5.incident?.id === createdIncidentId &&
      incidentsForLearner.length === 1
    ) {
      console.log(`   PASS: Retransmitted SOS correlated to existing incident ${createdIncidentId} without duplicating.`);
      passedCount++;
    } else {
      console.error('   FAIL: Repeated SOS packet created a duplicate incident.', {
        res5,
        totalIncidentsForLearner: incidentsForLearner.length
      });
    }

    // ----------------------------------------------------
    // TEST 6: Unknown device SOS packet -> rejected safely
    // ----------------------------------------------------
    console.log('6. Unknown device SOS packet -> rejected safely');
    const unknownDevicePacket: RawNetworkPacket = {
      id: 'pkt_sos_unknown',
      transport: 'HTTP',
      remoteAddress: '192.168.1.99',
      remotePort: 5050,
      data: Buffer.from(
        JSON.stringify({
          protocol: 'SIMULATED',
          deviceId: 'DEV-UNKNOWN-999',
          timestamp: new Date().toISOString(),
          latitude: -25.7592,
          longitude: 28.2340,
          sosActive: true,
          alarmType: 'SOS_PANIC'
        })
      ),
      receivedAt: new Date()
    };

    const res6 = await emergencyPipeline.processRawEmergencyPacket(unknownDevicePacket);
    if (!res6.success && res6.status === 'REJECTED_UNKNOWN_DEVICE') {
      console.log(`   PASS: Unknown device rejected safely: ${res6.error}`);
      passedCount++;
    } else {
      console.error('   FAIL: Unknown device was not rejected.', res6);
    }

    // ----------------------------------------------------
    // TEST 7: Invalid packet -> no incident created
    // ----------------------------------------------------
    console.log('7. Invalid packet -> no incident created');
    const malformedPacket: RawNetworkPacket = {
      id: 'pkt_malformed',
      transport: 'TCP',
      remoteAddress: '127.0.0.1',
      remotePort: 5050,
      data: Buffer.from('NOT_A_VALID_PROTOCOL_PACKET_CORRUPTED_HEX_9999'),
      receivedAt: new Date()
    };

    const res7 = await emergencyPipeline.processRawEmergencyPacket(malformedPacket);
    if (!res7.success && res7.status === 'REJECTED_MALFORMED') {
      console.log(`   PASS: Malformed packet rejected safely: ${res7.error}`);
      passedCount++;
    } else {
      console.error('   FAIL: Malformed packet was not rejected.', res7);
    }

    // ----------------------------------------------------
    // TEST 8: Existing multi-officer workflow remains unchanged
    // ----------------------------------------------------
    console.log('8. Existing multi-officer workflow remains unchanged');
    // Test Handover, Monitoring, Dispatch, and Resolution
    const officer2 = { id: 'usr-off-002', name: 'Commander David Ndlovu', role: 'FOUNDER_EXECUTIVE' };
    
    // a. Handover
    const handoverInc = emergencyPipeline.handoverIncident(
      createdIncidentId,
      officer1,
      officer2,
      'Shift changeover and tactical tactical escalation'
    );
    const handoverOk = handoverInc.primaryOfficerId === officer2.id;

    // b. Observer Monitoring
    const monitoredInc = emergencyPipeline.joinMonitoring(createdIncidentId, officer1);
    const monitorOk = monitoredInc.monitoringOfficers.some((m) => m.userId === officer1.id);

    // c. Tactical Dispatch
    const responder = {
      id: 'resp-saps-01',
      name: 'SAPS Sunnyside Sector 2 Unit B',
      unitType: 'SAPS',
      vehicleId: 'SAPS-GP-9912',
      etaMinutes: 3
    };
    const dispatchedInc = emergencyPipeline.dispatchResponder(createdIncidentId, responder, officer2);
    const dispatchOk = dispatchedInc.status === 'DISPATCHED' && dispatchedInc.assignedResponder?.id === responder.id;

    // d. Incident Resolution
    const resolvedInc = emergencyPipeline.resolveIncident(
      createdIncidentId,
      officer2,
      'Learner secured by SAPS unit and handed to authorized parent.'
    );
    const resolveOk = resolvedInc.status === 'RESOLVED';

    if (handoverOk && monitorOk && dispatchOk && resolveOk) {
      console.log('   PASS: Multi-officer lifecycle (Handover, Monitoring, Dispatch, Resolution) functioning seamlessly.');
      passedCount++;
    } else {
      console.error('   FAIL: Multi-officer workflow failed.', {
        handoverOk,
        monitorOk,
        dispatchOk,
        resolveOk
      });
    }

  } catch (err: unknown) {
    console.error('Unhandled exception in Emergency Acceptance Suite:', err);
  }

  console.log(`\nResults: ${passedCount}/${totalCount} tests passed.`);
  return passedCount === totalCount;
}
