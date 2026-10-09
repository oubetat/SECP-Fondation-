import { BooleanAdversarialBattery } from './src/engine/benchmark/boolean/BooleanAdversarialBattery';
import * as fs from 'fs';

async function main() {
  console.log("=== STARTING PATCH-172 QUALIFICATION SUITE ===");
  const report = BooleanAdversarialBattery.runAll();
  
  console.log("\n=== QUALIFICATION MATRIX ===");
  console.log("CASE | ENGINE STATUS | TOPOLOGY | VOLUME | ORACLE | DETERMINISM | FINAL VERDICT");
  console.log("--------------------------------------------------------------------------------");
  
  for (const record of report.evidenceLedger) {
    const caseName = (record.testId || "UNKNOWN").padEnd(30);
    const engineStatus = (record.verdict || "UNKNOWN").padEnd(15);
    const topology = record.topologyValidation?.isManifold ? "PASS".padEnd(10) : "FAIL".padEnd(10);
    const volume = record.invariants?.invariantsSatisfied ? "PASS".padEnd(8) : "FAIL".padEnd(8);
    const oracle = record.invariants?.details?.length === 0 ? "PASS".padEnd(8) : "WARN".padEnd(8);
    const determinism = record.determinismResult?.isDeterministic ? "PASS".padEnd(12) : "FAIL".padEnd(12);
    const verdict = record.verdict;
    
    console.log(`${caseName} | ${engineStatus} | ${topology} | ${volume} | ${oracle} | ${determinism} | ${verdict}`);
  }
  
  console.log("\n=== FINAL BREAKDOWN ===");
  console.log(`TOTAL CASES: ${report.totalCases}`);
  console.log(`PASSED: ${report.passedCount}`);
  console.log(`FAILED: ${report.failedCount}`);
  console.log(`NUMERICAL FAILURES: ${report.numericalFailureCount}`);
  console.log(`TOPOLOGY FAILURES: ${report.topologyFailureCount}`);
  console.log(`UNPROVEN: ${report.unprovenCount}`);
  console.log(`PASS RATE: ${report.passRatePercent.toFixed(2)}%`);
  
  fs.writeFileSync('qualification_report.json', JSON.stringify(report, null, 2));
}

main().catch(console.error);
