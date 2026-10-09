import { CFDBenchmarkBattery } from './src/engine/benchmark/cfd/CFDBenchmarkBattery';
import { HardAcceptanceGate174 } from './src/engine/benchmark/cfd/HardAcceptanceGate174';

const report = CFDBenchmarkBattery.runCompleteBattery();
console.log('--- Failed tests ---');
console.log(JSON.stringify(report.tests.filter(t => !t.passed), null, 2));
console.log('--- Report stats ---');
console.log(`Passed: ${report.passedCount}`);
console.log(`Failed: ${report.failedCount}`);
console.log(`Unproven: ${report.unprovenCount}`);
console.log(`Overall Verdict: ${report.overallVerdict}`);

const gate = HardAcceptanceGate174.evaluateGate();
console.log('--- Failed checks ---');
console.log(JSON.stringify(gate.checks.filter(c => !c.passed), null, 2));
