/**
 * ITIS GUARDIAN NETWORK — MULTI-TRACKER PROTOCOL PROFILE ARCHITECTURE
 * 
 * Architectural Pipeline:
 * Protocol Profile
 *   → Packet Decoder
 *   → Validation Rules
 *   → Location Extractor
 *   → Device Identifier Extractor
 *   → Heartbeat Parser
 *   → ACK Encoder
 */

import {
  DecodedPacketEnvelope,
  ProtocolValidationResult,
  ProtocolAckResult,
  ProtocolDetectionResult,
  ProtocolProfileSummary,
  TelemetryTransportType
} from '../../types.js';

export interface IProtocolProfile {
  /** Unique machine identifier, e.g. 'GT012', 'ASCII', 'JSON' */
  readonly protocolId: string;
  
  /** Human-readable name, e.g. 'GT012 Concox Binary' */
  readonly protocolName: string;
  
  /** Tracker manufacturer / standard, e.g. 'Concox / Jimi IoT', 'Standard NMEA/ASCII' */
  readonly manufacturer: string;
  
  /** Profile specification version */
  readonly version: string;
  
  /** Description of framing and transport characteristics */
  readonly framingDescription: string;
  
  /** Supported packet types */
  readonly supportedPacketTypes: readonly ('LOGIN' | 'LOCATION' | 'HEARTBEAT' | 'ALARM' | 'STATUS' | 'COMMAND' | 'UNKNOWN')[];
  
  /** Transports suitable for this protocol */
  readonly transportSuitability: readonly TelemetryTransportType[];

  /**
   * 1. Protocol Detection Rule
   * Analyzes raw packet framing and characteristics to determine whether this profile can handle it.
   */
  canHandle(rawPacket: string | Buffer, registeredDeviceProtocol?: string): ProtocolDetectionResult;

  /**
   * 2. Packet Decoder
   * Converts raw packet bytes or string into an unvalidated structured envelope.
   */
  decode(rawPacket: string | Buffer, context?: { fallbackDeviceId?: string }): DecodedPacketEnvelope;

  /**
   * 3. Validation Rules
   * Validates framing integrity, checksums, physical coordinate ranges, battery bounds, and timestamps.
   */
  validate(envelope: DecodedPacketEnvelope, rawPacket: string | Buffer): ProtocolValidationResult;

  /**
   * 4. Location Extractor
   * Extracts authoritative GPS coordinates, speed, heading, altitude, and precision metrics.
   */
  extractLocation(envelope: DecodedPacketEnvelope): DecodedPacketEnvelope['extractedLocation'];

  /**
   * 5. Device Identifier Extractor
   * Extracts hardware IMEI, serial number, or protocol device ID from payload.
   */
  extractDeviceIdentifier(envelope: DecodedPacketEnvelope, rawPacket: string | Buffer): string | undefined;

  /**
   * 6. Heartbeat Parser
   * Extracts device health, battery percentage, charging status, and status flags.
   */
  parseHeartbeat(envelope: DecodedPacketEnvelope): {
    batteryPercentage?: number;
    voltageLevel?: number;
    voltage?: number;
    charging?: boolean;
    statusFlags?: Record<string, boolean>;
  };

  /**
   * 7. ACK Encoder
   * Builds protocol-specific downlink acknowledgement.
   * Invariant: Never emit GT012 binary ACKs to non-GT012 protocols.
   */
  encodeAck(envelope: DecodedPacketEnvelope, rawPacket: string | Buffer): ProtocolAckResult;

  /**
   * Summarize profile capabilities for registry inspection and technician portal
   */
  getSummary(): ProtocolProfileSummary;
}
