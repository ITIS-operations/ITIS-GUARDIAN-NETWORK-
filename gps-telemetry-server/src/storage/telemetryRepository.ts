import { TelemetryEvent, ProcessedAlertEvent } from '../types/telemetry.js';
import pg from 'pg';

export interface ITelemetryRepository {
  init(): Promise<void>;
  saveEvent(event: TelemetryEvent): Promise<void>;
  saveAlert(alert: ProcessedAlertEvent): Promise<void>;
  getLatestDeviceEvent(deviceId: string): Promise<TelemetryEvent | null>;
  getDeviceHistory(deviceId: string, limit?: number): Promise<TelemetryEvent[]>;
  getRecentAlerts(limit?: number): Promise<ProcessedAlertEvent[]>;
  getDeviceAlerts(deviceId: string, limit?: number): Promise<ProcessedAlertEvent[]>;
  getRecentSosEvents(limit?: number): Promise<ProcessedAlertEvent[]>;
  close(): Promise<void>;
}

/**
 * In-Memory Telemetry Repository for Local Development and Tests
 */
export class MemoryTelemetryRepository implements ITelemetryRepository {
  private events: TelemetryEvent[] = [];
  private alerts: ProcessedAlertEvent[] = [];
  private latestByDevice: Map<string, TelemetryEvent> = new Map();

  public async init(): Promise<void> {
    // Ready immediately
  }

  public async saveEvent(event: TelemetryEvent): Promise<void> {
    this.events.unshift(event);
    this.latestByDevice.set(event.deviceId, event);

    // Keep memory bounded to 10,000 in-memory events during testing
    if (this.events.length > 10000) {
      this.events.pop();
    }
  }

  public async saveAlert(alert: ProcessedAlertEvent): Promise<void> {
    this.alerts.unshift(alert);
    if (this.alerts.length > 1000) {
      this.alerts.pop();
    }
  }

  public async getLatestDeviceEvent(deviceId: string): Promise<TelemetryEvent | null> {
    return this.latestByDevice.get(deviceId) || null;
  }

  public async getDeviceHistory(deviceId: string, limit: number = 50): Promise<TelemetryEvent[]> {
    return this.events
      .filter((e) => e.deviceId === deviceId)
      .slice(0, limit);
  }

  public async getRecentAlerts(limit: number = 50): Promise<ProcessedAlertEvent[]> {
    return this.alerts.slice(0, limit);
  }

  public async getDeviceAlerts(deviceId: string, limit: number = 50): Promise<ProcessedAlertEvent[]> {
    return this.alerts
      .filter((a) => a.deviceId === deviceId)
      .slice(0, limit);
  }

  public async getRecentSosEvents(limit: number = 50): Promise<ProcessedAlertEvent[]> {
    return this.alerts
      .filter((a) => a.alarmType === 'SOS_PANIC' || a.severity === 'CRITICAL_SOS')
      .slice(0, limit);
  }

  public async close(): Promise<void> {
    this.events = [];
    this.alerts = [];
    this.latestByDevice.clear();
  }
}

/**
 * PostgreSQL Telemetry Repository for Dedicated Telemetry Database
 */
export class PostgresTelemetryRepository implements ITelemetryRepository {
  private pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  public async init(): Promise<void> {
    const ddl = `
      CREATE TABLE IF NOT EXISTS telemetry_events (
        id VARCHAR(64) PRIMARY KEY,
        device_id VARCHAR(64) NOT NULL,
        imei VARCHAR(32),
        protocol VARCHAR(32) NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        speed DOUBLE PRECISION,
        heading DOUBLE PRECISION,
        accuracy DOUBLE PRECISION,
        altitude DOUBLE PRECISION,
        battery_level INTEGER,
        gsm_signal INTEGER,
        ignition_status BOOLEAN,
        sos_active BOOLEAN,
        alarm_type VARCHAR(32),
        raw_packet_ref VARCHAR(64),
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_telemetry_events_dev_time ON telemetry_events(device_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_telemetry_events_alarm ON telemetry_events(alarm_type) WHERE alarm_type IS NOT NULL;

      CREATE TABLE IF NOT EXISTS telemetry_alerts (
        id VARCHAR(64) PRIMARY KEY,
        device_id VARCHAR(64) NOT NULL,
        imei VARCHAR(32),
        learner_id VARCHAR(64),
        school_id VARCHAR(64),
        alarm_type VARCHAR(32) NOT NULL,
        severity VARCHAR(32) NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        speed DOUBLE PRECISION,
        battery_level INTEGER,
        description TEXT NOT NULL,
        acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_telemetry_alerts_severity ON telemetry_alerts(severity, timestamp DESC);
    `;
    await this.pool.query(ddl);
  }

  public async saveEvent(event: TelemetryEvent): Promise<void> {
    const query = `
      INSERT INTO telemetry_events (
        id, device_id, imei, protocol, timestamp, latitude, longitude,
        speed, heading, accuracy, altitude, battery_level, gsm_signal,
        ignition_status, sos_active, alarm_type, raw_packet_ref, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18);
    `;
    await this.pool.query(query, [
      event.id,
      event.deviceId,
      event.imei || null,
      event.protocol,
      event.timestamp,
      event.latitude ?? null,
      event.longitude ?? null,
      event.speed ?? null,
      event.heading ?? null,
      event.accuracy ?? null,
      event.altitude ?? null,
      event.batteryLevel ?? null,
      event.gsmSignal ?? null,
      event.ignitionStatus ?? null,
      event.sosActive ?? null,
      event.alarmType ?? null,
      event.rawPacketReference ?? null,
      event.metadata ? JSON.stringify(event.metadata) : null
    ]);
  }

  public async saveAlert(alert: ProcessedAlertEvent): Promise<void> {
    const query = `
      INSERT INTO telemetry_alerts (
        id, device_id, imei, learner_id, school_id, alarm_type, severity,
        timestamp, latitude, longitude, speed, battery_level, description, acknowledged
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);
    `;
    await this.pool.query(query, [
      alert.id,
      alert.deviceId,
      alert.imei || null,
      alert.learnerId || null,
      alert.schoolId || null,
      alert.alarmType,
      alert.severity,
      alert.timestamp,
      alert.latitude ?? null,
      alert.longitude ?? null,
      alert.speed ?? null,
      alert.batteryLevel ?? null,
      alert.description,
      alert.acknowledged
    ]);
  }

  public async getLatestDeviceEvent(deviceId: string): Promise<TelemetryEvent | null> {
    const query = `
      SELECT * FROM telemetry_events
      WHERE device_id = $1
      ORDER BY timestamp DESC
      LIMIT 1;
    `;
    const res = await this.pool.query(query, [deviceId]);
    if (res.rows.length === 0) return null;
    return this.mapEventRow(res.rows[0]);
  }

  public async getDeviceHistory(deviceId: string, limit: number = 50): Promise<TelemetryEvent[]> {
    const query = `
      SELECT * FROM telemetry_events
      WHERE device_id = $1
      ORDER BY timestamp DESC
      LIMIT $2;
    `;
    const res = await this.pool.query(query, [deviceId, limit]);
    return res.rows.map(this.mapEventRow);
  }

  public async getRecentAlerts(limit: number = 50): Promise<ProcessedAlertEvent[]> {
    const query = `
      SELECT * FROM telemetry_alerts
      ORDER BY timestamp DESC
      LIMIT $1;
    `;
    const res = await this.pool.query(query, [limit]);
    return res.rows.map(this.mapAlertRow);
  }

  public async close(): Promise<void> {
    // Pool managed centrally
  }

  private mapEventRow(row: any): TelemetryEvent {
    return {
      id: row.id,
      deviceId: row.device_id,
      imei: row.imei || undefined,
      protocol: row.protocol,
      timestamp: new Date(row.timestamp),
      latitude: row.latitude != null ? parseFloat(row.latitude) : undefined,
      longitude: row.longitude != null ? parseFloat(row.longitude) : undefined,
      speed: row.speed != null ? parseFloat(row.speed) : undefined,
      heading: row.heading != null ? parseFloat(row.heading) : undefined,
      accuracy: row.accuracy != null ? parseFloat(row.accuracy) : undefined,
      altitude: row.altitude != null ? parseFloat(row.altitude) : undefined,
      batteryLevel: row.battery_level != null ? parseInt(row.battery_level, 10) : undefined,
      gsmSignal: row.gsm_signal != null ? parseInt(row.gsm_signal, 10) : undefined,
      ignitionStatus: row.ignition_status != null ? row.ignition_status : undefined,
      sosActive: row.sos_active != null ? row.sos_active : undefined,
      alarmType: row.alarm_type || undefined,
      rawPacketReference: row.raw_packet_ref || undefined,
      metadata: row.metadata || undefined
    };
  }

  private mapAlertRow(row: any): ProcessedAlertEvent {
    return {
      id: row.id,
      deviceId: row.device_id,
      imei: row.imei || undefined,
      learnerId: row.learner_id || undefined,
      schoolId: row.school_id || undefined,
      alarmType: row.alarm_type,
      severity: row.severity,
      timestamp: new Date(row.timestamp),
      latitude: row.latitude != null ? parseFloat(row.latitude) : undefined,
      longitude: row.longitude != null ? parseFloat(row.longitude) : undefined,
      speed: row.speed != null ? parseFloat(row.speed) : undefined,
      batteryLevel: row.battery_level != null ? parseInt(row.battery_level, 10) : undefined,
      description: row.description,
      acknowledged: row.acknowledged
    };
  }
}
