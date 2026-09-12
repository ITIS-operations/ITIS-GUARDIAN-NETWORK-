/**
 * ITIS GUARDIAN NETWORK — GPS TELEMETRY INCIDENT DETECTION & SAFETY AUTOMATION ENGINE
 * 
 * Controlled server-side safety automation layer:
 * - Detects configured telemetry conditions (offline, silence, route deviation, geofence, stationary, tamper, low battery, SOS)
 * - Authoritative Validation -> Rule Evaluation -> Safety Alert -> Incident Evaluation -> Command Centre Queue
 * - Comprehensive deduplication, cooldown windows, repeated alert suppression, and incident correlation
 * - STRICT SAFETY DIRECTIVE: Under NO circumstances does this system automatically dispatch real emergency services.
 *   All dispatches require explicit human commanding officer authorization.
 */

import {
  SafetyAutomationEventType,
  SafetyRuleSeverity,
  SafetyRuleThresholds,
  SafetyRuleConfig,
  SafetyAlertRecord,
  SafetyAutomationEngineConfig,
  SafetyAutomationEvaluationResult,
  ActiveUserSession,
  AuthoritativeTelemetryRecord,
  IncidentAlert,
  IncidentSeverity,
  SafetySignal,
  SafetySignalType,
  SafetySignalSource,
  IncidentCandidate,
  SafetyIntelligenceEvaluationResult
} from '../types.js';
import { db } from './dbStore.js';
import { repository } from './db/index.js';

// Calculate distance in meters using Haversine formula
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Radius of the Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class SafetyAutomationEngine {
  private config: SafetyAutomationEngineConfig;
  private alerts: Map<string, SafetyAlertRecord> = new Map();
  // Cooldown tracker: key is `${ruleId}:${deviceId}`
  private cooldowns: Map<string, { lastTriggeredAt: number; suppressedCount: number }> = new Map();

  // Prompt 20 Safety Intelligence Signal & Incident Candidate Stores
  private safetySignals: Map<string, SafetySignal> = new Map();
  private incidentCandidates: Map<string, IncidentCandidate> = new Map();
  private signalCooldowns: Map<string, { lastGeneratedAt: number; count: number }> = new Map();

  // Active listener for incident delta events (provided by server.ts if registered)
  private deltaNotifier: ((eventType: string, data: any) => void) | null = null;

  constructor() {
    this.config = this.getDefaultConfig();
  }

  public setDeltaNotifier(notifier: (eventType: string, data: any) => void): void {
    this.deltaNotifier = notifier;
  }

  private getDefaultConfig(): SafetyAutomationEngineConfig {
    return {
      globalEnabled: true,
      rules: [
        {
          ruleId: 'RULE_DEVICE_OFFLINE',
          eventType: 'DEVICE_OFFLINE',
          name: 'Device Offline Detection',
          description: 'Triggers when a registered active tracker ceases communication beyond the configured threshold.',
          enabled: true,
          severity: 'MEDIUM',
          cooldownSeconds: 300,
          thresholds: {
            offlineSilenceSeconds: 900 // 15 minutes default
          },
          autoEscalateToIncident: false,
          suppressionWindowSeconds: 300
        },
        {
          ruleId: 'RULE_PROLONGED_SILENCE',
          eventType: 'PROLONGED_SILENCE',
          name: 'Prolonged Telemetry Silence',
          description: 'Elevated safety trigger when communication silence persists past safe margins.',
          enabled: true,
          severity: 'HIGH',
          cooldownSeconds: 600,
          thresholds: {
            prolongedSilenceSeconds: 1800 // 30 minutes default
          },
          autoEscalateToIncident: false,
          suppressionWindowSeconds: 600
        },
        {
          ruleId: 'RULE_UNEXPECTED_ROUTE_DEVIATION',
          eventType: 'UNEXPECTED_ROUTE_DEVIATION',
          name: 'Unexpected Route Deviation',
          description: 'Detects significant lateral variance from safe school transit corridors.',
          enabled: true,
          severity: 'MEDIUM',
          cooldownSeconds: 300,
          thresholds: {
            routeDeviationMeters: 300
          },
          autoEscalateToIncident: false,
          suppressionWindowSeconds: 300
        },
        {
          ruleId: 'RULE_GEOFENCE_EXIT',
          eventType: 'GEOFENCE_EXIT',
          name: 'School Geofence Perimeter Exit',
          description: 'Detects departure outside the authoritative school safe zone during active hours.',
          enabled: true,
          severity: 'HIGH',
          cooldownSeconds: 300,
          thresholds: {
            geofenceBufferMeters: 50
          },
          autoEscalateToIncident: false,
          suppressionWindowSeconds: 300
        },
        {
          ruleId: 'RULE_GEOFENCE_ENTRY',
          eventType: 'GEOFENCE_ENTRY',
          name: 'School Geofence Perimeter Arrival',
          description: 'Detects confirmed safe entry into authoritative school safe zone perimeter.',
          enabled: true,
          severity: 'LOW',
          cooldownSeconds: 600,
          thresholds: {
            geofenceBufferMeters: 50
          },
          autoEscalateToIncident: false,
          suppressionWindowSeconds: 600
        },
        {
          ruleId: 'RULE_UNUSUAL_STATIONARY',
          eventType: 'UNUSUAL_STATIONARY',
          name: 'Unusual Stationary Transit Dwell',
          description: 'Detects zero velocity dwelling during expected transit windows outside registered zones.',
          enabled: true,
          severity: 'MEDIUM',
          cooldownSeconds: 600,
          thresholds: {
            stationaryMinutes: 30,
            speedThresholdKmh: 1.0
          },
          autoEscalateToIncident: false,
          suppressionWindowSeconds: 600
        },
        {
          ruleId: 'RULE_TRACKER_TAMPER',
          eventType: 'TRACKER_TAMPER',
          name: 'Tracker Physical Tamper / Removal Alert',
          description: 'Hardware optical sensor or teardown switch trigger indicates device detachment.',
          enabled: true,
          severity: 'CRITICAL_SOS',
          cooldownSeconds: 120,
          thresholds: {
            tamperFlagsSupported: true
          },
          autoEscalateToIncident: true,
          autoEscalateSeverity: 'CRITICAL_SOS',
          suppressionWindowSeconds: 120
        },
        {
          ruleId: 'RULE_LOW_BATTERY',
          eventType: 'LOW_BATTERY',
          name: 'Critical Battery Depletion',
          description: 'Battery charge level drops below threshold, threatening telemetry continuity.',
          enabled: true,
          severity: 'LOW',
          cooldownSeconds: 1800,
          thresholds: {
            lowBatteryPercentage: 15
          },
          autoEscalateToIncident: false,
          suppressionWindowSeconds: 1800
        },
        {
          ruleId: 'RULE_EMERGENCY_SOS',
          eventType: 'EMERGENCY_SOS',
          name: 'Emergency Distress Beacon / SOS Packet',
          description: 'Immediate child distress packet broadcast via GT012 hardware button or companion beacon.',
          enabled: true,
          severity: 'CRITICAL_SOS',
          cooldownSeconds: 60,
          thresholds: {
            requireSosConfirmation: false
          },
          autoEscalateToIncident: true,
          autoEscalateSeverity: 'CRITICAL_SOS',
          suppressionWindowSeconds: 60
        }
      ],
      suppressionPolicy: {
        defaultCooldownSeconds: 300,
        maxSuppressionWindowSeconds: 3600
      },
      incidentCorrelationWindowMinutes: 120,
      dispatchPolicy: {
        autoDispatchRealServices: false,
        humanAuthorizationRequired: true
      }
    };
  }

  // ----------------------------------------------------
  // CONFIGURATION MANAGEMENT & RBAC
  // ----------------------------------------------------
  public getConfig(): SafetyAutomationEngineConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  public updateConfig(
    updates: Partial<SafetyAutomationEngineConfig>,
    actor: ActiveUserSession
  ): SafetyAutomationEngineConfig {
    this.assertAuthorizedToConfigure(actor);

    if (updates.globalEnabled !== undefined) {
      this.config.globalEnabled = Boolean(updates.globalEnabled);
    }
    if (updates.incidentCorrelationWindowMinutes !== undefined) {
      this.config.incidentCorrelationWindowMinutes = Math.max(1, Number(updates.incidentCorrelationWindowMinutes));
    }
    if (updates.suppressionPolicy) {
      this.config.suppressionPolicy = {
        ...this.config.suppressionPolicy,
        ...updates.suppressionPolicy
      };
    }
    // Strictly preserve dispatch safety policy
    this.config.dispatchPolicy = {
      autoDispatchRealServices: false,
      humanAuthorizationRequired: true
    };

    if (updates.rules && Array.isArray(updates.rules)) {
      for (const updatedRule of updates.rules) {
        const idx = this.config.rules.findIndex(r => r.ruleId === updatedRule.ruleId);
        if (idx !== -1) {
          this.config.rules[idx] = {
            ...this.config.rules[idx],
            ...updatedRule,
            thresholds: {
              ...this.config.rules[idx].thresholds,
              ...(updatedRule.thresholds || {})
            }
          };
        } else {
          this.config.rules.push(updatedRule);
        }
      }
    }

    db.logAuditEvent({
      actionType: 'SAFETY_AUTOMATION_CONFIGURED',
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      targetEntity: 'SYSTEM',
      targetId: 'SAFETY_AUTOMATION_ENGINE',
      details: {
        globalEnabled: this.config.globalEnabled,
        rulesCount: this.config.rules.length,
        timestamp: new Date().toISOString()
      }
    });

    return this.getConfig();
  }

  public updateRule(
    ruleId: string,
    updates: Partial<SafetyRuleConfig>,
    actor: ActiveUserSession
  ): SafetyRuleConfig {
    this.assertAuthorizedToConfigure(actor);

    const rule = this.config.rules.find(r => r.ruleId === ruleId);
    if (!rule) {
      throw new Error(`Automation rule with ID "${ruleId}" not found.`);
    }

    if (updates.enabled !== undefined) rule.enabled = Boolean(updates.enabled);
    if (updates.severity !== undefined) rule.severity = updates.severity;
    if (updates.cooldownSeconds !== undefined) rule.cooldownSeconds = Math.max(10, Number(updates.cooldownSeconds));
    if (updates.autoEscalateToIncident !== undefined) rule.autoEscalateToIncident = Boolean(updates.autoEscalateToIncident);
    if (updates.autoEscalateSeverity !== undefined) rule.autoEscalateSeverity = updates.autoEscalateSeverity;
    if (updates.thresholds) {
      rule.thresholds = {
        ...rule.thresholds,
        ...updates.thresholds
      };
    }

    db.logAuditEvent({
      actionType: 'SAFETY_AUTOMATION_CONFIGURED',
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      targetEntity: 'AUTOMATION_RULE',
      targetId: ruleId,
      details: {
        ruleId,
        eventType: rule.eventType,
        enabled: rule.enabled,
        severity: rule.severity,
        cooldownSeconds: rule.cooldownSeconds,
        thresholds: rule.thresholds
      }
    });

    return JSON.parse(JSON.stringify(rule));
  }

  public assertAuthorizedToConfigure(actor: ActiveUserSession): void {
    if (actor.role !== 'SYSTEM_ADMIN' && actor.role !== 'FOUNDER_EXECUTIVE') {
      db.logAuditEvent({
        actionType: 'SECURITY_VIOLATION_RECORDED',
        actorUserId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        targetEntity: 'SYSTEM',
        targetId: 'SAFETY_AUTOMATION_ENGINE',
        details: {
          reason: 'Unauthorized attempt to modify safety automation configuration.',
          requiredRoles: ['SYSTEM_ADMIN', 'FOUNDER_EXECUTIVE']
        }
      });
      throw new Error('Access Denied: Only System Administrators and Founder Executives may configure safety automation.');
    }
  }

  public assertAuthorizedToView(actor: ActiveUserSession): void {
    const authorized = [
      'SYSTEM_ADMIN',
      'FOUNDER_EXECUTIVE',
      'COMMAND_OPERATOR',
      'GOVERNMENT_AUDITOR'
    ];
    if (!authorized.includes(actor.role)) {
      throw new Error('Access Denied: You do not have operational clearance to view safety automation queue.');
    }
  }

  // ----------------------------------------------------
  // AUTHORITATIVE TELEMETRY RULE EVALUATION PIPELINE
  // ----------------------------------------------------
  public async evaluateTelemetry(
    telemetry: AuthoritativeTelemetryRecord,
    actor?: ActiveUserSession
  ): Promise<SafetyAutomationEvaluationResult> {
    const result: SafetyAutomationEvaluationResult = {
      evaluated: false,
      alertsTriggered: [],
      alertsSuppressed: [],
      correlatedIncidents: [],
      escalatedIncidents: []
    };

    if (!this.config.globalEnabled) {
      return result;
    }

    result.evaluated = true;

    // Resolve context: device, learner, school
    const deviceId = telemetry.deviceId;
    const trackerDeviceId = telemetry.trackerDeviceId;
    const learnerId = telemetry.learnerId;
    let learner: any = null;
    let school: any = null;

    if (learnerId) {
      learner = db.learners.get(learnerId);
    }
    const schoolId = telemetry.schoolId || learner?.schoolId;
    if (schoolId) {
      school = db.schools.get(schoolId);
    }

    // Evaluate each enabled rule
    for (const rule of this.config.rules) {
      if (!rule.enabled) continue;

      let triggered = false;
      let alertTitle = '';
      let alertDescription = '';
      const customDetails: Record<string, any> = {};

      switch (rule.eventType) {
        case 'EMERGENCY_SOS': {
          if (telemetry.isSos || telemetry.packetType === 'ALARM' || telemetry.alarmType === 'SOS') {
            triggered = true;
            alertTitle = `SOS Distress Signal - ${learner ? (learner.firstName + ' ' + learner.lastName) : trackerDeviceId}`;
            alertDescription = `Immediate distress packet received from tracker ${trackerDeviceId} at (${telemetry.latitude.toFixed(4)}, ${telemetry.longitude.toFixed(4)}).`;
            customDetails.sosTrigger = true;
          }
          break;
        }

        case 'TRACKER_TAMPER': {
          if (
            telemetry.alarmType === 'TAMPER' ||
            telemetry.alarmType === 'REMOVAL' ||
            telemetry.alarmType === 'DETACH' ||
            (telemetry as any).tamperAlert === true
          ) {
            triggered = true;
            alertTitle = `Tracker Tamper / Removal Alert - ${trackerDeviceId}`;
            alertDescription = `Physical removal switch or optical tamper sensor triggered on device ${trackerDeviceId}.`;
            customDetails.tamperSensor = true;
          }
          break;
        }

        case 'LOW_BATTERY': {
          const thresholdPct = rule.thresholds.lowBatteryPercentage ?? 15;
          if (telemetry.batteryLevel !== undefined && telemetry.batteryLevel <= thresholdPct) {
            triggered = true;
            alertTitle = `Low Battery Alert (${telemetry.batteryLevel}%) - ${trackerDeviceId}`;
            alertDescription = `Battery charge dropped to ${telemetry.batteryLevel}%, below safety threshold (${thresholdPct}%).`;
            customDetails.batteryLevel = telemetry.batteryLevel;
            customDetails.thresholdPct = thresholdPct;
          }
          break;
        }

        case 'GEOFENCE_EXIT': {
          if (school && school.geofenceCenter) {
            const dist = calculateDistanceMeters(
              telemetry.latitude,
              telemetry.longitude,
              school.geofenceCenter.lat,
              school.geofenceCenter.lng
            );
            const buffer = rule.thresholds.geofenceBufferMeters ?? 50;
            const thresholdDist = school.geofenceCenter.radiusMeters + buffer;

            if (dist > thresholdDist) {
              triggered = true;
              alertTitle = `Geofence Perimeter Breach - ${learner ? (learner.firstName + ' ' + learner.lastName) : trackerDeviceId}`;
              alertDescription = `Device located ${Math.round(dist)}m from school center, exceeding perimeter allowance of ${thresholdDist}m.`;
              customDetails.distanceMeters = Math.round(dist);
              customDetails.allowedRadiusMeters = thresholdDist;
              customDetails.schoolName = school.name;
            }
          }
          break;
        }

        case 'GEOFENCE_ENTRY': {
          if (school && school.geofenceCenter) {
            const dist = calculateDistanceMeters(
              telemetry.latitude,
              telemetry.longitude,
              school.geofenceCenter.lat,
              school.geofenceCenter.lng
            );
            const buffer = rule.thresholds.geofenceBufferMeters ?? 50;
            const thresholdDist = school.geofenceCenter.radiusMeters - buffer;

            // Only trigger if firmly within school bounds
            if (dist <= thresholdDist) {
              triggered = true;
              alertTitle = `Safe Arrival at School - ${learner ? (learner.firstName + ' ' + learner.lastName) : trackerDeviceId}`;
              alertDescription = `Device arrived inside ${school.name} perimeter (${Math.round(dist)}m from center).`;
              customDetails.distanceMeters = Math.round(dist);
              customDetails.schoolName = school.name;
            }
          }
          break;
        }

        case 'UNEXPECTED_ROUTE_DEVIATION': {
          const deviationThreshold = rule.thresholds.routeDeviationMeters ?? 300;
          if (
            (telemetry as any).routeDeviationMeters &&
            (telemetry as any).routeDeviationMeters > deviationThreshold
          ) {
            triggered = true;
            alertTitle = `Unexpected Route Deviation - ${learner ? (learner.firstName + ' ' + learner.lastName) : trackerDeviceId}`;
            alertDescription = `Vehicle/Child deviated ${(telemetry as any).routeDeviationMeters}m from scheduled transit corridor.`;
            customDetails.deviationMeters = (telemetry as any).routeDeviationMeters;
          }
          break;
        }

        case 'UNUSUAL_STATIONARY': {
          const speedThreshold = rule.thresholds.speedThresholdKmh ?? 1.0;
          const stationaryMinutesThreshold = rule.thresholds.stationaryMinutes ?? 30;
          if (
            (telemetry as any).stationaryDurationMinutes &&
            (telemetry as any).stationaryDurationMinutes >= stationaryMinutesThreshold &&
            (telemetry.speedKmh ?? 0) <= speedThreshold
          ) {
            triggered = true;
            alertTitle = `Unusual Stationary Dwell - ${trackerDeviceId}`;
            alertDescription = `Tracker stationary for ${(telemetry as any).stationaryDurationMinutes} minutes away from designated premises.`;
            customDetails.stationaryMinutes = (telemetry as any).stationaryDurationMinutes;
          }
          break;
        }

        default:
          break;
      }

      if (triggered) {
        await this.handleTriggeredRule({
          rule,
          telemetry,
          deviceId,
          trackerDeviceId,
          learnerId,
          learner,
          schoolId,
          school,
          alertTitle,
          alertDescription,
          customDetails,
          actor,
          result
        });
      }
    }

    return result;
  }

  // ----------------------------------------------------
  // OFFLINE & PROLONGED SILENCE EVALUATION
  // ----------------------------------------------------
  public async evaluateDeviceOfflineCondition(
    deviceId: string,
    lastSeenTimestampIso: string,
    actor?: ActiveUserSession
  ): Promise<SafetyAutomationEvaluationResult> {
    const result: SafetyAutomationEvaluationResult = {
      evaluated: true,
      alertsTriggered: [],
      alertsSuppressed: [],
      correlatedIncidents: [],
      escalatedIncidents: []
    };

    if (!this.config.globalEnabled) return result;

    const device = db.devices.get(deviceId);
    const trackerDeviceId = device?.trackerDeviceId || deviceId;
    const learnerId = device?.assignedLearnerId || null;
    let learner: any = null;
    let school: any = null;
    if (learnerId) {
      learner = db.learners.get(learnerId);
      if (learner?.schoolId) school = db.schools.get(learner.schoolId);
    }

    const lastSeenMs = new Date(lastSeenTimestampIso).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - lastSeenMs) / 1000));

    // Check PROLONGED_SILENCE first (higher severity)
    const prolongedRule = this.config.rules.find(r => r.eventType === 'PROLONGED_SILENCE' && r.enabled);
    if (prolongedRule) {
      const thresholdSeconds = prolongedRule.thresholds.prolongedSilenceSeconds ?? 1800;
      if (elapsedSeconds >= thresholdSeconds) {
        await this.handleTriggeredRule({
          rule: prolongedRule,
          telemetry: {
            id: 'tel-synthetic-silence',
            deviceId,
            trackerDeviceId,
            learnerId,
            schoolId: school?.id || null,
            timestamp: new Date().toISOString(),
            latitude: device?.lastKnownLatitude || -25.7589,
            longitude: device?.lastKnownLongitude || 28.2321,
            accuracyMeters: 10,
            speedKmh: 0,
            heading: 0,
            batteryLevel: device?.batteryStatus?.percentage ?? 50,
            protocol: 'GT012',
            packetType: 'HEARTBEAT',
            transportSource: 'TCP',
            validationStatus: 'VALIDATED',
            ingestedAt: new Date().toISOString()
          },
          deviceId,
          trackerDeviceId,
          learnerId,
          learner,
          schoolId: school?.id || null,
          school,
          alertTitle: `Prolonged Telemetry Silence (${Math.round(elapsedSeconds / 60)} min) - ${trackerDeviceId}`,
          alertDescription: `No telemetry received for ${Math.round(elapsedSeconds / 60)} minutes from tracker ${trackerDeviceId} (threshold: ${Math.round(thresholdSeconds / 60)} min).`,
          customDetails: { elapsedSeconds, thresholdSeconds },
          actor,
          result
        });
        return result;
      }
    }

    // Check DEVICE_OFFLINE
    const offlineRule = this.config.rules.find(r => r.eventType === 'DEVICE_OFFLINE' && r.enabled);
    if (offlineRule) {
      const thresholdSeconds = offlineRule.thresholds.offlineSilenceSeconds ?? 900;
      if (elapsedSeconds >= thresholdSeconds) {
        await this.handleTriggeredRule({
          rule: offlineRule,
          telemetry: {
            id: 'tel-synthetic-offline',
            deviceId,
            trackerDeviceId,
            learnerId,
            schoolId: school?.id || null,
            timestamp: new Date().toISOString(),
            latitude: device?.lastKnownLatitude || -25.7589,
            longitude: device?.lastKnownLongitude || 28.2321,
            accuracyMeters: 10,
            speedKmh: 0,
            heading: 0,
            batteryLevel: device?.batteryStatus?.percentage ?? 50,
            protocol: 'GT012',
            packetType: 'HEARTBEAT',
            transportSource: 'TCP',
            validationStatus: 'VALIDATED',
            ingestedAt: new Date().toISOString()
          },
          deviceId,
          trackerDeviceId,
          learnerId,
          learner,
          schoolId: school?.id || null,
          school,
          alertTitle: `Device Offline Detected - ${trackerDeviceId}`,
          alertDescription: `Tracker ${trackerDeviceId} has ceased telemetry for ${Math.round(elapsedSeconds / 60)} minutes (threshold: ${Math.round(thresholdSeconds / 60)} min).`,
          customDetails: { elapsedSeconds, thresholdSeconds },
          actor,
          result
        });
      }
    }

    return result;
  }

  // ----------------------------------------------------
  // DEDUPLICATION, SUPPRESSION, & INCIDENT CORRELATION
  // ----------------------------------------------------
  private async handleTriggeredRule(params: {
    rule: SafetyRuleConfig;
    telemetry: AuthoritativeTelemetryRecord;
    deviceId: string;
    trackerDeviceId: string;
    learnerId?: string | null;
    learner?: any;
    schoolId?: string | null;
    school?: any;
    alertTitle: string;
    alertDescription: string;
    customDetails: Record<string, any>;
    actor?: ActiveUserSession;
    result: SafetyAutomationEvaluationResult;
  }): Promise<void> {
    const {
      rule,
      telemetry,
      deviceId,
      trackerDeviceId,
      learnerId,
      learner,
      schoolId,
      school,
      alertTitle,
      alertDescription,
      customDetails,
      actor,
      result
    } = params;

    const cooldownKey = `${rule.ruleId}:${deviceId}`;
    const now = Date.now();
    const existingCooldown = this.cooldowns.get(cooldownKey);
    const cooldownMs = rule.cooldownSeconds * 1000;

    // 1. Check if within cooldown window (Repeated Alert Suppression)
    if (existingCooldown && (now - existingCooldown.lastTriggeredAt) < cooldownMs) {
      existingCooldown.suppressedCount++;
      const cooldownRemainingSec = Math.ceil((cooldownMs - (now - existingCooldown.lastTriggeredAt)) / 1000);

      db.logAuditEvent({
        actionType: 'TELEMETRY_ALERT_SUPPRESSED',
        actorUserId: actor?.id || 'sys-automation',
        actorName: actor?.name || 'ITIS Safety Automation Engine',
        actorRole: actor?.role || 'SYSTEM_AUTOMATION',
        targetEntity: 'AUTOMATION_RULE',
        targetId: rule.ruleId,
        details: {
          ruleId: rule.ruleId,
          eventType: rule.eventType,
          deviceId,
          trackerDeviceId,
          reason: 'COOLDOWN_ACTIVE',
          cooldownRemainingSec,
          suppressedCount: existingCooldown.suppressedCount
        }
      });

      result.alertsSuppressed.push({
        ruleId: rule.ruleId,
        eventType: rule.eventType,
        deviceId,
        reason: `Suppressed: Cooldown active (${cooldownRemainingSec}s remaining). Total duplicates suppressed: ${existingCooldown.suppressedCount}.`
      });

      return;
    }

    // Update cooldown timestamp
    this.cooldowns.set(cooldownKey, {
      lastTriggeredAt: now,
      suppressedCount: 0
    });

    // Log automation rule triggered
    db.logAuditEvent({
      actionType: 'AUTOMATION_RULE_TRIGGERED',
      actorUserId: actor?.id || 'sys-automation',
      actorName: actor?.name || 'ITIS Safety Automation Engine',
      actorRole: actor?.role || 'SYSTEM_AUTOMATION',
      targetEntity: 'AUTOMATION_RULE',
      targetId: rule.ruleId,
      details: {
        ruleId: rule.ruleId,
        eventType: rule.eventType,
        severity: rule.severity,
        deviceId,
        trackerDeviceId,
        learnerId,
        coordinates: { lat: telemetry.latitude, lng: telemetry.longitude }
      }
    });

    // 2. Incident Correlation Check: Check if an active incident exists for this learner or device
    const activeIncident = await this.findActiveIncidentForLearnerOrDevice(learnerId, deviceId);

    const alertId = 'alert-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    const alertRecord: SafetyAlertRecord = {
      id: alertId,
      ruleId: rule.ruleId,
      eventType: rule.eventType,
      title: alertTitle,
      description: alertDescription,
      severity: rule.severity,
      status: activeIncident ? 'CORRELATED_TO_INCIDENT' : 'PENDING_REVIEW',
      deviceId,
      trackerDeviceId,
      learnerId,
      learnerName: learner ? `${learner.firstName} ${learner.lastName}` : (telemetry as any).learnerName || undefined,
      schoolId,
      schoolName: school ? school.name : undefined,
      location: {
        lat: telemetry.latitude,
        lng: telemetry.longitude,
        accuracyMeters: telemetry.accuracyMeters,
        speedKmh: telemetry.speedKmh
      },
      telemetrySnapshot: {
        timestamp: telemetry.timestamp,
        batteryLevel: telemetry.batteryLevel,
        speedKmh: telemetry.speedKmh,
        heading: telemetry.heading,
        satellites: telemetry.satellites,
        isSos: telemetry.isSos,
        alarmType: telemetry.alarmType,
        tamperAlert: (telemetry as any).tamperAlert,
        rawPacketFingerprint: telemetry.rawPacketFingerprint
      },
      correlatedIncidentId: activeIncident ? activeIncident.id : null,
      escalatedIncidentId: null,
      suppressedDuplicatesCount: 0,
      lastTriggeredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.alerts.set(alertId, alertRecord);

    // 3. Where an active incident already exists:
    // Append relevant telemetry context, do NOT automatically create another duplicate incident!
    if (activeIncident) {
      const updateNote = `[Telemetry Automation] ${rule.name} triggered at ${new Date().toLocaleTimeString()}. Lat: ${telemetry.latitude.toFixed(4)}, Lng: ${telemetry.longitude.toFixed(4)}, Battery: ${telemetry.batteryLevel ?? 'N/A'}%`;
      
      if (!activeIncident.notes) activeIncident.notes = [];
      activeIncident.notes.push(updateNote);
      activeIncident.location = {
        lat: telemetry.latitude,
        lng: telemetry.longitude,
        addressDescription: activeIncident.location.addressDescription,
        accuracyMeters: telemetry.accuracyMeters || 5.0,
        locationTimestamp: telemetry.timestamp
      };

      // Persist update to repository
      try {
        await repository.incidents.update(activeIncident.id, {
          notes: activeIncident.notes,
          location: activeIncident.location
        });
      } catch (err) {
        // In-memory fallback
        db.incidents.set(activeIncident.id, activeIncident);
      }

      db.logAuditEvent({
        actionType: 'TELEMETRY_INCIDENT_CORRELATED',
        actorUserId: actor?.id || 'sys-automation',
        actorName: actor?.name || 'ITIS Safety Automation Engine',
        actorRole: actor?.role || 'SYSTEM_AUTOMATION',
        targetEntity: 'INCIDENT',
        targetId: activeIncident.id,
        details: {
          alertId,
          ruleId: rule.ruleId,
          eventType: rule.eventType,
          learnerId,
          incidentId: activeIncident.id,
          noteAppended: updateNote
        }
      });

      result.correlatedIncidents.push({
        alertId,
        incidentId: activeIncident.id,
        learnerId: learnerId || 'unknown',
        notesAppended: updateNote
      });

      // Notify Command Centre stream of incident update
      if (this.deltaNotifier) {
        this.deltaNotifier('INCIDENT_UPDATED', activeIncident);
      }
    } else {
      // 4. Where NO incident exists:
      // Create an internal alert for review
      db.logAuditEvent({
        actionType: 'TELEMETRY_ALERT_GENERATED',
        actorUserId: actor?.id || 'sys-automation',
        actorName: actor?.name || 'ITIS Safety Automation Engine',
        actorRole: actor?.role || 'SYSTEM_AUTOMATION',
        targetEntity: 'SAFETY_ALERT',
        targetId: alertId,
        details: {
          alertId,
          ruleId: rule.ruleId,
          eventType: rule.eventType,
          severity: rule.severity,
          deviceId,
          trackerDeviceId,
          learnerId,
          customDetails
        }
      });

      // If configured for auto-escalation (e.g. SOS or physical tamper):
      if (rule.autoEscalateToIncident && learnerId) {
        const escalatedIncident = await this.escalateAlertToInternalIncident(
          alertRecord,
          (rule.autoEscalateSeverity as any) || 'CRITICAL_SOS',
          actor
        );
        result.escalatedIncidents.push({
          alertId,
          incidentId: escalatedIncident.id,
          severity: escalatedIncident.severity
        });
      }
    }

    result.alertsTriggered.push(alertRecord);

    // Notify Command Centre stream of new alert
    if (this.deltaNotifier) {
      this.deltaNotifier('SAFETY_ALERT_CREATED', alertRecord);
    }
  }

  // ----------------------------------------------------
  // ESCALATION LOGIC (INTERNAL COMMAND CENTRE INCIDENT)
  // STRICT SAFETY CONTROL: No real emergency dispatch occurs!
  // ----------------------------------------------------
  private async escalateAlertToInternalIncident(
    alert: SafetyAlertRecord,
    severity: IncidentSeverity,
    actor?: ActiveUserSession
  ): Promise<IncidentAlert> {
    const incId = 'inc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    const now = new Date().toISOString();

    const learner = alert.learnerId ? db.learners.get(alert.learnerId) : null;
    const person = learner ? db.persons.get(learner.personId) : null;
    const school = alert.schoolId ? db.schools.get(alert.schoolId) : null;

    // Strict safety control notes
    const incidentNotes = [
      `[Safety Automation Auto-Escalation] Alert: ${alert.title}`,
      `Safety Directive: Automatic real-world dispatch is suppressed. Human Command Officer authorization is strictly required.`,
      `Telemetry Snapshot: Speed ${alert.telemetrySnapshot.speedKmh ?? 0} km/h, Battery ${alert.telemetrySnapshot.batteryLevel ?? 'N/A'}%`
    ];

    const newIncident: IncidentAlert = {
      id: incId,
      learnerId: alert.learnerId || 'lrn-automation',
      learnerName: person ? `${person.firstName} ${person.lastName}` : (alert.learnerName || 'Protected Learner'),
      learnerGrade: 'Grade 10',
      schoolId: alert.schoolId || 'sch-001',
      schoolName: school ? school.name : (alert.schoolName || 'South African Partner School'),
      guardianName: 'Registered Authoritative Guardian',
      guardianMobile: '+27 82 000 0000',
      timestamp: now,
      severity,
      status: 'ACTIVE_ALARM',
      operationalState: 'AVAILABLE',
      triggerType: alert.eventType === 'EMERGENCY_SOS' ? 'MANUAL_SOS_BEACON' : 'GEOFENCE_BREACH',
      location: {
        lat: alert.location?.lat || -25.7589,
        lng: alert.location?.lng || 28.2321,
        addressDescription: `Automated Safety Zone Alert (${alert.trackerDeviceId})`,
        accuracyMeters: alert.location?.accuracyMeters || 5.0,
        locationSource: 'GT012_AUTHORITATIVE_GPS',
        locationTimestamp: alert.telemetrySnapshot.timestamp
      },
      slaTargetSeconds: 180,
      elapsedSeconds: 0,
      notes: incidentNotes
    };

    let createdIncident: IncidentAlert;
    try {
      createdIncident = await repository.incidents.create(newIncident, {
        userId: actor?.id || 'sys-automation',
        userName: actor?.name || 'ITIS Safety Automation Engine',
        userRole: actor?.role || 'SYSTEM_AUTOMATION'
      });
    } catch (err) {
      db.incidents.set(incId, newIncident);
      createdIncident = newIncident;
    }

    alert.status = 'ESCALATED';
    alert.escalatedIncidentId = createdIncident.id;
    alert.updatedAt = new Date().toISOString();

    if (this.deltaNotifier) {
      this.deltaNotifier('NEW_INCIDENT', createdIncident);
    }

    return createdIncident;
  }

  public async reviewAlert(
    alertId: string,
    action: 'DISMISS' | 'ESCALATE' | 'RESOLVE',
    actor: ActiveUserSession,
    reason?: string
  ): Promise<{ alert: SafetyAlertRecord; incident?: IncidentAlert }> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Safety Alert with ID "${alertId}" not found.`);
    }

    if (
      actor.role !== 'COMMAND_OPERATOR' &&
      actor.role !== 'SYSTEM_ADMIN' &&
      actor.role !== 'FOUNDER_EXECUTIVE'
    ) {
      throw new Error('Access Denied: Only Command Operators and System Administrators can review safety alerts.');
    }

    alert.reviewedByUserId = actor.id;
    alert.reviewedAt = new Date().toISOString();
    alert.updatedAt = new Date().toISOString();

    let createdIncident: IncidentAlert | undefined;

    if (action === 'DISMISS') {
      alert.status = 'DISMISSED';
      alert.dismissReason = reason || 'Dismissed as false condition by Command Officer';
    } else if (action === 'RESOLVE') {
      alert.status = 'RESOLVED';
    } else if (action === 'ESCALATE') {
      createdIncident = await this.escalateAlertToInternalIncident(
        alert,
        alert.severity === 'CRITICAL_SOS' ? 'CRITICAL_SOS' : 'HIGH',
        actor
      );
    }

    db.logAuditEvent({
      actionType: 'EMERGENCY_INCIDENT_UPDATED',
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      targetEntity: 'SAFETY_ALERT',
      targetId: alertId,
      details: {
        action,
        reason,
        status: alert.status,
        escalatedIncidentId: alert.escalatedIncidentId
      }
    });

    return { alert, incident: createdIncident };
  }

  // ----------------------------------------------------
  // QUERY & ACCESS APIS (COMMAND CENTRE QUEUE)
  // ----------------------------------------------------
  public getAlerts(filters?: {
    status?: string;
    severity?: string;
    eventType?: string;
    deviceId?: string;
    schoolId?: string;
    limit?: number;
  }): SafetyAlertRecord[] {
    let list = Array.from(this.alerts.values());

    if (filters?.status) {
      list = list.filter(a => a.status === filters.status);
    }
    if (filters?.severity) {
      list = list.filter(a => a.severity === filters.severity);
    }
    if (filters?.eventType) {
      list = list.filter(a => a.eventType === filters.eventType);
    }
    if (filters?.deviceId) {
      list = list.filter(a => a.deviceId === filters.deviceId || a.trackerDeviceId === filters.deviceId);
    }
    if (filters?.schoolId) {
      list = list.filter(a => a.schoolId === filters.schoolId);
    }

    // Sort newest first
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filters?.limit) {
      list = list.slice(0, filters.limit);
    }

    return list;
  }

  public getAlertById(alertId: string): SafetyAlertRecord | null {
    return this.alerts.get(alertId) || null;
  }

  // Helper to find an active incident
  public async findActiveIncidentForLearnerOrDevice(
    learnerId?: string | null,
    deviceId?: string | null
  ): Promise<IncidentAlert | null> {
    // 1. Check in-memory DB
    for (const inc of db.incidents.values()) {
      if (inc.status !== 'RESOLVED') {
        if (learnerId && inc.learnerId === learnerId) return inc;
        if (deviceId && inc.location?.addressDescription?.includes(deviceId)) return inc;
      }
    }

    // 2. Check repository if available
    try {
      if (learnerId) {
        const paginated = await repository.incidents.query({ learnerId, activeOnly: true, limit: 1 });
        if (paginated.data && paginated.data.length > 0) {
          const repoInc = paginated.data[0];
          if (repoInc.status !== 'RESOLVED') return repoInc;
        }
      }
    } catch {
      // Ignore repository error in offline fallback
    }

    return null;
  }

  // ====================================================
  // PROMPT 20: SAFETY INTELLIGENCE SIGNALS & CANDIDATES
  // ====================================================

  /**
   * Authoritatively generate a Safety Signal with cooldown deduplication.
   * If severity is CRITICAL, automatically creates an IncidentCandidate for human operator review.
   * NOTE: Responders are NEVER automatically dispatched.
   */
  public generateSafetySignal(params: {
    signalType: SafetySignalType;
    severity: SafetyRuleSeverity;
    deviceId: string;
    trackerDeviceId?: string;
    learnerId?: string | null;
    schoolId?: string | null;
    confidence?: number;
    source?: SafetySignalSource;
    details?: Record<string, any>;
    actorUser?: ActiveUserSession;
    cooldownSeconds?: number;
  }): { signal: SafetySignal; candidate?: IncidentCandidate; suppressed: boolean; reason?: string } {
    const now = Date.now();
    const cooldownPeriodMs = (params.cooldownSeconds ?? 300) * 1000;
    const cooldownKey = `${params.deviceId}:${params.signalType}`;

    const existingCooldown = this.signalCooldowns.get(cooldownKey);
    if (existingCooldown && (now - existingCooldown.lastGeneratedAt) < cooldownPeriodMs) {
      existingCooldown.count++;
      let activeSignal: SafetySignal | undefined;
      for (const sig of this.safetySignals.values()) {
        if (sig.deviceId === params.deviceId && sig.signalType === params.signalType && sig.status !== 'RESOLVED' && sig.status !== 'DISMISSED') {
          activeSignal = sig;
          break;
        }
      }

      if (activeSignal) {
        activeSignal.suppressedDuplicateCount++;
        activeSignal.updatedAt = new Date().toISOString();
      }

      db.logAuditEvent({
        actionType: 'SAFETY_SIGNAL_SUPPRESSED',
        actorUserId: params.actorUser?.id || 'SYSTEM_SAFETY_ENGINE',
        actorName: params.actorUser?.name || 'Safety Intelligence Automation',
        actorRole: params.actorUser?.role || 'SYSTEM_ADMIN',
        targetEntity: 'SYSTEM' as any,
        targetId: activeSignal?.id || `SIG-SUPPRESSED-${params.deviceId}`,
        details: {
          signalType: params.signalType,
          deviceId: params.deviceId,
          cooldownWindowSeconds: params.cooldownSeconds ?? 300,
          elapsedSecondsSinceLast: Math.floor((now - existingCooldown.lastGeneratedAt) / 1000),
          suppressionCount: existingCooldown.count
        }
      });

      return {
        signal: activeSignal || {
          id: `SIG-SUPPRESSED-${Date.now()}`,
          signalType: params.signalType,
          severity: params.severity,
          deviceId: params.deviceId,
          trackerDeviceId: params.trackerDeviceId || params.deviceId,
          timestamp: new Date().toISOString(),
          confidence: params.confidence ?? 0.85,
          source: params.source || 'SYSTEM_MONITOR',
          status: 'NEW',
          suppressedDuplicateCount: existingCooldown.count,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        suppressed: true,
        reason: `Signal suppressed: Cooldown of ${params.cooldownSeconds ?? 300}s active (${Math.floor((now - existingCooldown.lastGeneratedAt) / 1000)}s elapsed).`
      };
    }

    const device = db.devices.get(params.deviceId);
    const trackerDeviceId = params.trackerDeviceId || device?.trackerDeviceId || params.deviceId;
    const learnerId = params.learnerId !== undefined ? params.learnerId : (device?.assignedLearnerId || null);
    let learnerName: string | undefined;
    let schoolId = params.schoolId !== undefined ? params.schoolId : (device?.assignedSchoolId || null);
    let schoolName: string | undefined;

    if (learnerId) {
      const lrn = db.learners.get(learnerId);
      const hyd = db.getHydratedLearner(learnerId);
      if (hyd) {
        learnerName = `${hyd.person.firstName} ${hyd.person.lastName}`;
        if (!schoolId && hyd.currentSchool) {
          schoolId = hyd.currentSchool.id;
          schoolName = hyd.currentSchool.name;
        }
      } else if (lrn) {
        learnerName = lrn.emisId;
        if (!schoolId) schoolId = (lrn as any).schoolId;
      }
    }

    if (schoolId && !schoolName) {
      schoolName = db.schools.get(schoolId)?.name;
    }

    const signalId = `SIG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const timestamp = new Date().toISOString();

    const signal: SafetySignal = {
      id: signalId,
      signalType: params.signalType,
      severity: params.severity,
      learnerId,
      learnerName,
      deviceId: params.deviceId,
      trackerDeviceId,
      schoolId,
      schoolName,
      timestamp,
      confidence: params.confidence ?? 0.90,
      source: params.source || 'SYSTEM_MONITOR',
      details: params.details,
      status: 'NEW',
      suppressedDuplicateCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.safetySignals.set(signalId, signal);
    this.signalCooldowns.set(cooldownKey, { lastGeneratedAt: now, count: 0 });

    db.logAuditEvent({
      actionType: 'SAFETY_SIGNAL_GENERATED',
      actorUserId: params.actorUser?.id || 'SYSTEM_SAFETY_ENGINE',
      actorName: params.actorUser?.name || 'Safety Intelligence Automation',
      actorRole: params.actorUser?.role || 'SYSTEM_ADMIN',
      targetEntity: 'SYSTEM' as any,
      targetId: signal.id,
      details: {
        signalType: signal.signalType,
        severity: signal.severity,
        deviceId: signal.deviceId,
        trackerDeviceId: signal.trackerDeviceId,
        confidence: signal.confidence,
        learnerId: signal.learnerId
      }
    });

    let candidate: IncidentCandidate | undefined;
    if (params.severity === 'CRITICAL') {
      const candidateId = `CAND-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const candidateNumber = `CAND-2026-${Math.floor(1000 + Math.random() * 9000)}`;

      let lastTelemetrySecs = 0;
      const lastContact = device?.lastTelemetryTimestamp || device?.lastHeartbeatTimestamp || device?.lastCommunicationTimestamp || device?.lastKnownLocation?.timestamp;
      if (lastContact) {
        lastTelemetrySecs = Math.max(0, Math.floor((Date.now() - new Date(lastContact).getTime()) / 1000));
      }

      let gpsQual: 'GOOD' | 'MODERATE' | 'WEAK' | 'UNAVAILABLE' = 'UNAVAILABLE';
      if (device?.lastKnownLocation?.accuracyMeters) {
        if (device.lastKnownLocation.accuracyMeters < 10) gpsQual = 'GOOD';
        else if (device.lastKnownLocation.accuracyMeters <= 30) gpsQual = 'MODERATE';
        else gpsQual = 'WEAK';
      }

      candidate = {
        id: candidateId,
        candidateNumber,
        signalId: signal.id,
        signalType: signal.signalType,
        severity: signal.severity,
        deviceId: signal.deviceId,
        trackerDeviceId: signal.trackerDeviceId,
        learnerId: signal.learnerId,
        learnerName: signal.learnerName,
        schoolId: signal.schoolId,
        schoolName: signal.schoolName,
        deviceStatus: device?.deviceStatus || 'ASSIGNED',
        lastKnownLocation: device?.lastKnownLocation ? {
          lat: device.lastKnownLocation.latitude,
          lng: device.lastKnownLocation.longitude,
          accuracyMeters: device.lastKnownLocation.accuracyMeters,
          addressDescription: device.lastKnownLocation.addressDescription
        } : undefined,
        timeSinceLastTelemetrySeconds: lastTelemetrySecs,
        batteryPercentage: device?.batteryStatus?.percentage ?? 100,
        gpsQuality: gpsQual,
        relatedIncidents: [],
        createdAt: timestamp,
        reviewStatus: 'PENDING_REVIEW',
        autoDispatchedResponders: false
      };

      this.incidentCandidates.set(candidateId, candidate);

      signal.escalatedToIncidentCandidate = true;
      signal.incidentCandidateId = candidateId;
      signal.status = 'ESCALATED';

      db.logAuditEvent({
        actionType: 'SAFETY_SIGNAL_ESCALATED',
        actorUserId: params.actorUser?.id || 'SYSTEM_SAFETY_ENGINE',
        actorName: params.actorUser?.name || 'Safety Intelligence Automation',
        actorRole: params.actorUser?.role || 'SYSTEM_ADMIN',
        targetEntity: 'SYSTEM' as any,
        targetId: candidate.id,
        details: {
          candidateNumber: candidate.candidateNumber,
          signalId: signal.id,
          signalType: signal.signalType,
          severity: signal.severity,
          autoDispatchedResponders: false
        }
      });
    }

    return { signal, candidate, suppressed: false };
  }

  /**
   * Evaluate a device for Safety Intelligence Signals (e.g., OFFLINE, LOW_BATTERY, GPS_SIGNAL_LOST)
   */
  public evaluateSafetySignalsForDevice(
    deviceId: string,
    actorUser?: ActiveUserSession
  ): SafetyIntelligenceEvaluationResult {
    const device = db.devices.get(deviceId);
    const result: SafetyIntelligenceEvaluationResult = {
      evaluated: true,
      deviceId,
      signalsGenerated: [],
      signalsSuppressed: [],
      candidatesCreated: [],
      incidentCandidatesCreated: []
    };

    if (!device) return result;

    const lastContact = device.lastTelemetryTimestamp || device.lastHeartbeatTimestamp || device.lastCommunicationTimestamp || device.lastKnownLocation?.timestamp;
    if (lastContact) {
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(lastContact).getTime()) / 1000));
      if (elapsedSeconds >= 600) {
        const isProlonged = elapsedSeconds >= 1800;
        const res = this.generateSafetySignal({
          signalType: isProlonged ? 'PROLONGED_SILENCE' : 'DEVICE_OFFLINE',
          severity: isProlonged ? 'CRITICAL' : 'HIGH',
          deviceId: device.itisDeviceId,
          trackerDeviceId: device.trackerDeviceId,
          confidence: 0.95,
          actorUser,
          details: { elapsedSeconds, thresholdSeconds: 600 }
        });
        if (res.suppressed) {
          result.signalsSuppressed.push({
            signalType: res.signal.signalType,
            deviceId: res.signal.deviceId,
            reason: 'Signal suppressed within active cooldown window'
          });
        } else {
          result.signalsGenerated.push(res.signal);
          if (res.candidate) {
            result.candidatesCreated.push(res.candidate);
            result.incidentCandidatesCreated!.push(res.candidate);
          }
        }
      }
    }

    const batteryPct = device.batteryStatus?.percentage;
    if (batteryPct !== undefined) {
      if (batteryPct < 10) {
        const res = this.generateSafetySignal({
          signalType: 'CRITICAL_BATTERY',
          severity: 'CRITICAL',
          deviceId: device.itisDeviceId,
          trackerDeviceId: device.trackerDeviceId,
          confidence: 0.98,
          actorUser,
          details: { batteryPercentage: batteryPct, threshold: 10 }
        });
        if (res.suppressed) {
          result.signalsSuppressed.push({
            signalType: res.signal.signalType,
            deviceId: res.signal.deviceId,
            reason: 'Signal suppressed within active cooldown window'
          });
        } else {
          result.signalsGenerated.push(res.signal);
          if (res.candidate) {
            result.candidatesCreated.push(res.candidate);
            result.incidentCandidatesCreated!.push(res.candidate);
          }
        }
      } else if (batteryPct < 20) {
        const res = this.generateSafetySignal({
          signalType: 'LOW_BATTERY',
          severity: 'MEDIUM',
          deviceId: device.itisDeviceId,
          trackerDeviceId: device.trackerDeviceId,
          confidence: 0.95,
          actorUser,
          details: { batteryPercentage: batteryPct, threshold: 20 }
        });
        if (res.suppressed) {
          result.signalsSuppressed.push({
            signalType: res.signal.signalType,
            deviceId: res.signal.deviceId,
            reason: 'Signal suppressed within active cooldown window'
          });
        } else {
          result.signalsGenerated.push(res.signal);
          if (res.candidate) {
            result.candidatesCreated.push(res.candidate);
            result.incidentCandidatesCreated!.push(res.candidate);
          }
        }
      }
    }

    if (device.lastKnownLocation?.accuracyMeters && device.lastKnownLocation.accuracyMeters > 50) {
      const res = this.generateSafetySignal({
        signalType: 'GPS_SIGNAL_LOST',
        severity: 'MEDIUM',
        deviceId: device.itisDeviceId,
        trackerDeviceId: device.trackerDeviceId,
        confidence: 0.85,
        actorUser,
        details: { accuracyMeters: device.lastKnownLocation.accuracyMeters }
      });
      if (res.suppressed) {
        result.signalsSuppressed.push({
          signalType: res.signal.signalType,
          deviceId: res.signal.deviceId,
          reason: 'Signal suppressed within active cooldown window'
        });
      } else {
        result.signalsGenerated.push(res.signal);
        if (res.candidate) {
          result.candidatesCreated.push(res.candidate);
          result.incidentCandidatesCreated!.push(res.candidate);
        }
      }
    }

    return result;
  }

  /**
   * Authoritatively review an Incident Candidate (CONFIRM -> Active Incident, DISMISS -> Dismissed Candidate)
   */
  public reviewIncidentCandidate(
    candidateId: string,
    action: 'CONFIRM' | 'DISMISS',
    actorUser: ActiveUserSession,
    reason?: string
  ): { candidate: IncidentCandidate; incident?: any } {
    const candidate = this.incidentCandidates.get(candidateId);
    if (!candidate) {
      const err: any = new Error(`Incident candidate '${candidateId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (candidate.reviewStatus !== 'PENDING_REVIEW') {
      const err: any = new Error(`Incident candidate '${candidateId}' has already been reviewed (Status: ${candidate.reviewStatus}).`);
      err.statusCode = 400;
      throw err;
    }

    const reviewedAt = new Date().toISOString();

    if (action === 'CONFIRM') {
      candidate.reviewStatus = 'CONFIRMED_INCIDENT';
      candidate.reviewedByUserId = actorUser.id;
      candidate.reviewedAt = reviewedAt;

      const incidentId = `INC-${Date.now().toString(36).toUpperCase()}`;
      const incident = {
        id: incidentId,
        incidentNumber: `INC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        learnerId: candidate.learnerId || '',
        deviceId: candidate.deviceId,
        trackerDeviceId: candidate.trackerDeviceId,
        schoolId: candidate.schoolId || null,
        type: 'SAFETY_INTELLIGENCE_ESCALATION',
        status: 'ACTIVE_ALARM',
        severity: candidate.severity === 'CRITICAL' ? 'CRITICAL_SOS' : 'HIGH_PRIORITY',
        description: `Confirmed incident from candidate ${candidate.candidateNumber} (${candidate.signalType}).`,
        createdAt: reviewedAt,
        updatedAt: reviewedAt,
        location: candidate.lastKnownLocation ? {
          latitude: candidate.lastKnownLocation.lat,
          longitude: candidate.lastKnownLocation.lng,
          addressDescription: candidate.lastKnownLocation.addressDescription || 'Last known GPS fix',
          timestamp: reviewedAt
        } : undefined
      };

      db.incidents.set(incidentId, incident as any);
      candidate.escalatedIncidentId = incidentId;

      const signal = this.safetySignals.get(candidate.signalId);
      if (signal) {
        signal.status = 'ESCALATED';
        signal.updatedAt = reviewedAt;
      }

      db.logAuditEvent({
        actionType: 'INCIDENT_REPORT_SUBMITTED',
        actorUserId: actorUser.id,
        actorName: actorUser.name,
        actorRole: actorUser.role,
        targetEntity: 'INCIDENT',
        targetId: incidentId,
        details: {
          candidateId: candidate.id,
          candidateNumber: candidate.candidateNumber,
          signalType: candidate.signalType,
          reason
        }
      });

      return { candidate, incident };
    } else {
      candidate.reviewStatus = 'DISMISSED';
      candidate.reviewedByUserId = actorUser.id;
      candidate.reviewedAt = reviewedAt;
      candidate.dismissReason = reason || 'Dismissed after operational evaluation';

      const signal = this.safetySignals.get(candidate.signalId);
      if (signal) {
        signal.status = 'DISMISSED';
        signal.updatedAt = reviewedAt;
      }

      db.logAuditEvent({
        actionType: 'SAFETY_SIGNAL_DISMISSED',
        actorUserId: actorUser.id,
        actorName: actorUser.name,
        actorRole: actorUser.role,
        targetEntity: 'SYSTEM' as any,
        targetId: candidate.id,
        details: {
          candidateNumber: candidate.candidateNumber,
          signalId: candidate.signalId,
          reason: candidate.dismissReason
        }
      });

      return { candidate };
    }
  }

  public getSafetySignals(filter?: { deviceId?: string; learnerId?: string; status?: string; signalType?: SafetySignalType }): SafetySignal[] {
    let list = Array.from(this.safetySignals.values());
    if (filter?.deviceId) list = list.filter(s => s.deviceId === filter.deviceId);
    if (filter?.learnerId) list = list.filter(s => s.learnerId === filter.learnerId);
    if (filter?.status) list = list.filter(s => s.status === filter.status);
    if (filter?.signalType) list = list.filter(s => s.signalType === filter.signalType);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getIncidentCandidates(status?: string): IncidentCandidate[] {
    let list = Array.from(this.incidentCandidates.values());
    if (status) list = list.filter(c => c.reviewStatus === status);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getCandidateById(candidateId: string): IncidentCandidate | null {
    return this.incidentCandidates.get(candidateId) || null;
  }

  // Clear test data for clean unit test runs
  public clearTestData(): void {
    this.alerts.clear();
    this.cooldowns.clear();
    this.safetySignals.clear();
    this.incidentCandidates.clear();
    this.signalCooldowns.clear();
  }
}

export const safetyAutomationEngine = new SafetyAutomationEngine();
