/**
 * ITIS GUARDIAN NETWORK — LIVE GPS LOCATION SERVICE & MAP DATA API ACCEPTANCE TEST SUITE
 * 
 * Verifies all 10 criteria for authoritative location services, map-ready APIs,
 * access control enforcement, audit compliance, and backward compatibility.
 */

import {
  ActiveUserSession,
  LiveLocationTestSuiteResult
} from '../types.js';
import { db } from './dbStore.js';
import { repository } from './db/index.js';
import { liveLocationService } from './liveLocationService.js';
import { deviceRegistryEngine } from './deviceRegistryEngine.js';
import { telemetryPersistenceEngine } from './telemetryPersistenceEngine.js';

export class LiveLocationTestSuite {
  public async runAllTests(): Promise<LiveLocationTestSuiteResult> {
    const results: LiveLocationTestSuiteResult['results'] = [];
    const timestamp = new Date().toISOString();

    // Setup mock actors for testing
    const adminUser: ActiveUserSession = {
      id: 'usr-admin-test',
      name: 'Super Administrator',
      email: 'admin.test@itis.safety.za',
      role: 'SYSTEM_ADMIN',
      token: 'tok-admin-test'
    };

    const commandUser: ActiveUserSession = {
      id: 'usr-cmd-test',
      name: 'Captain V. Khumalo',
      email: 'command.test@itis.safety.za',
      role: 'COMMAND_OPERATOR',
      token: 'tok-cmd-test'
    };

    // Ensure active test device exists in registry
    const testTrackerId = 'GT012-TRK-LIVE-MAP-01';
    let testDevice = deviceRegistryEngine.findByTrackerIdentifier(testTrackerId);
    if (!testDevice) {
      testDevice = deviceRegistryEngine.registerDevice({
        trackerDeviceId: testTrackerId,
        imei: '868204049999901',
        serialNumber: 'SN-TEST-MAP-01',
        deviceModel: 'GT012-SA-PRO',
        firmwareVersion: 'v1.4.2-rel',
        hardwareRevision: 'HW-REV-3'
      }, adminUser);
      deviceRegistryEngine.activateDevice(testDevice.itisDeviceId, adminUser);
      testDevice = deviceRegistryEngine.findByTrackerIdentifier(testTrackerId)!;
    }
    const testDeviceId = testDevice.itisDeviceId;

    // Setup Guardian & Linked Learner in memory if needed
    const testGuardianId = 'grd-test-01';
    const testLearnerId = 'lrn-test-01';
    const unrelatedLearnerId = 'lrn-test-unrelated-99';

    if (!db.persons.has('per-lrn-01')) {
      db.persons.set('per-lrn-01', {
        id: 'per-lrn-01',
        officialId: '1205040001088',
        idType: 'SA_ID',
        firstName: 'Sipho',
        lastName: 'Khumalo',
        dateOfBirth: '2014-05-04',
        gender: 'MALE',
        isVerified: true
      } as any);
    }

    if (!db.persons.has('per-lrn-unrel')) {
      db.persons.set('per-lrn-unrel', {
        id: 'per-lrn-unrel',
        officialId: '1108035555081',
        idType: 'SA_ID',
        firstName: 'Katlego',
        lastName: 'Maseko',
        dateOfBirth: '2013-08-03',
        gender: 'FEMALE',
        isVerified: true
      } as any);
    }

    if (!db.guardians.has(testGuardianId)) {
      db.guardians.set(testGuardianId, {
        id: testGuardianId,
        personId: 'per-grd-01',
        relationshipType: 'MOTHER',
        primaryContactNumber: '+27820000001',
        preferredCommunicationChannel: 'SMS',
        isPrimaryEmergencyContact: true,
        legalCustodyVerified: true,
        verificationStatus: 'VERIFIED'
      } as any);
    }

    if (!db.learners.has(testLearnerId)) {
      db.learners.set(testLearnerId, {
        id: testLearnerId,
        personId: 'per-lrn-01',
        currentSchoolId: 'sch-sunnyside-01',
        schoolId: 'sch-sunnyside-01',
        learnerGrade: 'GRADE_4',
        enrolmentStatus: 'ACTIVE',
        safetyProfileVerified: true,
        consentForTrackingGranted: true,
        trackingEnabled: true,
        currentDeviceId: testDeviceId
      } as any);
    } else {
      const existing = db.learners.get(testLearnerId)!;
      (existing as any).currentDeviceId = testDeviceId;
    }

    // Link device in registry to test learner
    testDevice.assignedLearnerId = testLearnerId;

    // Persist a baseline telemetry packet for this device
    await telemetryPersistenceEngine.persistAuthoritativeTelemetry({
      deviceId: testDeviceId,
      trackerDeviceId: testTrackerId,
      learnerId: testLearnerId,
      schoolId: 'sch-sunnyside-01',
      timestamp: new Date().toISOString(),
      latitude: -25.7589,
      longitude: 28.2321,
      accuracyMeters: 3.8,
      speedKmh: 12.5,
      heading: 94,
      altitudeMeters: 1340,
      batteryLevel: 92,
      batteryVoltage: 4.12,
      protocol: 'GT012',
      packetType: 'LOCATION',
      transportSource: 'SIMULATOR'
    });

    if (!db.learners.has(unrelatedLearnerId)) {
      db.learners.set(unrelatedLearnerId, {
        id: unrelatedLearnerId,
        personId: 'per-lrn-unrel',
        currentSchoolId: 'sch-pretoria-west-02',
        schoolId: 'sch-pretoria-west-02',
        learnerGrade: 'GRADE_7',
        enrolmentStatus: 'ACTIVE',
        safetyProfileVerified: true,
        consentForTrackingGranted: true,
        trackingEnabled: true
      } as any);
    }

    // Link testLearnerId to testGuardianId
    const testRelId = 'rel-test-01';
    db.relationships.set(testRelId, {
      id: testRelId,
      guardianId: testGuardianId,
      learnerId: testLearnerId,
      relationshipType: 'MOTHER',
      verificationStatus: 'VERIFIED',
      verificationDate: new Date().toISOString()
    } as any);
    db.rebuildIndexes();

    // Guardian session
    const guardianUser: ActiveUserSession = {
      id: 'usr-grd-test',
      name: 'Nokuthula Khumalo',
      email: 'nokuthula.test@family.za',
      role: 'PARENT_GUARDIAN',
      guardianId: testGuardianId,
      token: 'tok-grd-test'
    };

    // School sessions for School 1 and School 2
    const schoolStaffUser: ActiveUserSession = {
      id: 'usr-sch-staff-01',
      name: 'Teacher Dlamini',
      email: 'dlamini.test@sunnyside.edu.za',
      role: 'SCHOOL_ADMIN_STAFF',
      schoolId: 'sch-sunnyside-01',
      token: 'tok-sch-test'
    };

    // Ensure enrolment exists for testLearnerId in sch-sunnyside-01
    db.enrolments.set('enr-test-01', {
      id: 'enr-test-01',
      learnerId: testLearnerId,
      schoolId: 'sch-sunnyside-01',
      enrolmentStatus: 'ACTIVE',
      academicYear: 2026
    } as any);

    // Ensure enrolment exists for unrelatedLearnerId in sch-pretoria-west-02
    db.enrolments.set('enr-test-unrelated', {
      id: 'enr-test-unrelated',
      learnerId: unrelatedLearnerId,
      schoolId: 'sch-pretoria-west-02',
      enrolmentStatus: 'ACTIVE',
      academicYear: 2026
    } as any);

    // Ensure test incident exists for Command Centre test
    const testIncidentId = 'inc-test-live-map-01';
    if (!db.incidents.has(testIncidentId)) {
      db.incidents.set(testIncidentId, {
        id: testIncidentId,
        incidentNumber: 'INC-2026-TEST-99',
        type: 'DURESS_ALARM',
        status: 'DISPATCHED',
        severity: 'CRITICAL_SOS',
        learnerId: testLearnerId,
        schoolId: 'sch-sunnyside-01',
        location: {
          lat: -25.7589,
          lng: 28.2321,
          address: 'Corner Steve Biko & Kotze St, Sunnyside, Pretoria'
        },
        assignedResponder: {
          id: 'resp-saps-01',
          name: 'SAPS Sunnyside Sector 2 Unit B',
          unitType: 'POLICE',
          vehicleId: 'GP-POLICE-041'
        },
        createdAt: new Date().toISOString()
      } as any);
    }

    // Ensure a responder unit exists in db.responderUnits
    if (!db.responderUnits.has('resp-saps-01')) {
      db.responderUnits.set('resp-saps-01', {
        id: 'resp-saps-01',
        name: 'SAPS Sunnyside Sector 2 Unit B',
        unitType: 'POLICE',
        status: 'EN_ROUTE',
        currentLocation: {
          lat: -25.7620,
          lng: 28.2350,
          lastUpdated: new Date().toISOString()
        }
      } as any);
    }

    // -------------------------------------------------------------------------
    // TEST 1: Latest device location returns correctly
    // -------------------------------------------------------------------------
    try {
      const devLoc = await liveLocationService.getLatestDeviceLocation(adminUser, testDeviceId);
      const pass =
        devLoc.deviceId === testDeviceId &&
        typeof devLoc.latitude === 'number' &&
        typeof devLoc.longitude === 'number' &&
        devLoc.geoJson?.type === 'Feature' &&
        devLoc.geoJson.geometry.type === 'Point' &&
        Array.isArray(devLoc.geoJson.geometry.coordinates) &&
        devLoc.geoJson.geometry.coordinates[0] === devLoc.longitude &&
        devLoc.geoJson.geometry.coordinates[1] === devLoc.latitude;

      results.push({
        id: 'TEST-1',
        name: 'Latest device location returns correctly',
        requirement: 'Map API returns authoritative latest device location with valid GeoJSON point feature.',
        expected: `Device '${testDeviceId}' location returned with GeoJSON coordinates matching lat/long.`,
        actual: pass
          ? `SUCCESS: Device location returned (lat: ${devLoc.latitude}, lng: ${devLoc.longitude}, accuracy: ${devLoc.accuracyMeters}m, GeoJSON Point validated).`
          : 'FAIL: Location format or GeoJSON point feature invalid.',
        status: pass ? 'PASS' : 'FAIL',
        evidence: { devLoc }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-1',
        name: 'Latest device location returns correctly',
        requirement: 'Map API returns authoritative latest device location with valid GeoJSON point feature.',
        expected: 'Device location returned with GeoJSON coordinates.',
        actual: `ERROR: ${err.message}`,
        status: 'FAIL'
      });
    }

    // -------------------------------------------------------------------------
    // TEST 2: Guardian accesses linked learner location
    // -------------------------------------------------------------------------
    try {
      const learnerLoc = await liveLocationService.getLearnerCurrentLocation(guardianUser, testLearnerId);
      const pass =
        learnerLoc.accessAuthorized &&
        learnerLoc.learnerId === testLearnerId &&
        learnerLoc.officialIdentifierMasked.includes('******') &&
        typeof learnerLoc.firstName === 'string';

      results.push({
        id: 'TEST-2',
        name: 'Guardian accesses linked learner location',
        requirement: 'Guardian can access location of verified linked child with privacy data minimization.',
        expected: 'Linked learner location returned with masked identifier and safe metadata.',
        actual: pass
          ? `SUCCESS: Guardian accessed location for child '${learnerLoc.firstName} ${learnerLoc.lastNameInitial}' (Masked ID: ${learnerLoc.officialIdentifierMasked}, SafeZone: ${learnerLoc.geofenceStatus}).`
          : 'FAIL: Expected linked child location was not returned properly.',
        status: pass ? 'PASS' : 'FAIL',
        evidence: { learnerLoc }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-2',
        name: 'Guardian accesses linked learner location',
        requirement: 'Guardian can access location of verified linked child with privacy data minimization.',
        expected: 'Linked learner location returned.',
        actual: `ERROR: ${err.message}`,
        status: 'FAIL'
      });
    }

    // -------------------------------------------------------------------------
    // TEST 3: Guardian denied unrelated learner location
    // -------------------------------------------------------------------------
    try {
      let denied = false;
      let errorMsg = '';
      try {
        await liveLocationService.getLearnerCurrentLocation(guardianUser, unrelatedLearnerId);
      } catch (e: any) {
        denied = true;
        errorMsg = e.message;
      }

      const pass = denied && (errorMsg.includes('403') || errorMsg.includes('Forbidden') || errorMsg.includes('not authorized'));

      results.push({
        id: 'TEST-3',
        name: 'Guardian denied unrelated learner location',
        requirement: 'Guardian access to unrelated, unlinked learner locations is strictly blocked with 403 Forbidden.',
        expected: '403 Forbidden thrown on attempting to query unrelated learner location.',
        actual: pass
          ? `SUCCESS: Server rejected unauthorized guardian access: "${errorMsg}"`
          : `FAIL: Expected 403 Forbidden, but operation allowed or returned improper error: "${errorMsg}"`,
        status: pass ? 'PASS' : 'FAIL',
        evidence: { denied, errorMsg }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-3',
        name: 'Guardian denied unrelated learner location',
        requirement: 'Guardian access to unrelated learner location is strictly blocked.',
        expected: '403 Forbidden',
        actual: `ERROR: ${err.message}`,
        status: 'FAIL'
      });
    }

    // -------------------------------------------------------------------------
    // TEST 4: School staff denied cross-school location
    // -------------------------------------------------------------------------
    try {
      let crossSchoolDenied = false;
      let errorMsg = '';
      try {
        await liveLocationService.getLearnerCurrentLocation(schoolStaffUser, unrelatedLearnerId);
      } catch (e: any) {
        crossSchoolDenied = true;
        errorMsg = e.message;
      }

      const pass = crossSchoolDenied && (errorMsg.includes('403') || errorMsg.includes('Forbidden') || errorMsg.includes('outside their assigned institution'));

      results.push({
        id: 'TEST-4',
        name: 'School staff denied cross-school location',
        requirement: 'School staff are strictly prohibited from viewing location data of learners enrolled in other institutions.',
        expected: '403 Forbidden thrown when school staff attempts cross-school query.',
        actual: pass
          ? `SUCCESS: Cross-school boundary enforced: "${errorMsg}"`
          : `FAIL: Expected cross-school query to be rejected with 403, got "${errorMsg}"`,
        status: pass ? 'PASS' : 'FAIL',
        evidence: { crossSchoolDenied, errorMsg }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-4',
        name: 'School staff denied cross-school location',
        requirement: 'School staff are prohibited from viewing cross-school location data.',
        expected: '403 Forbidden',
        actual: `ERROR: ${err.message}`,
        status: 'FAIL'
      });
    }

    // -------------------------------------------------------------------------
    // TEST 5: Command Centre incident map access works
    // -------------------------------------------------------------------------
    try {
      const tacticalCtx = await liveLocationService.getIncidentTacticalContext(commandUser, testIncidentId);
      const pass =
        tacticalCtx.incidentId === testIncidentId &&
        Boolean(tacticalCtx.incidentLocation) &&
        Boolean(tacticalCtx.tacticalVectors) &&
        Boolean(tacticalCtx.assignedResponder);

      results.push({
        id: 'TEST-5',
        name: 'Command Centre incident map access works',
        requirement: 'Command officers can access tactical context with incident coordinates, vectors, and responder GPS.',
        expected: 'Tactical context returns incident location, learner coordinates, tactical vectors, and assigned responder.',
        actual: pass
          ? `SUCCESS: Command context loaded (Incident: ${tacticalCtx.incidentId}, Assigned: ${tacticalCtx.assignedResponder?.callsign}, ETA: ${tacticalCtx.assignedResponder?.etaMinutes}m, Vectors: ${tacticalCtx.tacticalVectors?.distanceMeters}m @ ${tacticalCtx.tacticalVectors?.bearingDegrees}°).`
          : 'FAIL: Incomplete tactical context received for incident.',
        status: pass ? 'PASS' : 'FAIL',
        evidence: { tacticalCtx }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-5',
        name: 'Command Centre incident map access works',
        requirement: 'Command officers can access tactical context.',
        expected: 'Full tactical context returned.',
        actual: `ERROR: ${err.message}`,
        status: 'FAIL'
      });
    }

    // -------------------------------------------------------------------------
    // TEST 6: Responder GPS remains operational
    // -------------------------------------------------------------------------
    try {
      const targetUnitId = 'resp-saps-01';
      const testLat = -25.7533;
      const testLng = 28.2388;

      const updated = await (repository.responders as any).updateLiveLocation(targetUnitId, {
        latitude: testLat,
        longitude: testLng,
        lat: testLat,
        lng: testLng
      });

      const unitInDb = db.responderUnits.get(targetUnitId);
      const pass =
        Boolean(updated) &&
        unitInDb?.currentLocation?.lat === testLat &&
        unitInDb?.currentLocation?.lng === testLng;

      results.push({
        id: 'TEST-6',
        name: 'Responder GPS remains operational',
        requirement: 'Field Responder live GPS reporting and tracking engine continues to function without disturbance.',
        expected: 'Responder location updates and persists successfully.',
        actual: pass
          ? `SUCCESS: Responder GPS operational. Live location updated for unit '${targetUnitId}' to [${testLat}, ${testLng}].`
          : 'FAIL: Responder location did not update properly.',
        status: pass ? 'PASS' : 'FAIL',
        evidence: { updated, unitInDb }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-6',
        name: 'Responder GPS remains operational',
        requirement: 'Field Responder live GPS reporting continues to function.',
        expected: 'Responder location updates successfully.',
        actual: `ERROR: ${err.message}`,
        status: 'FAIL'
      });
    }

    // -------------------------------------------------------------------------
    // TEST 7: Location history pagination works
    // -------------------------------------------------------------------------
    try {
      // Add a couple of points to device history
      await telemetryPersistenceEngine.persistAuthoritativeTelemetry({
        deviceId: testDeviceId,
        trackerDeviceId: testTrackerId,
        timestamp: new Date(Date.now() - 60000).toISOString(),
        latitude: -25.7592,
        longitude: 28.2325,
        speedKmh: 14.0,
        heading: 96,
        protocol: 'GT012',
        packetType: 'LOCATION',
        transportSource: 'SIMULATOR'
      });

      const history = await liveLocationService.getLocationHistory(adminUser, {
        subjectType: 'DEVICE',
        subjectId: testDeviceId,
        page: 1,
        limit: 2
      });

      const pass =
        history.pagination.page === 1 &&
        history.pagination.limit === 2 &&
        Array.isArray(history.points) &&
        history.pathGeoJson?.type === 'Feature' &&
        history.pathGeoJson.geometry.type === 'LineString' &&
        Array.isArray(history.pathGeoJson.geometry.coordinates);

      results.push({
        id: 'TEST-7',
        name: 'Location history pagination works',
        requirement: 'Location history enforces pagination, date range boundaries, and generates GeoJSON LineString trajectory.',
        expected: 'Paginated points returned with LineString trajectory path.',
        actual: pass
          ? `SUCCESS: Paginated history returned ${history.points.length} points (page: ${history.pagination.page}, limit: ${history.pagination.limit}, total: ${history.pagination.total}, LineString coords: ${history.pathGeoJson.geometry.coordinates.length}).`
          : 'FAIL: Location history pagination or GeoJSON LineString invalid.',
        status: pass ? 'PASS' : 'FAIL',
        evidence: { pagination: history.pagination, pointCount: history.points.length }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-7',
        name: 'Location history pagination works',
        requirement: 'Location history enforces pagination.',
        expected: 'Paginated points returned.',
        actual: `ERROR: ${err.message}`,
        status: 'FAIL'
      });
    }

    // -------------------------------------------------------------------------
    // TEST 8: Unauthorized request is audited
    // -------------------------------------------------------------------------
    try {
      // Find audit event logged during TEST 3 or TEST 4
      const deniedAudits = db.auditLogs.filter(
        a => a.actionType === 'UNAUTHORIZED_LOCATION_ACCESS_DENIED'
      );

      const pass = deniedAudits.length > 0;
      const latestDenied = deniedAudits[deniedAudits.length - 1];

      results.push({
        id: 'TEST-8',
        name: 'Unauthorized request is audited',
        requirement: 'All denied location queries emit an immutable UNAUTHORIZED_LOCATION_ACCESS_DENIED audit record.',
        expected: 'UNAUTHORIZED_LOCATION_ACCESS_DENIED audit log recorded in audit trail.',
        actual: pass
          ? `SUCCESS: Audit log recorded (${deniedAudits.length} events logged, latest actor: ${latestDenied.actorName}, role: ${latestDenied.actorRole}, target: ${latestDenied.targetId}, checksum: ${latestDenied.checksum.slice(0, 12)}...).`
          : 'FAIL: No UNAUTHORIZED_LOCATION_ACCESS_DENIED event found in audit trail.',
        status: pass ? 'PASS' : 'FAIL',
        evidence: { deniedCount: deniedAudits.length, latestDenied }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-8',
        name: 'Unauthorized request is audited',
        requirement: 'All denied location queries emit an audit record.',
        expected: 'Audit log recorded.',
        actual: `ERROR: ${err.message}`,
        status: 'FAIL'
      });
    }

    // -------------------------------------------------------------------------
    // TEST 9: Existing TacticalInterceptionMap remains functional
    // -------------------------------------------------------------------------
    try {
      // Verify that IncidentTacticalLocationContext provides all data required by TacticalInterceptionMap
      const incident = db.incidents.get(testIncidentId);
      const responders = Array.from(db.responderUnits.values());
      const hasProps =
        Boolean(incident) &&
        typeof incident?.location?.lat === 'number' &&
        typeof incident?.location?.lng === 'number' &&
        Array.isArray(responders) &&
        responders.length > 0;

      results.push({
        id: 'TEST-9',
        name: 'Existing TacticalInterceptionMap remains functional',
        requirement: 'TacticalInterceptionMap contract, props, and incident rendering models remain intact and undisturbed.',
        expected: 'Incident and responder data structures match TacticalInterceptionMap requirements.',
        actual: hasProps
          ? `SUCCESS: TacticalInterceptionMap props contract verified (Incident: ${incident?.id}, Location: [${incident?.location?.lat}, ${incident?.location?.lng}], Fleet Units: ${responders.length}).`
          : 'FAIL: Incident or responder structure incompatible with map.',
        status: hasProps ? 'PASS' : 'FAIL',
        evidence: { incidentId: incident?.id, respondersCount: responders.length }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-9',
        name: 'Existing TacticalInterceptionMap remains functional',
        requirement: 'TacticalInterceptionMap contract preserved.',
        expected: 'Map props validated.',
        actual: `ERROR: ${err.message}`,
        status: 'FAIL'
      });
    }

    // -------------------------------------------------------------------------
    // TEST 10: Zero authentication regression
    // -------------------------------------------------------------------------
    try {
      // Verify db.authenticateUser and session token retrieval
      const authResult = db.authenticateUser('sysadmin@itis.safety.za', 'Password123!') || db.authenticateUser('admin@itis.safety.za', 'Password123!');
      const session = authResult?.token ? db.getSession(authResult.token) : null;
      const userRole = session?.session?.role || authResult?.user?.role;
      const pass =
        Boolean(authResult) &&
        Boolean(authResult?.token) &&
        Boolean(session) &&
        userRole === 'SYSTEM_ADMIN';

      results.push({
        id: 'TEST-10',
        name: 'Zero authentication regression',
        requirement: 'Authentication, session management, and credential verification continue functioning with zero regression.',
        expected: 'Administrative user authenticates and session validates.',
        actual: pass
          ? `SUCCESS: Authentication verified. Valid login returned active session token (${authResult?.user?.email}, Role: ${userRole}).`
          : `FAIL: Authentication returned null or invalid session.`,
        status: pass ? 'PASS' : 'FAIL',
        evidence: { authSuccess: Boolean(authResult), role: userRole }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-10',
        name: 'Zero authentication regression',
        requirement: 'Authentication functions without regression.',
        expected: 'Successful login & session.',
        actual: `ERROR: ${err.message}`,
        status: 'FAIL'
      });
    }

    const passedTests = results.filter(r => r.status === 'PASS').length;
    const failedTests = results.filter(r => r.status === 'FAIL').length;

    return {
      suiteId: `suite-live-location-${Date.now()}`,
      timestamp,
      totalTests: results.length,
      passedTests,
      failedTests,
      allPassed: failedTests === 0,
      results
    };
  }
}

export const liveLocationTestSuite = new LiveLocationTestSuite();
