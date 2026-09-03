import { loadConfig } from './config.js';
import pg from 'pg';
import { IDeviceRepository, MemoryDeviceRepository, PostgresDeviceRepository } from '../storage/deviceRepository.js';
import { ITelemetryRepository, MemoryTelemetryRepository, PostgresTelemetryRepository } from '../storage/telemetryRepository.js';
import { DeviceSessionManager } from '../devices/deviceSession.js';
import { DeviceRegistry } from '../devices/deviceRegistry.js';
import { DeviceAuthenticationService } from '../devices/deviceAuthentication.js';
import { ProtocolRegistry } from '../protocol/protocolRegistry.js';
import { SimulatedTestProtocol } from '../protocol/simulatedProtocol.js';
import { TrackerProtocolAdapter } from '../protocol/trackerProtocolAdapter.js';
import { GeofenceEngine } from '../geofence/geofenceEngine.js';
import { AlertEngine } from '../alerts/alertEngine.js';
import { EventPublisher } from '../integration/eventPublisher.js';
import { ItisIntegrationClient } from '../integration/itisIntegrationClient.js';
import { TelemetryProcessor } from '../telemetry/telemetryProcessor.js';
import { ConnectionGuard } from '../security/connectionGuard.js';
import { IngestionRateLimiter } from '../security/rateLimiter.js';
import { TcpTelemetryServer } from '../transport/tcpServer.js';
import { UdpTelemetryServer } from '../transport/udpServer.js';
import { HttpTelemetryServer } from '../transport/httpServer.js';

export async function bootstrapTelemetryServer() {
  const config = loadConfig();

  console.log(`\n======================================================`);
  console.log(`  ITIS GPS TELEMETRY INGESTION SERVER`);
  console.log(`  Storage Mode:    ${config.storageMode.toUpperCase()}`);
  console.log(`  HTTP Rest/Health: http://${config.host}:${config.httpPort}`);
  console.log(`  TCP Port:        ${config.tcpPort}`);
  console.log(`  UDP Port:        ${config.udpPort}`);
  console.log(`======================================================\n`);

  // 1. Initialize Storage Repositories
  let deviceRepo: IDeviceRepository;
  let telemetryRepo: ITelemetryRepository;
  let pgPool: pg.Pool | null = null;

  if (config.storageMode === 'postgresql') {
    try {
      if (config.database.connectionString) {
        console.log(`[Storage] Connecting to PostgreSQL via DATABASE_URL...`);
        pgPool = new pg.Pool({
          connectionString: config.database.connectionString,
          ssl: config.database.ssl ? { rejectUnauthorized: false } : undefined,
          max: config.database.poolMax || 20
        });
      } else {
        console.log(`[Storage] Connecting to PostgreSQL at ${config.database.host}:${config.database.port}...`);
        pgPool = new pg.Pool({
          host: config.database.host,
          port: config.database.port,
          database: config.database.database,
          user: config.database.user,
          password: config.database.password,
          ssl: config.database.ssl ? { rejectUnauthorized: false } : undefined,
          max: config.database.poolMax || 20
        });
      }

      // Test connection
      await pgPool.query('SELECT 1;');
      console.log(`[Storage] PostgreSQL connected successfully.`);

      deviceRepo = new PostgresDeviceRepository(pgPool);
      telemetryRepo = new PostgresTelemetryRepository(pgPool);
      await deviceRepo.init();
      await telemetryRepo.init();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Storage] PostgreSQL initialization failed (${msg}). Falling back to MEMORY storage.`);
      deviceRepo = new MemoryDeviceRepository();
      telemetryRepo = new MemoryTelemetryRepository();
      await deviceRepo.init();
      await telemetryRepo.init();
    }
  } else {
    console.log(`[Storage] Operating in zero-dependency IN-MEMORY storage mode.`);
    deviceRepo = new MemoryDeviceRepository();
    telemetryRepo = new MemoryTelemetryRepository();
    await deviceRepo.init();
    await telemetryRepo.init();
  }

  // 2. Initialize Core Device & Session Management
  const sessionManager = new DeviceSessionManager();
  const deviceRegistry = new DeviceRegistry(deviceRepo, sessionManager);
  const authService = new DeviceAuthenticationService(deviceRepo);

  // 3. Initialize Protocol Registry
  const protocolRegistry = new ProtocolRegistry();
  protocolRegistry.register(new SimulatedTestProtocol());
  protocolRegistry.register(new TrackerProtocolAdapter());

  // 4. Initialize Engines & Pipelines
  const geofenceEngine = new GeofenceEngine();
  // Register standard school perimeter demo geofence
  geofenceEngine.registerGeofence({
    id: 'geo_pretoria_school_01',
    name: 'Pretoria Primary Safe Zone',
    type: 'CIRCLE',
    centerLatitude: -25.7590,
    centerLongitude: 28.2340,
    radiusMeters: 500,
    isActive: true
  });

  const alertEngine = new AlertEngine(geofenceEngine);
  const itisClient = new ItisIntegrationClient(config.integration);
  const eventPublisher = new EventPublisher(itisClient);
  const telemetryProcessor = new TelemetryProcessor(
    telemetryRepo,
    deviceRegistry,
    alertEngine,
    eventPublisher
  );

  // 5. Initialize Security Guards & Rate Limiters
  const connectionGuard = new ConnectionGuard(
    config.security.maxConcurrentTcpConnections,
    50
  );
  const rateLimiter = new IngestionRateLimiter(
    config.security.rateLimitMaxPacketsPerMinute,
    60000
  );

  // 6. Initialize Transports
  const tcpServer = new TcpTelemetryServer(
    config.host,
    config.tcpPort,
    protocolRegistry,
    telemetryProcessor,
    sessionManager,
    authService,
    connectionGuard,
    rateLimiter,
    config.security.deviceIdleTimeoutSeconds
  );

  const udpServer = new UdpTelemetryServer(
    config.host,
    config.udpPort,
    protocolRegistry,
    telemetryProcessor,
    authService,
    rateLimiter
  );

  const httpServer = new HttpTelemetryServer(
    config.host,
    config.httpPort,
    config.storageMode,
    protocolRegistry,
    telemetryProcessor,
    authService,
    deviceRegistry,
    telemetryRepo,
    rateLimiter
  );

  // 7. Start Network Listeners
  await httpServer.start();
  await tcpServer.start();
  await udpServer.start();

  console.log(`[TelemetryServer] All transports active and operational.`);

  // 8. Graceful Shutdown Handler
  const shutdown = async () => {
    console.log(`\n[TelemetryServer] Initiating graceful shutdown...`);
    await tcpServer.stop();
    await udpServer.stop();
    await httpServer.stop();
    await deviceRepo.close();
    await telemetryRepo.close();
    if (pgPool) await pgPool.end();
    console.log(`[TelemetryServer] Shutdown complete.`);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return {
    config,
    deviceRegistry,
    telemetryRepo,
    protocolRegistry,
    tcpServer,
    udpServer,
    httpServer
  };
}

// Auto-boot when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  bootstrapTelemetryServer().catch((err) => {
    console.error('Fatal Telemetry Server Boot Error:', err);
    process.exit(1);
  });
}
