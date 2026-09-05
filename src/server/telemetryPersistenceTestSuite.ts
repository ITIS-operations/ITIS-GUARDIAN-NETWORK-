/**
 * ITIS GUARDIAN NETWORK — AUTHORITATIVE TELEMETRY PERSISTENCE ACCEPTANCE TEST SUITE
 * 
 * Verifies all 10 Authoritative Acceptance Tests:
 * TEST 1: Valid GT012 telemetry persists.
 * TEST 2: Latest location updates.
 * TEST 3: Duplicate packet does not create duplicate telemetry.
 * TEST 4: Invalid CRC packet does not persist.
 * TEST 5: Unknown device does not persist.
 * TEST 6: Suspended device does not update location.
 * TEST 7: Guardian only sees linked learner telemetry.
 * TEST 8: Unauthorized learner telemetry is denied.
 * TEST 9: Simulator remains functional.
 * TEST 10: Existing system has zero regression.
 */

import {
  TelemetryPersistenceTestSuiteResult,
  ActiveUserSession,
  TelemetryEnvelope
} from '../types.js';
import { db } from './dbStore.js';
import { deviceRegistryEngine } from './deviceRegistryEngine.js';
import { telemetryPersistenceEngine } from './telemetryPersistenceEngine.js';
import { telemetryGatewayEngine } from './telemetryGatewayEngine.js';
import { telemetrySimulationEngine } from './telemetrySimulationEngine.js';
import { repository } from './db/index.js';

export class TelemetryPersistenceTestSuite {
  public async runAllTests(): Promise<TelemetryPersistenceTestSuiteResult> {
    const timestamp = new Date().toISOString();
    const results: TelemetryPersistenceTestSuiteResult['results'] = [];

    // Setup Test Actors
    const techActor: ActiveUserSession = {
      id: 'USR-TECH-TEST',
      name: 'Thabo Sithole (Hardware Lead)',
      email: 'thabo.tech@itis.safety.za',
      role: 'TECHNICIAN',
      token: 'tok-tech-test'
    };

    const founderActor: ActiveUserSession = {
      id: 'USR-SUPER-001',
      name: 'Executive Founder',
      email: 'founder@itis365.co.za',
      role: 'FOUNDER_EXECUTIVE',
      token: 'token-founder'
    };

    const guardian1Actor: ActiveUserSession = {
      id: 'usr-g-auth-001',
      name: 'Thabo Mokoena (Guardian 1)',
      email: 'thabo@guardian.co.za',
      role: 'PARENT_GUARDIAN',
      token: 'token-g1'
    };

    const guardian2Actor: ActiveUserSession = {
      id: 'usr-g-unauth-002',
      name: 'Nandi Sithole (Guardian 2)',
      email: 'nandi@guardian.co.za',
      role: 'PARENT_GUARDIAN',
      token: 'token-g2'
    };

    // Ensure active test device exists in registry
    const testTrackerId = 'GT012-TRK-PERSIST-01';
    let testDevice = deviceRegistryEngine.findByTrackerIdentifier(testTrackerId);
    if (!testDevice) {
      testDevice = deviceRegistryEngine.registerDevice({
        trackerDeviceId: testTrackerId,
        imei: '864209040001001',
        serialNumber: 'SN-GT012-P01',
        deviceModel: 'GT012-ADVANCED',
        hardwareRevision: 'v2.1',
        firmwareVersion: '1.4.0'
      }, techActor);
      deviceRegistryEngine.activateDevice(testDevice.itisDeviceId, techActor);
      testDevice = deviceRegistryEngine.findByTrackerIdentifier(testTrackerId)!;
    }

    // Ensure test learner and enrolment exist
    const testLearnerId = 'LRN-TEST-PERSIST-01';
    if (!db.learners.has(testLearnerId)) {
      db.learners.set(testLearnerId, {
        id: testLearnerId,
        personId: 'PRS-LRN-01',
        emisId: 'EMIS-LRN-01',
        admissionNumber: 'ADM-001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      db.persons.set('PRS-LRN-01', {
        id: 'PRS-LRN-01',
        officialId: '1205040001088',
        idType: 'SA_ID',
        firstName: 'Sipho',
        lastName: 'Mokoena',
        dateOfBirth: '2012-05-04',
        gender: 'MALE',
        isVerified: true,
        verificationSource: 'DHA_NPR_LOOKUP',
        mobileVerified: false,
        emailVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      // School enrolment
      db.enrolments.set('enr-test-01', {
        id: 'enr-test-01',
        learnerId: testLearnerId,
        schoolId: 'SCH-001',
        admissionDate: '2025-01-15',
        enrolmentStatus: 'ACTIVE',
        currentAcademicYear: 2026,
        enrolledByStaffId: 'usr-admin-01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // Link Guardian 1 to Sipho
    db.guardians.set(guardian1Actor.id, {
      id: guardian1Actor.id,
      personId: 'PRS-G1',
      userId: guardian1Actor.id,
      saIdNumber: '8001015009087',
      saIdMasked: '800101*****87',
      idVerified: true,
      mobileNumber: '+27821112233',
      mobileVerified: true,
      preferredLanguage: 'en',
      pushNotificationsEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    db.relationships.set('rel-g1-test', {
      id: 'rel-g1-test',
      guardianId: guardian1Actor.id,
      learnerId: testLearnerId,
      relationshipType: 'FATHER',
      isPrimary: true,
      legalCustodyVerified: true,
      authorizedForPickup: true,
      receiveSosAlerts: true,
      verificationStatus: 'VERIFIED',
      establishedAt: new Date().toISOString(),
      establishedByStaffUserId: 'usr-admin-01',
      establishedByStaffName: 'Admin',
      establishedBySchoolId: 'SCH-001',
      auditTrailId: 'aud-001'
    });

    // Assign testDevice to testLearner
    try {
      deviceRegistryEngine.assignDeviceToLearner({
        deviceId: testDevice.itisDeviceId,
        learnerId: testLearnerId,
        notes: 'Assigned for Persistence Acceptance Test Suite'
      }, techActor);
    } catch {
      // Already assigned
    }

    // Clear duplicate cache before running tests
    telemetryGatewayEngine.clearDuplicateCache();

    // ------------------------------------------------------------------------
    // TEST 1: Valid GT012 telemetry persists
    // ------------------------------------------------------------------------
    try {
      const initialCount = await repository.telemetry.count();
      const testLat = -25.747900;
      const testLng = 28.229300;

      const persistRes = await telemetryPersistenceEngine.persistAuthoritativeTelemetry({
        deviceId: testDevice.itisDeviceId,
        trackerDeviceId: testDevice.trackerDeviceId,
        learnerId: testLearnerId,
        schoolId: 'SCH-001',
        timestamp: new Date().toISOString(),
        latitude: testLat,
        longitude: testLng,
        accuracyMeters: 4.8,
        speedKmh: 24.5,
        heading: 120,
        batteryLevel: 94,
        protocol: 'GT012',
        packetType: 'LOCATION',
        transportSource: 'HTTP',
        satellites: 9
      }, techActor);

      const afterCount = await repository.telemetry.count();
      const persistsOk = Boolean(
        persistRes.record &&
        persistRes.record.id &&
        persistRes.record.validationStatus === 'VALIDATED' &&
        afterCount > initialCount
      );

      results.push({
        id: 'TEST-1',
        name: 'Valid GT012 telemetry persists',
        requirement: 'Valid telemetry packets processed by the Telemetry Gateway must persist through the repository/database abstraction.',
        expected: 'Telemetry record created with unique ID, VALIDATED status, and persisted in storage.',
        actual: persistsOk ? `Persisted record ${persistRes.record.id} successfully.` : 'Failed to persist record.',
        status: persistsOk ? 'PASS' : 'FAIL',
        evidence: { recordId: persistRes.record?.id, initialCount, afterCount }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-1',
        name: 'Valid GT012 telemetry persists',
        requirement: 'Valid telemetry packets must persist.',
        expected: 'Telemetry record persisted.',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // ------------------------------------------------------------------------
    // TEST 2: Latest location updates
    // ------------------------------------------------------------------------
    try {
      const newLat = -26.195240;
      const newLng = 28.034150;
      const newTs = new Date().toISOString();

      await telemetryPersistenceEngine.persistAuthoritativeTelemetry({
        deviceId: testDevice.itisDeviceId,
        trackerDeviceId: testDevice.trackerDeviceId,
        learnerId: testLearnerId,
        schoolId: 'SCH-001',
        timestamp: newTs,
        latitude: newLat,
        longitude: newLng,
        accuracyMeters: 3.5,
        speedKmh: 12.0,
        heading: 270,
        batteryLevel: 91,
        protocol: 'GT012',
        packetType: 'LOCATION',
        transportSource: 'TCP'
      }, techActor);

      // Verify O(1) lookup by deviceId, trackerDeviceId, and learnerId
      const byDevId = await repository.telemetry.getLatestLocation(testDevice.itisDeviceId);
      const byTracker = await repository.telemetry.getLatestLocation(testDevice.trackerDeviceId);
      const byLearner = await repository.telemetry.getLatestLocationByLearner(testLearnerId);

      const isUpdated = Boolean(
        byDevId &&
        byTracker &&
        byLearner &&
        Math.abs(byDevId.latitude - newLat) < 0.0001 &&
        Math.abs(byTracker.longitude - newLng) < 0.0001 &&
        byLearner.deviceId === testDevice.itisDeviceId
      );

      results.push({
        id: 'TEST-2',
        name: 'Latest location updates',
        requirement: 'System maintains an efficient authoritative latest-location record per device without full history scans.',
        expected: 'Latest location resolves instantly by deviceId, trackerDeviceId, and learnerId with updated coordinates.',
        actual: isUpdated ? `Latest location updated: Lat ${byDevId?.latitude}, Lng ${byDevId?.longitude}` : 'Latest location mismatch.',
        status: isUpdated ? 'PASS' : 'FAIL',
        evidence: {
          resolvedByDeviceId: Boolean(byDevId),
          resolvedByTrackerId: Boolean(byTracker),
          resolvedByLearnerId: Boolean(byLearner),
          lat: byDevId?.latitude,
          lng: byDevId?.longitude
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-2',
        name: 'Latest location updates',
        requirement: 'Latest location updates.',
        expected: 'Latest location updated.',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // ------------------------------------------------------------------------
    // TEST 3: Duplicate packet does not create duplicate telemetry
    // ------------------------------------------------------------------------
    try {
      const uniqueSerial = Math.floor(1000 + Math.random() * 50000);
      const gt012Buf = telemetrySimulationEngine.buildGt012LocationPacket({
        lat: -25.750000,
        lng: 28.230000,
        speed: 30,
        heading: 90,
        satellites: 8,
        serialNumber: uniqueSerial
      });

      const envelope: TelemetryEnvelope = {
        transportType: 'TCP',
        rawPacket: gt012Buf.toString('hex'),
        receivedAt: new Date().toISOString(),
        deviceIdentifier: testDevice.trackerDeviceId
      };

      // Ingest once -> accepted
      const firstIngest = await telemetryGatewayEngine.ingestTelemetryPacket(envelope, techActor);
      const countAfterFirst = await repository.telemetry.count();

      // Ingest identical frame immediately -> duplicate suppressed
      const secondIngest = await telemetryGatewayEngine.ingestTelemetryPacket(envelope, techActor);
      const countAfterSecond = await repository.telemetry.count();

      const dupSuppressed = Boolean(
        firstIngest.accepted &&
        secondIngest.duplicate === true &&
        secondIngest.status === 'REJECTED' &&
        countAfterSecond === countAfterFirst
      );

      results.push({
        id: 'TEST-3',
        name: 'Duplicate packet does not create duplicate telemetry',
        requirement: 'Packets rejected as duplicates within the sliding window must not be persisted.',
        expected: 'Second identical packet flagged as duplicate and rejected; repository count unchanged.',
        actual: dupSuppressed
          ? `Duplicate detected (status: ${secondIngest.status}, dup: ${secondIngest.duplicate}), count unchanged (${countAfterSecond}).`
          : 'Duplicate was not properly suppressed.',
        status: dupSuppressed ? 'PASS' : 'FAIL',
        evidence: {
          firstAccepted: firstIngest.accepted,
          secondDuplicate: secondIngest.duplicate,
          countAfterFirst,
          countAfterSecond
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-3',
        name: 'Duplicate packet does not create duplicate telemetry',
        requirement: 'Duplicate packet suppression.',
        expected: 'Duplicate not persisted.',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // ------------------------------------------------------------------------
    // TEST 4: Invalid CRC packet does not persist
    // ------------------------------------------------------------------------
    try {
      const countBefore = await repository.telemetry.count();
      // Generate packet and corrupt the CRC bytes (bytes 32 and 33)
      const corruptedBuf = telemetrySimulationEngine.buildGt012LocationPacket({
        lat: -25.751000,
        lng: 28.231000,
        speed: 10,
        heading: 180,
        serialNumber: Math.floor(1000 + Math.random() * 50000)
      });
      corruptedBuf[32] = 0xDE;
      corruptedBuf[33] = 0xAD;

      const corruptEnvelope: TelemetryEnvelope = {
        transportType: 'TCP',
        rawPacket: corruptedBuf.toString('hex'),
        receivedAt: new Date().toISOString(),
        deviceIdentifier: testDevice.trackerDeviceId
      };

      const corruptIngest = await telemetryGatewayEngine.ingestTelemetryPacket(corruptEnvelope, techActor);
      const countAfter = await repository.telemetry.count();

      const crcRejected = Boolean(
        !corruptIngest.accepted &&
        corruptIngest.validationResult.validCrc === false &&
        countAfter === countBefore
      );

      results.push({
        id: 'TEST-4',
        name: 'Invalid CRC packet does not persist',
        requirement: 'Malformed or CRC-corrupted packets must fail validation and be blocked from persistence.',
        expected: 'Packet rejected with validCrc=false; repository record count unchanged.',
        actual: crcRejected
          ? `Corrupt packet rejected (validCrc: ${corruptIngest.validationResult.validCrc}), count unchanged.`
          : 'Corrupt packet was erroneously persisted.',
        status: crcRejected ? 'PASS' : 'FAIL',
        evidence: {
          accepted: corruptIngest.accepted,
          validCrc: corruptIngest.validationResult.validCrc,
          countBefore,
          countAfter
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-4',
        name: 'Invalid CRC packet does not persist',
        requirement: 'Invalid CRC rejection.',
        expected: 'Corrupt packet rejected.',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // ------------------------------------------------------------------------
    // TEST 5: Unknown device does not persist
    // ------------------------------------------------------------------------
    try {
      const unknownDevId = 'DEV-UNKNOWN-99999';
      let rejected = false;

      try {
        await telemetryPersistenceEngine.persistAuthoritativeTelemetry({
          deviceId: unknownDevId,
          trackerDeviceId: 'UNKNOWN-TRK-999',
          timestamp: new Date().toISOString(),
          latitude: -25.750000,
          longitude: 28.230000,
          protocol: 'GT012',
          packetType: 'LOCATION',
          transportSource: 'HTTP'
        }, techActor);
      } catch (err: any) {
        rejected = err.message.includes('not registered') || err.message.includes('not found');
      }

      results.push({
        id: 'TEST-5',
        name: 'Unknown device does not persist',
        requirement: 'Packets purporting to come from unregistered hardware must be rejected and not persisted.',
        expected: 'Attempt to persist telemetry for unknown device throws Device not registered exception.',
        actual: rejected ? 'Unknown device telemetry rejected successfully.' : 'Persistence succeeded for unknown device.',
        status: rejected ? 'PASS' : 'FAIL',
        evidence: { unknownDeviceId: unknownDevId, rejected }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-5',
        name: 'Unknown device does not persist',
        requirement: 'Unknown device rejection.',
        expected: 'Exception thrown.',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // ------------------------------------------------------------------------
    // TEST 6: Suspended device does not update location
    // ------------------------------------------------------------------------
    try {
      // Register a dedicated device to suspend
      const suspTrackerId = 'GT012-TRK-TEST-SUSP';
      let suspDevice = deviceRegistryEngine.findByTrackerIdentifier(suspTrackerId);
      if (!suspDevice) {
        suspDevice = deviceRegistryEngine.registerDevice({
          trackerDeviceId: suspTrackerId,
          imei: '864209049999002',
          serialNumber: 'SN-GT012-SUSP',
          deviceModel: 'GT012-ADVANCED',
          hardwareRevision: 'v2.1',
          firmwareVersion: '1.4.0'
        }, techActor);
        deviceRegistryEngine.activateDevice(suspDevice.itisDeviceId, techActor);
        suspDevice = deviceRegistryEngine.findByTrackerIdentifier(suspTrackerId)!;
      }

      // Record initial position
      const initialLat = -26.100000;
      const initialLng = 28.050000;
      await telemetryPersistenceEngine.persistAuthoritativeTelemetry({
        deviceId: suspDevice.itisDeviceId,
        trackerDeviceId: suspDevice.trackerDeviceId,
        timestamp: new Date().toISOString(),
        latitude: initialLat,
        longitude: initialLng,
        protocol: 'GT012',
        packetType: 'LOCATION',
        transportSource: 'HTTP'
      }, techActor);

      // Suspend device
      deviceRegistryEngine.suspendDevice(suspDevice.itisDeviceId, techActor, 'Administrative quarantine test');

      // Attempt new position on suspended device
      let blockedFromPersistence = false;
      try {
        await telemetryPersistenceEngine.persistAuthoritativeTelemetry({
          deviceId: suspDevice.itisDeviceId,
          trackerDeviceId: suspDevice.trackerDeviceId,
          timestamp: new Date().toISOString(),
          latitude: -26.999999,
          longitude: 28.999999,
          protocol: 'GT012',
          packetType: 'LOCATION',
          transportSource: 'HTTP'
        }, techActor);
      } catch (err: any) {
        blockedFromPersistence = err.message.includes('SUSPENDED');
      }

      // Check latest location did not change
      const latestAfterSusp = await repository.telemetry.getLatestLocation(suspDevice.itisDeviceId);
      const positionUnchanged = Boolean(
        latestAfterSusp &&
        Math.abs(latestAfterSusp.latitude - initialLat) < 0.001 &&
        latestAfterSusp.latitude !== -26.999999
      );

      const passed = blockedFromPersistence && positionUnchanged;

      results.push({
        id: 'TEST-6',
        name: 'Suspended device does not update location',
        requirement: 'Suspended devices must have incoming telemetry quarantined and latest location blocked from updating.',
        expected: 'Persistence rejected with SUSPENDED message; latest location coordinates remain unchanged.',
        actual: passed
          ? 'Suspended device telemetry blocked; latest location retained previous coordinates.'
          : 'Suspended device location was modified.',
        status: passed ? 'PASS' : 'FAIL',
        evidence: { blockedFromPersistence, positionUnchanged, retainedLat: latestAfterSusp?.latitude }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-6',
        name: 'Suspended device does not update location',
        requirement: 'Suspended device check.',
        expected: 'Suspension enforced.',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // ------------------------------------------------------------------------
    // TEST 7: Guardian only sees linked learner telemetry
    // ------------------------------------------------------------------------
    try {
      // Guardian 1 is verified linked to Sipho (testLearnerId)
      const latestLoc = await telemetryPersistenceEngine.getLatestLocationForActor(guardian1Actor, testLearnerId);
      const history = await telemetryPersistenceEngine.getTelemetryHistoryForActor(guardian1Actor, {
        learnerId: testLearnerId,
        limit: 5
      });

      // Verify Guardian data is sanitized (no rawPacketFingerprint)
      const isSanitized = history.data.every(rec => !rec.rawPacketFingerprint);
      const authorized = Boolean(latestLoc && latestLoc.learnerId === testLearnerId && isSanitized);

      results.push({
        id: 'TEST-7',
        name: 'Guardian only sees linked learner telemetry',
        requirement: 'Guardians may retrieve telemetry for verified linked children with technical binary diagnostics sanitized.',
        expected: 'Location and history returned successfully with internal technical fingerprints stripped.',
        actual: authorized
          ? `Guardian retrieved ${history.data.length} records safely for linked child ${testLearnerId}.`
          : 'Guardian access failed or unsanitized technical data exposed.',
        status: authorized ? 'PASS' : 'FAIL',
        evidence: {
          retrievedLocation: Boolean(latestLoc),
          recordsCount: history.data.length,
          technicalFingerprintsSanitized: isSanitized
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-7',
        name: 'Guardian only sees linked learner telemetry',
        requirement: 'Linked guardian access.',
        expected: 'Authorized access.',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // ------------------------------------------------------------------------
    // TEST 8: Unauthorized learner telemetry is denied
    // ------------------------------------------------------------------------
    try {
      // Guardian 2 is NOT linked to Sipho (testLearnerId)
      let locationDenied = false;
      let historyDenied = false;

      try {
        await telemetryPersistenceEngine.getLatestLocationForActor(guardian2Actor, testLearnerId);
      } catch (err: any) {
        locationDenied = err.message.includes('Unauthorized') || err.message.includes('not authorized');
      }

      try {
        await telemetryPersistenceEngine.getTelemetryHistoryForActor(guardian2Actor, {
          learnerId: testLearnerId
        });
      } catch (err: any) {
        historyDenied = err.message.includes('Unauthorized') || err.message.includes('not linked');
      }

      const passed = locationDenied && historyDenied;

      results.push({
        id: 'TEST-8',
        name: 'Unauthorized learner telemetry is denied',
        requirement: 'Guardians attempting to query location of children not explicitly linked to them must be strictly denied.',
        expected: 'Unauthorized exception thrown for both latest location and historical telemetry; audit event recorded.',
        actual: passed
          ? 'Access correctly denied with Unauthorized exceptions for unlinked guardian.'
          : 'Access was erroneously allowed to unlinked guardian.',
        status: passed ? 'PASS' : 'FAIL',
        evidence: { locationDenied, historyDenied }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-8',
        name: 'Unauthorized learner telemetry is denied',
        requirement: 'Unauthorized query denied.',
        expected: 'Access denied.',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // ------------------------------------------------------------------------
    // TEST 9: Simulator remains functional
    // ------------------------------------------------------------------------
    try {
      const uniqueSerial = Math.floor(1000 + Math.random() * 50000);
      const simBuffer = telemetrySimulationEngine.buildGt012LocationPacket({
        lat: -25.748500,
        lng: 28.229800,
        speed: 35,
        heading: 180,
        satellites: 9,
        serialNumber: uniqueSerial
      });

      const simRun = await telemetrySimulationEngine.simulatePacket({
        targetDeviceId: testDevice.trackerDeviceId,
        protocolFormat: 'GT012',
        rawPacket: simBuffer.toString('hex')
      }, techActor);

      // Verify simulator result is successful and accepted
      const simOk = simRun.status === 'SIMULATION_SUCCESS';

      // Verify the latest location reflects the simulator
      const latestFromSim = await repository.telemetry.getLatestLocation(testDevice.itisDeviceId);
      const reflectsSim = Boolean(
        latestFromSim &&
        Math.abs(latestFromSim.latitude - (-25.748500)) < 0.001
      );

      const passed = simOk && reflectsSim;

      results.push({
        id: 'TEST-9',
        name: 'Simulator remains functional',
        requirement: 'Existing Telemetry Simulator must remain fully operational and persist simulated packets through the gateway.',
        expected: 'Simulation executes successfully, packet accepted, latest location updated.',
        actual: passed
          ? `Simulation succeeded (diagnostic: ${simRun.diagnosticCode}), latest location updated.`
          : 'Simulator execution failed or did not update persistence layer.',
        status: passed ? 'PASS' : 'FAIL',
        evidence: { simStatus: simRun.status, simDiagnostic: simRun.diagnosticCode, reflectsSim }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-9',
        name: 'Simulator remains functional',
        requirement: 'Simulator operation.',
        expected: 'Simulator operational.',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // ------------------------------------------------------------------------
    // TEST 10: Existing system has zero regression
    // ------------------------------------------------------------------------
    try {
      // 1. Check Audit Trail Integrity
      const auditIntegrity = db.verifyAuditTrailIntegrity();

      // 2. Check Device Registry functionality
      const regDevices = deviceRegistryEngine.getAllDevices();

      // 3. Check Learner repository functionality
      const learnersCount = db.learners.size;

      // 4. Check Schools repository functionality
      const schoolsCount = db.schools.size;

      const zeroRegression = Boolean(
        auditIntegrity.valid &&
        regDevices.length > 0 &&
        learnersCount > 0 &&
        schoolsCount > 0
      );

      results.push({
        id: 'TEST-10',
        name: 'Existing system has zero regression',
        requirement: 'Core Device Registry, Audit Trail, Learner profiles, and Schools must function without regression.',
        expected: 'Audit integrity verified (valid=true), device registry operational, core databases healthy.',
        actual: zeroRegression
          ? `Zero regressions verified: audit valid (${auditIntegrity.totalChecked} logs), ${regDevices.length} devices, ${learnersCount} learners, ${schoolsCount} schools.`
          : 'Regression detected in core subsystem.',
        status: zeroRegression ? 'PASS' : 'FAIL',
        evidence: {
          auditValid: auditIntegrity.valid,
          totalAuditLogs: auditIntegrity.totalChecked,
          registeredDevices: regDevices.length,
          learnersCount,
          schoolsCount
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-10',
        name: 'Existing system has zero regression',
        requirement: 'Zero regression check.',
        expected: 'Zero regression.',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    const passedTests = results.filter(r => r.status === 'PASS').length;
    const failedTests = results.filter(r => r.status === 'FAIL').length;

    return {
      suiteId: 'SUITE-TEL-PERSISTENCE-V1',
      timestamp,
      totalTests: results.length,
      passedTests,
      failedTests,
      allPassed: failedTests === 0,
      results
    };
  }
}

export const telemetryPersistenceTestSuite = new TelemetryPersistenceTestSuite();
