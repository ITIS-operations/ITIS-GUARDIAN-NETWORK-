import { DeviceSession } from '../types/device.js';

export class DeviceSessionManager {
  private sessions: Map<string, DeviceSession> = new Map(); // Key: sessionId
  private deviceSessionIndex: Map<string, string> = new Map(); // Key: deviceId -> sessionId

  public createSession(params: {
    deviceId: string;
    imei: string;
    protocol: string;
    remoteAddress: string;
    remotePort: number;
    socketRef?: unknown;
  }): DeviceSession {
    const sessionId = `sess_${params.deviceId}_${Date.now()}`;
    const now = new Date();

    const session: DeviceSession = {
      sessionId,
      deviceId: params.deviceId,
      imei: params.imei,
      protocol: params.protocol,
      remoteAddress: params.remoteAddress,
      remotePort: params.remotePort,
      connectedAt: now,
      lastPacketAt: now,
      packetCount: 0,
      authenticated: false,
      socketRef: params.socketRef
    };

    // Close any previous session for this device
    const existingSessionId = this.deviceSessionIndex.get(params.deviceId);
    if (existingSessionId && existingSessionId !== sessionId) {
      this.sessions.delete(existingSessionId);
    }

    this.sessions.set(sessionId, session);
    this.deviceSessionIndex.set(params.deviceId, sessionId);

    return session;
  }

  public getSession(sessionId: string): DeviceSession | undefined {
    return this.sessions.get(sessionId);
  }

  public getSessionByDeviceId(deviceId: string): DeviceSession | undefined {
    const sessionId = this.deviceSessionIndex.get(deviceId);
    return sessionId ? this.sessions.get(sessionId) : undefined;
  }

  public recordPacket(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastPacketAt = new Date();
      session.packetCount += 1;
    }
  }

  public setAuthenticated(sessionId: string, authenticated: boolean): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.authenticated = authenticated;
    }
  }

  public removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.deviceSessionIndex.delete(session.deviceId);
      this.sessions.delete(sessionId);
    }
  }

  public getActiveSessionCount(): number {
    return this.sessions.size;
  }

  public getIdleSessions(timeoutSeconds: number): DeviceSession[] {
    const threshold = Date.now() - (timeoutSeconds * 1000);
    const idle: DeviceSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.lastPacketAt.getTime() < threshold) {
        idle.push(session);
      }
    }
    return idle;
  }
}
