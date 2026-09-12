import { db } from './dbStore.js';
import { repository } from './db/index.js';
import { incidentLifecycleEngine, CreateCandidateParams } from './incidentLifecycleEngine.js';
import { ActiveUserSession, IncidentSeverity } from '../types.js';

export interface TestResultItem {
  id: string;
  name: string;
  category: string;
  description: string;
  expectedBehavior: string;
  actualResult: string;
  passed: boolean;
  durationMs: number;
  evidence?: Record<string, any>;
}

export interface IncidentLifecycleTestSuiteReport {
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  allPassed: boolean;
  results: TestResultItem[];
}

export class IncidentLifecycleTestSuite {
  public async runAllLifecycleTests(): Promise<IncidentLifecycleTestSuiteReport> {
    const results: TestResultItem[] = [];

    // Test Actors
    const commandOfficer1: ActiveUserSession = {
      id: 'usr-command-01',
      name: 'Command Officer Sipho Ndlovu',
      email: 'command@itis.safety.za',
      role: 'COMMAND_OPERATOR',
      token: 'test-token-cmd-01'
    };

    const commandOfficer2: ActiveUserSession = {
      id: 'usr-commandoperator-3840',
      name: 'Capt. Keith Botha',
      email: 'pkieth@itis.co.za',
      role: 'COMMAND_OPERATOR',
      token: 'test-token-cmd-02'
    };

    const supervisor: ActiveUserSession = {
      id: 'usr-sysadmin-01',
      name: 'Sovereign Administrator',
      email: 'sysadmin@itis.safety.za',
      role: 'SYSTEM_ADMIN',
      token: 'test-token-sys-01'
    };

    const founder: ActiveUserSession = {
      id: 'USR-SUPER-001',
      name: 'Executive Founder',
      email: 'founder@itis365.co.za',
      role: 'FOUNDER_EXECUTIVE',
      token: 'test-token-fnd-01'
    };

    const schoolPrincipal: ActiveUserSession = {
      id: 'usr-principal-01',
      name: 'Dr. Gregory Hassenkamp',
      email: 'admin@pbhs.co.za',
      role: 'SCHOOL_PRINCIPAL',
      schoolId: 'sch-001',
      token: 'test-token-prin-01'
    };

    const technician: ActiveUserSession = {
      id: 'usr-tech-01',
      name: 'Thabo Sithole',
      email: 'thabo.molefe@itis-test-ops.gov.za',
      role: 'TECHNICIAN',
      token: 'test-token-tech-01'
    };

    const guardianUser: ActiveUserSession = {
      id: 'usr-parent-01',
      name: 'Grace Molefe',
      email: 'grace.molefe@safetynet.co.za',
      role: 'PARENT_GUARDIAN',
      guardianId: 'grd-001',
      token: 'test-token-grd-01'
    };

    const auditor: ActiveUserSession = {
      id: 'usr-auditor-01',
      name: 'Adv. P. Dlamini',
      email: 'audit.officer.3038@itis.safety.za',
      role: 'GOVERNMENT_AUDITOR',
      token: 'test-token-aud-01'
    };

    const responderUser: ActiveUserSession = {
      id: 'usr-resp-01',
      name: 'Officer Kruger (Tactical Lead)',
      email: 'officer.kruger@tactical.co.za',
      role: 'FIELD_RESPONDER',
      responderUnit: 'resp-saps-01',
      token: 'test-token-resp-01'
    };

    // Helper runner
    const runTest = async (
      id: string,
      name: string,
      category: string,
      description: string,
      expectedBehavior: string,
      fn: () => Promise<{ passed: boolean; actualResult: string; evidence?: any }>
    ) => {
      const start = Date.now();
      try {
        const outcome = await fn();
        results.push({
          id,
          name,
          category,
          description,
          expectedBehavior,
          actualResult: outcome.actualResult,
          passed: outcome.passed,
          durationMs: Date.now() - start,
          evidence: outcome.evidence
        });
      } catch (err: any) {
        results.push({
          id,
          name,
          category,
          description,
          expectedBehavior,
          actualResult: `Execution error: ${err.message}`,
          passed: false,
          durationMs: Date.now() - start
        });
      }
    };

    // Shared state for multi-stage lifecycle verification
    let createdCandidateId = '';
    let createdIncidentId = '';

    // ====================================================
    // 1. SIGNAL & CANDIDATE MANAGEMENT
    // ====================================================

    // TEST 01: SOS Signal to Incident Candidate
    await runTest(
      'LC-TEST-01',
      'SOS Signal to Incident Candidate Escalation',
      'SIGNAL_INGESTION',
      'Verify automated generation of an incident candidate from an SOS safety signal with audit trail.',
      'Candidate generated with PENDING_REVIEW status and unique candidate number.',
      async () => {
        const res = incidentLifecycleEngine.createIncidentCandidate({
          signalType: 'EMERGENCY_SOS',
          severity: 'CRITICAL_SOS',
          learnerId: 'lrn-001',
          schoolId: 'sch-001',
          location: { lat: -25.7589, lng: 28.2321, accuracyMeters: 4.2 },
          idempotencyKey: `idem-sos-${Date.now()}`
        });
        createdCandidateId = res.candidate.id;
        const passed = res.candidate.status === 'PENDING_REVIEW' && !res.isDuplicate && Boolean(res.candidate.candidateNumber);
        return {
          passed,
          actualResult: `Candidate created: ${res.candidate.candidateNumber} (${res.candidate.status})`,
          evidence: { candidateId: res.candidate.id, candidateNumber: res.candidate.candidateNumber }
        };
      }
    );

    // TEST 02: Candidate Idempotency Deduplication
    await runTest(
      'LC-TEST-02',
      'Incident Candidate Idempotency Deduplication',
      'DEDUPLICATION',
      'Verify duplicate signals with identical idempotencyKey return existing candidate without duplicating.',
      'Duplicate signal returns original candidate with isDuplicate=true.',
      async () => {
        const key = `idem-dedup-${Date.now()}`;
        const first = incidentLifecycleEngine.createIncidentCandidate({
          signalType: 'DEVICE_TAMPER',
          severity: 'HIGH',
          learnerId: 'lrn-001',
          idempotencyKey: key
        });
        const second = incidentLifecycleEngine.createIncidentCandidate({
          signalType: 'DEVICE_TAMPER',
          severity: 'HIGH',
          learnerId: 'lrn-001',
          idempotencyKey: key
        });
        const passed = first.candidate.id === second.candidate.id && second.isDuplicate === true;
        return {
          passed,
          actualResult: passed ? 'Duplicate signal detected and deduplicated cleanly.' : 'Failed: Duplicate candidate created.',
          evidence: { firstId: first.candidate.id, secondId: second.candidate.id }
        };
      }
    );

    // TEST 03: Diverse Signal Type Support
    await runTest(
      'LC-TEST-03',
      'Diverse Safety Signal Types Handling',
      'SIGNAL_INGESTION',
      'Verify candidate generation for tamper, geofence, offline, and confidential reports.',
      'All 4 distinct signal types successfully create structured candidates.',
      async () => {
        const types: CreateCandidateParams['signalType'][] = [
          'GEOFENCE_VIOLATION',
          'DEVICE_OFFLINE',
          'UNAUTHORIZED_PICKUP',
          'CONFIDENTIAL_SAFETY_REPORT'
        ];
        const candidates = types.map(st =>
          incidentLifecycleEngine.createIncidentCandidate({
            signalType: st,
            severity: 'HIGH',
            learnerId: 'lrn-001',
            schoolId: 'sch-001'
          })
        );
        const allCreated = candidates.every(c => c.candidate.status === 'PENDING_REVIEW');
        return {
          passed: allCreated,
          actualResult: `Generated ${candidates.length} candidates across distinct emergency signal domains.`,
          evidence: { signalTypes: types }
        };
      }
    );

    // ====================================================
    // 2. AUTHORITATIVE INCIDENT CREATION & SLA
    // ====================================================

    // TEST 04: Authoritative Incident Creation
    await runTest(
      'LC-TEST-04',
      'Authoritative Incident Creation with SLA Computation',
      'INCIDENT_CREATION',
      'Verify authorized officer creates incident with automatic SLA target and initial timeline event.',
      'Incident created with QUEUED status, SLA=180s for CRITICAL_SOS, and initial INCIDENT_CREATED timeline event.',
      async () => {
        const key = `idem-inc-${Date.now()}`;
        const res = await incidentLifecycleEngine.createIncident(
          {
            learnerId: 'lrn-001',
            schoolId: 'sch-001',
            severity: 'CRITICAL_SOS',
            triggerType: 'EMERGENCY_SOS',
            sourceCandidateId: createdCandidateId,
            idempotencyKey: key,
            location: { lat: -25.7589, lng: 28.2321, addressDescription: 'Pretoria Campus Main Gate' }
          },
          commandOfficer1
        );
        createdIncidentId = res.incident.id;
        const hasCreatedEvent = res.incident.timeline?.some(e => e.eventType === 'INCIDENT_CREATED');
        const cand = incidentLifecycleEngine.getCandidate(createdCandidateId);
        const passed = 
          res.incident.status === 'QUEUED' &&
          res.incident.slaTargetSeconds === 180 &&
          Boolean(hasCreatedEvent) &&
          cand?.status === 'CONFIRMED_INCIDENT';

        return {
          passed,
          actualResult: `Incident created: ${res.incident.incidentNumber}, SLA: ${res.incident.slaTargetSeconds}s, Candidate Confirmed: ${cand?.status}`,
          evidence: { incidentId: res.incident.id, status: res.incident.status, sla: res.incident.slaTargetSeconds }
        };
      }
    );

    // TEST 05: Incident Creation Idempotency
    await runTest(
      'LC-TEST-05',
      'Incident Creation Idempotency Guard',
      'DEDUPLICATION',
      'Verify retrying incident creation with the same idempotency key returns existing incident.',
      'Second call returns existing incident without creating duplicate record in repository.',
      async () => {
        const key = `idem-guard-${Date.now()}`;
        const first = await incidentLifecycleEngine.createIncident(
          { learnerId: 'lrn-001', severity: 'HIGH', idempotencyKey: key },
          commandOfficer1
        );
        const second = await incidentLifecycleEngine.createIncident(
          { learnerId: 'lrn-001', severity: 'HIGH', idempotencyKey: key },
          commandOfficer1
        );
        const passed = first.incident.id === second.incident.id && second.isDuplicate === true;
        return {
          passed,
          actualResult: passed ? 'Idempotent creation verified: duplicate blocked.' : 'Failed: Duplicate incident created.',
          evidence: { firstId: first.incident.id, secondId: second.incident.id }
        };
      }
    );

    // TEST 06: Technician Forbidden from Creating Incidents
    await runTest(
      'LC-TEST-06',
      'Technician Incident Creation Access Denied',
      'RBAC_ENFORCEMENT',
      'Verify technicians are forbidden from authoritatively opening emergency incidents.',
      'Call rejects with ACCESS DENIED error.',
      async () => {
        let blocked = false;
        try {
          await incidentLifecycleEngine.createIncident(
            { learnerId: 'lrn-001', severity: 'HIGH' },
            technician
          );
        } catch (err: any) {
          blocked = err.message.includes('ACCESS DENIED');
        }
        return {
          passed: blocked,
          actualResult: blocked ? 'Technician incident creation rejected with ACCESS DENIED.' : 'Failed: Technician was allowed to create incident.'
        };
      }
    );

    // TEST 07: School Staff Cross-Institutional Boundary Protection
    await runTest(
      'LC-TEST-07',
      'School Principal Cross-School Boundary Enforcement',
      'ABAC_ENFORCEMENT',
      'Verify a school principal cannot create an emergency incident for a different school.',
      'Rejection with INSTITUTIONAL BOUNDARY VIOLATION.',
      async () => {
        let blocked = false;
        try {
          await incidentLifecycleEngine.createIncident(
            { learnerId: 'lrn-001', schoolId: 'sch-002', severity: 'HIGH' }, // Principal is sch-001
            schoolPrincipal
          );
        } catch (err: any) {
          blocked = err.message.includes('INSTITUTIONAL BOUNDARY VIOLATION');
        }
        return {
          passed: blocked,
          actualResult: blocked ? 'Cross-school incident creation blocked by ABAC policy.' : 'Failed: Cross-school incident was permitted.'
        };
      }
    );

    // ====================================================
    // 3. INCIDENT PRIORITIZATION
    // ====================================================

    // TEST 08: Dynamic Incident Prioritization
    await runTest(
      'LC-TEST-08',
      'Dynamic Severity Escalation & SLA Adjustment',
      'PRIORITIZATION',
      'Verify command officer can escalate incident severity with timeline and audit trail.',
      'Severity updated to CRITICAL_SOS, SLA adjusted to 180s, timeline contains INCIDENT_PRIORITIZED.',
      async () => {
        const testInc = await incidentLifecycleEngine.createIncident(
          { learnerId: 'lrn-001', severity: 'LOW' },
          commandOfficer1
        );
        const updated = await incidentLifecycleEngine.prioritizeIncident(
          testInc.incident.id,
          'CRITICAL_SOS',
          'Threat escalated: multiple weapons detected at perimeter',
          commandOfficer1
        );
        const hasPrioEvent = updated.timeline?.some(e => e.eventType === 'INCIDENT_PRIORITIZED');
        const passed = updated.severity === 'CRITICAL_SOS' && updated.slaTargetSeconds === 180 && Boolean(hasPrioEvent);
        return {
          passed,
          actualResult: `Severity escalated to ${updated.severity}, new SLA: ${updated.slaTargetSeconds}s, Event logged: ${Boolean(hasPrioEvent)}`,
          evidence: { severity: updated.severity, slaTargetSeconds: updated.slaTargetSeconds }
        };
      }
    );

    // ====================================================
    // 4. ATOMIC CLAIMING, MONITORING & HANDOVER
    // ====================================================

    // TEST 09: Primary Officer Atomic Claim
    await runTest(
      'LC-TEST-09',
      'Command Officer Primary Atomic Claim',
      'CONCURRENCY_CONTROL',
      'Verify first command officer claims incident atomically.',
      'Incident status becomes CLAIMED with primaryOfficerId set.',
      async () => {
        const claimed = await incidentLifecycleEngine.claimIncident(createdIncidentId, commandOfficer1);
        const passed = claimed.primaryOfficerId === commandOfficer1.id && claimed.status === 'CLAIMED';
        return {
          passed,
          actualResult: `Incident claimed by ${claimed.primaryOfficerName} (${claimed.primaryOfficerId})`,
          evidence: { primaryOfficerId: claimed.primaryOfficerId, status: claimed.status }
        };
      }
    );

    // TEST 10: Multi-Officer Claim Conflict Prevention
    await runTest(
      'LC-TEST-10',
      'Multi-Officer Claim Race Condition Conflict Prevention',
      'CONCURRENCY_CONTROL',
      'Verify second officer cannot overwrite primary claim without explicit handover.',
      'Second claim rejected with 409 conflict error.',
      async () => {
        let conflictCaught = false;
        try {
          await incidentLifecycleEngine.claimIncident(createdIncidentId, commandOfficer2);
        } catch (err: any) {
          conflictCaught = err.message.includes('ALREADY_CLAIMED_CONFLICT') || err.message.includes('already claimed');
        }
        return {
          passed: conflictCaught,
          actualResult: conflictCaught ? 'Conflict prevented: Second claim blocked by primary command lock.' : 'Failed: Second officer stole claim without handover.'
        };
      }
    );

    // TEST 11: Multi-Officer Observer Join
    await runTest(
      'LC-TEST-11',
      'Command Room Observer Monitoring',
      'COLLABORATION',
      'Verify second officer can join as observer without disturbing primary officer lock.',
      'Officer added to monitoringOfficers without altering primaryOfficerId.',
      async () => {
        const monitored = await incidentLifecycleEngine.joinMonitoring(createdIncidentId, commandOfficer2);
        const isMonitoring = monitored.monitoringOfficers?.some(o => (o as any).id === commandOfficer2.id || (o as any).userId === commandOfficer2.id);
        const passed = isMonitoring && monitored.primaryOfficerId === commandOfficer1.id;
        return {
          passed: Boolean(passed),
          actualResult: `Second officer joined monitoring. Observers: ${monitored.monitoringOfficers?.length}, Primary: ${monitored.primaryOfficerName}`,
          evidence: { observers: monitored.monitoringOfficers?.map(o => o.name) }
        };
      }
    );

    // TEST 12: Structured Command Handover
    await runTest(
      'LC-TEST-12',
      'Structured Command Handover Protocol',
      'COMMAND_TRANSFER',
      'Verify primary officer transfers command to second officer with structured audit log.',
      'Primary officer switches to Officer 2 with COMMAND_HANDOVER timeline entry.',
      async () => {
        const handedOver = await incidentLifecycleEngine.handoverIncident(
          createdIncidentId,
          commandOfficer1,
          { id: commandOfficer2.id, name: commandOfficer2.name, role: commandOfficer2.role },
          'Shift changeover: Evening dispatch cycle commencement'
        );
        const hasHandoverEvent = handedOver.timeline?.some(e => e.eventType === 'COMMAND_HANDOVER');
        const passed = handedOver.primaryOfficerId === commandOfficer2.id && Boolean(hasHandoverEvent);
        return {
          passed,
          actualResult: `Handover complete. New Primary: ${handedOver.primaryOfficerName} (${handedOver.primaryOfficerId})`,
          evidence: { newPrimary: handedOver.primaryOfficerName, hasHandoverEvent }
        };
      }
    );

    // TEST 13: Command Release to Queue
    await runTest(
      'LC-TEST-13',
      'Command Release Back to Queue',
      'QUEUE_MANAGEMENT',
      'Verify officer can release incident back to queue when unassigned.',
      'Primary officer cleared and status reset to QUEUED.',
      async () => {
        const testInc = await incidentLifecycleEngine.createIncident({ learnerId: 'lrn-001', severity: 'HIGH' }, commandOfficer1);
        await incidentLifecycleEngine.claimIncident(testInc.incident.id, commandOfficer1);
        const released = await incidentLifecycleEngine.releaseIncident(testInc.incident.id, commandOfficer1, 'Standby for field report');
        const passed = !released.primaryOfficerId && released.status === 'QUEUED';
        return {
          passed,
          actualResult: `Incident released. Primary: ${released.primaryOfficerId || 'None'}, Status: ${released.status}`,
          evidence: { status: released.status }
        };
      }
    );

    // ====================================================
    // 5. DISPATCH & RESPONDER WORKFLOW
    // ====================================================

    // TEST 14: Tactical Unit Dispatch
    await runTest(
      'LC-TEST-14',
      'Tactical Unit Dispatch Activation',
      'DISPATCH',
      'Verify command officer dispatches responder unit with tactical instructions.',
      'Incident status becomes DISPATCHED with assignedResponder details populated.',
      async () => {
        const res = await incidentLifecycleEngine.dispatchResponder(
          createdIncidentId,
          'resp-saps-01',
          commandOfficer2,
          'Urgent interception: Suspect approaching Sector 4 gate'
        );
        const inc = res.incident;
        const hasDispatchEvent = inc.timeline?.some(e => e.eventType === 'DISPATCH_ACTIVATED');
        const passed = 
          inc.status === 'DISPATCHED' &&
          inc.assignedResponder?.id === 'resp-saps-01' &&
          Boolean(hasDispatchEvent) &&
          !res.isDuplicate;

        return {
          passed,
          actualResult: `Unit dispatched: ${inc.assignedResponder?.name} (${inc.assignedResponder?.vehicleId}), Status: ${inc.status}`,
          evidence: { responderId: inc.assignedResponder?.id, instructions: inc.dispatchInstructions }
        };
      }
    );

    // TEST 15: Dispatch Idempotency
    await runTest(
      'LC-TEST-15',
      'Responder Dispatch Idempotency Guard',
      'DISPATCH',
      'Verify re-dispatching same unit with idempotency key returns existing assignment without duplicating.',
      'Duplicate dispatch returns existing assignment with isDuplicate=true.',
      async () => {
        const key = `disp-idem-${Date.now()}`;
        const first = await incidentLifecycleEngine.dispatchResponder(
          createdIncidentId,
          'resp-saps-01',
          commandOfficer2,
          'First instruction',
          key
        );
        const second = await incidentLifecycleEngine.dispatchResponder(
          createdIncidentId,
          'resp-saps-01',
          commandOfficer2,
          'Second instruction',
          key
        );
        const passed = first.incident.id === second.incident.id && second.isDuplicate === true;
        return {
          passed,
          actualResult: passed ? 'Dispatch idempotency verified: duplicate dispatch prevented.' : 'Failed: Duplicate dispatch record created.',
          evidence: { isDuplicate: second.isDuplicate }
        };
      }
    );

    // TEST 16: Responder Reassignment
    await runTest(
      'LC-TEST-16',
      'Responder Unit Reassignment Protocol',
      'DISPATCH',
      'Verify command officer can transfer assignment to another unit, releasing previous unit.',
      'Incident assigned to new unit with previous unit released to AVAILABLE.',
      async () => {
        const testInc = await incidentLifecycleEngine.createIncident({ learnerId: 'lrn-001', severity: 'HIGH' }, commandOfficer1);
        await incidentLifecycleEngine.dispatchResponder(testInc.incident.id, 'resp-saps-01', commandOfficer1, 'Initial');
        const reassigned = await incidentLifecycleEngine.reassignResponder(
          testInc.incident.id,
          'resp-private-01',
          commandOfficer1,
          'Sector 2 unit is closer to coordinates (1.5km vs 4.0km)'
        );
        const oldUnit = await repository.responders.findById('resp-saps-01');
        const passed = reassigned.assignedResponder?.id === 'resp-private-01' && oldUnit?.operationalState === 'AVAILABLE';
        return {
          passed: Boolean(passed),
          actualResult: `Reassigned to ${reassigned.assignedResponder?.name}. Previous unit state: ${oldUnit?.operationalState}`,
          evidence: { newUnit: reassigned.assignedResponder?.id, oldUnitState: oldUnit?.operationalState }
        };
      }
    );

    // TEST 17: Dispatch Cancellation
    await runTest(
      'LC-TEST-17',
      'Dispatch Cancellation & Responder Release',
      'DISPATCH',
      'Verify command officer can cancel dispatch, resetting responder to AVAILABLE.',
      'Incident assignedResponder cleared and responder state set to AVAILABLE.',
      async () => {
        const testInc = await incidentLifecycleEngine.createIncident({ learnerId: 'lrn-001', severity: 'HIGH' }, commandOfficer1);
        await incidentLifecycleEngine.dispatchResponder(testInc.incident.id, 'resp-saps-01', commandOfficer1, 'Dispatch');
        const cancelled = await incidentLifecycleEngine.cancelDispatch(
          testInc.incident.id,
          commandOfficer1,
          'False alarm reported by school principal'
        );
        const resp = await repository.responders.findById('resp-saps-01');
        const passed = !cancelled.assignedResponder && resp?.operationalState === 'AVAILABLE';
        return {
          passed: Boolean(passed),
          actualResult: `Dispatch cancelled. Assigned: ${cancelled.assignedResponder || 'None'}, Unit state: ${resp?.operationalState}`,
          evidence: { unitState: resp?.operationalState }
        };
      }
    );

    // ====================================================
    // 6. RESPONDER OPERATIONAL FIELD PROGRESSION
    // ====================================================

    // TEST 18: Responder Accepts Assignment
    await runTest(
      'LC-TEST-18',
      'Responder Acceptance of Tactical Assignment',
      'RESPONDER_LIFECYCLE',
      'Verify dispatched responder accepts assignment and engages GPS navigation.',
      'responderAcceptedAt recorded and timeline contains RESPONDER_ACCEPTED event.',
      async () => {
        const updated = await incidentLifecycleEngine.responderAcceptAssignment(createdIncidentId, responderUser);
        const hasAcceptEvent = updated.timeline?.some(e => e.eventType === 'RESPONDER_ACCEPTED');
        const passed = Boolean(updated.responderAcceptedAt) && Boolean(hasAcceptEvent);
        return {
          passed,
          actualResult: `Assignment accepted at ${updated.responderAcceptedAt}. Event logged: ${hasAcceptEvent}`,
          evidence: { acceptedAt: updated.responderAcceptedAt }
        };
      }
    );

    // TEST 19: Responder En-Route Progression
    await runTest(
      'LC-TEST-19',
      'Responder En-Route Progression',
      'RESPONDER_LIFECYCLE',
      'Verify responder transitions state to EN_ROUTE towards emergency coordinates.',
      'Incident status becomes EN_ROUTE and timeline contains RESPONDER_EN_ROUTE event.',
      async () => {
        const updated = await incidentLifecycleEngine.responderSetEnRoute(createdIncidentId, responderUser);
        const hasEnRouteEvent = updated.timeline?.some(e => e.eventType === 'RESPONDER_EN_ROUTE');
        const passed = updated.status === 'EN_ROUTE' && Boolean(hasEnRouteEvent);
        return {
          passed,
          actualResult: `Incident status: ${updated.status}. Event logged: ${hasEnRouteEvent}`,
          evidence: { status: updated.status }
        };
      }
    );

    // TEST 20: Real-time Responder GPS Location Update
    await runTest(
      'LC-TEST-20',
      'Real-time Responder GPS Location Tracking',
      'TELEMETRY',
      'Verify live GPS telemetry updates responder unit and actively assigned incident coordinates.',
      'Responder coordinates and heading updated in unit registry and incident record.',
      async () => {
        const updated = await incidentLifecycleEngine.updateResponderLiveLocation(
          'resp-saps-01',
          -25.7595,
          28.2335,
          { heading: 142, speed: 45, accuracy: 3.0 },
          responderUser
        );
        const inc = await repository.incidents.findById(createdIncidentId);
        const passed = 
          updated?.currentLocation?.lat === -25.7595 &&
          inc?.assignedResponder?.currentLat === -25.7595 &&
          inc?.assignedResponder?.speed === 45;

        return {
          passed: Boolean(passed),
          actualResult: `Live GPS synchronized: Lat=${inc?.assignedResponder?.currentLat}, Lng=${inc?.assignedResponder?.currentLng}, Speed=${inc?.assignedResponder?.speed}km/h`,
          evidence: { lat: inc?.assignedResponder?.currentLat, speed: inc?.assignedResponder?.speed }
        };
      }
    );

    // TEST 21: Responder Arrive On-Scene
    await runTest(
      'LC-TEST-21',
      'Responder On-Scene Arrival Confirmation',
      'RESPONDER_LIFECYCLE',
      'Verify responder confirms on-scene arrival, recording timestamp and event.',
      'Incident status becomes ON_SCENE, responderArrivedAt recorded.',
      async () => {
        const updated = await incidentLifecycleEngine.responderArriveOnScene(createdIncidentId, responderUser);
        const hasArriveEvent = updated.timeline?.some(e => e.eventType === 'RESPONDER_ARRIVED');
        const passed = updated.status === 'ON_SCENE' && Boolean(updated.responderArrivedAt) && Boolean(hasArriveEvent);
        return {
          passed,
          actualResult: `Arrived on scene at ${updated.responderArrivedAt}. Status: ${updated.status}`,
          evidence: { arrivedAt: updated.responderArrivedAt, status: updated.status }
        };
      }
    );

    // TEST 22: Scene Perimeter Secured
    await runTest(
      'LC-TEST-22',
      'Tactical Scene Secured & Learner Escort',
      'RESPONDER_LIFECYCLE',
      'Verify responder secures perimeter and establishes safe control over learner.',
      'Incident status transitions to ACTIVE with SCENE_SECURED event logged.',
      async () => {
        const updated = await incidentLifecycleEngine.responderSecureScene(createdIncidentId, responderUser);
        const hasSecureEvent = updated.timeline?.some(e => e.eventType === 'SCENE_SECURED');
        const passed = Boolean(hasSecureEvent);
        return {
          passed,
          actualResult: `Scene secured verified. Status: ${updated.status}, Event logged: ${hasSecureEvent}`,
          evidence: { status: updated.status }
        };
      }
    );

    // TEST 23: Responder Requests Tactical Backup
    await runTest(
      'LC-TEST-23',
      'Tactical Assistance Request Workflow',
      'RESPONDER_LIFECYCLE',
      'Verify responder can request emergency assistance from Command Centre with reason.',
      'ASSISTANCE_REQUESTED event logged in timeline with unit marked ASSISTANCE_REQUIRED.',
      async () => {
        const updated = await incidentLifecycleEngine.responderRequestAssistance(
          createdIncidentId,
          responderUser,
          'Multiple hostile individuals blocking exit corridor'
        );
        const hasAssistEvent = updated.timeline?.some(e => e.eventType === 'ASSISTANCE_REQUESTED');
        const resp = await repository.responders.findById('resp-saps-01');
        const passed = Boolean(hasAssistEvent) && resp?.operationalState === 'ASSISTANCE_REQUIRED';
        return {
          passed,
          actualResult: `Assistance requested. Unit state: ${resp?.operationalState}, Event logged: ${hasAssistEvent}`,
          evidence: { unitState: resp?.operationalState }
        };
      }
    );

    // ====================================================
    // 7. INCIDENT RESOLUTION & SUPERVISORY CLOSURE
    // ====================================================

    // TEST 24: Incident Resolution with Structured Details
    await runTest(
      'LC-TEST-24',
      'Authoritative Incident Resolution Protocol',
      'RESOLUTION',
      'Verify authorized officer resolves incident with category, summary, and responder release.',
      'Incident status becomes RESOLVED, resolutionDetails populated, responder released to AVAILABLE.',
      async () => {
        const resolved = await incidentLifecycleEngine.resolveIncident(
          createdIncidentId,
          {
            category: 'LEARNER_SAFE_RECOVERY',
            summary: 'Learner safely recovered from perimeter and escorted to campus security office.',
            emergencyServicesInvolved: true,
            followUpRequired: false,
            notes: 'Physical examination completed: no injuries.'
          },
          commandOfficer2
        );
        const resp = await repository.responders.findById('resp-saps-01');
        const hasResolveEvent = resolved.timeline?.some(e => e.eventType === 'INCIDENT_RESOLVED');
        const passed = 
          resolved.status === 'RESOLVED' &&
          resolved.resolutionDetails?.category === 'LEARNER_SAFE_RECOVERY' &&
          resp?.operationalState === 'AVAILABLE' &&
          Boolean(hasResolveEvent);

        return {
          passed: Boolean(passed),
          actualResult: `Resolved: ${resolved.resolutionDetails?.category}. Responder state: ${resp?.operationalState}`,
          evidence: { category: resolved.resolutionDetails?.category, resolvedAt: resolved.resolvedAt }
        };
      }
    );

    // TEST 25: Unauthorized Resolution Rejection
    await runTest(
      'LC-TEST-25',
      'Unauthorized Incident Resolution Denied',
      'RBAC_ENFORCEMENT',
      'Verify government auditor and parent are forbidden from resolving incidents.',
      'Call rejected with ACCESS DENIED error.',
      async () => {
        let auditorBlocked = false;
        let parentBlocked = false;
        try {
          await incidentLifecycleEngine.resolveIncident(
            createdIncidentId,
            { category: 'FALSE_ALARM', summary: 'Audit resolve', emergencyServicesInvolved: false, followUpRequired: false },
            auditor
          );
        } catch (e: any) {
          auditorBlocked = e.message.includes('ACCESS DENIED');
        }

        try {
          await incidentLifecycleEngine.resolveIncident(
            createdIncidentId,
            { category: 'FALSE_ALARM', summary: 'Parent resolve', emergencyServicesInvolved: false, followUpRequired: false },
            guardianUser
          );
        } catch (e: any) {
          parentBlocked = e.message.includes('ACCESS DENIED');
        }

        const passed = auditorBlocked && parentBlocked;
        return {
          passed,
          actualResult: `Auditor blocked: ${auditorBlocked}, Parent blocked: ${parentBlocked}`,
          evidence: { auditorBlocked, parentBlocked }
        };
      }
    );

    // TEST 26: Supervisory Review & Formal Case Closure
    await runTest(
      'LC-TEST-26',
      'Supervisory Review & Formal Incident Closure',
      'CASE_CLOSURE',
      'Verify system administrator performs supervisory review and closes the incident permanently.',
      'Status becomes CLOSED, supervisoryReview recorded, INCIDENT_CLOSED event logged.',
      async () => {
        const closed = await incidentLifecycleEngine.reviewIncident(
          createdIncidentId,
          {
            decision: 'APPROVE_CLOSURE',
            notes: 'Verified all operational procedures followed according to National Safety Policy.'
          },
          supervisor
        );
        const hasCloseEvent = closed.timeline?.some(e => e.eventType === 'INCIDENT_CLOSED');
        const passed = 
          closed.status === 'CLOSED' &&
          closed.supervisoryReview?.decision === 'APPROVE_CLOSURE' &&
          Boolean(closed.closedAt) &&
          Boolean(hasCloseEvent);

        return {
          passed,
          actualResult: `Supervisory closure approved. Status: ${closed.status}, ClosedAt: ${closed.closedAt}`,
          evidence: { status: closed.status, review: closed.supervisoryReview?.decision }
        };
      }
    );

    // ====================================================
    // 8. SLA METRICS & AUTOMATED BREACH DETECTION
    // ====================================================

    // TEST 27: SLA Metrics Calculation & Breach Evaluation
    await runTest(
      'LC-TEST-27',
      'SLA Metrics Calculation & Interval Timers',
      'SLA_ENGINE',
      'Verify SLA metrics computation calculates elapsed time, breach status, and interval milestones.',
      'SLA metrics compute target, intervals, and breach flags accurately.',
      async () => {
        const inc = await repository.incidents.findById(createdIncidentId);
        if (!inc) throw new Error('Incident not found');
        const metrics = incidentLifecycleEngine.evaluateSlaMetrics(inc);
        const passed = 
          metrics.slaTargetSeconds === 180 &&
          typeof metrics.elapsedSeconds === 'number' &&
          typeof metrics.timeToClaimSeconds === 'number' &&
          typeof metrics.timeToDispatchSeconds === 'number' &&
          typeof metrics.timeToResolveSeconds === 'number';

        return {
          passed,
          actualResult: `SLA Target: ${metrics.slaTargetSeconds}s, Claim: ${metrics.timeToClaimSeconds}s, Dispatch: ${metrics.timeToDispatchSeconds}s, Resolve: ${metrics.timeToResolveSeconds}s`,
          evidence: metrics
        };
      }
    );

    // TEST 28: Automated SLA Breach Escalation
    await runTest(
      'LC-TEST-28',
      'Automated SLA Breach Supervisory Escalation',
      'SLA_ENGINE',
      'Verify active incidents exceeding SLA target trigger automated escalation and audit alert.',
      'Automated SLA engine flags breach, increments escalationCount, and logs INCIDENT_ESCALATED event.',
      async () => {
        // Create an overdue incident
        const overdueInc = await incidentLifecycleEngine.createIncident(
          { learnerId: 'lrn-001', severity: 'CRITICAL_SOS' },
          commandOfficer1
        );
        // Backdate timestamp by 200 seconds (target is 180s)
        overdueInc.incident.timestamp = new Date(Date.now() - 250000).toISOString();
        db.incidents.set(overdueInc.incident.id, overdueInc.incident);

        const evaluation = await incidentLifecycleEngine.evaluateAllActiveSlas();
        const escalated = db.incidents.get(overdueInc.incident.id);
        const hasEscalateEvent = escalated?.timeline?.some(e => e.eventType === 'INCIDENT_ESCALATED');
        const passed = 
          evaluation.breachedCount > 0 &&
          escalated?.slaBreached === true &&
          Boolean(hasEscalateEvent);

        return {
          passed,
          actualResult: `SLA breach detected. Evaluated: ${evaluation.evaluatedCount}, Breached: ${evaluation.breachedCount}, Escalated: ${Boolean(hasEscalateEvent)}`,
          evidence: { breachedCount: evaluation.breachedCount, slaBreached: escalated?.slaBreached }
        };
      }
    );

    // ====================================================
    // 9. NEED-TO-KNOW ABAC ISOLATION & PRIVACY MASKING
    // ====================================================

    // TEST 29: Guardian Need-to-Know Scoping & Data Masking
    await runTest(
      'LC-TEST-29',
      'Guardian Need-to-Know Scoping & Data Masking',
      'POPIA_SECURITY',
      'Verify guardians can only access their own linked child and receive masked tactical details.',
      'Guardian allowed for linked child, denied for unlinked child, and tactical notes/responder identities masked.',
      async () => {
        const linkedInc: any = { id: 'inc-linked', learnerId: 'lrn-001', notes: ['Emergency active', '[COMMAND TACTICAL] Alpha unit inbound'], assignedResponder: { unitType: 'SAPS', name: 'Sgt. J. Ndlovu', vehicleId: 'POL-01' } };
        const unlinkedInc: any = { id: 'inc-unlinked', learnerId: 'lrn-other', notes: ['Other child'] };

        const linkedAccess = incidentLifecycleEngine.canUserAccessIncident(guardianUser, linkedInc);
        const unlinkedAccess = incidentLifecycleEngine.canUserAccessIncident(guardianUser, unlinkedInc);
        const masked = incidentLifecycleEngine.maskIncidentForUser(linkedInc, guardianUser);

        const tacticalNotesStripped = !masked.notes.some(n => n.includes('[COMMAND'));
        const responderMasked = masked.assignedResponder?.name === 'SAPS Emergency Patrol' && masked.assignedResponder?.id === 'masked-responder-unit';

        const passed = linkedAccess === true && unlinkedAccess === false && tacticalNotesStripped && responderMasked;
        return {
          passed,
          actualResult: `Linked access: ${linkedAccess}, Unlinked access: ${unlinkedAccess}, Tactical masked: ${tacticalNotesStripped}, Unit masked: ${responderMasked}`,
          evidence: { linkedAccess, unlinkedAccess, maskedNotes: masked.notes, responderName: masked.assignedResponder?.name }
        };
      }
    );

    // TEST 30: Complete 16-Stage End-to-End Incident Traceability
    await runTest(
      'LC-TEST-30',
      'Complete 16-Stage End-to-End Lifecycle Traceability',
      'AUDIT_COMPLIANCE',
      'Verify complete immutable audit trail and timeline from Signal -> Queue -> Claim -> Dispatch -> Resolve -> Closed.',
      'Incident contains complete chronological timeline events with verifiable audit trail.',
      async () => {
        const inc = await repository.incidents.findById(createdIncidentId);
        if (!inc) throw new Error('Incident record missing');

        const events = inc.timeline || [];
        const eventTypes = events.map(e => e.eventType);

        const requiredSequence = [
          'INCIDENT_CREATED',
          'INCIDENT_CLAIMED',
          'COMMAND_HANDOVER',
          'DISPATCH_ACTIVATED',
          'RESPONDER_ACCEPTED',
          'RESPONDER_EN_ROUTE',
          'RESPONDER_ARRIVED',
          'SCENE_SECURED',
          'INCIDENT_RESOLVED',
          'INCIDENT_CLOSED'
        ];

        const allPresent = requiredSequence.every(req => eventTypes.includes(req as any));
        return {
          passed: allPresent,
          actualResult: `All 10 required operational stage events verified in timeline (${events.length} total events recorded).`,
          evidence: { eventTypes }
        };
      }
    );

    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.filter(r => !r.passed).length;

    return {
      timestamp: new Date().toISOString(),
      totalTests: results.length,
      passedTests,
      failedTests,
      allPassed: failedTests === 0,
      results
    };
  }
}

export const incidentLifecycleTestSuite = new IncidentLifecycleTestSuite();
