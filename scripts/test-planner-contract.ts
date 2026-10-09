import { WasmComputePlanner } from '../src/engine/engineering_wasm/WasmComputePlanner';
import { AccessControlEngine } from '../src/engine/collaboration/AccessControlEngine';
import { HardAcceptanceGate302 } from '../src/engine/engineering_wasm/HardAcceptanceGate302';
import { HardAcceptanceGate293 } from '../src/engine/collaboration/HardAcceptanceGate293';

async function testPlannerContract() {
  console.log('--- DIAGNOSTIC: WasmComputePlanner Contract ---');
  const planner = new WasmComputePlanner();
  console.log('planner.constructor.name:', planner.constructor.name);
  console.log('Object.keys(planner):', Object.keys(planner));
  console.log('Prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(planner)));
  console.log('typeof planner.runFullDomainBenchmark:', typeof planner.runFullDomainBenchmark);
  console.log('typeof planner.benchmarkBoundaryOverhead:', typeof planner.benchmarkBoundaryOverhead);
  console.log('typeof planner.plan:', typeof planner.plan);

  if (typeof planner.runFullDomainBenchmark !== 'function') {
    throw new Error('FAIL: planner.runFullDomainBenchmark is not a function');
  }

  const boundary = planner.benchmarkBoundaryOverhead(5000);
  console.log('Boundary overhead stats:', boundary);

  const plan = planner.plan('LINALG', 50000);
  console.log('Plan result:', plan);

  const bench1000 = await planner.runFullDomainBenchmark(1000);
  console.log('Benchmark (size=1000) count:', bench1000.length);
  for (const b of bench1000) {
    console.log(`  - [${b.domain}] ${b.kernelName}: speedup=${b.speedup}x, error=${b.numericalError}, isCorrect=${b.isCorrect}`);
  }

  const bench5000 = await planner.runFullDomainBenchmark(5000);
  console.log('Benchmark (size=5000) count:', bench5000.length);
  for (const b of bench5000) {
    console.log(`  - [${b.domain}] ${b.kernelName}: speedup=${b.speedup}x, error=${b.numericalError}, isCorrect=${b.isCorrect}`);
  }

  console.log('\n--- DIAGNOSTIC: HardAcceptanceGate302 ---');
  const report302 = await HardAcceptanceGate302.evaluateGate();
  console.log(`Gate 302: passed=${report302.passed}, assertions=${report302.passedAssertions}/${report302.totalAssertions}`);

  console.log('\n--- DIAGNOSTIC: AccessControlEngine Contract ---');
  const ace = new AccessControlEngine();
  console.log('ace.constructor.name:', ace.constructor.name);
  console.log('typeof ace.getAuditLogs:', typeof ace.getAuditLogs);
  console.log('typeof ace.authorize:', typeof ace.authorize);
  console.log('typeof ace.updateMemberStatus:', typeof ace.updateMemberStatus);

  ace.addMember({ userId: 'TEST_ENG', role: 'ENGINEER', status: 'ACTIVE' });
  const decision = ace.authorize({ userId: 'TEST_ENG' }, 'PROJ-TEST', 'PART', 'UPDATE');
  console.log('Authorize decision:', decision);
  const logs = ace.getAuditLogs('PROJ-TEST');
  console.log('Audit logs count:', logs.length);

  console.log('\n--- DIAGNOSTIC: HardAcceptanceGate293 ---');
  const report293 = HardAcceptanceGate293.evaluate();
  console.log(`Gate 293: passed=${report293.passed}, results=${report293.results.length}`);

  console.log('\nALL CONTRACT DIAGNOSTICS COMPLETED SUCCESSFULLY.');
}

testPlannerContract().catch(err => {
  console.error('DIAGNOSTIC FAILURE:', err);
  process.exit(1);
});
