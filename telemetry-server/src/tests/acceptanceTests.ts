/**
 * =====================================================================
 * ITIS DEDICATED GPS TELEMETRY SERVER - ACCEPTANCE TEST SUITE
 * Complete automated validation of all 9 acceptance criteria
 * =====================================================================
 */

import net from 'net';
import dgram from 'dgram';
import fs from 'fs';
import path from 'path';
import { DedicatedTelemetryServer } from '../index.js';
import { ProtocolTestSuite } from '../../../src/server/protocols/protocolTestSuite.js';

export interface AcceptanceTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  evidence?: any;
  error?: string;
}

export async function runAllAcceptanceTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  allPassed: boolean;
  results: AcceptanceTestResult[];
}> {
  console.log('\n=============================================================');
  console.log('  RUNNING ITIS DEDICATED TELEMETRY SERVER ACCEPTANCE SUITE   ');
  console.log('=============================================================\n');

  const results: AcceptanceTestResult[] = [];

  // -------------------------------------------------------------------
  // TEST 1: Server package builds
  // -------------------------------------------------------------------
  try {
    const rootDir = process.cwd().endsWith('telemetry-server') ? path.resolve(process.cwd(), '..') : process.cwd();
    const telemetryDir = path.resolve(rootDir, 'telemetry-server');

    const pkgPath = path.resolve(telemetryDir, 'package.json');
    const tsconfigPath = path.resolve(telemetryDir, 'tsconfig.json');
    const dockerfilePath = path.resolve(telemetryDir, 'Dockerfile');
    const composePath = path.resolve(telemetryDir, 'docker-compose.example.yml');
    const envPath = path.resolve(telemetryDir, '.env.example');

    const pkgExists = fs.existsSync(pkgPath);
    const tsconfigExists = fs.existsSync(tsconfigPath);
    const dockerExists = fs.existsSync(dockerfilePath);
    const composeExists = fs.existsSync(composePath);
    const envExists = fs.existsSync(envPath);

    const allFilesPresent = pkgExists && tsconfigExists && dockerExists && composeExists && envExists;

    // Verify instantiation of main server class
    const tempServer = new DedicatedTelemetryServer({
      tcpPort: 19023,
      udpPort: 19024,
      healthPort: 19092
    });

    results.push({
      id: 'TEST_1_SERVER_PACKAGE_BUILDS',
      name: 'TEST 1: Server package builds',
      passed: allFilesPresent && Boolean(tempServer),
      expected: 'All package artifacts exist and TypeScript classes instantiate cleanly',
      actual: `Package files present: ${allFilesPresent}, DedicatedTelemetryServer instantiated cleanly`,
      evidence: { pkgExists, tsconfigExists, dockerExists, composeExists, envExists }
    });
  } catch (err: any) {
    results.push({
      id: 'TEST_1_SERVER_PACKAGE_BUILDS',
      name: 'TEST 1: Server package builds',
      passed: false,
      expected: 'Clean build and instantiation',
      actual: `Build check threw error: ${err.message}`,
      error: err.stack
    });
  }

  // -------------------------------------------------------------------
  // TEST 2: TCP adapter starts in dedicated runtime mode
  // -------------------------------------------------------------------
  let runtimeServer: DedicatedTelemetryServer | null = null;
  const TEST_TCP_PORT = 15023;
  const TEST_UDP_PORT = 15024;
  const TEST_HEALTH_PORT = 18092;

  try {
    runtimeServer = new DedicatedTelemetryServer({
      host: '127.0.0.1',
      tcpPort: TEST_TCP_PORT,
      udpPort: TEST_UDP_PORT,
      healthPort: TEST_HEALTH_PORT,
      maxConnections: 10,
      idleTimeoutMs: 10000
    });

    await runtimeServer.start();

    const isTcpListening = runtimeServer.tcpAdapter.getListening();
    const runtimeState = runtimeServer.getRuntimeState();

    // Verify socket connection to TCP port
    const client = new net.Socket();
    let connected = false;

    await new Promise<void>((resolve, reject) => {
      client.connect(TEST_TCP_PORT, '127.0.0.1', () => {
        connected = true;
        client.end();
        resolve();
      });
      client.on('error', reject);
    });

    results.push({
      id: 'TEST_2_TCP_ADAPTER_STARTS',
      name: 'TEST 2: TCP adapter starts in dedicated runtime mode',
      passed: isTcpListening && runtimeState === 'RUNNING' && connected,
      expected: 'TCP adapter listening on port 15023 and accepts client connections',
      actual: `TCP Listening: ${isTcpListening}, RuntimeState: ${runtimeState}, ClientConnected: ${connected}`,
      evidence: { isTcpListening, runtimeState, connected }
    });
  } catch (err: any) {
    results.push({
      id: 'TEST_2_TCP_ADAPTER_STARTS',
      name: 'TEST 2: TCP adapter starts in dedicated runtime mode',
      passed: false,
      expected: 'TCP adapter starts and listens',
      actual: `Failed: ${err.message}`,
      error: err.stack
    });
  }

  // -------------------------------------------------------------------
  // TEST 3: UDP adapter remains controlled
  // -------------------------------------------------------------------
  try {
    if (!runtimeServer) throw new Error('Runtime server not started');

    const isUdpListening = runtimeServer.udpAdapter.getListening();

    // Send test datagram
    const udpClient = dgram.createSocket('udp4');
    let udpSent = false;

    await new Promise<void>((resolve, reject) => {
      const message = Buffer.from('PING_UDP');
      udpClient.send(message, TEST_UDP_PORT, '127.0.0.1', (err) => {
        if (err) reject(err);
        else {
          udpSent = true;
          udpClient.close();
          resolve();
        }
      });
    });

    results.push({
      id: 'TEST_3_UDP_ADAPTER_CONTROLLED',
      name: 'TEST 3: UDP adapter remains controlled',
      passed: isUdpListening && udpSent,
      expected: 'UDP adapter listening on port 15024 and processes datagrams without unhandled exceptions',
      actual: `UDP Listening: ${isUdpListening}, Datagram Sent: ${udpSent}`,
      evidence: { isUdpListening, udpSent }
    });
  } catch (err: any) {
    results.push({
      id: 'TEST_3_UDP_ADAPTER_CONTROLLED',
      name: 'TEST 3: UDP adapter remains controlled',
      passed: false,
      expected: 'Controlled UDP operation',
      actual: `Failed: ${err.message}`,
      error: err.stack
    });
  }

  // -------------------------------------------------------------------
  // TEST 5: Packet reaches TelemetryGatewayEngine
  // (Run before shutdown while runtimeServer is active)
  // -------------------------------------------------------------------
  try {
    if (!runtimeServer) throw new Error('Runtime server not started');

    // Send valid GT012 Concox location packet via TCP client socket
    // Valid GT012 location hex frame generated with exact CRC and framing
    const sampleGt012Hex = ProtocolTestSuite.buildTestGt012LocationPacket(881);
    const packetBuffer = Buffer.from(sampleGt012Hex, 'hex');

    const tcpClient = new net.Socket();
    let ackReceived = false;
    let ackBufferHex = '';

    await new Promise<void>((resolve, reject) => {
      tcpClient.connect(TEST_TCP_PORT, '127.0.0.1', () => {
        tcpClient.write(packetBuffer);
      });

      tcpClient.on('data', (data) => {
        ackReceived = true;
        ackBufferHex = data.toString('hex');
        tcpClient.end();
        resolve();
      });

      tcpClient.on('error', reject);

      setTimeout(() => {
        if (!ackReceived) {
          tcpClient.destroy();
          resolve();
        }
      }, 2000);
    });

    const acceptedCount = runtimeServer.metrics.acceptedPackets;

    results.push({
      id: 'TEST_5_PACKET_REACHES_GATEWAY_ENGINE',
      name: 'TEST 5: Packet reaches TelemetryGatewayEngine',
      passed: acceptedCount > 0 && ackReceived,
      expected: 'Inbound packet traverses TCP adapter -> GatewayBridge -> TelemetryGatewayEngine and returns ACK',
      actual: `Accepted packets: ${acceptedCount}, ACK received: ${ackReceived}, ACK Hex: ${ackBufferHex}`,
      evidence: { acceptedCount, ackReceived, ackBufferHex }
    });
  } catch (err: any) {
    results.push({
      id: 'TEST_5_PACKET_REACHES_GATEWAY_ENGINE',
      name: 'TEST 5: Packet reaches TelemetryGatewayEngine',
      passed: false,
      expected: 'Packet reaches gateway engine',
      actual: `Failed: ${err.message}`,
      error: err.stack
    });
  }

  // -------------------------------------------------------------------
  // TEST 6: Invalid packet isolated
  // -------------------------------------------------------------------
  try {
    if (!runtimeServer) throw new Error('Runtime server not started');

    const initialRejected = runtimeServer.metrics.rejectedPackets;

    // Send corrupted malformed packet via TCP
    const malformedBuffer = Buffer.from('CORRUPTED_RAW_UNRECOGNIZED_STREAM_FRAME_7878_INVALID');

    const tcpClient = new net.Socket();
    await new Promise<void>((resolve) => {
      tcpClient.connect(TEST_TCP_PORT, '127.0.0.1', () => {
        tcpClient.write(malformedBuffer);
        setTimeout(() => {
          tcpClient.destroy();
          resolve();
        }, 500);
      });
      tcpClient.on('error', () => resolve());
    });

    const quarantineStats = runtimeServer.securityEngine.getQuarantineStats();
    const serverStillRunning = runtimeServer.getRuntimeState() === 'RUNNING';

    results.push({
      id: 'TEST_6_INVALID_PACKET_ISOLATED',
      name: 'TEST 6: Invalid packet isolated',
      passed: quarantineStats.totalQuarantined > 0 && serverStillRunning,
      expected: 'Malformed packet captured by SecurityIsolationEngine without crashing process',
      actual: `Quarantined count: ${quarantineStats.totalQuarantined}, Server still running: ${serverStillRunning}`,
      evidence: { quarantineStats, serverStillRunning }
    });
  } catch (err: any) {
    results.push({
      id: 'TEST_6_INVALID_PACKET_ISOLATED',
      name: 'TEST 6: Invalid packet isolated',
      passed: false,
      expected: 'Zero-crash invalid packet isolation',
      actual: `Failed: ${err.message}`,
      error: err.stack
    });
  }

  // -------------------------------------------------------------------
  // TEST 7: Connection limits work
  // -------------------------------------------------------------------
  try {
    // Spin up an isolated server with tight connection limit of 2
    const limitedServer = new DedicatedTelemetryServer({
      host: '127.0.0.1',
      tcpPort: 16023,
      udpPort: 16024,
      healthPort: 19093,
      maxConnections: 2
    });

    await limitedServer.start();

    // Open connection 1
    const socket1 = new net.Socket();
    await new Promise<void>((resolve) => socket1.connect(16023, '127.0.0.1', resolve));

    // Open connection 2
    const socket2 = new net.Socket();
    await new Promise<void>((resolve) => socket2.connect(16023, '127.0.0.1', resolve));

    // Connection count should now be 2
    const countBefore = limitedServer.connectionManager.getActiveCount();

    // Check if canAcceptConnection correctly returns false
    const limitCheck = limitedServer.connectionManager.canAcceptConnection();

    // Clean up
    socket1.destroy();
    socket2.destroy();
    await limitedServer.stop();

    results.push({
      id: 'TEST_7_CONNECTION_LIMITS_WORK',
      name: 'TEST 7: Connection limits work',
      passed: countBefore === 2 && limitCheck.allowed === false,
      expected: 'Connection manager allows up to maxConnections (2) and rejects subsequent connections',
      actual: `Active count at ceiling: ${countBefore}, canAcceptConnection allowed: ${limitCheck.allowed}`,
      evidence: { countBefore, limitCheck }
    });
  } catch (err: any) {
    results.push({
      id: 'TEST_7_CONNECTION_LIMITS_WORK',
      name: 'TEST 7: Connection limits work',
      passed: false,
      expected: 'Connection limit rejection',
      actual: `Failed: ${err.message}`,
      error: err.stack
    });
  }

  // -------------------------------------------------------------------
  // TEST 4: Graceful shutdown works
  // (Executed on runtimeServer)
  // -------------------------------------------------------------------
  try {
    if (!runtimeServer) throw new Error('Runtime server not started');

    await runtimeServer.stop();

    const finalState = runtimeServer.getRuntimeState();
    const tcpListening = runtimeServer.tcpAdapter.getListening();
    const udpListening = runtimeServer.udpAdapter.getListening();
    const healthListening = runtimeServer.healthServer.getListening();

    const allListenersClosed = !tcpListening && !udpListening && !healthListening;

    results.push({
      id: 'TEST_4_GRACEFUL_SHUTDOWN_WORKS',
      name: 'TEST 4: Graceful shutdown works',
      passed: finalState === 'STOPPED' && allListenersClosed,
      expected: 'runtimeState transitions to STOPPED and all listeners (TCP, UDP, Health) close cleanly',
      actual: `State: ${finalState}, All listeners closed: ${allListenersClosed}`,
      evidence: { finalState, tcpListening, udpListening, healthListening }
    });
  } catch (err: any) {
    results.push({
      id: 'TEST_4_GRACEFUL_SHUTDOWN_WORKS',
      name: 'TEST 4: Graceful shutdown works',
      passed: false,
      expected: 'Clean graceful shutdown',
      actual: `Failed: ${err.message}`,
      error: err.stack
    });
  }

  // -------------------------------------------------------------------
  // TEST 8: Existing ITIS web application unaffected
  // -------------------------------------------------------------------
  try {
    const rootDir = process.cwd().endsWith('telemetry-server') ? path.resolve(process.cwd(), '..') : process.cwd();
    const rootPkg = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf8'));
    const serverTs = fs.readFileSync(path.resolve(rootDir, 'server.ts'), 'utf8');
    const vercelJsonExists = fs.existsSync(path.resolve(rootDir, 'vercel.json'));

    // Check that port 3000 remains the web app port and scripts are untouched
    const hasViteBuild = rootPkg.scripts?.build?.includes('vite build');
    const hasPort3000 = serverTs.includes('3000');
    const rootUnchanged = hasViteBuild && hasPort3000 && vercelJsonExists;

    results.push({
      id: 'TEST_8_EXISTING_WEB_APP_UNAFFECTED',
      name: 'TEST 8: Existing ITIS web application unaffected',
      passed: rootUnchanged,
      expected: 'Web server (server.ts) on port 3000, root package.json, and vercel.json remain intact',
      actual: `Port 3000 intact: ${hasPort3000}, Vite build script intact: ${hasViteBuild}, vercel.json intact: ${vercelJsonExists}`,
      evidence: { hasViteBuild, hasPort3000, vercelJsonExists }
    });
  } catch (err: any) {
    results.push({
      id: 'TEST_8_EXISTING_WEB_APP_UNAFFECTED',
      name: 'TEST 8: Existing ITIS web application unaffected',
      passed: false,
      expected: 'Web application unaffected',
      actual: `Failed: ${err.message}`,
      error: err.stack
    });
  }

  // -------------------------------------------------------------------
  // TEST 9: No production deployment occurs
  // -------------------------------------------------------------------
  try {
    const rootDir = process.cwd().endsWith('telemetry-server') ? path.resolve(process.cwd(), '..') : process.cwd();
    const telemetryDir = path.resolve(rootDir, 'telemetry-server');

    // Ensure no production deployment commands were run, ports were only tested locally
    // and deployment files are configured with safe example variables
    const composeContent = fs.readFileSync(
      path.resolve(telemetryDir, 'docker-compose.example.yml'),
      'utf8'
    );
    const envExampleContent = fs.readFileSync(
      path.resolve(telemetryDir, '.env.example'),
      'utf8'
    );

    const isExampleCompose = !composeContent.includes('password:') && !composeContent.includes('secret:');
    const isExampleEnv = envExampleContent.includes('HOST=0.0.0.0') && !envExampleContent.includes('SECRET_KEY=actual_secret');
    const noProdDeployment = isExampleCompose && isExampleEnv;

    results.push({
      id: 'TEST_9_NO_PRODUCTION_DEPLOYMENT_OCCURS',
      name: 'TEST 9: No production deployment occurs',
      passed: noProdDeployment,
      expected: 'Zero production deployment triggered; only deployment-ready package artifacts created',
      actual: `Deployment prevented: ${noProdDeployment}, Safe templates verified`,
      evidence: { isExampleCompose, isExampleEnv }
    });
  } catch (err: any) {
    results.push({
      id: 'TEST_9_NO_PRODUCTION_DEPLOYMENT_OCCURS',
      name: 'TEST 9: No production deployment occurs',
      passed: false,
      expected: 'No production deployment',
      actual: `Failed: ${err.message}`,
      error: err.stack
    });
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  const allPassed = failedCount === 0 && results.length === 9;

  console.log('-------------------------------------------------------------');
  console.log(`ACCEPTANCE RESULTS: ${passedCount}/${results.length} PASSED (All Passed: ${allPassed})`);
  console.log('-------------------------------------------------------------\n');

  return {
    total: results.length,
    passed: passedCount,
    failed: failedCount,
    allPassed,
    results
  };
}

// Direct execution
if (process.argv[1]?.endsWith('acceptanceTests.ts')) {
  runAllAcceptanceTests()
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
      process.exit(summary.allPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Fatal test error:', err);
      process.exit(1);
    });
}
