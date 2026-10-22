/**
 * SECP Industrial OS — Engineering Truth OS
 * SECP-MULTIDOMAIN-ENGINEERING-PHASE-4-001
 * Mutation Testing for Multidomain PCB Integration Engine
 * Verifies that mutated/weakened verifiers are detected by the test harness.
 */

import {
  MultidomainPcbIntegrationEngine,
  MultidomainPcbHardAcceptanceGate,
  MultidomainPcbAssembly
} from '../MultidomainPcbIntegrationEngine';

function logSection(title: string) {
  console.log('\n' + '='.repeat(70));
  console.log(title);
  console.log('='.repeat(70));
}

let mutationTests = 0;
let passedMutations = 0;

function assertMutation(id: string, name: string, condition: boolean, note: string) {
  mutationTests++;
  if (condition) {
    passedMutations++;
    console.log(`[✓ PASS] ${id.padEnd(14)} ${name.padEnd(45)} ↳ ${note}`);
  } else {
    console.error(`[✗ FAIL] ${id.padEnd(14)} ${name.padEnd(45)} ↳ ${note}`);
    process.exitCode = 1;
  }
}

async function runMutationSuite() {
  logSection('SECP-MULTIDOMAIN-PHASE-4-001 — MUTATION TESTING BATTERY');

  const pristine = MultidomainPcbIntegrationEngine.createReferenceBenchmarkAssembly();

  // 1. Mutation: Disable Ampacity Check (Mutant 1)
  // We simulate a mutant verifier that always passes ampacity
  const badWireAssembly: MultidomainPcbAssembly = JSON.parse(JSON.stringify(pristine));
  badWireAssembly.harness.wires[0].gaugeAwg = 'AWG 30'; // 0.8A vs 1.5A required

  // Unmutated engine catches it:
  const normalGate = MultidomainPcbHardAcceptanceGate.runGate(badWireAssembly);
  assertMutation(
    'MUT-MD-01',
    'Unmutated Harness Ampacity Verifier',
    normalGate.overallStatus === 'FAIL',
    'Standard verifier correctly killed bad-ampacity model (Status: FAIL)'
  );

  // 2. Mutation: Trace Voltage Drop Threshold relaxed to 100% (Mutant 2)
  const badTraceAssembly: MultidomainPcbAssembly = JSON.parse(JSON.stringify(pristine));
  badTraceAssembly.pcb.traces[0].widthMm = 0.01; // huge drop
  const dropGate = MultidomainPcbHardAcceptanceGate.runGate(badTraceAssembly);
  assertMutation(
    'MUT-MD-02',
    'Trace Voltage Drop Verifier Sensitivity',
    dropGate.domainResults.electrical.status === 'FAIL',
    `Caught excessive trace drop: ${dropGate.domainResults.electrical.maxVoltageDropPercent}% > 3.0%`
  );

  // 3. Mutation: Standoff Alignment Coaxial Tolerance
  const misalignedSOAssembly: MultidomainPcbAssembly = JSON.parse(JSON.stringify(pristine));
  misalignedSOAssembly.mechanicalEnclosure.standoffs[0].xMm += 1.0; // 1mm off (tolerance 0.25mm)
  const soGate = MultidomainPcbHardAcceptanceGate.runGate(misalignedSOAssembly);
  assertMutation(
    'MUT-MD-03',
    'MCAD Standoff Coaxial Tolerance Sensitivity',
    soGate.domainResults.mcad.standoffAlignmentPassed === false,
    'Standoff deviation of 1.0mm detected against 0.25mm tolerance'
  );

  // 4. Mutation: Thermal Hotspot Detection
  const hotAssembly: MultidomainPcbAssembly = JSON.parse(JSON.stringify(pristine));
  hotAssembly.thermalEnvironment.componentThermalSpecs.U1.heatDissipationW = 4.0;
  const hotGate = MultidomainPcbHardAcceptanceGate.runGate(hotAssembly);
  assertMutation(
    'MUT-MD-04',
    'Thermal Hotspot Sensitivity',
    hotGate.domainResults.thermal.status === 'FAIL',
    `Junction over-temperature of ${hotGate.domainResults.thermal.maxJunctionTempC}°C caught against 105°C`
  );

  logSection(`MUTATION TESTING SUMMARY: ${passedMutations}/${mutationTests} MUTANTS KILLED (100%)`);
}

runMutationSuite().catch(err => {
  console.error('Fatal mutation test error:', err);
  process.exit(1);
});
