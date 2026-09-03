import { EncodedPacketResult, DecodedPacketResult } from '../types/packet.js';
import { IDeviceProtocol } from './deviceProtocol.js';

export class PacketEncoder {
  /**
   * Encodes an acknowledgment packet if the protocol supports it.
   */
  public static encodeAck(
    protocol: IDeviceProtocol,
    decoded: DecodedPacketResult<unknown>
  ): Buffer | null {
    if (protocol.encodeAck) {
      try {
        return protocol.encodeAck(decoded);
      } catch (err) {
        console.error(`[PacketEncoder] Failed to generate ACK for ${protocol.protocolName}:`, err);
        return null;
      }
    }
    return null;
  }

  /**
   * Encodes a command packet to send downstream to a tracker.
   */
  public static encodeCommand(
    protocol: IDeviceProtocol,
    commandType: string,
    params?: Record<string, unknown>
  ): EncodedPacketResult {
    if (protocol.encodeCommand) {
      try {
        return protocol.encodeCommand(commandType, params);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          data: Buffer.alloc(0),
          error: `Failed to encode command: ${msg}`
        };
      }
    }

    return {
      success: false,
      data: Buffer.alloc(0),
      error: `Protocol ${protocol.protocolName} does not implement downstream commands.`
    };
  }
}
