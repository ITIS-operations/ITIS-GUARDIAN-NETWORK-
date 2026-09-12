/**
 * ==============================================================================
 * ITIS GUARDIAN NETWORK — PHYSICAL HARDWARE INTEGRATION & ACCEPTANCE RUNNER
 * ==============================================================================
 * Prompt 24: Physical GT012 / Concox Hardware Integration & Field-Test Readiness
 */

import { runPhysicalHardwareReadinessSuite } from './physicalHardwareReadinessTestSuite.js';

async function main() {
  console.log('==============================================================================');
  console.log('  ITIS GUARDIAN NETWORK — PHYSICAL GT012 / CONCOX HARDWARE ACCEPTANCE SUITE');
  console.log('==============================================================================\n');

  const result = await runPhysicalHardwareReadinessSuite();

  console.log(`TOTAL ACCEPTANCE CRITERIA EVALUATED: ${result.totalCriteria}`);
  console.log(`  [SOFTWARE_VERIFIED]          : ${result.softwareVerifiedCount} (All Passed: ${result.allSoftwarePassed})`);
  console.log(`  [HARDWARE_READY_FOR_TESTING] : ${result.hardwareReadyForTestingCount}`);
  console.log(`  [PHYSICALLY_TESTED]          : ${result.physicallyTestedCount} (STRICT GUARANTEE: Never fabricated)`);
  console.log(`  [NOT_YET_VERIFIED]           : ${result.notYetVerifiedCount}`);
  console.log('------------------------------------------------------------------------------\n');

  console.log('CRITERIA CHECKLIST (A THROUGH W):');
  for (const item of result.checklist) {
    const symbol = item.status === 'PASS' ? '✓' : item.status === 'READY_FOR_PHYSICAL_BENCH_TEST' ? '○' : '✗';
    console.log(`[${symbol}] [${item.verificationClassification}] ${item.criterionKey}: ${item.criterionName}`);
    console.log(`    Expected: ${item.expected}`);
    console.log(`    Actual:   ${item.actual}`);
    console.log(`    Notes:    ${item.notes}`);
  }

  console.log('\n------------------------------------------------------------------------------');
  console.log('CONTROLLED FIELD-TEST BLUEPRINT RECORDS:');
  for (const rec of result.testRecords) {
    console.log(`- ${rec.testId} [${rec.verificationClassification}]`);
    console.log(`    Device: ${rec.deviceId} (IMEI: ${rec.imei}) | Carrier: ${rec.simCarrier}`);
    console.log(`    Scenario: ${rec.testScenario}`);
    console.log(`    Location: ${rec.location.name}`);
    console.log(`    Controlled Subject Guard: ${rec.isControlledTestSubject ? 'ACTIVE (NO REAL CHILD PII)' : 'UNSAFE'}`);
  }
  console.log('==============================================================================\n');

  if (!result.allSoftwarePassed) {
    console.error('FATAL: Some software readiness criteria failed validation.');
    process.exit(1);
  } else {
    console.log('SUCCESS: All software criteria passed. System is HARDWARE READY FOR TESTING.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
