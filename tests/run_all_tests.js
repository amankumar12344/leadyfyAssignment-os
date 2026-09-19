const fs = require('fs');
const path = require('path');
const { runTests: testAuthRbac } = require('./test_auth_rbac');
const { runTests: testClientCompany } = require('./test_client_company_bug');
const { runTests: testCreatorDoubleBooking } = require('./test_creator_double_booking');
const { runTests: testVideoStateMachine } = require('./test_video_state_machine');
const { runTests: testDeliveryIdempotency } = require('./test_delivery_idempotency');
const { runTests: testFinancials } = require('./test_financials');
const { runTests: testClientIsolation } = require('./test_client_isolation');
const { runTests: testE2E } = require('./test_e2e_full_lifecycle');
const seed = require('../src/database/seed');

async function main() {
  console.log('====================================================');
  console.log('       LEADYFY OS AUTOMATED TEST SUITE');
  console.log('====================================================\n');

  // Reset database to ensure test idempotency across runs
  const dbPath = path.join(__dirname, '..', 'data', 'leadyfy.sqlite');
  if (fs.existsSync(dbPath)) {
    try { fs.unlinkSync(dbPath); } catch (e) {}
  }
  await seed();


  const tests = [
    { name: '1. Authentication & RBAC', fn: testAuthRbac },
    { name: '2. Critical Client Bug (company vs company_name)', fn: testClientCompany },
    { name: '3. Creator Double-Booking Prevention', fn: testCreatorDoubleBooking },
    { name: '4. Strict Video Production State Machine', fn: testVideoStateMachine },
    { name: '5. Idempotent Final Delivery', fn: testDeliveryIdempotency },
    { name: '6. Financial Ledgers & Payout Duplication Checks', fn: testFinancials },
    { name: '7. Client Data Isolation & Shielding', fn: testClientIsolation },
    { name: '8. Complete UGC Agency E2E Lifecycle', fn: testE2E }
  ];

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      console.log(`\nPASSED: ${t.name}\n----------------------------------------------------`);
    } catch (err) {
      failed++;
      console.error(`\nFAILED: ${t.name}`);
      console.error(err);
      console.log(`----------------------------------------------------`);
    }
  }

  console.log('\n====================================================');
  console.log(`TOTAL SUITES: ${tests.length}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
