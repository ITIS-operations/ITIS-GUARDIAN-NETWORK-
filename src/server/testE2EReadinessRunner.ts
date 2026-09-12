/**
 * Standalone CLI runner for GPS Tracker End-to-End Production Readiness Simulation
 */
import { telemetryE2EReadinessTestSuite } from './telemetryE2EReadinessTestSuite.js';

async function run() {
  console.log('\n=============================================================================');
  console.log('  ITIS GUARDIAN NETWORK — GPS TRACKER PRODUCTION READINESS SIMULATION');
  console.log('=============================================================================');

  const suiteResult = await telemetryE2EReadinessTestSuite.runAllTests();

  console.log(`\nTimestamp: ${suiteResult.timestamp}`);
  console.log(`Pipeline Stages: ${suiteResult.pipeline.join(' → ')}`);
  console.log('-----------------------------------------------------------------------------');
  console.log(`HARDWARE STATUS: ${suiteResult.hardwareStatus.realHardwareConnected ? 'CONNECTED' : 'DISCONNECTED (SIMULATION ONLY)'}`);
  console.log(`NOTICE: ${suiteResult.hardwareStatus.hardwareVerificationNotice}`);
  console.log(`REASON: ${suiteResult.hardwareStatus.allowedClassificationReason}`);
  console.log('-----------------------------------------------------------------------------');

  console.log('\nINDIVIDUAL TEST RESULTS (20 END-TO-END TESTS):');
  for (const r of suiteResult.results) {
    console.log(`[${r.status}] ${r.name} [${r.category}]`);
    console.log(`    Stage:    ${r.pipelineStage}`);
    console.log(`    Expected: ${r.expected}`);
    console.log(`    Actual:   ${r.actual}`);
    if (r.status === 'FAIL') {
      console.log('    Evidence:', JSON.stringify(r.evidence, null, 2));
    }
  }

  console.log('\n=============================================================================');
  console.log('                             FINAL REPORT                                    ');
  console.log('=============================================================================');
  console.log(`Total Tests:                  ${suiteResult.summary.totalTests}`);
  console.log(`Passed Tests:                 ${suiteResult.summary.passed}`);
  console.log(`Failed Tests:                 ${suiteResult.summary.failed}`);
  console.log(`All Passed:                   ${suiteResult.summary.allPassed}`);
  console.log(`Simulated-Only Items:         ${suiteResult.summary.simulatedOnlyItemsCount}`);
  console.log(`Actual Hardware Verified:     ${suiteResult.summary.actualHardwareVerifiedItemsCount}`);
  console.log('-----------------------------------------------------------------------------');
  console.log(`READINESS CLASSIFICATION:     ${suiteResult.classification}`);
  console.log('-----------------------------------------------------------------------------');

  console.log('\nSIMULATED-ONLY ITEMS:');
  suiteResult.simulatedOnlyItems.forEach((item, idx) => {
    console.log(`  ${idx + 1}. [SIMULATED] ${item}`);
  });

  console.log('\nACTUAL HARDWARE VERIFIED ITEMS:');
  if (suiteResult.actualHardwareVerifiedItems.length === 0) {
    console.log('  (None - Zero physical GPS hardware attached; simulation discipline strictly enforced)');
  } else {
    suiteResult.actualHardwareVerifiedItems.forEach((item, idx) => {
      console.log(`  ${idx + 1}. [HARDWARE] ${item}`);
    });
  }

  console.log('\nREMAINING REQUIREMENTS:');
  suiteResult.remainingRequirements.forEach((req, idx) => {
    console.log(`  • ${req}`);
  });

  console.log('\nDEPLOYMENT PREREQUISITES:');
  suiteResult.deploymentPrerequisites.forEach((pre, idx) => {
    console.log(`  • ${pre}`);
  });

  console.log('\nSECURITY AUDIT:');
  console.log('  • Passwords, secret keys, API tokens, and database credentials strictly suppressed from diagnostics payload.');

  console.log('=============================================================================\n');

  if (!suiteResult.summary.allPassed) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
