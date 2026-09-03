import net from 'net';

/**
 * ==============================================================================
 * DEVELOPMENT GPS DEVICE SIMULATOR
 * ==============================================================================
 * 
 * [SIMULATED TELEMETRY ONLY]
 * Generates test telemetry streams, movement trajectories, battery drawdown,
 * heartbeats, and SOS panic triggers for local developer testing.
 */

export interface SimulatorOptions {
  host?: string;
  tcpPort?: number;
  httpPort?: number;
  deviceId?: string;
  intervalMs?: number;
}

export class GpsDeviceSimulator {
  private host: string;
  private tcpPort: number;
  private deviceId: string;
  private intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private client: net.Socket | null = null;

  // Starting location: Gauteng / Pretoria School Zone (-25.7590, 28.2340)
  private currentLat = -25.7590;
  private currentLng = 28.2340;
  private currentBattery = 98;
  private tickCount = 0;

  constructor(options?: SimulatorOptions) {
    this.host = options?.host || '127.0.0.1';
    this.tcpPort = options?.tcpPort || 5000;
    this.deviceId = options?.deviceId || 'DEV-SIM-001';
    this.intervalMs = options?.intervalMs || 3000;
  }

  public start(): void {
    console.log(`\n======================================================`);
    console.log(`[SIMULATED TELEMETRY] Starting Device Simulator`);
    console.log(`Device ID: ${this.deviceId}`);
    console.log(`Target:    ${this.host}:${this.tcpPort}`);
    console.log(`Interval:  ${this.intervalMs}ms`);
    console.log(`======================================================\n`);

    this.connectAndStream();
  }

  private connectAndStream(): void {
    this.client = new net.Socket();

    this.client.connect(this.tcpPort, this.host, () => {
      console.log(`[SIMULATED TELEMETRY] Connected to Telemetry Server via TCP.`);
      this.timer = setInterval(() => this.sendTick(), this.intervalMs);
    });

    this.client.on('data', (data) => {
      console.log(`[SIMULATED TELEMETRY] Received Server ACK:`, data.toString().trim());
    });

    this.client.on('error', (err) => {
      console.warn(`[SIMULATED TELEMETRY] Connection error: ${err.message}. Retrying in 5s...`);
    });

    this.client.on('close', () => {
      if (this.timer) clearInterval(this.timer);
      console.log(`[SIMULATED TELEMETRY] Connection closed.`);
    });
  }

  private sendTick(): void {
    if (!this.client || this.client.destroyed) return;

    this.tickCount++;

    // Simulate gentle movement
    this.currentLat += (Math.random() - 0.5) * 0.0005;
    this.currentLng += (Math.random() - 0.5) * 0.0005;
    this.currentBattery = Math.max(5, this.currentBattery - 0.05);

    // Trigger an SOS panic event every 10 ticks for testing
    const isSosTrigger = this.tickCount % 10 === 0;

    const simulatedPayload = {
      simulated: true,
      deviceId: this.deviceId,
      imei: this.deviceId,
      timestamp: new Date().toISOString(),
      latitude: parseFloat(this.currentLat.toFixed(6)),
      longitude: parseFloat(this.currentLng.toFixed(6)),
      speed: parseFloat((Math.random() * 25 + 5).toFixed(1)),
      heading: Math.floor(Math.random() * 360),
      accuracy: 3.5,
      altitude: 1350,
      batteryLevel: Math.round(this.currentBattery),
      gsmSignal: 28,
      ignitionStatus: true,
      sosActive: isSosTrigger,
      alarmType: isSosTrigger ? 'SOS_PANIC' : undefined,
      requiresAck: true,
      metadata: {
        simulationTick: this.tickCount,
        note: isSosTrigger ? 'SIMULATED TEST SOS' : 'SIMULATED ROUTINE PING'
      }
    };

    const packetBuffer = Buffer.from(JSON.stringify(simulatedPayload) + '\n');
    this.client.write(packetBuffer);

    console.log(
      `[SIMULATED TELEMETRY] Sent packet #${this.tickCount} | Lat: ${simulatedPayload.latitude}, Lng: ${simulatedPayload.longitude} | Batt: ${simulatedPayload.batteryLevel}% | SOS: ${isSosTrigger}`
    );
  }

  public stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.client) this.client.destroy();
    console.log(`[SIMULATED TELEMETRY] Simulator stopped.`);
  }
}

// Auto-run if executed directly via CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const sim = new GpsDeviceSimulator();
  sim.start();

  process.on('SIGINT', () => {
    sim.stop();
    process.exit(0);
  });
}
