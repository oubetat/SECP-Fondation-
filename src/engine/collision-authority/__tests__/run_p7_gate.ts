import { HardAcceptanceGateP7 } from '../HardAcceptanceGateP7';

async function main() {
  console.log('START_P7_EVALUATION');
  const report = await HardAcceptanceGateP7.evaluate();
  console.log('=== P7 REPORT SUMMARY ===');
  console.log('Total Gates:', report.totalGates);
  console.log('Passed Gates:', report.passedGates);
  console.log('Failed Gates:', report.failedGates);
  console.log('Verdict:', report.verdict);
  console.log('=== ALL GATES DETAILS ===');
  for (const g of report.gates) {
    console.log(`${g.gateId}: passed=${g.passed} | req="${g.requirement}" | evidence="${g.evidence}"`);
  }
}

main().catch(err => {
  console.error('P7 EVALUATION ERROR:', err);
});
