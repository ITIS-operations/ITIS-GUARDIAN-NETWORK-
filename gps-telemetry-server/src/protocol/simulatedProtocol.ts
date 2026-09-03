import { IDeviceProtocol } from './deviceProtocol.js';
import { RawNetworkPacket, DecodedPacketResult } from '../types/packet.js';
import { TelemetryEvent, AlarmClassification } from '../types/telemetry.js';
import { TelemetryNormalizer } from '../telemetry/telemetryNormalizer.js';

/**
 * ==============================================================================
 * SIMULATED TELEMETRY PROTOCOL (DEVELOPMENT & INTEGRATION TESTING ONLY)
 * ==============================================================================
 * 
 * NOTE: This protocol is STRICTLY for local testing, CI validation, and
 * simulated device test runs. It does NOT represent any proprietary or
 * hardware-specific physical tracker protocol.
 */
export class SimulatedTestProtocol implements IDeviceProtocol {
  public readonly protocolName = 'SIMULATED_TEST_PROTOCOL';
  public readonly description = 'Development & Integration Simulator Format (JSON / Delimited text)';
  public readonly defaultPort = 5000;

  /**
   * Matches JSON packets or packets starting with 'SIM_TELEMETRY:'
   */
  public matches(packet: RawNetworkPacket): boolean {
    const rawStr = packet.data.toString('utf8').trim();
    if (rawStr.startsWith('{') && (
      rawStr.includes('"simulated"') ||
      rawStr.includes('"protocol"') ||
      rawStr.includes('"deviceId"') ||
      rawStr.includes('"imei"')
    )) {
      return true;
    }
    if (rawStr.startsWith('SIM_TELEMETRY:')) {
      return true;
    }
    return false;
  }

  public async decode(packet: RawNetworkPacket): Promise<DecodedPacketResult<unknown>> {
    const rawStr = packet.data.toString('utf8').trim();

    try {
      if (rawStr.startsWith('{')) {
        const json = JSON.parse(rawStr);
        return {
          success: true,
          protocolName: this.protocolName,
          deviceId: json.deviceId || json.imei,
          packetType: json.packetType || (json.sosActive ? 'ALARM' : 'LOCATION'),
          payload: {
            deviceId: json.deviceId || json.imei,
            imei: json.imei || json.deviceId,
            timestamp: json.timestamp ? new Date(json.timestamp) : new Date(),
            latitude: json.latitude,
            longitude: json.longitude,
            speed: json.speed,
            heading: json.heading,
            accuracy: json.accuracy,
            altitude: json.altitude,
            batteryLevel: json.batteryLevel,
            gsmSignal: json.gsmSignal,
            ignitionStatus: json.ignitionStatus,
            sosActive: json.sosActive,
            alarmType: json.alarmType as AlarmClassification,
            metadata: { isSimulation: true, ...json.metadata }
          },
          rawPacketRef: packet.id,
          requiresAck: Boolean(json.requiresAck)
        };
      } else if (rawStr.startsWith('SIM_TELEMETRY:')) {
        // Format: SIM_TELEMETRY:<deviceId>:<lat>:<lng>:<speed>:<heading>:<battery>:<sos>
        const parts = rawStr.split(':');
        const deviceId = parts[1];
        const latitude = parseFloat(parts[2]);
        const longitude = parseFloat(parts[3]);
        const speed = parseFloat(parts[4]);
        const heading = parseFloat(parts[5]);
        const batteryLevel = parseInt(parts[6], 10);
        const sosActive = parts[7] === '1' || parts[7] === 'true';

        return {
          success: true,
          protocolName: this.protocolName,
          deviceId,
          packetType: sosActive ? 'ALARM' : 'LOCATION',
          payload: {
            deviceId,
            imei: deviceId,
            timestamp: new Date(),
            latitude,
            longitude,
            speed,
            heading,
            batteryLevel,
            sosActive,
            alarmType: sosActive ? ('SOS_PANIC' as AlarmClassification) : undefined,
            metadata: { isSimulation: true }
          },
          rawPacketRef: packet.id,
          requiresAck: false
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        protocolName: this.protocolName,
        rawPacketRef: packet.id,
        error: `Failed to decode simulation frame: ${msg}`
      };
    }

    return {
      success: false,
      protocolName: this.protocolName,
      rawPacketRef: packet.id,
      error: 'Unrecognized simulation packet structure'
    };
  }

  public normalize(decoded: DecodedPacketResult<unknown>): TelemetryEvent | null {
    return TelemetryNormalizer.normalize(decoded, this.protocolName);
  }

  public encodeAck(decoded: DecodedPacketResult<unknown>): Buffer | null {
    return Buffer.from(JSON.stringify({ ack: true, ref: decoded.rawPacketRef, status: 'RECEIVED' }) + '\n');
  }
}
