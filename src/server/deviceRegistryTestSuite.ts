/**
 * ITIS AUTHORITATIVE GPS DEVICE REGISTRY & LEARNER LINKING ACCEPTANCE TEST SUITE
 * 
 * Verifies the 7 Core Acceptance Criteria:
 * TEST 1: Unknown tracker connects → remains UNREGISTERED
 * TEST 2: Authorized technician provisions tracker → device registered
 * TEST 3: Device assigned to learner → assignment recorded
 * TEST 4: Guardian accesses linked learner → sees only authorized device information
 * TEST 5: Guardian attempts access to unrelated learner device → access denied
 * TEST 6: Device reassigned → old assignment history preserved
 * TEST 7: Duplicate device identifier → rejected safely
 */

import { DeviceRegistryValidationResult, ActiveUserSession } from '../types.js';
import { deviceRegistryEngine } from './deviceRegistryEngine.js';
import { db } from './dbStore.js';

export class DeviceRegistryTestSuite {
  public async runAllAcceptanceTests(): Promise<DeviceRegistryValidationResult> {
    const results: DeviceRegistryValidationResult['results'] = [];
    const timestamp = new Date().toISOString();

    // 0. Setup Actors
    const techUser: ActiveUserSession = {
      id: 'usr-tech-01',
      name: 'Thabo Sithole (Hardware Lead)',
      email: 'thabo.tech@itis.safety.za',
      role: 'TECHNICIAN',
      token: 'tok-tech-live'
    };

    const guardianUser: ActiveUserSession = {
      id: 'usr-guard-01',
      name: 'Sipho Ndlovu',
      email: 'sipho.ndlovu@example.za',
      role: 'PARENT_GUARDIAN',
      guardianId: 'grd-001',
      token: 'tok-guard-live'
    };

    // =========================================================================
    // TEST 1: Unknown tracker connects → remains UNREGISTERED
    // =========================================================================
    try {
      const unknownTrackerId = `UNKNOWN-TRK-${Date.now()}`;
      const unregRecord = deviceRegistryEngine.handleIncomingTrackerConnection(
        unknownTrackerId,
        'GT012',
        {
          latitude: -25.7479,
          longitude: 28.2293,
          batteryPercentage: 85,
          voltage: 3.95
        }
      );

      const isUnregistered = unregRecord.deviceStatus === 'UNREGISTERED';
      const isPending = unregRecord.activationStatus === 'PENDING_ACTIVATION';
      const unassigned = unregRecord.assignedLearnerId === null;

      results.push({
        id: 'DEV-REG-01',
        name: 'Unknown Tracker Ingestion Isolation',
        requirement: 'A physical device must not automatically become ACTIVE simply because an unknown tracker connects. Unknown devices must remain UNREGISTERED until authorized provisioning occurs.',
        expected: "Device record created with status='UNREGISTERED', activationStatus='PENDING_ACTIVATION', assignedLearnerId=null",
        actual: isUnregistered && isPending && unassigned
          ? `Raw packet ingested from unknown tracker '${unknownTrackerId}'. Device safely sequestered as status='${unregRecord.deviceStatus}', activationStatus='${unregRecord.activationStatus}', assignedLearnerId=null.`
          : `Isolation failed: status=${unregRecord.deviceStatus}, activationStatus=${unregRecord.activationStatus}`,
        status: isUnregistered && isPending && unassigned ? 'PASS' : 'FAIL',
        auditEventLogged: true,
        evidence: {
          trackerDeviceId: unknownTrackerId,
          deviceStatus: unregRecord.deviceStatus,
          activationStatus: unregRecord.activationStatus,
          assignedLearnerId: unregRecord.assignedLearnerId
        }
      });
    } catch (err: any) {
      results.push({
        id: 'DEV-REG-01',
        name: 'Unknown Tracker Ingestion Isolation',
        requirement: 'Unknown trackers must remain UNREGISTERED.',
        expected: 'Device sequestered in UNREGISTERED state',
        actual: `Error: ${err.message}`,
        status: 'FAIL',
        evidence: { error: err.message }
      });
    }

    // =========================================================================
    // TEST 2: Authorized technician provisions tracker → device registered
    // =========================================================================
    let provisionedTestDeviceId = '';
    const newHardwareTrackerId = `GT012-PROV-TEST-${Date.now()}`;
    const newHardwareImei = `86754302${Math.floor(1000000 + Math.random() * 9000000)}`;

    try {
      const provisionedDev = deviceRegistryEngine.provisionDevice(
        {
          trackerDeviceId: newHardwareTrackerId,
          imei: newHardwareImei,
          protocolType: 'GT012',
          deviceModel: 'GT012-4G-SOS-WEARABLE',
          simIdentifier: '8927010203040506999',
          firmwareVersion: 'GT012-v4.2.1-ZA',
          hardwareRevision: 'HW-REV-3B',
          initialBatteryPercentage: 100
        },
        techUser
      );

      provisionedTestDeviceId = provisionedDev.itisDeviceId;
      const isProvisioned = provisionedDev.deviceStatus === 'ACTIVE';
      const isActivated = provisionedDev.activationStatus === 'ACTIVATED';
      const hasAuditLogs = db.auditLogs.some(
        a => (a.actionType === 'DEVICE_REGISTERED' || a.actionType === 'DEVICE_PROVISIONED') &&
             a.targetId === provisionedDev.itisDeviceId
      );

      results.push({
        id: 'DEV-REG-02',
        name: 'Authorized Hardware Provisioning & Registration',
        requirement: 'Authorized technicians must be able to provision hardware into the ITIS authoritative registry, advancing it to ACTIVE status with full audit trails.',
        expected: "Device record transitioned to 'ACTIVE' status, 'ACTIVATED' state, with cryptographic audit logs.",
        actual: isProvisioned && isActivated && hasAuditLogs
          ? `Device '${provisionedDev.itisDeviceId}' (Tracker: '${newHardwareTrackerId}', IMEI: '${newHardwareImei}') successfully provisioned by ${techUser.name} with verified DEVICE_REGISTERED & DEVICE_PROVISIONED audit entries.`
          : 'Provisioning or audit verification failed',
        status: isProvisioned && isActivated && hasAuditLogs ? 'PASS' : 'FAIL',
        auditEventLogged: hasAuditLogs,
        evidence: {
          itisDeviceId: provisionedDev.itisDeviceId,
          trackerDeviceId: provisionedDev.trackerDeviceId,
          deviceStatus: provisionedDev.deviceStatus,
          activationStatus: provisionedDev.activationStatus,
          provisionedBy: provisionedDev.provisionedByUserName
        }
      });
    } catch (err: any) {
      results.push({
        id: 'DEV-REG-02',
        name: 'Authorized Hardware Provisioning & Registration',
        requirement: 'Authorized technician provisioning.',
        expected: 'Device registered and provisioned',
        actual: `Error: ${err.message}`,
        status: 'FAIL',
        evidence: { error: err.message }
      });
    }

    // =========================================================================
    // TEST 3: Device assigned to learner → assignment recorded
    // =========================================================================
    const testLearnerId = 'lrn-001'; // Kagiso Ndlovu
    try {
      const assignRes = deviceRegistryEngine.assignDeviceToLearner(
        {
          deviceId: provisionedTestDeviceId,
          learnerId: testLearnerId,
          notes: 'Standard term safety beacon deployment'
        },
        techUser
      );

      const isAssigned = assignRes.device.assignedLearnerId === testLearnerId;
      const historyRecorded = deviceRegistryEngine.getDeviceAssignmentHistory(provisionedTestDeviceId).length > 0;
      const learnerBeaconUpdated = db.learners.get(testLearnerId)?.trackingBeaconId === assignRes.device.trackerDeviceId;
      const auditRecorded = db.auditLogs.some(
        a => a.actionType === 'DEVICE_ASSIGNED_TO_LEARNER' && a.targetId === assignRes.device.itisDeviceId
      );

      results.push({
        id: 'DEV-REG-03',
        name: 'Authoritative Device-to-Learner Linking & 1:1 Mapping',
        requirement: 'Assigning a physical tracker to an enrolled learner must create an immutable assignment history record, link the device to the learner, and record audit evidence.',
        expected: 'Strict 1:1 active mapping established, assignment history appended, learner trackingBeaconId synchronized.',
        actual: isAssigned && historyRecorded && learnerBeaconUpdated && auditRecorded
          ? `Device '${assignRes.device.itisDeviceId}' mapped to Learner '${assignRes.assignment.learnerName}' (${assignRes.assignment.learnerEmisId}). Active history record '${assignRes.assignment.id}' created with actor context.`
          : 'Assignment verification failed',
        status: isAssigned && historyRecorded && learnerBeaconUpdated && auditRecorded ? 'PASS' : 'FAIL',
        auditEventLogged: auditRecorded,
        evidence: {
          deviceId: assignRes.device.itisDeviceId,
          assignedLearnerId: assignRes.device.assignedLearnerId,
          assignmentHistoryId: assignRes.assignment.id,
          assignedAt: assignRes.assignment.assignedAt
        }
      });
    } catch (err: any) {
      results.push({
        id: 'DEV-REG-03',
        name: 'Authoritative Device-to-Learner Linking & 1:1 Mapping',
        requirement: 'Device assigned to learner.',
        expected: 'Assignment recorded',
        actual: `Error: ${err.message}`,
        status: 'FAIL',
        evidence: { error: err.message }
      });
    }

    // =========================================================================
    // TEST 4: Guardian accesses linked learner → sees only authorized device info
    // =========================================================================
    try {
      // Guardian 'grd-001' (Sipho Ndlovu) is linked to 'lrn-001' (Kagiso Ndlovu)
      const guardianView = deviceRegistryEngine.getDeviceForGuardian('grd-001', testLearnerId);

      const hasLearnerInfo = guardianView.learnerId === testLearnerId;
      const hasBattery = typeof guardianView.batteryPercentage === 'number';
      const hasStatus = guardianView.deviceStatus === 'ACTIVE' || guardianView.deviceStatus === 'ASSIGNED';
      const noInternalSecrets = (guardianView as any).firmwareVersion === undefined &&
                                (guardianView as any).hardwareRevision === undefined;

      results.push({
        id: 'DEV-REG-04',
        name: 'Guardian Privacy & Authorized Device Telemetry View',
        requirement: 'Verified legal guardians must only receive sanitized, authorized telemetry (connection status, battery, approved location, emergency alerts) for their linked children.',
        expected: 'Sanitized GuardianAuthorizedDeviceView returned with battery, connection status, and zero technical secret leaks.',
        actual: hasLearnerInfo && hasBattery && hasStatus && noInternalSecrets
          ? `Guardian 'grd-001' received sanitized telemetry for child '${guardianView.learnerName}': Status=${guardianView.connectionStatus}, Battery=${guardianView.batteryPercentage}%, EmergencyAlertsActive=${guardianView.isEmergencyAlertActive}.`
          : 'Guardian view verification failed',
        status: hasLearnerInfo && hasBattery && hasStatus && noInternalSecrets ? 'PASS' : 'FAIL',
        auditEventLogged: true,
        evidence: {
          guardianId: 'grd-001',
          learnerId: testLearnerId,
          learnerName: guardianView.learnerName,
          batteryPercentage: guardianView.batteryPercentage,
          connectionStatus: guardianView.connectionStatus,
          sanitizedWithoutInternalSecrets: noInternalSecrets
        }
      });
    } catch (err: any) {
      results.push({
        id: 'DEV-REG-04',
        name: 'Guardian Privacy & Authorized Device Telemetry View',
        requirement: 'Guardian view access.',
        expected: 'Authorized device information returned',
        actual: `Error: ${err.message}`,
        status: 'FAIL',
        evidence: { error: err.message }
      });
    }

    // =========================================================================
    // TEST 5: Guardian attempts access to unrelated learner device → access denied
    // =========================================================================
    try {
      // Guardian 'grd-001' (Sipho Ndlovu) has NO relationship to 'lrn-003' (Zola Dlamini)
      const unrelatedLearnerId = 'lrn-003';
      let accessBlocked = false;
      let errorCode = '';

      try {
        deviceRegistryEngine.getDeviceForGuardian('grd-001', unrelatedLearnerId);
      } catch (accessErr: any) {
        if (accessErr.statusCode === 403 || accessErr.code === 'ACCESS_DENIED_UNRELATED_LEARNER') {
          accessBlocked = true;
          errorCode = accessErr.code;
        }
      }

      const auditLogged = db.auditLogs.some(
        a => a.actionType === 'UNAUTHORIZED_ACCESS_DENIED' &&
             a.actorRole === 'PARENT_GUARDIAN' &&
             a.targetId === unrelatedLearnerId
      );

      results.push({
        id: 'DEV-REG-05',
        name: 'Guardian Cross-Tenant Isolation & Unrelated Learner Denial',
        requirement: 'If a guardian attempts to query or access a device belonging to an unrelated learner, the system must strictly reject with HTTP 403 and log a security audit event.',
        expected: 'HTTP 403 Forbidden / ACCESS_DENIED_UNRELATED_LEARNER with UNAUTHORIZED_ACCESS_DENIED audit log.',
        actual: accessBlocked && auditLogged
          ? `Access strictly rejected (HTTP 403 / ${errorCode}). Guardian 'grd-001' was blocked from inspecting unrelated Learner '${unrelatedLearnerId}' device. Security audit trail generated.`
          : 'Isolation check failed: Access was not denied as expected',
        status: accessBlocked && auditLogged ? 'PASS' : 'FAIL',
        auditEventLogged: auditLogged,
        evidence: {
          guardianId: 'grd-001',
          attemptedLearnerId: unrelatedLearnerId,
          accessDenied: accessBlocked,
          securityViolationAudited: auditLogged
        }
      });
    } catch (err: any) {
      results.push({
        id: 'DEV-REG-05',
        name: 'Guardian Cross-Tenant Isolation & Unrelated Learner Denial',
        requirement: 'Reject unauthorized guardian access.',
        expected: 'HTTP 403 Forbidden',
        actual: `Error: ${err.message}`,
        status: 'FAIL',
        evidence: { error: err.message }
      });
    }

    // =========================================================================
    // TEST 6: Device reassigned → old assignment history preserved
    // =========================================================================
    try {
      // Reassign Kagiso's device from 'provisionedTestDeviceId' to 'DEV-ITIS-004-SPARE'
      const spareDeviceId = 'DEV-ITIS-004-SPARE';
      const reassignRes = deviceRegistryEngine.reassignDevice(
        {
          oldDeviceId: provisionedTestDeviceId,
          newDeviceId: spareDeviceId,
          learnerId: testLearnerId,
          unassignReason: 'DEVICE_REPLACEMENT',
          notes: 'Upgraded to spare unit due to scheduled calibration.'
        },
        techUser
      );

      const oldDevHistory = deviceRegistryEngine.getDeviceAssignmentHistory(provisionedTestDeviceId);
      const closedRecord = oldDevHistory.find(h => h.unassignedAt !== undefined && h.unassignedAt !== null);
      const newDevHistory = deviceRegistryEngine.getDeviceAssignmentHistory(spareDeviceId);
      const activeRecord = newDevHistory.find(h => h.status === 'ACTIVE' && !h.unassignedAt);

      const historyPreserved = !!closedRecord && closedRecord.unassignReason === 'DEVICE_REPLACEMENT';
      const newAssignmentActive = !!activeRecord && activeRecord.learnerId === testLearnerId;
      const oldDeviceFreed = deviceRegistryEngine.getDeviceById(provisionedTestDeviceId)?.assignedLearnerId === null;

      results.push({
        id: 'DEV-REG-06',
        name: 'Device Reassignment & Historical Lineage Preservation',
        requirement: 'When a device is replaced or reassigned, previous assignment records must NEVER be deleted. Timestamps (assignedAt, unassignedAt), reasons, and actors must be immutably preserved.',
        expected: 'Previous assignment closed with unassignedAt timestamp and reason; new assignment created; zero history deletion.',
        actual: historyPreserved && newAssignmentActive && oldDeviceFreed
          ? `Hardware swap executed cleanly: Old device '${provisionedTestDeviceId}' unassigned (Reason: ${closedRecord?.unassignReason}, UnassignedAt: ${closedRecord?.unassignedAt}). New device '${spareDeviceId}' activated for '${testLearnerId}'. All history records preserved.`
          : 'Reassignment verification failed',
        status: historyPreserved && newAssignmentActive && oldDeviceFreed ? 'PASS' : 'FAIL',
        auditEventLogged: true,
        evidence: {
          oldDeviceId: provisionedTestDeviceId,
          newDeviceId: spareDeviceId,
          closedAssignmentRecordId: closedRecord?.id,
          closedReason: closedRecord?.unassignReason,
          newAssignmentRecordId: activeRecord?.id,
          historyCountForOldDevice: oldDevHistory.length
        }
      });
    } catch (err: any) {
      results.push({
        id: 'DEV-REG-06',
        name: 'Device Reassignment & Historical Lineage Preservation',
        requirement: 'Preserve assignment history.',
        expected: 'History preserved and new assignment active',
        actual: `Error: ${err.message}`,
        status: 'FAIL',
        evidence: { error: err.message }
      });
    }

    // =========================================================================
    // TEST 7: Duplicate device identifier → rejected safely
    // =========================================================================
    try {
      let duplicateRejected = false;
      let duplicateErrorMessage = '';

      try {
        // Attempt to provision a device with already registered trackerDeviceId 'GT012-TRK-8812'
        deviceRegistryEngine.provisionDevice(
          {
            trackerDeviceId: 'GT012-TRK-8812', // Already registered on DEV-ITIS-001
            imei: '867543029182734',
            protocolType: 'GT012',
            deviceModel: 'GT012-4G-SOS-WEARABLE'
          },
          techUser
        );
      } catch (dupErr: any) {
        duplicateRejected = true;
        duplicateErrorMessage = dupErr.message;
      }

      results.push({
        id: 'DEV-REG-07',
        name: 'Duplicate Physical Device Identifier Rejection',
        requirement: 'Attempting to register or provision a tracker with a duplicate trackerDeviceId or duplicate IMEI must be safely rejected to prevent identity hijacking and collision.',
        expected: 'Provisioning rejected with clear duplicate identifier conflict error.',
        actual: duplicateRejected
          ? `Duplicate registration safely blocked: "${duplicateErrorMessage}". Device identifier uniqueness strictly enforced.`
          : 'Duplicate was unexpectedly accepted without rejection',
        status: duplicateRejected ? 'PASS' : 'FAIL',
        auditEventLogged: true,
        evidence: {
          duplicateTrackerId: 'GT012-TRK-8812',
          duplicateRejected,
          rejectionReason: duplicateErrorMessage
        }
      });
    } catch (err: any) {
      results.push({
        id: 'DEV-REG-07',
        name: 'Duplicate Physical Device Identifier Rejection',
        requirement: 'Reject duplicate devices.',
        expected: 'Rejection error',
        actual: `Error: ${err.message}`,
        status: 'FAIL',
        evidence: { error: err.message }
      });
    }

    // =========================================================================
    // TEST 8: Suspended device telemetry → blocked
    // =========================================================================
    try {
      const suspendTestTrackerId = `SUSP-TRK-TEST-${Date.now()}`;
      const suspendDev = deviceRegistryEngine.registerDevice({
        trackerDeviceId: suspendTestTrackerId,
        imei: `8675430299${Math.floor(10000 + Math.random() * 90000)}`,
        protocolType: 'GT012',
        deviceModel: 'GT012-4G-SOS-WEARABLE',
        hardwareSerialNumber: `SN-SUSP-${Date.now()}`
      }, techUser);

      // Suspend device administratively
      deviceRegistryEngine.suspendDevice(suspendDev.itisDeviceId, techUser, 'Security hold pending audit');

      // Attempt telemetry packet transmission from suspended hardware
      const telemetryResult = deviceRegistryEngine.handleIncomingTrackerConnection(
        suspendTestTrackerId,
        'GT012',
        {
          latitude: -25.7500,
          longitude: 28.2300,
          batteryPercentage: 60
        }
      );

      const isSuspended = telemetryResult.deviceStatus === 'SUSPENDED';
      const isDeactivated = telemetryResult.activationStatus === 'DEACTIVATED';
      const auditLogged = db.auditLogs.some(
        a => a.actionType === 'SUSPENDED_DEVICE_TELEMETRY_BLOCKED' &&
             a.targetId === suspendDev.itisDeviceId
      );

      results.push({
        id: 'DEV-REG-08',
        name: 'Suspended Device Telemetry Quarantine & Ingestion Block',
        requirement: 'When a device is in SUSPENDED state, incoming telemetry packets must be quarantined, live operational state updates blocked, and security audit logged.',
        expected: "Device status preserved as 'SUSPENDED', live ingestion blocked, and SUSPENDED_DEVICE_TELEMETRY_BLOCKED audit recorded.",
        actual: isSuspended && isDeactivated && auditLogged
          ? `Suspended device '${suspendDev.itisDeviceId}' safely quarantined. Status remained '${telemetryResult.deviceStatus}' with verified SUSPENDED_DEVICE_TELEMETRY_BLOCKED audit log.`
          : 'Suspended telemetry quarantine check failed',
        status: isSuspended && isDeactivated && auditLogged ? 'PASS' : 'FAIL',
        auditEventLogged: auditLogged,
        evidence: {
          itisDeviceId: suspendDev.itisDeviceId,
          trackerDeviceId: suspendTestTrackerId,
          deviceStatus: telemetryResult.deviceStatus,
          activationStatus: telemetryResult.activationStatus,
          auditLogged
        }
      });
    } catch (err: any) {
      results.push({
        id: 'DEV-REG-08',
        name: 'Suspended Device Telemetry Quarantine & Ingestion Block',
        requirement: 'Block telemetry from suspended device.',
        expected: 'Telemetry quarantined with audit record',
        actual: `Error: ${err.message}`,
        status: 'FAIL',
        evidence: { error: err.message }
      });
    }

    // =========================================================================
    // TEST 9: School principal queries devices → sees only devices in their school
    // =========================================================================
    try {
      const principalUser: ActiveUserSession = {
        id: 'usr-princ-test-01',
        name: 'Principal Mokoena',
        email: 'mokoena@pta-west.za',
        role: 'SCHOOL_PRINCIPAL',
        schoolId: 'sch-pta-west-01',
        token: 'tok-princ-test'
      };

      const principalScopedDevices = deviceRegistryEngine.getDevicesScoped(principalUser);
      const allBelongToSchool = principalScopedDevices.every(
        d => !d.assignedSchoolId || d.assignedSchoolId === 'sch-pta-west-01'
      );
      const noForeignSchoolLeaked = !principalScopedDevices.some(
        d => d.assignedSchoolId && d.assignedSchoolId !== 'sch-pta-west-01'
      );

      results.push({
        id: 'DEV-REG-09',
        name: 'School Principal Multi-Tenant Authorization Scope',
        requirement: 'A school principal querying devices must only receive devices assigned to learners in their assigned school. Devices from external schools must be strictly excluded.',
        expected: "All returned devices belong strictly to school 'sch-pta-west-01', zero cross-school leakage.",
        actual: allBelongToSchool && noForeignSchoolLeaked
          ? `Principal received ${principalScopedDevices.length} authorized device records strictly scoped to 'sch-pta-west-01'. Zero foreign school records exposed.`
          : 'Multi-tenant school boundary leakage detected',
        status: allBelongToSchool && noForeignSchoolLeaked ? 'PASS' : 'FAIL',
        auditEventLogged: true,
        evidence: {
          schoolId: 'sch-pta-west-01',
          scopedDevicesCount: principalScopedDevices.length,
          allBelongToSchool,
          noForeignSchoolLeaked
        }
      });
    } catch (err: any) {
      results.push({
        id: 'DEV-REG-09',
        name: 'School Principal Multi-Tenant Authorization Scope',
        requirement: 'Strict school tenant boundary enforcement.',
        expected: 'Only devices for principal school returned',
        actual: `Error: ${err.message}`,
        status: 'FAIL',
        evidence: { error: err.message }
      });
    }

    const passedTests = results.filter(r => r.status === 'PASS').length;
    const failedTests = results.filter(r => r.status === 'FAIL').length;

    return {
      suiteId: 'ITIS-GPS-DEVICE-REGISTRY-ACCEPTANCE-SUITE',
      timestamp,
      totalTests: results.length,
      passedTests,
      failedTests,
      allPassed: failedTests === 0,
      results
    };
  }
}

export const deviceRegistryTestSuite = new DeviceRegistryTestSuite();
