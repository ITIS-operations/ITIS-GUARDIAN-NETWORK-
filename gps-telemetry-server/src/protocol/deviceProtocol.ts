import { RawNetworkPacket, DecodedPacketResult, EncodedPacketResult } from '../types/packet.js';
import { TelemetryEvent } from '../types/telemetry.js';

/**
 * Protocol Interface for GPS Tracking Hardware.
 * Any physical tracker (GT012, JT808, TK103, Teltonika, etc.)
 * must implement this contract.
 */
export interface IDeviceProtocol {
  readonly protocolName: string;
  readonly description: string;
  readonly defaultPort: number;

  /**
   * Determine if the incoming raw byte stream matches this protocol's signature.
   */
  matches(packet: RawNetworkPacket): boolean;

  /**
   * Decode raw packet bytes into a structured decoded result.
   */
  decode(packet: RawNetworkPacket): Promise<DecodedPacketResult<unknown>>;

  /**
   * Normalize protocol-specific payload into a unified TelemetryEvent.
   * Unsupported fields must remain undefined or null (no fabricated data).
   */
  normalize(decoded: DecodedPacketResult<unknown>): TelemetryEvent | null;

  /**
   * Generate an acknowledgment or command packet for the device if required.
   */
  encodeAck?(decoded: DecodedPacketResult<unknown>): Buffer | null;

  /**
   * Encode a downstream command (e.g. ping, configure, reboot) for the device.
   */
  encodeCommand?(commandType: string, params?: Record<string, unknown>): EncodedPacketResult;
}
