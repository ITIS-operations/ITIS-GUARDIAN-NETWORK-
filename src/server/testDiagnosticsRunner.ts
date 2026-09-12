/**
 * Standalone CLI runner for Telemetry Diagnostics Acceptance Tests
 */
import { runTelemetryDiagnosticsTestSuite } from './telemetryDiagnosticsTestSuite.js';

async function run() {
  console.log('=============================================================');
  console.log('  RUNNING TELEMETRY OPERATIONS & DIAGNOSTICS ACCEPTANCE SUITE');
  console.log('=============================================================');

  const result = await runTelemetryDiagnosticsTestSuite();

  console.log(`\nResults: ${result.passedTests}/${result.totalTests} PASSED (All Passed: ${result.allPassed})`);
  console.log('-------------------------------------------------------------');
  for (const r of result.results) {
    console.log(`[${r.status}] ${r.name}`);
    console.log(`    Expected: ${r.expected}`);
    console.log(`    Actual:   ${r.actual}`);
    if (r.status === 'FAIL') {
      console.log('    Evidence:', JSON.stringify(r.evidence, null, 2));
    }
  }
  console.log('=============================================================\n');

  if (!result.allPassed) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
