/**
 * Raw and framed network packet representations.
 */

export type TransportProtocol = 'TCP' | 'UDP' | 'HTTP';

export interface RawNetworkPacket {
  id: string;
  transport: TransportProtocol;
  remoteAddress: string;
  remotePort: number;
  data: Buffer;
  receivedAt: Date;
}

export interface DecodedPacketResult<T = unknown> {
  success: boolean;
  protocolName: string;
  deviceId?: string;
  packetType?: 'HEARTBEAT' | 'LOCATION' | 'ALARM' | 'LOGIN' | 'ACK' | 'STATUS' | 'UNKNOWN';
  payload?: T;
  rawPacketRef: string;
  error?: string;
  requiresAck?: boolean;
  ackData?: Buffer;
}

export interface EncodedPacketResult {
  success: boolean;
  data: Buffer;
  error?: string;
}
