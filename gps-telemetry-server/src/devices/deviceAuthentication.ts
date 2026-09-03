import { DeviceAuthResult } from '../types/device.js';
import { IDeviceRepository } from '../storage/deviceRepository.js';
import { TelemetryValidator } from '../security/validation.js';

export class DeviceAuthenticationService {
  constructor(private deviceRepository: IDeviceRepository) {}

  public async authenticateDevice(imeiOrId: string): Promise<DeviceAuthResult> {
    if (!TelemetryValidator.isValidDeviceId(imeiOrId)) {
      return {
        allowed: false,
        reason: 'MALFORMED_DEVICE_IDENTIFIER'
      };
    }

    const device = await this.deviceRepository.findByIdOrImei(imeiOrId);
    if (!device) {
      return {
        allowed: false,
        reason: 'DEVICE_NOT_REGISTERED'
      };
    }

    if (device.deviceState === 'RETIRED') {
      return {
        allowed: false,
        reason: 'DEVICE_RETIRED',
        device
      };
    }

    if (device.deviceState === 'SUSPENDED') {
      return {
        allowed: false,
        reason: 'DEVICE_SUSPENDED',
        device
      };
    }

    if (device.deviceState === 'UNREGISTERED') {
      return {
        allowed: false,
        reason: 'DEVICE_UNREGISTERED',
        device
      };
    }

    if (!device.isActive) {
      return {
        allowed: false,
        reason: 'DEVICE_DEACTIVATED',
        device
      };
    }

    if (device.status === 'TAMPERED' || device.deviceState === 'FAULT') {
      return {
        allowed: true, // Allow packet ingest so tamper/fault telemetry can be captured, but flagged
        reason: 'DEVICE_TAMPER_FLAGGED',
        device
      };
    }

    return {
      allowed: true,
      device
    };
  }
}
