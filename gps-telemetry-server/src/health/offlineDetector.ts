import { DeviceRecord, DeviceConnectivityStatus } from '../types/device.js';
import { IDeviceRepository } from '../storage/deviceRepository.js';

export interface DeviceHealthEvaluation {
  deviceId: string;
  previousStatus: DeviceConnectivityStatus;
  currentStatus: DeviceConnectivityStatus;
  changed: boolean;
  secondsSinceLastSeen: number | null;
  lastSeenAt: Date | null;
  reason?: string;
}

export interface DeviceHealthSweepSummary {
  evaluatedCount: number;
  onlineCount: number;
  staleCount: number;
  offlineCount: number;
  changedCount: number;
  updates: DeviceHealthEvaluation[];
  timestamp: string;
}

/**
 * Authoritative Device Health & Offline Transition Monitor
 * 
 * Tracks lastSeenAt and transitions devices based on protocol heartbeat timeouts:
 * - STALE: Heartbeat missed (> 180s / 3 minutes by default)
 * - OFFLINE: Extended silence (> 600s / 10 minutes by default)
 * 
 * Safety Rule:
 * Does NOT automatically trigger emergency dispatch on offline transitions unless
 * explicit active distress policies are engaged.
 */
export class OfflineDetector {
  private staleTimeoutMs: number;
  private offlineTimeoutMs: number;

  constructor(
    staleTimeoutSeconds: number = 180,  // 3 minutes (e.g. 2 missed heartbeats)
    offlineTimeoutSeconds: number = 600 // 10 minutes
  ) {
    this.staleTimeoutMs = staleTimeoutSeconds * 1000;
    this.offlineTimeoutMs = offlineTimeoutSeconds * 1000;
  }

  /**
   * Evaluates the connectivity health of a single device record.
   */
  public evaluateDevice(device: DeviceRecord, now: Date = new Date()): DeviceHealthEvaluation {
    const previousStatus = device.status;
    const nowMs = now.getTime();

    // If device was never seen or has no lastSeenAt, treat as OFFLINE
    if (!device.lastSeenAt) {
      const isChanged = previousStatus !== 'OFFLINE' && previousStatus !== 'STANDBY';
      return {
        deviceId: device.id,
        previousStatus,
        currentStatus: previousStatus === 'STANDBY' ? 'STANDBY' : 'OFFLINE',
        changed: isChanged,
        secondsSinceLastSeen: null,
        lastSeenAt: null,
        reason: 'NO_PREVIOUS_TELEMETRY_RECORDED'
      };
    }

    const lastSeenMs = device.lastSeenAt instanceof Date ? device.lastSeenAt.getTime() : new Date(device.lastSeenAt).getTime();
    const elapsedMs = Math.max(0, nowMs - lastSeenMs);
    const elapsedSec = Math.round(elapsedMs / 1000);

    let currentStatus: DeviceConnectivityStatus = previousStatus;
    let reason: string | undefined = undefined;

    // Devices in explicit TAMPERED state preserve their alert state
    if (previousStatus === 'TAMPERED') {
      return {
        deviceId: device.id,
        previousStatus,
        currentStatus: 'TAMPERED',
        changed: false,
        secondsSinceLastSeen: elapsedSec,
        lastSeenAt: device.lastSeenAt,
        reason: 'TAMPER_STATE_PRESERVED'
      };
    }

    if (elapsedMs >= this.offlineTimeoutMs) {
      currentStatus = 'OFFLINE';
      reason = `HEARTBEAT_TIMEOUT_OFFLINE: Device silent for ${elapsedSec}s (threshold: ${Math.round(this.offlineTimeoutMs / 1000)}s)`;
    } else if (elapsedMs >= this.staleTimeoutMs) {
      currentStatus = 'STALE';
      reason = `HEARTBEAT_TIMEOUT_STALE: Device silent for ${elapsedSec}s (threshold: ${Math.round(this.staleTimeoutMs / 1000)}s)`;
    } else {
      currentStatus = 'ONLINE';
      reason = `HEARTBEAT_ACTIVE: Telemetry received ${elapsedSec}s ago`;
    }

    return {
      deviceId: device.id,
      previousStatus,
      currentStatus,
      changed: previousStatus !== currentStatus,
      secondsSinceLastSeen: elapsedSec,
      lastSeenAt: device.lastSeenAt,
      reason
    };
  }

  /**
   * Sweeps all registered devices in repository and updates their status if changed.
   */
  public async sweepAllDevices(
    deviceRepo: IDeviceRepository,
    now: Date = new Date()
  ): Promise<DeviceHealthSweepSummary> {
    const devices = await deviceRepo.listAll(500);
    const updates: DeviceHealthEvaluation[] = [];

    let onlineCount = 0;
    let staleCount = 0;
    let offlineCount = 0;
    let changedCount = 0;

    for (const dev of devices) {
      const evalResult = this.evaluateDevice(dev, now);
      
      if (evalResult.currentStatus === 'ONLINE') onlineCount++;
      else if (evalResult.currentStatus === 'STALE') staleCount++;
      else offlineCount++;

      if (evalResult.changed) {
        changedCount++;
        await deviceRepo.updateStatus(dev.id, evalResult.currentStatus);
      }

      updates.push(evalResult);
    }

    return {
      evaluatedCount: devices.length,
      onlineCount,
      staleCount,
      offlineCount,
      changedCount,
      updates,
      timestamp: now.toISOString()
    };
  }
}
