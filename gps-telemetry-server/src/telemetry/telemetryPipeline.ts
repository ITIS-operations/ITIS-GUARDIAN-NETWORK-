import { RawNetworkPacket, DecodedPacketResult } from '../types/packet.js';
import { TelemetryEvent, ProcessedAlertEvent } from '../types/telemetry.js';
import { ProtocolRegistry } from '../protocol/protocolRegistry.js';
import { PacketDecoder } from '../protocol/packetDecoder.js';
import { PacketEncoder } from '../protocol/packetEncoder.js';
import { DeviceAuthenticationService } from '../devices/deviceAuthentication.js';
import { DeviceRegistry } from '../devices/deviceRegistry.js';
import { TelemetryProcessor, TelemetryProcessingResult } from './telemetryProcessor.js';
import { TelemetryValidator } from '../security/validation.js';
import { DeviceRecord } from '../types/device.js';

export interface PipelineExecutionResult {
  success: boolean;
  stage: 'TRANSPORT' | 'PROTOCOL_IDENTIFICATION' | 'PACKET_VALIDATION' | 'DEVICE_AUTHENTICATION' | 'PROTOCOL_DECODER' | 'NORMALIZATION' | 'PROCESSING_COMPLETED';
  protocolName?: string;
  deviceId?: string;
  device?: DeviceRecord;
  event?: TelemetryEvent;
  alertsTriggered: ProcessedAlertEvent[];
  isDuplicate?: boolean;
  requiresAck?: boolean;
  ackData?: Buffer;
  error?: string;
}

/**
 * End-to-End GPS Telemetry Processing Pipeline
 * 
 * Implements the full 12-stage ingestion architecture:
 * 
 * TRACKER (Hardware)
 *     ↓
 * 1. Transport Server (TCP / UDP / HTTP)
 *     ↓
 * 2. Protocol Identification (Registry lookup)
 *     ↓
 * 3. Packet Validation (Framing, buffer size, CRC checksum)
 *     ↓
 * 4. Device Authentication (Registration, Active / Suspended / Retired status)
 *     ↓
 * 5. Protocol Decoder (Hardware payload decoding)
 *     ↓
 * 6. Telemetry Normalization (Consistent internal representation, zero fabricated fields)
 *     ↓
 * 7. Device Lookup (Authoritative registry lookup)
 *     ↓
 * 8. Device-to-Learner Association (Enriches with learner and school context)
 *     ↓
 * 9. Telemetry Processing & Duplicate Protection (Validates GPS, suppresses duplicate packets)
 *     ↓
 * 10. Alert Detection (SOS Panic, Low Battery, Tamper, Geofence)
 *     ↓
 * 11. Storage (TelemetryRepository persistence)
 *     ↓
 * 12. ITIS Integration Event (Upstream dispatch)
 */
export class TelemetryPipeline {
  constructor(
    private protocolRegistry: ProtocolRegistry,
    private authService: DeviceAuthenticationService,
    private deviceRegistry: DeviceRegistry,
    private telemetryProcessor: TelemetryProcessor
  ) {}

  /**
   * Executes the full pipeline for an incoming raw network packet.
   */
  public async processRawPacket(packet: RawNetworkPacket): Promise<PipelineExecutionResult> {
    // Stage 1 & 2: Protocol Identification
    const protocol = this.protocolRegistry.identifyProtocol(packet);
    if (!protocol) {
      return {
        success: false,
        stage: 'PROTOCOL_IDENTIFICATION',
        alertsTriggered: [],
        error: 'UNRECOGNIZED_PROTOCOL_FRAMING'
      };
    }

    // Stage 3: Packet Validation
    if (!TelemetryValidator.isValidPacketSize(packet.data)) {
      return {
        success: false,
        stage: 'PACKET_VALIDATION',
        protocolName: protocol.protocolName,
        alertsTriggered: [],
        error: 'INVALID_PACKET_BUFFER_SIZE'
      };
    }

    // Stage 4: Protocol Decoder
    const decoded: DecodedPacketResult<any> = await PacketDecoder.decodePacket(protocol, packet);
    if (!decoded.success || !decoded.deviceId) {
      return {
        success: false,
        stage: 'PROTOCOL_DECODER',
        protocolName: protocol.protocolName,
        alertsTriggered: [],
        error: decoded.error || 'PACKET_DECODING_FAILED'
      };
    }

    const deviceId = decoded.deviceId;

    // Stage 5: Device Authentication
    const auth = await this.authService.authenticateDevice(deviceId);
    if (!auth.allowed) {
      return {
        success: false,
        stage: 'DEVICE_AUTHENTICATION',
        protocolName: protocol.protocolName,
        deviceId,
        alertsTriggered: [],
        error: auth.reason || 'DEVICE_AUTHENTICATION_FAILED'
      };
    }

    // Stage 6: Telemetry Normalization
    const normalizedEvent = protocol.normalize(decoded);
    if (!normalizedEvent) {
      return {
        success: false,
        stage: 'NORMALIZATION',
        protocolName: protocol.protocolName,
        deviceId,
        device: auth.device,
        alertsTriggered: [],
        error: 'TELEMETRY_NORMALIZATION_FAILED'
      };
    }

    // Stage 7-12: Processing, Deduplication, Alerts, Storage, Upstream Integration
    const procResult: TelemetryProcessingResult = await this.telemetryProcessor.processEvent(normalizedEvent);

    // Compute ACK if required by hardware protocol
    let ackData: Buffer | undefined = undefined;
    if (decoded.requiresAck) {
      ackData = decoded.ackData || PacketEncoder.encodeAck(protocol, decoded);
    }

    return {
      success: procResult.success,
      stage: 'PROCESSING_COMPLETED',
      protocolName: protocol.protocolName,
      deviceId,
      device: auth.device,
      event: procResult.event,
      alertsTriggered: procResult.alertsTriggered,
      isDuplicate: procResult.isDuplicate,
      requiresAck: decoded.requiresAck,
      ackData,
      error: procResult.error
    };
  }

  public getTelemetryProcessor(): TelemetryProcessor {
    return this.telemetryProcessor;
  }

  public getDeviceRegistry(): DeviceRegistry {
    return this.deviceRegistry;
  }

  public getAuthService(): DeviceAuthenticationService {
    return this.authService;
  }
}
