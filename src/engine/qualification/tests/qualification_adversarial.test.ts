/**
 * SECP Industrial OS — Engineering Truth OS
 * SECP-PHASE-5-001: Aircraft & Industrial Qualification Engine
 * qualification_adversarial.test.ts
 * 
 * Adversarial & Negative Test Suite for System Qualification Engine.
 * Verifies that the engine cannot be bypassed, spoofed, or manipulated:
 * every physical, geometric, electrical, or evidence violation MUST fail
 * or block qualification.
 */

import { createReferenceEcuSystem, EngineeringSystem } from '../EngineeringSystemCanonicalModel';
import { SystemQualificationEngine } from '../SystemQualificationEngine';
import { QualificationChangeImpact } from '../QualificationChangeImpact';

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
    console.log(`[✓ PASS] ${id.padEnd(16)} ${name.padEnd(42)} ↳ ${note}`);
  } else {
    console.error(`[✗ FAIL] ${id.padEnd(16)} ${name.padEnd(42)} ↳ ${note}`);
    process.exitCode = 1;
  }
}

async function runAdversarialQualificationSuite() {
  logSection('SECP PHASE 5 — QUALIFICATION ADVERSARIAL & MUTATION SUITE');

  const engine = new SystemQualificationEngine();

  // Baseline execution to establish clean baseline
  const cleanEcu = createReferenceEcuSystem();
  const cleanReport = engine.evaluateSystem(cleanEcu);
  assert(
    'ADV-BASE-001',
    'Clean Reference ECU Baseline Acceptance',
    cleanReport.qualificationStatus === 'QUALIFIED_WITHIN_DECLARED_SCOPE',
    'Clean system passes all gates before adversarial mutations'
  );

  // --------------------------------------------------------------------------
  // Scenario 1: Trace Voltage Drop Breach (> 3.0%)
  // --------------------------------------------------------------------------
  const mutEcu1 = createReferenceEcuSystem();
  mutEcu1.systemId = 'SECP-ADV-ECU-001';
  // Mutate trace path: make it 5,000mm long and thin 0.05mm
  if (mutEcu1.multidomainAssembly.pcb.traces && mutEcu1.multidomainAssembly.pcb.traces.length > 0) {
    mutEcu1.multidomainAssembly.pcb.traces[0].path = [{ x: 0, y: 0 }, { x: 5000, y: 0 }];
    mutEcu1.multidomainAssembly.pcb.traces[0].widthMm = 0.05;
  }
  const report1 = engine.evaluateSystem(mutEcu1);
  assert(
    'ADV-DROP-001',
    'Adversarial Trace Voltage Drop Detection',
    report1.qualificationStatus === 'VERIFICATION_FAILED' &&
    report1.requirementsTraceability.some(r => r.requirement.requirementId === 'REQ-ECU-ELEC-002' && r.status === 'BREACHED'),
    `Excessive trace drop rejected (Status: ${report1.qualificationStatus})`
  );

  // --------------------------------------------------------------------------
  // Scenario 2: Thermal Overheating Breach (> 105.0°C)
  // --------------------------------------------------------------------------
  const mutEcu2 = createReferenceEcuSystem();
  mutEcu2.systemId = 'SECP-ADV-ECU-002';
  // Mutate thermal dissipation of U1 to 10.0 Watts
  mutEcu2.multidomainAssembly.thermalEnvironment.componentThermalSpecs['U1'].heatDissipationW = 10.0;
  const report2 = engine.evaluateSystem(mutEcu2);
  assert(
    'ADV-THERM-001',
    'Adversarial Thermal Hotspot Rejection',
    report2.qualificationStatus === 'VERIFICATION_FAILED' &&
    report2.requirementsTraceability.some(r => r.requirement.requirementId === 'REQ-ECU-THERM-001' && r.status === 'BREACHED'),
    `Junction overheating rejected (Status: ${report2.qualificationStatus})`
  );

  // --------------------------------------------------------------------------
  // Scenario 3: Harness Ampacity Overload
  // --------------------------------------------------------------------------
  const mutEcu3 = createReferenceEcuSystem();
  mutEcu3.systemId = 'SECP-ADV-ECU-003';
  // Set harness interface demand to 50 Amperes, exceeding AWG 20 wire rating (7.5A)
  mutEcu3.multidomainAssembly.harnessInterfaces[0].pinMappings[0].maxCurrentAmps = 50.0;
  const report3 = engine.evaluateSystem(mutEcu3);
  assert(
    'ADV-HARN-001',
    'Adversarial Harness Ampacity Derating Breach',
    report3.qualificationStatus === 'VERIFICATION_FAILED' &&
    report3.requirementsTraceability.some(r => r.requirement.requirementId === 'REQ-ECU-HARN-001' && r.status === 'BREACHED'),
    `Wire current exceeding ampacity rejected (Status: ${report3.qualificationStatus})`
  );

  // --------------------------------------------------------------------------
  // Scenario 4: Connector Pinout Net Misalignment
  // --------------------------------------------------------------------------
  const mutEcu4 = createReferenceEcuSystem();
  mutEcu4.systemId = 'SECP-ADV-ECU-004';
  // Cross wire pin 1 to wrong net 'GND_UNMATCHED'
  mutEcu4.multidomainAssembly.harnessInterfaces[0].pinMappings[0].expectedNetName = 'INVALID_CROSS_WIRE_NET';
  const report4 = engine.evaluateSystem(mutEcu4);
  assert(
    'ADV-PIN-001',
    'Adversarial Connector Pinout Cross-Wiring Detection',
    report4.qualificationStatus === 'VERIFICATION_FAILED' &&
    report4.requirementsTraceability.some(r => r.requirement.requirementId === 'REQ-ECU-HARN-002' && r.status === 'BREACHED'),
    `Mismatched net pin rejected (Status: ${report4.qualificationStatus})`
  );

  // --------------------------------------------------------------------------
  // Scenario 5: MCAD Board Cavity Wall Breach
  // --------------------------------------------------------------------------
  const mutEcu5 = createReferenceEcuSystem();
  mutEcu5.systemId = 'SECP-ADV-ECU-005';
  // Expand board width to 150mm inside a 100mm enclosure
  mutEcu5.multidomainAssembly.pcb.boardWidthMm = 150;
  const report5 = engine.evaluateSystem(mutEcu5);
  assert(
    'ADV-WALL-001',
    'Adversarial MCAD Enclosure Cavity Clash Detection',
    report5.qualificationStatus === 'VERIFICATION_FAILED' &&
    report5.requirementsTraceability.some(r => r.requirement.requirementId === 'REQ-ECU-MECH-001' && r.status === 'BREACHED'),
    `Physical collision with enclosure wall detected and blocked (Status: ${report5.qualificationStatus})`
  );

  // --------------------------------------------------------------------------
  // Scenario 6: MCAD Lid Keepout Interference
  // --------------------------------------------------------------------------
  const mutEcu6 = createReferenceEcuSystem();
  mutEcu6.systemId = 'SECP-ADV-ECU-006';
  // Raise component 3D height on placement to 50mm inside a 20mm enclosure
  mutEcu6.multidomainAssembly.pcb.placements[0].height3dMm = 50.0;
  const report6 = engine.evaluateSystem(mutEcu6);
  assert(
    'ADV-LID-001',
    'Adversarial MCAD Lid Vertical Keepout Breach',
    report6.qualificationStatus === 'VERIFICATION_FAILED' &&
    report6.requirementsTraceability.some(r => r.requirement.requirementId === 'REQ-ECU-MECH-003' && r.status === 'BREACHED'),
    `Vertical component collision with lid detected (Status: ${report6.qualificationStatus})`
  );

  // --------------------------------------------------------------------------
  // Scenario 7: Unassigned BOM Part
  // --------------------------------------------------------------------------
  const mutEcu7 = createReferenceEcuSystem();
  mutEcu7.systemId = 'SECP-ADV-ECU-007';
  // Insert unassigned BOM item with missing MPN
  mutEcu7.multidomainAssembly.bomItems.push({
    id: 'BOM_UNASSIGNED',
    domain: 'ECAD',
    itemNumber: 99,
    refDesOrIdentifier: 'ROGUE_U99',
    description: 'Counterfeit unverified IC',
    manufacturer: 'UNKNOWN',
    mpn: '', // Empty MPN triggers unassigned item violation
    quantity: 1,
    unit: 'EA',
    mountingType: 'SMD'
  });
  const report7 = engine.evaluateSystem(mutEcu7);
  assert(
    'ADV-BOM-001',
    'Adversarial Unassigned BOM Item Rejection',
    report7.qualificationStatus === 'VERIFICATION_FAILED' &&
    report7.requirementsTraceability.some(r => r.requirement.requirementId === 'REQ-ECU-BOM-001' && r.status === 'BREACHED'),
    `Unassigned BOM item rejected (Status: ${report7.qualificationStatus})`
  );

  // --------------------------------------------------------------------------
  // Scenario 8: Automated Evidence Invalidation Cascade
  // --------------------------------------------------------------------------
  // Establish baseline on a new system instance
  const trackedSystem = createReferenceEcuSystem();
  trackedSystem.systemId = 'SECP-CASCADE-ECU-001';
  const trackedEngine = new SystemQualificationEngine();
  const baselineRep = trackedEngine.evaluateSystem(trackedSystem);
  assert(
    'ADV-CAS-001',
    'Establish Invalidation Cascade Baseline',
    baselineRep.qualificationStatus === 'QUALIFIED_WITHIN_DECLARED_SCOPE',
    'Baseline successfully established'
  );

  // Now mutate the system's revision ID without re-verifying
  const modifiedSystem: EngineeringSystem = {
    ...trackedSystem,
    revisionId: 'REV-5.1.0-MODIFIED'
  };
  const cascadeRep = trackedEngine.evaluateSystem(modifiedSystem);
  assert(
    'ADV-CAS-002',
    'Automated Evidence Invalidation on Revision Change',
    cascadeRep.qualificationStatus === 'QUALIFICATION_BLOCKED' && cascadeRep.blockedRequirements > 0,
    `Stale evidence rejected: Status changed to ${cascadeRep.qualificationStatus} (${cascadeRep.blockedRequirements} requirements blocked)`
  );

  logSection(`ADVERSARIAL VERIFICATION SUMMARY: ${passedAssertions}/${totalAssertions} PASSED (${((passedAssertions / totalAssertions) * 100).toFixed(1)}%)`);
}

runAdversarialQualificationSuite();
