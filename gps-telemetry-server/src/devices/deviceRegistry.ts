import { DeviceRecord, DeviceConnectivityStatus } from '../types/device.js';
import { IDeviceRepository } from '../storage/deviceRepository.js';
import { DeviceSessionManager } from './deviceSession.js';

export class DeviceRegistry {
  constructor(
    private deviceRepo: IDeviceRepository,
    private sessionManager: DeviceSessionManager
  ) {}

  public async getDevice(idOrImei: string): Promise<DeviceRecord | null> {
    return this.deviceRepo.findByIdOrImei(idOrImei);
  }

  public async registerDevice(device: DeviceRecord): Promise<void> {
    await this.deviceRepo.save(device);
  }

  public async updateConnectivity(
    deviceId: string,
    status: DeviceConnectivityStatus,
    telemetry?: { lat?: number; lng?: number; battery?: number; gsm?: number }
  ): Promise<void> {
    await this.deviceRepo.updateStatus(deviceId, status, telemetry);
  }

  public async associateWithLearner(deviceId: string, learnerId: string, schoolId?: string): Promise<void> {
    const dev = await this.deviceRepo.findByIdOrImei(deviceId);
    if (dev) {
      dev.learnerId = learnerId;
      if (schoolId) dev.schoolId = schoolId;
      await this.deviceRepo.save(dev);
    }
  }

  public async getRegisteredDevices(): Promise<DeviceRecord[]> {
    return this.deviceRepo.listAll();
  }

  public getSessionManager(): DeviceSessionManager {
    return this.sessionManager;
  }
}
