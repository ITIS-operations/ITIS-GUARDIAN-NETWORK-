import { DeviceRecord, DeviceConnectivityStatus } from '../types/device.js';
import pg from 'pg';

export interface IDeviceRepository {
  init(): Promise<void>;
  findByIdOrImei(idOrImei: string): Promise<DeviceRecord | null>;
  save(device: DeviceRecord): Promise<void>;
  updateStatus(id: string, status: DeviceConnectivityStatus, telemetry?: {
    lat?: number;
    lng?: number;
    battery?: number;
    gsm?: number;
  }): Promise<void>;
  listAll(limit?: number): Promise<DeviceRecord[]>;
  close(): Promise<void>;
}

/**
 * In-Memory Device Repository for Development and Tests
 */
export class MemoryDeviceRepository implements IDeviceRepository {
  private devices: Map<string, DeviceRecord> = new Map();
  private imeiIndex: Map<string, string> = new Map();

  public async init(): Promise<void> {
    // Seed standard development test devices
    const sampleDevices: DeviceRecord[] = [
      {
        id: 'DEV-SIM-001',
        imei: '868120034567890',
        serialNumber: 'SN-ITIS-868120',
        protocol: 'SIMULATED',
        model: 'SIM-TRACKER-V1',
        firmwareVersion: '1.0.0-dev',
        status: 'ONLINE',
        isActive: true,
        registeredAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'DEV-SIM-002',
        imei: '868120034567891',
        serialNumber: 'SN-ITIS-868121',
        protocol: 'SIMULATED',
        model: 'SIM-TRACKER-V1',
        firmwareVersion: '1.0.0-dev',
        status: 'ONLINE',
        isActive: true,
        registeredAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const d of sampleDevices) {
      await this.save(d);
    }
  }

  public async findByIdOrImei(idOrImei: string): Promise<DeviceRecord | null> {
    if (this.devices.has(idOrImei)) {
      return this.devices.get(idOrImei) || null;
    }
    const deviceId = this.imeiIndex.get(idOrImei);
    if (deviceId && this.devices.has(deviceId)) {
      return this.devices.get(deviceId) || null;
    }
    return null;
  }

  public async save(device: DeviceRecord): Promise<void> {
    this.devices.set(device.id, { ...device, updatedAt: new Date() });
    this.imeiIndex.set(device.imei, device.id);
  }

  public async updateStatus(
    id: string,
    status: DeviceConnectivityStatus,
    telemetry?: { lat?: number; lng?: number; battery?: number; gsm?: number }
  ): Promise<void> {
    const existing = this.devices.get(id);
    if (existing) {
      existing.status = status;
      existing.lastSeenAt = new Date();
      existing.updatedAt = new Date();
      if (telemetry?.lat !== undefined) existing.lastKnownLatitude = telemetry.lat;
      if (telemetry?.lng !== undefined) existing.lastKnownLongitude = telemetry.lng;
      if (telemetry?.battery !== undefined) existing.lastBatteryLevel = telemetry.battery;
      if (telemetry?.gsm !== undefined) existing.lastGsmSignal = telemetry.gsm;
      this.devices.set(id, existing);
    }
  }

  public async listAll(limit: number = 100): Promise<DeviceRecord[]> {
    return Array.from(this.devices.values()).slice(0, limit);
  }

  public async close(): Promise<void> {
    this.devices.clear();
    this.imeiIndex.clear();
  }
}

/**
 * PostgreSQL Device Repository for Production Telemetry Database
 */
export class PostgresDeviceRepository implements IDeviceRepository {
  private pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  public async init(): Promise<void> {
    const ddl = `
      CREATE TABLE IF NOT EXISTS telemetry_devices (
        id VARCHAR(64) PRIMARY KEY,
        imei VARCHAR(32) UNIQUE NOT NULL,
        serial_number VARCHAR(64) NOT NULL,
        protocol VARCHAR(32) NOT NULL,
        model VARCHAR(64),
        firmware_version VARCHAR(32),
        learner_id VARCHAR(64),
        school_id VARCHAR(64),
        status VARCHAR(32) NOT NULL DEFAULT 'OFFLINE',
        last_seen_at TIMESTAMP WITH TIME ZONE,
        last_known_lat DOUBLE PRECISION,
        last_known_lng DOUBLE PRECISION,
        last_battery_level INTEGER,
        last_gsm_signal INTEGER,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_telemetry_devices_imei ON telemetry_devices(imei);
      CREATE INDEX IF NOT EXISTS idx_telemetry_devices_status ON telemetry_devices(status);
    `;
    await this.pool.query(ddl);
  }

  public async findByIdOrImei(idOrImei: string): Promise<DeviceRecord | null> {
    const query = `
      SELECT * FROM telemetry_devices 
      WHERE id = $1 OR imei = $1 
      LIMIT 1;
    `;
    const res = await this.pool.query(query, [idOrImei]);
    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  public async save(device: DeviceRecord): Promise<void> {
    const query = `
      INSERT INTO telemetry_devices (
        id, imei, serial_number, protocol, model, firmware_version, 
        learner_id, school_id, status, last_seen_at, last_known_lat, 
        last_known_lng, last_battery_level, last_gsm_signal, is_active, registered_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
      ON CONFLICT (id) DO UPDATE SET
        imei = EXCLUDED.imei,
        serial_number = EXCLUDED.serial_number,
        protocol = EXCLUDED.protocol,
        model = EXCLUDED.model,
        firmware_version = EXCLUDED.firmware_version,
        learner_id = EXCLUDED.learner_id,
        school_id = EXCLUDED.school_id,
        status = EXCLUDED.status,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();
    `;
    await this.pool.query(query, [
      device.id,
      device.imei,
      device.serialNumber,
      device.protocol,
      device.model || null,
      device.firmwareVersion || null,
      device.learnerId || null,
      device.schoolId || null,
      device.status,
      device.lastSeenAt || null,
      device.lastKnownLatitude || null,
      device.lastKnownLongitude || null,
      device.lastBatteryLevel || null,
      device.lastGsmSignal || null,
      device.isActive,
      device.registeredAt
    ]);
  }

  public async updateStatus(
    id: string,
    status: DeviceConnectivityStatus,
    telemetry?: { lat?: number; lng?: number; battery?: number; gsm?: number }
  ): Promise<void> {
    const query = `
      UPDATE telemetry_devices
      SET status = $2,
          last_seen_at = NOW(),
          last_known_lat = COALESCE($3, last_known_lat),
          last_known_lng = COALESCE($4, last_known_lng),
          last_battery_level = COALESCE($5, last_battery_level),
          last_gsm_signal = COALESCE($6, last_gsm_signal),
          updated_at = NOW()
      WHERE id = $1 OR imei = $1;
    `;
    await this.pool.query(query, [
      id,
      status,
      telemetry?.lat ?? null,
      telemetry?.lng ?? null,
      telemetry?.battery ?? null,
      telemetry?.gsm ?? null
    ]);
  }

  public async listAll(limit: number = 100): Promise<DeviceRecord[]> {
    const query = `SELECT * FROM telemetry_devices ORDER BY last_seen_at DESC NULLS LAST LIMIT $1;`;
    const res = await this.pool.query(query, [limit]);
    return res.rows.map(this.mapRow);
  }

  public async close(): Promise<void> {
    // Pool is managed centrally
  }

  private mapRow(row: any): DeviceRecord {
    return {
      id: row.id,
      imei: row.imei,
      serialNumber: row.serial_number,
      protocol: row.protocol,
      model: row.model || undefined,
      firmwareVersion: row.firmware_version || undefined,
      learnerId: row.learner_id || undefined,
      schoolId: row.school_id || undefined,
      status: row.status as DeviceConnectivityStatus,
      lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at) : undefined,
      lastKnownLatitude: row.last_known_lat ? parseFloat(row.last_known_lat) : undefined,
      lastKnownLongitude: row.last_known_lng ? parseFloat(row.last_known_lng) : undefined,
      lastBatteryLevel: row.last_battery_level ? parseInt(row.last_battery_level, 10) : undefined,
      lastGsmSignal: row.last_gsm_signal ? parseInt(row.last_gsm_signal, 10) : undefined,
      isActive: row.is_active,
      registeredAt: new Date(row.registered_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
