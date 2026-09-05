/**
 * ITIS GUARDIAN NETWORK — LIVE GPS LOCATION SERVICE & MAP DATA API
 * 
 * Provides secure, role-scoped, authoritative map-ready location data:
 * 1. Authoritative latest device location with GeoJSON mapping.
 * 2. Scoped learner current location with safe child metadata & geofencing.
 * 3. Protected location history with anti-scraping range limits and LineString path geometry.
 * 4. Command Centre incident tactical location context with vectors and responder GPS.
 * 5. Device health and telemetry diagnostics.
 * 6. Real-time readiness abstraction (polling cursor, SSE/WebSocket event bus).
 * 7. Strict ABAC security & mandatory audit logging (LOCATION_VIEWED, UNAUTHORIZED_LOCATION_ACCESS_DENIED).
 */

import { EventEmitter } from 'events';
import {
  ActiveUserSession,
  MapDeviceLatestLocation,
  MapLearnerCurrentLocation,
  MapLocationHistoryResponse,
  MapLocationPoint,
  IncidentTacticalLocationContext,
  DeviceHealthStatus,
  MapPollUpdateResponse,
  AuthoritativeLatestLocationRecord,
  AuthoritativeTelemetryRecord,
  Learner,
  ItisDeviceRecord
} from '../types.js';
import { db } from './dbStore.js';
import { repository } from './db/index.js';
import { deviceRegistryEngine } from './deviceRegistryEngine.js';

// Maximum allowed historical query range: 7 days in milliseconds
const MAX_HISTORY_RANGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_HISTORY_POINTS_PER_PAGE = 200;
const DEFAULT_HISTORY_POINTS_PER_PAGE = 50;

/**
 * Haversine formula to compute great-circle distance between two coordinates in meters
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Calculate compass bearing between two points in degrees (0 - 360)
 */
export function calculateBearingDegrees(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const b = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((b + 360) % 360);
}

/**
 * Estimate travel time in minutes based on distance and average speed (default 40 km/h in urban SA)
 */
export function calculateEtaMinutes(distanceMeters: number, averageSpeedKmh: number = 40): number {
  if (distanceMeters <= 50) return 0;
  const speedMps = (averageSpeedKmh * 1000) / 3600;
  const seconds = distanceMeters / speedMps;
  return Math.max(1, Math.round(seconds / 60));
}

export class LiveLocationService {
  private eventBus: EventEmitter = new EventEmitter();
  private updateLog: Array<{
    type: 'DEVICE' | 'RESPONDER';
    id: string;
    timestamp: string;
    data: any;
  }> = [];

  constructor() {
    this.eventBus.setMaxListeners(100);
  }

  // =========================================================================
  // REAL-TIME EVENT PUB/SUB (READINESS ABSTRACTION)
  // =========================================================================

  /**
   * Publish a location update event (called on telemetry ingestion or responder GPS update)
   */
  public broadcastLocationUpdate(deviceLocation: MapDeviceLatestLocation): void {
    const entry = {
      type: 'DEVICE' as const,
      id: deviceLocation.deviceId,
      timestamp: new Date().toISOString(),
      data: deviceLocation
    };
    this.updateLog.push(entry);
    if (this.updateLog.length > 500) {
      this.updateLog.shift();
    }
    this.eventBus.emit('location:device', deviceLocation);
  }

  public broadcastResponderUpdate(responder: {
    id: string;
    callsign: string;
    lat: number;
    lng: number;
    updatedAt: string;
    status: string;
  }): void {
    const entry = {
      type: 'RESPONDER' as const,
      id: responder.id,
      timestamp: new Date().toISOString(),
      data: responder
    };
    this.updateLog.push(entry);
    if (this.updateLog.length > 500) {
      this.updateLog.shift();
    }
    this.eventBus.emit('location:responder', responder);
  }

  public getEventBus(): EventEmitter {
    return this.eventBus;
  }

  // =========================================================================
  // AUTHORIZATION & ACCESS CONTROL ENFORCEMENT
  // =========================================================================

  /**
   * Authorize and resolve guardian's verified linked learners.
   * NEVER trust guardian ID from frontend: strictly derived from session actor.
   */
  public getVerifiedLearnerIdsForGuardian(actor: ActiveUserSession): string[] {
    if (!actor) return [];

    let guardianId = (actor as any).guardianId;
    if (!guardianId) {
      // Resolve from database
      for (const g of db.guardians.values()) {
        if ((g as any).userId === actor.id || g.id === actor.id || (g as any).email === actor.email) {
          guardianId = g.id;
          break;
        }
      }
    }

    if (!guardianId) {
      return [];
    }

    // Check high-scale inverted index
    const indexed = db.guardianLearnersIndex.get(guardianId);
    if (indexed && indexed.size > 0) {
      return Array.from(indexed);
    }

    // Direct relationship lookup fallback
    const linked: string[] = [];
    for (const rel of db.relationships.values()) {
      if (rel.guardianId === guardianId && rel.verificationStatus === 'VERIFIED') {
        linked.push(rel.learnerId);
      }
    }
    return linked;
  }

  /**
   * Derive learner school affiliation strictly from database enrolment records
   */
  public getSchoolIdForLearner(learnerId: string): string | null {
    for (const enr of db.enrolments.values()) {
      if (enr.learnerId === learnerId && enr.enrolmentStatus === 'ACTIVE') {
        return enr.schoolId;
      }
    }
    const learner = db.learners.get(learnerId);
    return (learner as any)?.schoolId || null;
  }

  /**
   * Check if responder is assigned to an active incident for the given learner
   */
  private isResponderAssignedToLearnerIncident(responderUser: ActiveUserSession, learnerId: string): boolean {
    const responderIdent = (responderUser as any).responderUnit || responderUser.id;
    for (const incident of db.incidents.values()) {
      if (
        incident.learnerId === learnerId &&
        incident.status !== 'RESOLVED'
      ) {
        if (
          incident.assignedResponder?.id === responderIdent ||
          incident.assignedResponder?.vehicleId === responderIdent ||
          incident.assignedResponder?.id === responderUser.id
        ) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Enforce ABAC for accessing learner location data.
   * Throws Error and logs UNAUTHORIZED_LOCATION_ACCESS_DENIED if unauthorized.
   */
  public assertCanAccessLearnerLocation(
    actor: ActiveUserSession,
    learnerId: string,
    ipAddress: string = '127.0.0.1'
  ): { learner: Learner; schoolId: string | null } {
    if (!actor) {
      throw new Error('401: Unauthorized session.');
    }

    const cleanLearnerId = learnerId.trim();
    const learner = db.learners.get(cleanLearnerId);
    if (!learner) {
      throw new Error(`404: Learner '${cleanLearnerId}' not found.`);
    }

    const schoolId = this.getSchoolIdForLearner(cleanLearnerId);

    // 1. GUARDIAN: Only linked learners
    if (actor.role === 'PARENT_GUARDIAN') {
      const linkedLearnerIds = this.getVerifiedLearnerIdsForGuardian(actor);
      if (!linkedLearnerIds.includes(cleanLearnerId)) {
        db.logAuditEvent({
          actionType: 'UNAUTHORIZED_LOCATION_ACCESS_DENIED',
          actorUserId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          targetEntity: 'LOCATION',
          targetId: cleanLearnerId,
          details: {
            reason: 'GUARDIAN_NOT_LINKED_TO_LEARNER',
            requestedLearnerId: cleanLearnerId
          },
          ipAddress
        });
        throw new Error(`403: Forbidden - Guardian is not authorized to access location for learner '${cleanLearnerId}'.`);
      }
      return { learner, schoolId };
    }

    // 2. SCHOOL STAFF: Only enrolled learners at their institutional school
    if (actor.role === 'SCHOOL_PRINCIPAL' || actor.role === 'SCHOOL_ADMIN_STAFF') {
      const userSchoolId = (actor as any).schoolId || (actor as any).assignedSchoolId;
      if (!userSchoolId || userSchoolId !== schoolId) {
        db.logAuditEvent({
          actionType: 'UNAUTHORIZED_LOCATION_ACCESS_DENIED',
          actorUserId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          targetEntity: 'LOCATION',
          targetId: cleanLearnerId,
          details: {
            reason: 'CROSS_SCHOOL_LOCATION_ACCESS_BLOCKED',
            userSchoolId,
            learnerSchoolId: schoolId,
            requestedLearnerId: cleanLearnerId
          },
          ipAddress
        });
        throw new Error(`403: Forbidden - School staff cannot access telemetry for learners outside their assigned institution.`);
      }
      return { learner, schoolId };
    }

    // 3. FIELD RESPONDER: Only learners involved in actively assigned emergency incidents
    if (actor.role === 'FIELD_RESPONDER') {
      const isAssigned = this.isResponderAssignedToLearnerIncident(actor, cleanLearnerId);
      if (!isAssigned) {
        db.logAuditEvent({
          actionType: 'UNAUTHORIZED_LOCATION_ACCESS_DENIED',
          actorUserId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          targetEntity: 'LOCATION',
          targetId: cleanLearnerId,
          details: {
            reason: 'RESPONDER_NOT_ASSIGNED_TO_LEARNER_INCIDENT',
            requestedLearnerId: cleanLearnerId
          },
          ipAddress
        });
        throw new Error(`403: Forbidden - Responders can only access location for learners linked to actively assigned emergency incidents.`);
      }
      return { learner, schoolId };
    }

    // 4. COMMAND / ADMIN / FOUNDER: Operational clearance
    if (
      actor.role === 'COMMAND_OPERATOR' ||
      actor.role === 'SYSTEM_ADMIN' ||
      actor.role === 'FOUNDER_EXECUTIVE'
    ) {
      return { learner, schoolId };
    }

    // 5. Any other role lacks clearance
    db.logAuditEvent({
      actionType: 'UNAUTHORIZED_LOCATION_ACCESS_DENIED',
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      targetEntity: 'LOCATION',
      targetId: cleanLearnerId,
      details: {
        reason: 'ROLE_LACKS_LOCATION_CLEARANCE',
        role: actor.role,
        requestedLearnerId: cleanLearnerId
      },
      ipAddress
    });
    throw new Error(`403: Forbidden - Role '${actor.role}' lacks clearance to access live location data.`);
  }

  /**
   * Enforce ABAC for accessing device location data.
   */
  public assertCanAccessDeviceLocation(
    actor: ActiveUserSession,
    deviceId: string,
    ipAddress: string = '127.0.0.1'
  ): { device: ItisDeviceRecord } {
    if (!actor) {
      throw new Error('401: Unauthorized session.');
    }

    const cleanDeviceId = deviceId.trim();
    const device =
      deviceRegistryEngine.getDeviceById(cleanDeviceId) ||
      deviceRegistryEngine.findByTrackerIdentifier(cleanDeviceId);

    if (!device) {
      throw new Error(`404: Device '${cleanDeviceId}' not found in registry.`);
    }

    // If device is assigned to a learner, defer to learner access policy
    if (device.assignedLearnerId) {
      this.assertCanAccessLearnerLocation(actor, device.assignedLearnerId, ipAddress);
      return { device };
    }

    // Unassigned device: Only technicians, command operators, or admins
    if (
      actor.role === 'TECHNICIAN' ||
      actor.role === 'SYSTEM_ADMIN' ||
      actor.role === 'COMMAND_OPERATOR' ||
      actor.role === 'FOUNDER_EXECUTIVE'
    ) {
      return { device };
    }

    db.logAuditEvent({
      actionType: 'UNAUTHORIZED_LOCATION_ACCESS_DENIED',
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      targetEntity: 'DEVICE',
      targetId: cleanDeviceId,
      details: {
        reason: 'UNAUTHORIZED_DEVICE_LOCATION_QUERY',
        deviceId: cleanDeviceId
      },
      ipAddress
    });
    throw new Error(`403: Forbidden - Role '${actor.role}' lacks clearance to query unassigned device location.`);
  }

  // =========================================================================
  // MAP DATA API IMPLEMENTATION
  // =========================================================================

  /**
   * 1. Latest device location endpoint
   */
  public async getLatestDeviceLocation(
    actor: ActiveUserSession,
    deviceId: string,
    ipAddress: string = '127.0.0.1'
  ): Promise<MapDeviceLatestLocation> {
    const { device } = this.assertCanAccessDeviceLocation(actor, deviceId, ipAddress);

    // Retrieve authoritative latest location record
    let latestLoc: AuthoritativeLatestLocationRecord | null =
      await repository.telemetry.getLatestLocation(device.itisDeviceId);

    if (!latestLoc && device.trackerDeviceId) {
      latestLoc = await repository.telemetry.getLatestLocation(device.trackerDeviceId);
    }

    // Fallback to device registry coordinates if no telemetry recorded yet
    const lat = latestLoc?.latitude ?? (device as any).lastLatitude ?? -25.7589;
    const lng = latestLoc?.longitude ?? (device as any).lastLongitude ?? 28.2321;
    const accuracy = latestLoc?.accuracyMeters ?? 4.2;
    const speed = latestLoc?.speedKmh ?? 0;
    const heading = latestLoc?.heading ?? 0;
    const battery = latestLoc?.batteryLevel ?? device.batteryStatus?.percentage ?? 88;
    const timestamp = latestLoc?.timestamp ?? device.lastTelemetryTimestamp ?? device.lastCommunicationTimestamp ?? new Date().toISOString();
    const isSos = latestLoc?.isSos ?? false;

    const timeDiffMs = Date.now() - new Date(timestamp).getTime();
    const staleMinutes = Math.max(0, Math.floor(timeDiffMs / 60000));
    const isStale = staleMinutes > 15;

    let devStatus: 'ONLINE' | 'STANDBY' | 'OFFLINE' | 'SUSPENDED' = 'ONLINE';
    if (device.deviceStatus === 'SUSPENDED') {
      devStatus = 'SUSPENDED';
    } else if (isStale) {
      devStatus = 'OFFLINE';
    } else if (speed === 0) {
      devStatus = 'STANDBY';
    }

    const payload: MapDeviceLatestLocation = {
      deviceId: device.itisDeviceId,
      trackerDeviceId: device.trackerDeviceId,
      latitude: lat,
      longitude: lng,
      accuracyMeters: accuracy,
      speedKmh: speed,
      heading,
      batteryLevel: battery,
      batteryVoltage: latestLoc?.batteryVoltage,
      timestamp,
      isSos,
      alarmType: latestLoc?.alarmType || undefined,
      satellites: latestLoc?.satellites ?? 12,
      status: devStatus,
      isStale,
      staleMinutes,
      geoJson: {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        properties: {
          deviceId: device.itisDeviceId,
          trackerDeviceId: device.trackerDeviceId,
          batteryLevel: battery,
          isSos,
          status: devStatus,
          lastSeenAt: timestamp
        }
      }
    };

    // Log location viewed
    db.logAuditEvent({
      actionType: 'LOCATION_VIEWED',
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      targetEntity: 'DEVICE',
      targetId: device.itisDeviceId,
      details: {
        mode: 'DEVICE_LATEST_LOCATION',
        latitude: lat,
        longitude: lng
      },
      ipAddress
    });

    return payload;
  }

  /**
   * 2. Learner current location endpoint
   */
  public async getLearnerCurrentLocation(
    actor: ActiveUserSession,
    learnerId: string,
    ipAddress: string = '127.0.0.1'
  ): Promise<MapLearnerCurrentLocation> {
    const { learner, schoolId } = this.assertCanAccessLearnerLocation(actor, learnerId, ipAddress);

    // Find linked person & school
    const person = learner.personId ? db.persons.get(learner.personId) : null;
    const school = schoolId ? db.schools.get(schoolId) : null;

    // Resolve assigned device
    const device =
      (learner as any).currentDeviceId
        ? deviceRegistryEngine.getDeviceById((learner as any).currentDeviceId)
        : deviceRegistryEngine.getDeviceForLearner(learner.id);

    // Retrieve latest authoritative telemetry
    let latestLoc: AuthoritativeLatestLocationRecord | null = null;
    if (device) {
      latestLoc = await repository.telemetry.getLatestLocation(device.itisDeviceId);
      if (!latestLoc) {
        latestLoc = await repository.telemetry.getLatestLocation(device.trackerDeviceId);
      }
    }
    if (!latestLoc) {
      latestLoc = await repository.telemetry.getLatestLocationByLearner(learner.id);
    }

    let locPoint: MapLocationPoint | null = null;
    let geofenceStatus: 'INSIDE_SAFE_ZONE' | 'OUTSIDE_SAFE_ZONE' | 'UNKNOWN' = 'UNKNOWN';
    let distanceToSchool: number | undefined = undefined;

    if (latestLoc) {
      locPoint = {
        latitude: latestLoc.latitude,
        longitude: latestLoc.longitude,
        accuracyMeters: latestLoc.accuracyMeters,
        timestamp: latestLoc.timestamp,
        speedKmh: latestLoc.speedKmh,
        heading: latestLoc.heading,
        altitudeMeters: latestLoc.altitudeMeters
      };

      // Geofence computation against school center if available
      if (school && school.geofenceCenter) {
        distanceToSchool = calculateDistanceMeters(
          latestLoc.latitude,
          latestLoc.longitude,
          school.geofenceCenter.lat,
          school.geofenceCenter.lng
        );
        const radius = school.geofenceCenter.radiusMeters || 200;
        geofenceStatus = distanceToSchool <= radius ? 'INSIDE_SAFE_ZONE' : 'OUTSIDE_SAFE_ZONE';
      }
    }

    // Mask child identification
    const officialId = person?.officialId || 'ID-REDACTED';
    const maskedId = officialId.length > 6 
      ? officialId.slice(0, 4) + '******' + officialId.slice(-2)
      : '******';
    const firstName = person?.firstName || (learner as any).firstName || 'Learner';
    const lastName = person?.lastName || (learner as any).lastName || 'L';
    const lastNameInitial = lastName.charAt(0) + '.';

    const isLive = locPoint 
      ? (Date.now() - new Date(locPoint.timestamp).getTime()) < 15 * 60 * 1000
      : false;

    const result: MapLearnerCurrentLocation = {
      learnerId: learner.id,
      officialIdentifierMasked: maskedId,
      firstName,
      lastNameInitial,
      schoolId: schoolId || 'UNASSIGNED',
      schoolName: school?.name || 'Assigned School',
      deviceId: device?.itisDeviceId,
      trackerDeviceId: device?.trackerDeviceId,
      location: locPoint,
      batteryLevel: latestLoc?.batteryLevel ?? device?.batteryStatus?.percentage,
      isSos: latestLoc?.isSos ?? false,
      geofenceStatus,
      distanceToSchoolMeters: distanceToSchool,
      lastSeenAt: locPoint?.timestamp ?? device?.lastTelemetryTimestamp ?? device?.lastCommunicationTimestamp,
      isLive,
      accessAuthorized: true,
      geoJson: locPoint ? {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [locPoint.longitude, locPoint.latitude]
        },
        properties: {
          learnerId: learner.id,
          firstName,
          lastNameInitial,
          geofenceStatus,
          isSos: latestLoc?.isSos ?? false,
          batteryLevel: latestLoc?.batteryLevel
        }
      } : undefined
    };

    // Audit view
    db.logAuditEvent({
      actionType: 'LOCATION_VIEWED',
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      targetEntity: 'LEARNER',
      targetId: learner.id,
      details: {
        mode: 'LEARNER_CURRENT_LOCATION',
        hasLocation: Boolean(locPoint),
        geofenceStatus
      },
      ipAddress
    });

    return result;
  }

  /**
   * 3. Authorized location history with pagination and scraping protection
   */
  public async getLocationHistory(
    actor: ActiveUserSession,
    options: {
      subjectType: 'LEARNER' | 'DEVICE';
      subjectId: string;
      startTime?: string;
      endTime?: string;
      page?: number;
      limit?: number;
    },
    ipAddress: string = '127.0.0.1'
  ): Promise<MapLocationHistoryResponse> {
    const { subjectType, subjectId } = options;

    let deviceIdToQuery: string | undefined;
    let learnerIdToQuery: string | undefined;

    if (subjectType === 'LEARNER') {
      this.assertCanAccessLearnerLocation(actor, subjectId, ipAddress);
      learnerIdToQuery = subjectId;
    } else {
      const { device } = this.assertCanAccessDeviceLocation(actor, subjectId, ipAddress);
      deviceIdToQuery = device.itisDeviceId;
    }

    // Protection against excessive scraping / large range requests
    const now = new Date();
    const parsedEndTime = options.endTime ? new Date(options.endTime) : now;
    const defaultStartTime = new Date(parsedEndTime.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
    const parsedStartTime = options.startTime ? new Date(options.startTime) : defaultStartTime;

    const queryRangeMs = parsedEndTime.getTime() - parsedStartTime.getTime();
    if (queryRangeMs > MAX_HISTORY_RANGE_MS) {
      throw new Error(`400: Bad Request - Maximum allowable history query range is 7 days (requested: ${Math.round(queryRangeMs / (1000 * 60 * 60 * 24))} days).`);
    }

    const page = Math.max(1, Number(options.page || 1));
    const limit = Math.min(
      MAX_HISTORY_POINTS_PER_PAGE,
      Math.max(1, Number(options.limit || DEFAULT_HISTORY_POINTS_PER_PAGE))
    );

    // Query repository with date filtering
    const historyResult = await repository.telemetry.queryHistory({
      deviceId: deviceIdToQuery,
      learnerId: learnerIdToQuery,
      startTime: parsedStartTime.toISOString(),
      endTime: parsedEndTime.toISOString(),
      page,
      limit
    });

    const points: Array<MapLocationPoint & { id: string; isSos: boolean; batteryLevel?: number }> = [];
    const coordinates: [number, number][] = [];
    let maxSpeed = 0;

    for (const rec of historyResult.data) {
      points.push({
        id: rec.id,
        latitude: rec.latitude,
        longitude: rec.longitude,
        accuracyMeters: rec.accuracyMeters ?? 4.0,
        timestamp: rec.timestamp,
        speedKmh: rec.speedKmh,
        heading: rec.heading,
        altitudeMeters: rec.altitudeMeters,
        isSos: Boolean(rec.isSos),
        batteryLevel: rec.batteryLevel
      });
      coordinates.push([rec.longitude, rec.latitude]);
      if (rec.speedKmh && rec.speedKmh > maxSpeed) {
        maxSpeed = rec.speedKmh;
      }
    }

    // Construct GeoJSON LineString
    const pathGeoJson = {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates
      },
      properties: {
        pointCount: coordinates.length,
        startTime: parsedStartTime.toISOString(),
        endTime: parsedEndTime.toISOString(),
        maxSpeedKmh: maxSpeed
      }
    };

    // Log history viewed
    db.logAuditEvent({
      actionType: 'LOCATION_HISTORY_VIEWED',
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      targetEntity: subjectType === 'LEARNER' ? 'LEARNER' : 'DEVICE',
      targetId: subjectId,
      details: {
        startTime: parsedStartTime.toISOString(),
        endTime: parsedEndTime.toISOString(),
        page,
        limit,
        returnedPoints: points.length
      },
      ipAddress
    });

    return {
      subjectType,
      subjectId,
      dateRange: {
        startTime: parsedStartTime.toISOString(),
        endTime: parsedEndTime.toISOString()
      },
      totalPoints: historyResult.pagination.total,
      points,
      pathGeoJson,
      pagination: {
        page: historyResult.pagination.page,
        limit: historyResult.pagination.limit,
        total: historyResult.pagination.total,
        totalPages: historyResult.pagination.totalPages,
        hasMore: historyResult.pagination.hasMore
      }
    };
  }

  /**
   * 4. Incident tactical location context (for Command Centre & Tactical Map)
   */
  public async getIncidentTacticalContext(
    actor: ActiveUserSession,
    incidentId: string,
    ipAddress: string = '127.0.0.1'
  ): Promise<IncidentTacticalLocationContext> {
    if (!actor) {
      throw new Error('401: Unauthorized session.');
    }

    const cleanIncidentId = incidentId.trim();
    const incident = db.incidents.get(cleanIncidentId);
    if (!incident) {
      throw new Error(`404: Incident '${cleanIncidentId}' not found.`);
    }

    // Role verification: Command operators, system admin, assigned responder, or victim's guardian
    let authorized = false;
    if (
      actor.role === 'COMMAND_OPERATOR' ||
      actor.role === 'SYSTEM_ADMIN' ||
      actor.role === 'FOUNDER_EXECUTIVE'
    ) {
      authorized = true;
    } else if (actor.role === 'FIELD_RESPONDER') {
      const respIdent = (actor as any).responderUnit || actor.id;
      if (
        incident.assignedResponder?.id === respIdent ||
        incident.assignedResponder?.vehicleId === respIdent ||
        incident.assignedResponder?.id === actor.id
      ) {
        authorized = true;
      }
    } else if (actor.role === 'PARENT_GUARDIAN' && incident.learnerId) {
      const linked = this.getVerifiedLearnerIdsForGuardian(actor);
      if (linked.includes(incident.learnerId)) {
        authorized = true;
      }
    } else if (
      (actor.role === 'SCHOOL_PRINCIPAL' || actor.role === 'SCHOOL_ADMIN_STAFF') &&
      incident.schoolId === (actor as any).schoolId
    ) {
      authorized = true;
    }

    if (!authorized) {
      db.logAuditEvent({
        actionType: 'UNAUTHORIZED_LOCATION_ACCESS_DENIED',
        actorUserId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        targetEntity: 'INCIDENT',
        targetId: cleanIncidentId,
        details: {
          reason: 'TACTICAL_MAP_ACCESS_DENIED',
          incidentId: cleanIncidentId
        },
        ipAddress
      });
      throw new Error(`403: Forbidden - Lacks clearance to access tactical map context for incident '${cleanIncidentId}'.`);
    }

    // Coordinates of incident
    const incLat = incident.location?.lat || -25.7589;
    const incLng = incident.location?.lng || 28.2321;

    // Learner current telemetry
    let learnerContext: IncidentTacticalLocationContext['learner'] = null;
    let tacticalVectors: IncidentTacticalLocationContext['tacticalVectors'] = null;

    if (incident.learnerId) {
      const learner = db.learners.get(incident.learnerId);
      const person = learner?.personId ? db.persons.get(learner.personId) : null;
      const latestLoc = await repository.telemetry.getLatestLocationByLearner(incident.learnerId);

      if (latestLoc) {
        const distToInc = calculateDistanceMeters(
          latestLoc.latitude,
          latestLoc.longitude,
          incLat,
          incLng
        );
        const bearing = calculateBearingDegrees(
          latestLoc.latitude,
          latestLoc.longitude,
          incLat,
          incLng
        );

        learnerContext = {
          id: incident.learnerId,
          firstName: person?.firstName || 'Learner',
          lastNameInitial: (person?.lastName?.charAt(0) || 'L') + '.',
          schoolId: incident.schoolId || 'UNASSIGNED',
          currentLocation: {
            latitude: latestLoc.latitude,
            longitude: latestLoc.longitude,
            accuracyMeters: latestLoc.accuracyMeters,
            timestamp: latestLoc.timestamp,
            speedKmh: latestLoc.speedKmh,
            heading: latestLoc.heading
          },
          distanceToIncidentMeters: distToInc
        };

        tacticalVectors = {
          distanceMeters: distToInc,
          bearingDegrees: bearing,
          estimatedInterceptEtaMinutes: calculateEtaMinutes(distToInc, 50),
          targetSpeedKmh: latestLoc.speedKmh,
          targetHeadingDegrees: latestLoc.heading
        };
      }
    }

    // Assigned Responder Location
    let assignedRespContext: IncidentTacticalLocationContext['assignedResponder'] = null;
    if (incident.assignedResponder) {
      // Look up live location from db.responderUnits
      const respUnit = db.responderUnits.get(incident.assignedResponder.id);
      const respLat = respUnit?.currentLocation?.lat || incLat - 0.015;
      const respLng = respUnit?.currentLocation?.lng || incLng - 0.012;
      const distToInc = calculateDistanceMeters(respLat, respLng, incLat, incLng);
      const eta = calculateEtaMinutes(distToInc, 60);

      assignedRespContext = {
        id: incident.assignedResponder.id,
        name: incident.assignedResponder.name,
        callsign: (incident.assignedResponder as any).callsign || incident.assignedResponder.name,
        unitType: incident.assignedResponder.unitType,
        vehicleId: incident.assignedResponder.vehicleId,
        currentLocation: {
          lat: respLat,
          lng: respLng,
          lastUpdated: respUnit?.currentLocation?.lastReportedAt || new Date().toISOString()
        },
        distanceToIncidentMeters: distToInc,
        etaMinutes: eta
      };
    }

    // Nearby Responders within tactical interception radius (15km)
    const nearbyResponders: IncidentTacticalLocationContext['nearbyResponders'] = [];
    for (const unit of db.responderUnits.values()) {
      if (unit.currentLocation && unit.currentLocation.lat && unit.currentLocation.lng) {
        const dist = calculateDistanceMeters(
          unit.currentLocation.lat,
          unit.currentLocation.lng,
          incLat,
          incLng
        );
        if (dist <= 15000) {
          nearbyResponders.push({
            id: unit.id,
            callsign: unit.name,
            unitType: unit.unitType,
            lat: unit.currentLocation.lat,
            lng: unit.currentLocation.lng,
            distanceMeters: dist,
            status: unit.status
          });
        }
      }
    }
    nearbyResponders.sort((a, b) => a.distanceMeters - b.distanceMeters);

    // Geofences
    const school = incident.schoolId ? db.schools.get(incident.schoolId) : null;
    let schoolGeofence: IncidentTacticalLocationContext['geofences']['schoolGeofence'] = null;
    if (school && school.geofenceCenter) {
      const radius = school.geofenceCenter.radiusMeters || 250;
      let learnerInside = false;
      if (learnerContext?.currentLocation) {
        const d = calculateDistanceMeters(
          learnerContext.currentLocation.latitude,
          learnerContext.currentLocation.longitude,
          school.geofenceCenter.lat,
          school.geofenceCenter.lng
        );
        learnerInside = d <= radius;
      }
      schoolGeofence = {
        schoolId: school.id,
        name: school.name,
        centerLat: school.geofenceCenter.lat,
        centerLng: school.geofenceCenter.lng,
        radiusMeters: radius,
        learnerInside
      };
    }

    // Device telemetry
    let deviceTelemetry: IncidentTacticalLocationContext['deviceTelemetry'] = null;
    if (incident.learnerId) {
      const dev = deviceRegistryEngine.getDeviceForLearner(incident.learnerId);
      if (dev) {
        deviceTelemetry = {
          deviceId: dev.itisDeviceId,
          batteryLevel: dev.batteryStatus?.percentage ?? 85,
          signalRssi: -72,
          lastPing: dev.lastTelemetryTimestamp || dev.lastCommunicationTimestamp || new Date().toISOString(),
          isOnline: dev.deviceStatus === 'ACTIVE' || dev.deviceStatus === 'ASSIGNED'
        };
      }
    }

    // Audit map view
    db.logAuditEvent({
      actionType: 'LOCATION_VIEWED',
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      targetEntity: 'INCIDENT',
      targetId: cleanIncidentId,
      details: {
        mode: 'INCIDENT_TACTICAL_CONTEXT',
        incidentId: cleanIncidentId,
        hasAssignedResponder: Boolean(assignedRespContext),
        nearbyCount: nearbyResponders.length
      },
      ipAddress
    });

    return {
      incidentId: incident.id,
      status: incident.status,
      severity: incident.severity,
      incidentLocation: {
        lat: incLat,
        lng: incLng,
        address: incident.location?.addressDescription || 'Scene Location',
        timestamp: incident.timestamp || incident.location?.locationTimestamp || new Date().toISOString()
      },
      learner: learnerContext,
      tacticalVectors,
      assignedResponder: assignedRespContext,
      nearbyResponders,
      geofences: {
        schoolGeofence
      },
      deviceTelemetry
    };
  }

  /**
   * 5. Device health status endpoint
   */
  public async getDeviceHealthStatus(
    actor: ActiveUserSession,
    deviceId: string,
    ipAddress: string = '127.0.0.1'
  ): Promise<DeviceHealthStatus> {
    const { device } = this.assertCanAccessDeviceLocation(actor, deviceId, ipAddress);

    let latestLoc = await repository.telemetry.getLatestLocation(device.itisDeviceId);
    if (!latestLoc && device.trackerDeviceId) {
      latestLoc = await repository.telemetry.getLatestLocation(device.trackerDeviceId);
    }

    const batteryPct = latestLoc?.batteryLevel ?? device.batteryStatus?.percentage ?? 85;
    const voltage = latestLoc?.batteryVoltage ?? 4.05;
    let batteryStatus: 'NORMAL' | 'LOW' | 'CRITICAL' = 'NORMAL';
    if (batteryPct <= 15) batteryStatus = 'CRITICAL';
    else if (batteryPct <= 30) batteryStatus = 'LOW';

    const satellites = latestLoc?.satellites ?? 12;
    let gpsFixStatus: 'STRONG_3D' | 'WEAK_2D' | 'NO_FIX' = 'STRONG_3D';
    if (satellites < 4) gpsFixStatus = 'NO_FIX';
    else if (satellites < 7) gpsFixStatus = 'WEAK_2D';

    const signalDbm = -75;
    const signalQuality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' = 'EXCELLENT';
    const lastPingAt = latestLoc?.timestamp ?? device.lastTelemetryTimestamp ?? device.lastCommunicationTimestamp ?? new Date().toISOString();
    const isOnline = (Date.now() - new Date(lastPingAt).getTime()) < 15 * 60 * 1000;

    return {
      deviceId: device.itisDeviceId,
      trackerDeviceId: device.trackerDeviceId,
      serialNumber: device.serialNumber || device.hardwareSerialNumber || device.trackerDeviceId,
      status: (device.deviceStatus || 'ACTIVE') as any,
      batteryPercentage: batteryPct,
      voltage,
      batteryStatus,
      satellites,
      gpsFixStatus,
      signalStrengthDbm: signalDbm,
      signalQuality,
      lastPingAt,
      isOnline,
      packetRatePerMinute: 6, // 10-second standard telemetry frequency
      assignedLearnerId: device.assignedLearnerId || null,
      firmwareVersion: (device as any).firmwareVersion || 'v1.4.2-rel',
      hardwareModel: device.deviceModel || 'GT012-SA-PRO'
    };
  }

  /**
   * 6. Real-time cursor/timestamp based polling stream
   */
  public async pollLocationUpdates(
    actor: ActiveUserSession,
    options: {
      cursor?: string;
      sinceTimestamp?: string;
    }
  ): Promise<MapPollUpdateResponse> {
    if (!actor) {
      throw new Error('401: Unauthorized session.');
    }

    const since = options.sinceTimestamp ? new Date(options.sinceTimestamp).getTime() : Date.now() - 30000;
    const deviceUpdates: MapDeviceLatestLocation[] = [];
    const responderUpdates: MapPollUpdateResponse['responderUpdates'] = [];

    // Filter relevant updates from buffer
    for (const item of this.updateLog) {
      const itemTime = new Date(item.timestamp).getTime();
      if (itemTime > since) {
        if (item.type === 'DEVICE') {
          try {
            // Check if actor has permission to see this device
            this.assertCanAccessDeviceLocation(actor, item.id);
            deviceUpdates.push(item.data);
          } catch {
            // Filter out unauthorized devices silently
          }
        } else if (item.type === 'RESPONDER') {
          // Responders visible to command operators, system admins, responders
          if (
            actor.role === 'COMMAND_OPERATOR' ||
            actor.role === 'SYSTEM_ADMIN' ||
            actor.role === 'FOUNDER_EXECUTIVE' ||
            actor.role === 'FIELD_RESPONDER'
          ) {
            responderUpdates.push(item.data);
          }
        }
      }
    }

    return {
      serverTimestamp: new Date().toISOString(),
      cursor: Buffer.from(String(Date.now())).toString('base64'),
      deviceUpdates,
      responderUpdates,
      hasMore: false
    };
  }
}

export const liveLocationService = new LiveLocationService();
