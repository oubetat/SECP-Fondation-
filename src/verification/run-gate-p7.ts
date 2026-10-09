import { HardAcceptanceGateP7 } from '../engine/collision-authority/HardAcceptanceGateP7';

async function main() {
  const report = await HardAcceptanceGateP7.evaluate();
  console.log('=== HARD ACCEPTANCE GATE P7 REPORT ===');
  console.log(JSON.stringify(report, null, 2));
  if (report.verdict !== 'P7_FULLY_VERIFIED') {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
