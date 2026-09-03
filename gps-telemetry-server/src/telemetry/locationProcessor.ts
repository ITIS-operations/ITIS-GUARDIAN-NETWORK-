import { TelemetryEvent } from '../types/telemetry.js';
import { GeofenceEngine } from '../geofence/geofenceEngine.js';

export class LocationProcessor {
  private geofenceEngine = new GeofenceEngine();
  private lastKnownLocations: Map<string, { lat: number; lng: number; time: number }> = new Map();

  /**
   * Evaluates coordinate validity and rejects physically impossible jumps (> 250 km/h).
   */
  public sanitizeLocation(event: TelemetryEvent): { valid: boolean; reason?: string } {
    if (event.latitude == null || event.longitude == null) {
      return { valid: true }; // Event is valid, simply has no location (e.g. heartbeat)
    }

    const last = this.lastKnownLocations.get(event.deviceId);
    const now = event.timestamp.getTime();

    if (last) {
      const timeDiffHours = (now - last.time) / (1000 * 3600);
      if (timeDiffHours > 0 && timeDiffHours < 0.25) { // Within 15 minutes
        const distanceMeters = this.geofenceEngine.calculateDistanceMeters(
          last.lat,
          last.lng,
          event.latitude,
          event.longitude
        );
        const distanceKm = distanceMeters / 1000;
        const calculatedSpeed = distanceKm / timeDiffHours;

        // Max theoretical terrestrial speed for learner tracking: 250 km/h
        if (calculatedSpeed > 250) {
          return {
            valid: false,
            reason: `IMPOSSIBLE_SPEED_ANOMALY: ${Math.round(calculatedSpeed)} km/h calculated across ${Math.round(distanceMeters)} meters`
          };
        }
      }
    }

    // Update last known location cache
    this.lastKnownLocations.set(event.deviceId, {
      lat: event.latitude,
      lng: event.longitude,
      time: now
    });

    return { valid: true };
  }
}
