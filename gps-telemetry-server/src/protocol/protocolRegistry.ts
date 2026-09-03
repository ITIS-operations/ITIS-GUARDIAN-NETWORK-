import { RawNetworkPacket } from '../types/packet.js';
import { IDeviceProtocol } from './deviceProtocol.js';
import { SimulatedTestProtocol } from './simulatedProtocol.js';
import { TrackerProtocolAdapter } from './trackerProtocolAdapter.js';

export class ProtocolRegistry {
  private protocols: Map<string, IDeviceProtocol> = new Map();

  constructor() {
    // Automatically register standard built-in protocols
    this.register(new SimulatedTestProtocol());
    this.register(new TrackerProtocolAdapter());
  }

  public register(protocol: IDeviceProtocol): void {
    const key = protocol.protocolName.toUpperCase();
    this.protocols.set(key, protocol);
  }

  public get(protocolName: string): IDeviceProtocol | undefined {
    return this.protocols.get(protocolName.toUpperCase());
  }

  public getAll(): IDeviceProtocol[] {
    return Array.from(this.protocols.values());
  }

  /**
   * Identifies the matching protocol for an incoming raw packet.
   */
  public identifyProtocol(packet: RawNetworkPacket): IDeviceProtocol | null {
    for (const protocol of this.protocols.values()) {
      try {
        if (protocol.matches(packet)) {
          return protocol;
        }
      } catch (err) {
        console.error(`[ProtocolRegistry] Error testing protocol match for ${protocol.protocolName}:`, err);
      }
    }
    return null;
  }
}
