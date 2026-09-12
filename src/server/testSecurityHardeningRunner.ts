/**
 * Standalone CLI runner for Security Hardening, Privacy & POPIA Acceptance Tests
 */
import { securityHardeningTestSuite } from './securityHardeningTestSuite.js';

async function run() {
  console.log('=============================================================');
  console.log('  RUNNING SECURITY HARDENING, POPIA & RELIABILITY TEST SUITE');
  console.log('=============================================================');

  const result = await securityHardeningTestSuite.runAllTests();

  console.log(`\nResults: ${result.passedTests}/${result.totalTests} PASSED (All Passed: ${result.allPassed})`);
  console.log('-------------------------------------------------------------');
  for (const r of result.results) {
    const icon = r.passed ? '✓' : '✗';
    console.log(`[${icon} ${r.passed ? 'PASS' : 'FAIL'}] ${r.id}: ${r.name}`);
    console.log(`    Category: ${r.category}`);
    console.log(`    Expected: ${r.expected}`);
    console.log(`    Actual:   ${r.actual}`);
    if (!r.passed) {
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
  console.error('Fatal security test runner failure:', err);
  process.exit(1);
});
