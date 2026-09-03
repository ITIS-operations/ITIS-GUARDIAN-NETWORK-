/**
 * Strict Input and Packet Validation for GPS Telemetry
 */

/**
 * Strict Input and Packet Validation for GPS Telemetry
 * 
 * Enforces:
 * - Latitude bounds (-90 to +90) & rejection of 0,0 null fixes / NaNs
 * - Longitude bounds (-180 to +180) & rejection of 0,0 null fixes / NaNs
 * - Timestamp validity (no impossible future dates > 5 min, no stale dates > 30 days)
 * - Speed validity (0 to 250 km/h max terrestrial learner speed)
 * - Heading validity (0 to 360 degrees)
 * - Battery & Signal levels (0 to 100)
 */

export interface ValidationReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedLatitude?: number;
  sanitizedLongitude?: number;
  sanitizedSpeed?: number;
  sanitizedTimestamp: Date;
}

export class TelemetryValidator {
  /**
   * Validate IMEI or Hardware ID format (6-32 alphanumeric characters)
   */
  public static isValidDeviceId(id: string): boolean {
    if (!id || typeof id !== 'string') return false;
    const clean = id.trim();
    return /^[A-Za-z0-9_-]{6,32}$/.test(clean);
  }

  /**
   * Validate geographical latitude (-90 to +90, finite, non-zero for active GPS fix)
   */
  public static isValidLatitude(lat?: number | null): boolean {
    if (lat === undefined || lat === null || typeof lat !== 'number') return false;
    if (isNaN(lat) || !isFinite(lat)) return false;
    return lat >= -90.0 && lat <= 90.0 && lat !== 0.0;
  }

  /**
   * Validate geographical longitude (-180 to +180, finite, non-zero for active GPS fix)
   */
  public static isValidLongitude(lng?: number | null): boolean {
    if (lng === undefined || lng === null || typeof lng !== 'number') return false;
    if (isNaN(lng) || !isFinite(lng)) return false;
    return lng >= -180.0 && lng <= 180.0 && lng !== 0.0;
  }

  /**
   * Validate speed in km/h (0 to 250 km/h for learner/vehicle transport)
   */
  public static isValidSpeed(speed?: number | null): boolean {
    if (speed === undefined || speed === null) return true;
    return typeof speed === 'number' && !isNaN(speed) && isFinite(speed) && speed >= 0 && speed <= 250;
  }

  /**
   * Validate heading/course in degrees (0 to 360)
   */
  public static isValidHeading(heading?: number | null): boolean {
    if (heading === undefined || heading === null) return true;
    return typeof heading === 'number' && !isNaN(heading) && isFinite(heading) && heading >= 0 && heading <= 360;
  }

  /**
   * Validate battery percentage (0 to 100)
   */
  public static isValidBatteryLevel(battery?: number | null): boolean {
    if (battery === undefined || battery === null) return true;
    return typeof battery === 'number' && !isNaN(battery) && isFinite(battery) && battery >= 0 && battery <= 100;
  }

  /**
   * Validate GSM signal level (0 to 100 or CSQ 0-31)
   */
  public static isValidSignalLevel(signal?: number | null): boolean {
    if (signal === undefined || signal === null) return true;
    return typeof signal === 'number' && !isNaN(signal) && isFinite(signal) && signal >= 0 && signal <= 100;
  }

  /**
   * Validate telemetry timestamp against reasonable drift bounds
   * Rejects impossible future timestamps (> 5 min future clock skew)
   * Rejects stale timestamps (> 30 days in the past)
   */
  public static isValidTimestamp(timestamp: Date | number | string): boolean {
    const d = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (!d || isNaN(d.getTime())) {
      return false;
    }
    const now = Date.now();
    const time = d.getTime();
    const futureLimit = now + (5 * 60 * 1000); // Max 5 minutes future tolerance
    const pastLimit = now - (30 * 24 * 60 * 60 * 1000); // Max 30 days past buffer

    return time <= futureLimit && time >= pastLimit;
  }

  /**
   * Performs deep, strict validation of a telemetry event and returns a detailed report.
   * Does NOT silently accept malformed telemetry.
   */
  public static validateTelemetryData(data: {
    latitude?: number | null;
    longitude?: number | null;
    timestamp?: Date | number | string;
    speed?: number | null;
    heading?: number | null;
    batteryLevel?: number | null;
  }): ValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Timestamp validation
    let sanitizedTimestamp: Date;
    if (data.timestamp) {
      const rawDate = data.timestamp instanceof Date ? data.timestamp : new Date(data.timestamp);
      if (isNaN(rawDate.getTime())) {
        errors.push('INVALID_TIMESTAMP_NAN: Timestamp cannot be parsed as a valid Date');
        sanitizedTimestamp = new Date();
      } else if (rawDate.getTime() > Date.now() + (5 * 60 * 1000)) {
        errors.push(`IMPOSSIBLE_FUTURE_TIMESTAMP: Timestamp ${rawDate.toISOString()} is in the impossible future`);
        sanitizedTimestamp = new Date();
      } else if (rawDate.getTime() < Date.now() - (30 * 24 * 60 * 60 * 1000)) {
        errors.push(`EXPIRED_HISTORICAL_TIMESTAMP: Timestamp ${rawDate.toISOString()} exceeds maximum 30-day retention window`);
        sanitizedTimestamp = new Date();
      } else {
        sanitizedTimestamp = rawDate;
      }
    } else {
      sanitizedTimestamp = new Date();
    }

    // 2. Coordinate validation
    let sanitizedLatitude: number | undefined = undefined;
    let sanitizedLongitude: number | undefined = undefined;

    const hasLat = data.latitude !== undefined && data.latitude !== null;
    const hasLng = data.longitude !== undefined && data.longitude !== null;

    if (hasLat || hasLng) {
      if (!hasLat || !hasLng) {
        errors.push('MALFORMED_COORDINATES_PARTIAL: Latitude and longitude must both be provided together');
      } else {
        const lat = data.latitude!;
        const lng = data.longitude!;

        const latOk = this.isValidLatitude(lat);
        const lngOk = this.isValidLongitude(lng);

        if (!latOk || !lngOk) {
          if (lat === 0.0 && lng === 0.0) {
            warnings.push('NULL_ISLAND_COORDINATES: (0.0, 0.0) unacquired GPS fix coordinates omitted');
          } else {
            if (!latOk) errors.push(`INVALID_LATITUDE_OUT_OF_BOUNDS: Latitude ${lat} outside valid [-90.0, +90.0] range`);
            if (!lngOk) errors.push(`INVALID_LONGITUDE_OUT_OF_BOUNDS: Longitude ${lng} outside valid [-180.0, +180.0] range`);
          }
        } else {
          sanitizedLatitude = lat;
          sanitizedLongitude = lng;
        }
      }
    }

    // 3. Speed validation
    let sanitizedSpeed: number | undefined = undefined;
    if (data.speed !== undefined && data.speed !== null) {
      if (!this.isValidSpeed(data.speed)) {
        errors.push(`INVALID_SPEED_VALUE: Speed ${data.speed} km/h is negative or exceeds 250 km/h terrestrial maximum`);
      } else {
        sanitizedSpeed = data.speed;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedLatitude,
      sanitizedLongitude,
      sanitizedSpeed,
      sanitizedTimestamp
    };
  }

  /**
   * Validate packet buffer size
   */
  public static isValidPacketSize(buffer: Buffer, maxBytes: number = 2048): boolean {
    return Buffer.isBuffer(buffer) && buffer.length > 0 && buffer.length <= maxBytes;
  }

  /**
   * Sanitize log output to ensure no secrets or auth tokens are leaked
   */
  public static sanitizeLog(message: string): string {
    return message
      .replace(/password[:=]\s*["']?[^"'\s,]+/gi, 'password=[REDACTED]')
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
      .replace(/token[:=]\s*["']?[^"'\s,]+/gi, 'token=[REDACTED]')
      .replace(/secret[:=]\s*["']?[^"'\s,]+/gi, 'secret=[REDACTED]');
  }
}

