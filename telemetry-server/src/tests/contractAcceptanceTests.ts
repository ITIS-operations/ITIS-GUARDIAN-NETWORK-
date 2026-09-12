/**
 * =====================================================================
 * ITIS DEDICATED GPS TELEMETRY SERVER - SECURE INTEGRATION CONTRACT TESTS
 * Direct runner for the 7 Authoritative Integration Acceptance Tests
 * =====================================================================
 */

import { telemetryIntegrationTestSuite } from '../../../src/server/telemetryIntegration/telemetryIntegrationTestSuite.js';

export async function runContractTests() {
  const summary = await telemetryIntegrationTestSuite.runAllTests();
  return summary;
}

if (process.argv[1]?.includes('contractAcceptanceTests')) {
  runContractTests()
    .then((summary) => {
      console.log('Contract Acceptance Summary:');
      console.log(JSON.stringify(summary, null, 2));
      process.exit(summary.allPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Fatal contract test error:', err);
      process.exit(1);
    });
}
