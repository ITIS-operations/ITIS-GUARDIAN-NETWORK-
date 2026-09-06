import { protocolTestSuite } from '../src/server/protocols/protocolTestSuite.js';

async function main() {
  console.log('--- STARTING ITIS PROTOCOL ACCEPTANCE TEST SUITE ---');
  const results = await protocolTestSuite.runSuite();
  console.log('RESULTS:');
  console.log(JSON.stringify(results, null, 2));
  if (results.allPassed) {
    console.log(`\n>>> ALL ${results.totalTests} TESTS PASSED CLEANLY! <<<`);
    process.exit(0);
  } else {
    console.error(`\n>>> FAILURE: ${results.failedTests} / ${results.totalTests} TESTS FAILED! <<<`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
