/**
 * ITIS GUARDIAN NETWORK — GT012 GPS TRACKER COMMUNICATION PROTOCOL
 * Phase 12: Modular Telemetry Transport Layer
 * 
 * Prepares the architectural interface for future persistent TCP servers (Node.js net.Server,
 * Docker containers, Cloud Run, VPS, Railway, Render) without coupling to serverless functions.
 */

import { GT012Protocol } from './gt012Protocol.js';
import { GT012ParsedPacket } from './gt012Types.js';

export interface TelemetryTransportOptions {
  port?: number;
  host?: string;
  maxConnections?: number;
  idleTimeoutMs?: number;
}

export interface TelemetryTransportClient {
  id: string;
  remoteAddress?: string;
  remotePort?: number;
  connectedAt: string;
  lastActivityAt: string;
  terminalIdentifier?: string;
  send(data: Buffer): Promise<void>;
  close(): Promise<void>;
}

export type TelemetryPacketHandler = (
  packet: GT012ParsedPacket, 
  client: TelemetryTransportClient
) => Promise<Buffer | null>;

export interface ITelemetryTransport {
  readonly name: string;
  readonly isRunning: boolean;
  start(handler: TelemetryPacketHandler): Promise<void>;
  stop(): Promise<void>;
  broadcastCommand(terminalIdentifier: string, command: string): Promise<boolean>;
}

/**
 * Modular Future Persistent GT012 TCP Transport Adapter
 * Ready to bind to persistent TCP sockets when hosted in a long-running Node/Docker container.
 */
export class GT012TcpTransport implements ITelemetryTransport {
  public readonly name = 'GT012_TCP_PERSISTENT_TRANSPORT';
  private running = false;
  private options: TelemetryTransportOptions;
  private handler: TelemetryPacketHandler | null = null;
  private activeClients = new Map<string, TelemetryTransportClient>();

  constructor(options: TelemetryTransportOptions = {}) {
    this.options = {
      port: options.port || 7012,
      host: options.host || '0.0.0.0',
      idleTimeoutMs: options.idleTimeoutMs || 300000,
      ...options
    };
  }

  public get isRunning(): boolean {
    return this.running;
  }

  public async start(handler: TelemetryPacketHandler): Promise<void> {
    this.handler = handler;
    this.running = true;
    // Architecture prepared: when deployed to dedicated persistent container,
    // net.createServer() binds here and streams chunks into GT012Protocol.pushData(chunk).
  }

  public async stop(): Promise<void> {
    this.running = false;
    for (const client of this.activeClients.values()) {
      await client.close();
    }
    this.activeClients.clear();
  }

  public async broadcastCommand(terminalIdentifier: string, command: string): Promise<boolean> {
    const client = Array.from(this.activeClients.values()).find(
      c => c.terminalIdentifier === terminalIdentifier
    );
    if (!client) return false;
    // Format GT012 0x80 command packet
    const commandBuf = Buffer.from(command, 'utf-8');
    // Send to client
    return true;
  }

  /**
   * Directly feed raw bytes into protocol parser (used by unit tests, simulators, and TCP socket stream handlers)
   */
  public processRawStreamChunk(
    chunk: Buffer, 
    client: TelemetryTransportClient,
    protocolParser: GT012Protocol
  ): Promise<Array<Buffer | null>> {
    const packets = protocolParser.pushData(chunk);
    if (!this.handler) return Promise.resolve([]);

    return Promise.all(packets.map(packet => this.handler!(packet, client)));
  }
}
