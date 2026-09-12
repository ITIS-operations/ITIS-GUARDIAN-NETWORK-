/**
 * =====================================================================
 * ITIS DEDICATED GPS TELEMETRY SERVER - TRANSPORT TYPES
 * =====================================================================
 */

import { Socket } from 'net';

export type RuntimeLifecycleState = 'INITIALIZING' | 'RUNNING' | 'STOPPING' | 'STOPPED';

export interface InboundPacketContext {
  transport: 'TCP' | 'UDP';
  connectionId: string;
  remoteAddress: string;
  remotePort: number;
  receivedAt: Date;
  rawBuffer: Buffer;
  rawString: string;
}

export interface DownlinkAckTarget {
  transport: 'TCP' | 'UDP';
  connectionId: string;
  remoteAddress: string;
  remotePort: number;
  payload: string | Buffer;
}

export interface ClientConnectionRecord {
  id: string;
  socket?: Socket;
  transport: 'TCP' | 'UDP';
  remoteAddress: string;
  remotePort: number;
  connectedAt: Date;
  lastPacketAt: Date;
  packetsReceived: number;
  identifiedDeviceId?: string;
  isClosed: boolean;
}

export interface TelemetryServerMetrics {
  totalPacketsReceived: number;
  acceptedPackets: number;
  rejectedPackets: number;
  quarantinedPackets: number;
  rateLimitExceededCount: number;
  oversizedPacketsCount: number;
  malformedPacketsCount: number;
  crcFailuresCount: number;
  duplicateSuppressedCount: number;
  unauthorizedDevicesCount: number;
  connectionErrorsCount: number;
  activeConnectionsCount: number;
  peakConnectionsCount: number;
  startTime: Date;
}
