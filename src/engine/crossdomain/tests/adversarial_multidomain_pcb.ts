/**
 * SECP Industrial OS — Engineering Truth OS
 * SECP-MULTIDOMAIN-ENGINEERING-PHASE-4-001
 * Comprehensive Adversarial Battery for Multidomain PCB Engineering Integration
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

let totalTests = 0;
let passedTests = 0;

function assertAdversarial(id: string, name: string, condition: boolean, note: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[✓ PASS] ${id.padEnd(12)} ${name.padEnd(45)} ↳ ${note}`);
  } else {
    console.error(`[✗ FAIL] ${id.padEnd(12)} ${name.padEnd(45)} ↳ ${note}`);
    process.exitCode = 1;
  }
}

async function runAdversarialBattery() {
  logSection('SECP-MULTIDOMAIN-PHASE-4-001 — ADVERSARIAL VERIFICATION BATTERY');

  // Baseline Pristine Assembly
  const pristine = MultidomainPcbIntegrationEngine.createReferenceBenchmarkAssembly();
  const baselineGate = MultidomainPcbHardAcceptanceGate.runGate(pristine);
  assertAdversarial(
    'ADV-MD-00',
    'Baseline Pristine Assembly Verification',
    baselineGate.overallStatus === 'PASS',
    `Pristine baseline passed 100% assertions (${baselineGate.assertionsPassed}/${baselineGate.totalAssertions})`
  );

  // --------------------------------------------------------------------------
  // ADV-MD-01: Cross-Domain Pin Miswiring Detection
  // --------------------------------------------------------------------------
  const miswiredAssembly: MultidomainPcbAssembly = JSON.parse(JSON.stringify(pristine));
  // Mutate pin mapping: PCB Pin 1 (VCC_3V3) expected net changed to GND
  miswiredAssembly.harnessInterfaces[0].pinMappings[0].expectedNetName = 'GND';
  const gateMiswired = MultidomainPcbHardAcceptanceGate.runGate(miswiredAssembly);
  const miswireDetected = gateMiswired.details.some(
    d => d.assertionId === 'SEC-MD-002' && d.status === 'FAIL'
  );
  assertAdversarial(
    'ADV-MD-01',
    'Cross-Domain Pin Miswiring Detection',
    gateMiswired.overallStatus === 'FAIL' && miswireDetected,
    `Caught net mismatch: PCB net is 'VCC_3V3', interface expected 'GND'`
  );

  // --------------------------------------------------------------------------
  // ADV-MD-02: Harness Wire Ampacity Violation Detection
  // --------------------------------------------------------------------------
  const ampacityAssembly: MultidomainPcbAssembly = JSON.parse(JSON.stringify(pristine));
  // Mutate wire gauge to AWG 30 (rated 0.8A) on net demanding 1.5A
  ampacityAssembly.harness.wires[0].gaugeAwg = 'AWG 30';
  const gateAmpacity = MultidomainPcbHardAcceptanceGate.runGate(ampacityAssembly);
  const ampacityDetected = gateAmpacity.details.some(
    d => d.assertionId === 'SEC-MD-003' && d.status === 'FAIL'
  );
  assertAdversarial(
    'ADV-MD-02',
    'Harness Wire Gauge Ampacity Breach Detection',
    gateAmpacity.overallStatus === 'FAIL' && ampacityDetected,
    `Caught ampacity violation: AWG 30 rated for 0.8A < 1.5A required`
  );

  // --------------------------------------------------------------------------
  // ADV-MD-03: PCB Trace Excessive Voltage Drop Detection
  // --------------------------------------------------------------------------
  const traceDropAssembly: MultidomainPcbAssembly = JSON.parse(JSON.stringify(pristine));
  // Constrict VCC trace to 0.02mm width (huge resistance)
  traceDropAssembly.pcb.traces[0].widthMm = 0.02;
  const gateTraceDrop = MultidomainPcbHardAcceptanceGate.runGate(traceDropAssembly);
  const traceDropDetected = gateTraceDrop.details.some(
    d => d.assertionId === 'SEC-MD-005' && d.status === 'FAIL'
  );
  assertAdversarial(
    'ADV-MD-03',
    'Excessive Trace Voltage Drop Breach Detection',
    gateTraceDrop.overallStatus === 'FAIL' && traceDropDetected,
    `Caught trace voltage drop exceedance (> 3.0% limit)`
  );

  // --------------------------------------------------------------------------
  // ADV-MD-04: Thermal Over-Temperature & Hotspot Detection
  // --------------------------------------------------------------------------
  const thermalAssembly: MultidomainPcbAssembly = JSON.parse(JSON.stringify(pristine));
  // Mutate U1 thermal dissipation to 5.0W (junction temp will skyrocket to 25 + 5*35 = 200°C)
  thermalAssembly.thermalEnvironment.componentThermalSpecs.U1.heatDissipationW = 5.0;
  // Also update circuit resistor to lower resistance to draw high current
  thermalAssembly.electricalCircuit.components.find(c => c.id === 'U1')!.value = 1.0; // 3.3V / 1.0 ohm = 3.3A -> 10.89W
  const gateThermal = MultidomainPcbHardAcceptanceGate.runGate(thermalAssembly);
  const thermalDetected = gateThermal.details.some(
    d => d.assertionId === 'SEC-MD-006' && d.status === 'FAIL'
  );
  assertAdversarial(
    'ADV-MD-04',
    'Thermal Over-Temperature & Hotspot Detection',
    gateThermal.overallStatus === 'FAIL' && thermalDetected,
    `Caught junction over-temperature breach (${gateThermal.domainResults.thermal.maxJunctionTempC}°C > 105.0°C rating)`
  );

  // --------------------------------------------------------------------------
  // ADV-MD-05: MCAD Enclosure Standoff Misalignment Detection
  // --------------------------------------------------------------------------
  const standoffAssembly: MultidomainPcbAssembly = JSON.parse(JSON.stringify(pristine));
  // Shift standoff SO1 by 5mm in X
  standoffAssembly.mechanicalEnclosure.standoffs[0].xMm += 5.0;
  const gateStandoff = MultidomainPcbHardAcceptanceGate.runGate(standoffAssembly);
  const standoffDetected = gateStandoff.details.some(
    d => d.assertionId === 'SEC-MD-008' && d.status === 'FAIL'
  );
  assertAdversarial(
    'ADV-MD-05',
    'MCAD Standoff & Mounting Hole Misalignment Detection',
    gateStandoff.overallStatus === 'FAIL' && standoffDetected,
    `Caught standoff positional misalignment (> 0.25mm tolerance)`
  );

  // --------------------------------------------------------------------------
  // ADV-MD-06: MCAD Lid Keepout Vertical Clash Detection
  // --------------------------------------------------------------------------
  const lidClashAssembly: MultidomainPcbAssembly = JSON.parse(JSON.stringify(pristine));
  // Increase component height to 22mm (cavity ceiling is 30 - 6 - 6 - 1.6 = 16.4mm)
  lidClashAssembly.pcb.placements[0].height3dMm = 22.0;
  const gateLidClash = MultidomainPcbHardAcceptanceGate.runGate(lidClashAssembly);
  const lidClashDetected = gateLidClash.details.some(
    d => d.assertionId === 'SEC-MD-009' && d.status === 'FAIL'
  );
  assertAdversarial(
    'ADV-MD-06',
    'MCAD Lid Keepout 3D Height Interference Detection',
    gateLidClash.overallStatus === 'FAIL' && lidClashDetected,
    `Caught component ceiling interference (height 22mm breaches enclosure keepout)`
  );

  // --------------------------------------------------------------------------
  // ADV-MD-07: MCAD Board Lateral Wall Clearance Breach Detection
  // --------------------------------------------------------------------------
  const wallClearanceAssembly: MultidomainPcbAssembly = JSON.parse(JSON.stringify(pristine));
  // Widen PCB board to 98mm (enclosure internal length = 100mm, clearance = 1.0mm < 5.0mm required)
  wallClearanceAssembly.pcb.boardWidthMm = 98.0;
  const gateWallClearance = MultidomainPcbHardAcceptanceGate.runGate(wallClearanceAssembly);
  const wallClearanceDetected = gateWallClearance.details.some(
    d => d.assertionId === 'SEC-MD-007' && d.status === 'FAIL'
  );
  assertAdversarial(
    'ADV-MD-07',
    'MCAD Lateral Cavity Wall Clearance Breach Detection',
    gateWallClearance.overallStatus === 'FAIL' && wallClearanceDetected,
    `Caught enclosure wall clearance breach (1.0mm < 5.0mm required)`
  );

  // --------------------------------------------------------------------------
  // ADV-MD-08: Unified Multidomain BOM Missing Part Detection
  // --------------------------------------------------------------------------
  const missingBomAssembly: MultidomainPcbAssembly = JSON.parse(JSON.stringify(pristine));
  // Remove MCU from BOM
  missingBomAssembly.bomItems = missingBomAssembly.bomItems.filter(b => b.refDesOrIdentifier !== 'U1');
  const gateMissingBom = MultidomainPcbHardAcceptanceGate.runGate(missingBomAssembly);
  const missingBomDetected = gateMissingBom.details.some(
    d => d.assertionId === 'SEC-MD-011' && d.status === 'FAIL'
  );
  assertAdversarial(
    'ADV-MD-08',
    'Unified Multidomain BOM Completeness Enforcement',
    gateMissingBom.overallStatus === 'FAIL' && missingBomDetected,
    `Caught missing ECAD component U1 from Multidomain BOM`
  );

  // --------------------------------------------------------------------------
  // ADV-MD-09: Deterministic Permutation Invariance
  // --------------------------------------------------------------------------
  const permutedAssembly: MultidomainPcbAssembly = JSON.parse(JSON.stringify(pristine));
  // Reverse order of components, nets, traces, and bom items
  permutedAssembly.pcb.components.reverse();
  permutedAssembly.pcb.schematicNets.reverse();
  permutedAssembly.pcb.traces.reverse();
  permutedAssembly.harness.connectors.reverse();
  permutedAssembly.bomItems.reverse();
  const hashPristine = computeMultidomainCanonicalHash(pristine);
  const hashPermuted = computeMultidomainCanonicalHash(permutedAssembly);
  assertAdversarial(
    'ADV-MD-09',
    'Canonical Model Permutation Invariance',
    hashPristine === hashPermuted,
    `Permutation-invariant SHA-256 match: ${hashPristine.substring(0, 16)}...`
  );

  // --------------------------------------------------------------------------
  // ADV-MD-10: Cryptographic Mutation Sensitivity & Invalidation
  // --------------------------------------------------------------------------
  const mutatedAssembly: MultidomainPcbAssembly = JSON.parse(JSON.stringify(pristine));
  // Sub-millimeter mutation: shift trace coordinate by 0.05mm
  mutatedAssembly.pcb.traces[0].path[1].x += 0.05;
  const hashMutated = computeMultidomainCanonicalHash(mutatedAssembly);
  assertAdversarial(
    'ADV-MD-10',
    'Cryptographic Sensitivity to Sub-Millimeter Mutation',
    hashPristine !== hashMutated,
    `0.05mm shift flipped hash from ${hashPristine.substring(0, 12)}... to ${hashMutated.substring(0, 12)}...`
  );

  logSection(`ADVERSARIAL BATTERY SUMMARY: ${passedTests}/${totalTests} PASSED (${((passedTests / totalTests) * 100).toFixed(0)}%)`);
}

runAdversarialBattery().catch(err => {
  console.error('Fatal adversarial execution error:', err);
  process.exit(1);
});
