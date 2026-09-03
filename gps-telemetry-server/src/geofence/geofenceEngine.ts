import { GeofenceDefinition, GeofenceEvaluationResult } from '../types/telemetry.js';

export class GeofenceEngine {
  private geofences: Map<string, GeofenceDefinition> = new Map();
  // State cache: deviceId + geofenceId -> wasInside (boolean)
  private deviceGeofenceStates: Map<string, boolean> = new Map();

  public registerGeofence(geofence: GeofenceDefinition): void {
    this.geofences.set(geofence.id, geofence);
  }

  public removeGeofence(geofenceId: string): void {
    this.geofences.delete(geofenceId);
  }

  public listGeofences(): GeofenceDefinition[] {
    return Array.from(this.geofences.values());
  }

  /**
   * Evaluates all active geofences against a device coordinate fix.
   */
  public evaluate(deviceId: string, latitude: number, longitude: number): GeofenceEvaluationResult[] {
    const results: GeofenceEvaluationResult[] = [];

    for (const geofence of this.geofences.values()) {
      if (!geofence.isActive) continue;

      let isInside = false;
      let distanceMeters: number | undefined;

      if (geofence.type === 'CIRCLE') {
        if (geofence.centerLatitude != null && geofence.centerLongitude != null && geofence.radiusMeters != null) {
          distanceMeters = this.calculateDistanceMeters(
            latitude,
            longitude,
            geofence.centerLatitude,
            geofence.centerLongitude
          );
          isInside = distanceMeters <= geofence.radiusMeters;
        }
      } else if (geofence.type === 'POLYGON' && geofence.polygonCoordinates) {
        isInside = this.isPointInPolygon(latitude, longitude, geofence.polygonCoordinates);
      }

      const stateKey = `${deviceId}_${geofence.id}`;
      const previousInside = this.deviceGeofenceStates.get(stateKey);
      let event: 'ENTER' | 'EXIT' | 'NONE' = 'NONE';

      if (previousInside === undefined) {
        // Initial reading
        this.deviceGeofenceStates.set(stateKey, isInside);
      } else if (!previousInside && isInside) {
        event = 'ENTER';
        this.deviceGeofenceStates.set(stateKey, true);
      } else if (previousInside && !isInside) {
        event = 'EXIT';
        this.deviceGeofenceStates.set(stateKey, false);
      }

      results.push({
        geofenceId: geofence.id,
        geofenceName: geofence.name,
        isInside,
        event,
        distanceToCenterMeters: distanceMeters
      });
    }

    return results;
  }

  /**
   * Great-circle distance calculation via Haversine formula
   */
  public calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Ray-casting algorithm for Point in Polygon evaluation
   */
  private isPointInPolygon(
    lat: number,
    lng: number,
    polygon: Array<{ latitude: number; longitude: number }>
  ): boolean {
    if (polygon.length < 3) return false;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].latitude, yi = polygon[i].longitude;
      const xj = polygon[j].latitude, yj = polygon[j].longitude;

      const intersect =
        yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }

    return inside;
  }
}
