import { RawNetworkPacket, DecodedPacketResult } from '../types/packet.js';
import { IDeviceProtocol } from './deviceProtocol.js';
import { TelemetryValidator } from '../security/validation.js';

export class PacketDecoder {
  /**
   * Safely decodes a packet using the specified protocol with full error isolation.
   */
  public static async decodePacket(
    protocol: IDeviceProtocol,
    rawPacket: RawNetworkPacket
  ): Promise<DecodedPacketResult<unknown>> {
    try {
      if (!TelemetryValidator.isValidPacketSize(rawPacket.data)) {
        return {
          success: false,
          protocolName: protocol.protocolName,
          rawPacketRef: rawPacket.id,
          error: `Packet size invalid: ${rawPacket.data.length} bytes (exceeds bounds)`
        };
      }

      const result = await protocol.decode(rawPacket);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        protocolName: protocol.protocolName,
        rawPacketRef: rawPacket.id,
        error: `Decode execution failed: ${TelemetryValidator.sanitizeLog(msg)}`
      };
    }
  }
}
