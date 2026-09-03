import { testProtocolSuite } from './protocol.test.js';
import { testGT012TrackerProtocolSuite } from './trackerProtocol.test.js';
import { testDeviceRegistryAcceptanceSuite } from './deviceRegistryAcceptance.test.js';
import { testPipelineAcceptanceSuite } from './pipelineAcceptance.test.js';
import { testEmergencyAcceptanceSuite } from './emergencyAcceptance.test.js';
import { testTelemetrySuite } from './telemetry.test.js';
import { testGeofenceSuite } from './geofence.test.js';
import { testAlertsSuite } from './alerts.test.js';

async function main() {
  console.log('======================================================');
  console.log('  ITIS GPS TELEMETRY SERVER — INTEGRATION TEST RUNNER');
  console.log('======================================================\n');

  const r1 = await testProtocolSuite();
  console.log('');
  const rGT012 = await testGT012TrackerProtocolSuite();
  console.log('');
  const rDevReg = await testDeviceRegistryAcceptanceSuite();
  console.log('');
  const rPipeline = await testPipelineAcceptanceSuite();
  console.log('');
  const rEmergency = await testEmergencyAcceptanceSuite();
  console.log('');
  const r2 = await testTelemetrySuite();
  console.log('');
  const r3 = await testGeofenceSuite();
  console.log('');
  const r4 = await testAlertsSuite();
  console.log('');

  const allPassed = r1 && rGT012 && rDevReg && rPipeline && rEmergency && r2 && r3 && r4;
  console.log('======================================================');
  if (allPassed) {
    console.log('  ALL TEST SUITES PASSED SUCCESSFULLY (8/8)');
    console.log('======================================================\n');
    process.exit(0);
  } else {
    console.error('  SOME TESTS FAILED');
    console.log('======================================================\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
