/**
 * ITIS GUARDIAN NETWORK — PROTOCOL PROFILE REGISTRY
 * 
 * Central registry and authoritative protocol selection engine.
 * Responsibilities:
 * 1. Maintain registered protocol profiles (GT012, ASCII, JSON, and future manufacturer profiles).
 * 2. Controlled Protocol Selection based on packet framing, registered device config, and detection rules.
 * 3. Reject unknown protocols safely with diagnostic metrics (no crashes, no persistence).
 * 4. Ensure protocol-specific ACK generation (no GT012 ACKs to unrelated protocols).
 * 5. Provide zero-leak technician inspection diagnostics.
 */

import {
  ProtocolDetectionResult,
  ProtocolInspectionResult,
  ProtocolProfileSummary
} from '../../types.js';
import { IProtocolProfile } from './interfaces.js';
import { GT012ProtocolProfile } from './gt012Profile.js';
import { AsciiProtocolProfile } from './asciiProfile.js';
import { JsonProtocolProfile } from './jsonProfile.js';

export class ProtocolProfileRegistry {
  private profiles: Map<string, IProtocolProfile> = new Map();
  // Priority-ordered protocol evaluation list
  private evaluationOrder: string[] = [];

  constructor() {
    this.registerDefaultProfiles();
  }

  /**
   * Register default enterprise profiles
   */
  private registerDefaultProfiles(): void {
    const gt012 = new GT012ProtocolProfile();
    const ascii = new AsciiProtocolProfile();
    const json = new JsonProtocolProfile();

    this.registerProfile(gt012);
    this.registerProfile(ascii);
    this.registerProfile(json);
  }

  /**
   * Register a new or future protocol profile
   */
  public registerProfile(profile: IProtocolProfile): void {
    const id = profile.protocolId.toUpperCase();
    this.profiles.set(id, profile);
    if (!this.evaluationOrder.includes(id)) {
      this.evaluationOrder.push(id);
    }
  }

  /**
   * Retrieve a registered profile by identifier
   */
  public getProfile(protocolId: string): IProtocolProfile | undefined {
    return this.profiles.get(protocolId.toUpperCase());
  }

  /**
   * List all registered profiles and capabilities
   */
  public listProfiles(): ProtocolProfileSummary[] {
    return Array.from(this.profiles.values()).map(p => p.getSummary());
  }

  /**
   * Authoritative Protocol Detection Algorithm
   * 
   * Precedence & Rules:
   * 1. Never trust frontend protocol selection.
   * 2. If registered device configuration is provided, check if the packet satisfies that profile.
   * 3. Evaluate profiles by packet framing and detection rules.
   * 4. Return the highest-confidence matching profile.
   * 5. If no profile matches with sufficient confidence, return null safely.
   */
  public detectProtocol(
    rawPacket: string | Buffer,
    registeredDeviceProtocol?: string
  ): { profile: IProtocolProfile; detection: ProtocolDetectionResult } | null {
    if (!rawPacket) return null;

    // Step 1: If registered device protocol is supplied, test that profile first
    if (registeredDeviceProtocol) {
      const normalizedDeviceProto = registeredDeviceProtocol.toUpperCase();
      // Map aliases
      const mappedId = 
        normalizedDeviceProto === 'CONCOX' ? 'GT012' :
        normalizedDeviceProto === 'SIMULATED_JSON' || normalizedDeviceProto === 'SIMULATED' ? 'JSON' :
        normalizedDeviceProto;

      const deviceProfile = this.profiles.get(mappedId);
      if (deviceProfile) {
        const detection = deviceProfile.canHandle(rawPacket, registeredDeviceProtocol);
        if (detection.matched && detection.confidence >= 0.7) {
          return { profile: deviceProfile, detection };
        }
      }
    }

    // Step 2: Iterate through all registered profiles in evaluation order
    let bestMatch: { profile: IProtocolProfile; detection: ProtocolDetectionResult } | null = null;
    let highestConfidence = 0;

    for (const protoId of this.evaluationOrder) {
      const profile = this.profiles.get(protoId);
      if (!profile) continue;

      const detection = profile.canHandle(rawPacket, registeredDeviceProtocol);
      if (detection.matched && detection.confidence > highestConfidence && detection.confidence >= 0.6) {
        highestConfidence = detection.confidence;
        bestMatch = { profile, detection };
      }
    }

    return bestMatch;
  }

  /**
   * Diagnostic Packet Inspector for Technician Portal
   * Analyzes an incoming packet without modifying state or persisting data.
   * Protects privacy: No learner names, EMIS, or personal identifiers are exposed.
   */
  public inspectPacket(
    rawPacket: string,
    contextDeviceProtocol?: string
  ): ProtocolInspectionResult {
    const diagnostics: string[] = [];
    const trimmed = (rawPacket || '').trim();

    if (!trimmed) {
      return {
        detectedProtocol: 'NONE',
        protocolName: 'Empty Payload',
        isRegistered: false,
        parserStatus: 'UNRECOGNIZED_PROTOCOL',
        packetValidity: {
          validFraming: false,
          validChecksum: false,
          validCoordinates: false,
          validBattery: false,
          validTimestamp: false,
          errors: ['Empty packet received for inspection.']
        },
        ackAvailability: {
          ackRequired: false,
          ackFormat: 'NONE'
        },
        diagnostics: ['Packet input is empty.']
      };
    }

    const detected = this.detectProtocol(trimmed, contextDeviceProtocol);

    if (!detected) {
      diagnostics.push('Packet framing did not match any registered protocol profiles (GT012, ASCII, JSON).');
      diagnostics.push('Packet will be safely rejected by Authoritative Telemetry Ingestion Pipeline.');

      return {
        detectedProtocol: 'UNKNOWN',
        protocolName: 'Unrecognized Protocol',
        isRegistered: false,
        parserStatus: 'UNRECOGNIZED_PROTOCOL',
        packetValidity: {
          validFraming: false,
          validChecksum: false,
          validCoordinates: false,
          validBattery: false,
          validTimestamp: false,
          errors: ['Framing not recognized by any registered protocol profile.']
        },
        ackAvailability: {
          ackRequired: false,
          ackFormat: 'NONE'
        },
        diagnostics
      };
    }

    const { profile, detection } = detected;
    diagnostics.push(`Matched profile '${profile.protocolId}' (${profile.protocolName}) with confidence ${Math.round(detection.confidence * 100)}%.`);
    if (detection.reason) {
      diagnostics.push(`Detection note: ${detection.reason}`);
    }

    // Attempt decode
    let decoded;
    let parserStatus: 'SUCCESS' | 'PARSE_ERROR' | 'UNRECOGNIZED_PROTOCOL' = 'SUCCESS';
    try {
      decoded = profile.decode(trimmed);
    } catch (err: any) {
      parserStatus = 'PARSE_ERROR';
      diagnostics.push(`Decode exception caught: ${err.message}`);
      return {
        detectedProtocol: profile.protocolId,
        protocolName: profile.protocolName,
        isRegistered: true,
        parserStatus,
        packetValidity: {
          validFraming: false,
          validChecksum: false,
          validCoordinates: false,
          validBattery: false,
          validTimestamp: false,
          errors: [`Parser failed during decoding: ${err.message}`]
        },
        ackAvailability: {
          ackRequired: false,
          ackFormat: 'NONE'
        },
        diagnostics
      };
    }

    // Run validation rules
    const validation = profile.validate(decoded, trimmed);
    if (validation.errors.length > 0) {
      diagnostics.push(`Validation identified ${validation.errors.length} issue(s): ${validation.errors.join('; ')}`);
    } else {
      diagnostics.push('All protocol validation rules passed successfully.');
    }

    // Check ACK availability
    let ackResult;
    try {
      ackResult = profile.encodeAck(decoded, trimmed);
      diagnostics.push(`Downlink ACK configured: format=${ackResult.ackFormat}, payloadLength=${ackResult.ackPayload?.length || 0}`);
    } catch (err: any) {
      diagnostics.push(`ACK encoder warning: ${err.message}`);
      ackResult = { requiresAck: false, ackFormat: 'NONE' as const };
    }

    return {
      detectedProtocol: profile.protocolId,
      protocolName: profile.protocolName,
      isRegistered: true,
      parserStatus: validation.errors.length === 0 ? 'SUCCESS' : 'PARSE_ERROR',
      packetValidity: validation,
      ackAvailability: {
        ackRequired: ackResult.requiresAck,
        ackFormat: ackResult.ackFormat,
        ackPayload: ackResult.ackPayload
      },
      decodedSummary: {
        packetType: decoded.packetType,
        deviceIdentifier: decoded.deviceIdentifier ? `***${decoded.deviceIdentifier.slice(-4)}` : undefined, // Masked for privacy
        hasCoordinates: Boolean(decoded.extractedLocation),
        latitude: decoded.extractedLocation?.latitude,
        longitude: decoded.extractedLocation?.longitude,
        speed: decoded.extractedLocation?.speed,
        batteryPercentage: decoded.extractedBattery?.percentage,
        isSos: decoded.extractedEvent?.isSos,
        alarmType: decoded.extractedEvent?.alarmType
      },
      diagnostics
    };
  }
}

export const protocolProfileRegistry = new ProtocolProfileRegistry();
