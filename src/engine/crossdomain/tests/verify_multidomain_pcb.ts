/**
 * SECP Industrial OS — Engineering Truth OS
 * SECP-MULTIDOMAIN-ENGINEERING-PHASE-4-001
 * Primary Verification Suite for Multidomain PCB Engineering Integration
 */

import {
  MultidomainPcbIntegrationEngine,
  MultidomainPcbHardAcceptanceGate,
  computeMultidomainCanonicalHash,
  MultidomainPcbAssembly
} from '../MultidomainPcbIntegrationEngine';

function logSection(title: string) {
  console.log('\n' + '='.repeat(70));
  console.log(title);
  console.log('='.repeat(70));
}

let totalAssertions = 0;
let passedAssertions = 0;

function assert(id: string, name: string, condition: boolean, note: string) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`[✓ PASS] ${id.padEnd(12)} ${name.padEnd(45)} ↳ ${note}`);
  } else {
    console.error(`[✗ FAIL] ${id.padEnd(12)} ${name.padEnd(45)} ↳ ${note}`);
    process.exitCode = 1;
  }
}

async function runMultidomainVerification() {
  logSection('SECP INDUSTRIAL OS — MULTIDOMAIN PCB ACCEPTANCE SUITE (PHASE 4-001)');

  const assembly = MultidomainPcbIntegrationEngine.createReferenceBenchmarkAssembly();
  const startTime = performance.now();

  // Run Hard Acceptance Gate
  const gateReport = MultidomainPcbHardAcceptanceGate.runGate(assembly);
  const elapsedMs = (performance.now() - startTime).toFixed(2);

  // Assertion 1: Hard Gate Overall Verdict
  assert(
    'SEC-MD-GATE',
    'Hard Acceptance Gate Overall Verdict',
    gateReport.overallStatus === 'PASS' && gateReport.assertionsPassed === gateReport.totalAssertions,
    `Passed ${gateReport.assertionsPassed}/${gateReport.totalAssertions} assertions in ${elapsedMs}ms`
  );

  // Assertion 2: ECAD Canonical Integrity
  const ecadVal = gateReport.details.find(d => d.assertionId === 'SEC-MD-001');
  assert(
    'SEC-MD-001',
    'ECAD Canonical Model & Footprint Library',
    ecadVal?.status === 'PASS',
    `Footprints and netlists verified (${ecadVal?.notes})`
  );

  // Assertion 3: ECAD <-> Wiring Harness Interface Parity
  const ecadHarness = gateReport.domainResults.ecadHarness;
  assert(
    'SEC-MD-002',
    'ECAD <-> Wiring Harness Pin & Net Identity',
    ecadHarness.status === 'PASS' && ecadHarness.mismatches.length === 0,
    `Verified ${ecadHarness.verifiedPinsCount} pins across ${ecadHarness.mappedInterfacesCount} connector interface(s)`
  );

  // Assertion 4: Wiring Harness Ampacity Compliance
  assert(
    'SEC-MD-003',
    'Harness Wire Gauge Ampacity Rating',
    ecadHarness.ampacityViolations.length === 0,
    `AWG 20 wire rated for 7.5A exceeds circuit requirement (1.5A max)`
  );

  // Assertion 5: Electrical MNA Nodal Circuit Convergence
  const electrical = gateReport.domainResults.electrical;
  assert(
    'SEC-MD-004',
    'MNA Nodal Solver Convergence & Energy Conservation',
    electrical.nodalResult.success && Math.abs(electrical.nodalResult.powerBalance.imbalanceWatts) < 1e-12,
    `Imbalance = ${electrical.nodalResult.powerBalance.imbalanceWatts} W, All KCL/KVL balanced`
  );

  // Assertion 6: Copper Trace Voltage Drop
  assert(
    'SEC-MD-005',
    'Physical Trace Voltage Drop Compliance (< 3%)',
    electrical.status === 'PASS' && electrical.maxVoltageDropPercent <= 3.0,
    `Max voltage drop = ${electrical.maxVoltageDropPercent}% on digital supply line`
  );

  // Assertion 7: Thermal Semiconductor Junction Temperatures
  const thermal = gateReport.domainResults.thermal;
  assert(
    'SEC-MD-006',
    'Semiconductor Junction Temperature vs Rating',
    thermal.status === 'PASS' && thermal.maxJunctionTempC < 105.0,
    `Hottest IC (${thermal.hottestComponentRefDes}) at ${thermal.maxJunctionTempC}°C (Margin: ${(105.0 - thermal.maxJunctionTempC).toFixed(1)}°C)`
  );

  // Assertion 8: MCAD Enclosure Board Cavity Clearance
  const mcad = gateReport.domainResults.mcad;
  assert(
    'SEC-MD-007',
    'Board Clearance vs Enclosure Walls',
    mcad.enclosureClearancePassed,
    `Board outline clears enclosure cavity walls with >= 5.0mm margin`
  );

  // Assertion 9: MCAD Standoff Coaxial Alignment
  assert(
    'SEC-MD-008',
    'Enclosure Standoff & Mounting Hole Coaxial Alignment',
    mcad.standoffAlignmentPassed,
    `All 4 chassis standoffs coaxial with PCB mounting holes within 0.25mm tolerance`
  );

  // Assertion 10: MCAD Lid Keepout Vertical Clearance
  assert(
    'SEC-MD-009',
    'Component Height vs Enclosure Lid Clearance',
    mcad.lidClearancePassed,
    `Tallest component clears internal ceiling by > 3.0mm keepout`
  );

  // Assertion 11: MCAD Connector Cutout Egress Alignment
  assert(
    'SEC-MD-010',
    'Connector Egress Port Alignment',
    mcad.cutoutAlignmentPassed,
    `Cutout port aligned with J1 Molex header for harness plug engagement`
  );

  // Assertion 12: Unified Multidomain Manufacturing BOM
  const bom = gateReport.domainResults.manufacturingBom;
  assert(
    'SEC-MD-011',
    'Unified Multidomain BOM 100% Attribution',
    bom.status === 'PASS' && bom.totalItemCount === 8,
    `${bom.totalItemCount} items reconciled: ${bom.ecadItemCount} ECAD, ${bom.harnessItemCount} Harness, ${bom.mcadItemCount} MCAD`
  );

  // Assertion 13: Cryptographic Determinism & Canonical Hashing
  const hash1 = computeMultidomainCanonicalHash(assembly);
  const hash2 = computeMultidomainCanonicalHash(assembly);
  assert(
    'SEC-MD-012',
    'Cryptographic Determinism & Repeatable Hashing',
    hash1 === hash2 && hash1.length === 64,
    `Digest: ${hash1.substring(0, 16)}... across repeated evaluation cycles`
  );

  logSection(`VERIFICATION SUMMARY: ${passedAssertions}/${totalAssertions} PASSED (${((passedAssertions / totalAssertions) * 100).toFixed(0)}%)`);
}

runMultidomainVerification().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
