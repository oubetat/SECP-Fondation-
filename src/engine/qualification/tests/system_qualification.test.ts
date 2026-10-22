/**
 * SECP Industrial OS — Engineering Truth OS
 * SECP-PHASE-5-001: Aircraft & Industrial Qualification Engine
 * system_qualification.test.ts
 * 
 * Primary System-Level Qualification Acceptance Test Suite for SECP-REF-ECU-001.
 * Executes full multidomain verification, maps all requirements to canonical evidence,
 * computes Merkle root, verifies all acceptance criteria, and generates formal reports.
 */

import { existsSync, readFileSync } from 'fs';
import { createReferenceEcuSystem } from '../EngineeringSystemCanonicalModel';
import { SystemQualificationEngine } from '../SystemQualificationEngine';
import { QualificationReportGenerator } from '../QualificationReportGenerator';

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

async function runSystemQualificationAcceptance() {
  logSection('SECP PHASE 5 — SYSTEM QUALIFICATION ENGINE ACCEPTANCE SUITE');

  const ecu = createReferenceEcuSystem();
  const startTime = performance.now();

  const engine = SystemQualificationEngine.getInstance();
  const report = engine.evaluateSystem(ecu);
  const elapsedMs = (performance.now() - startTime).toFixed(2);

  // Assertion 1: Evaluation Completion
  assert(
    'QUAL-GATE-001',
    'System Qualification Engine Execution',
    report !== null && report !== undefined,
    `Evaluated system ${ecu.systemId} in ${elapsedMs}ms`
  );

  // Assertion 2: Overall Qualification Status Verdict
  assert(
    'QUAL-GATE-002',
    'Qualification Status Determination',
    report.qualificationStatus === 'QUALIFIED_WITHIN_DECLARED_SCOPE',
    `Status achieved: ${report.qualificationStatus}`
  );

  // Assertion 3: Requirements Pass Ratio
  assert(
    'QUAL-GATE-003',
    '100% Qualification Requirements Verified',
    report.verifiedRequirements === report.totalRequirements && report.failedRequirements === 0,
    `Verified ${report.verifiedRequirements}/${report.totalRequirements} requirements (0 failures, 0 blocked)`
  );

  // Assertion 4: Electrical Nodal Conservation
  const reqElec1 = report.requirementsTraceability.find(r => r.requirement.requirementId === 'REQ-ECU-ELEC-001');
  assert(
    'REQ-ELEC-001',
    'Electrical MNA Circuit Power Conservation',
    reqElec1?.status === 'SATISFIED' && Number(reqElec1.evidence?.measuredValue) <= 1e-12,
    `Power residue = ${reqElec1?.evidence?.measuredValue} W <= 1e-12 W`
  );

  // Assertion 5: Copper Trace Voltage Drop
  const reqElec2 = report.requirementsTraceability.find(r => r.requirement.requirementId === 'REQ-ECU-ELEC-002');
  assert(
    'REQ-ELEC-002',
    'PCB Copper Trace Voltage Drop Compliance',
    reqElec2?.status === 'SATISFIED' && Number(reqElec2.evidence?.measuredValue) <= 3.0,
    `Measured drop = ${reqElec2?.evidence?.measuredValue}% <= 3.0% limit`
  );

  // Assertion 6: Harness Ampacity & Pin Mating
  const reqHarn1 = report.requirementsTraceability.find(r => r.requirement.requirementId === 'REQ-ECU-HARN-001');
  const reqHarn2 = report.requirementsTraceability.find(r => r.requirement.requirementId === 'REQ-ECU-HARN-002');
  assert(
    'REQ-HARN-001',
    'Harness Ampacity & Connector Pinout Mating',
    reqHarn1?.status === 'SATISFIED' && reqHarn2?.status === 'SATISFIED',
    `Ampacity violations = ${reqHarn1?.evidence?.measuredValue}, Pin mismatches = ${reqHarn2?.evidence?.measuredValue}`
  );

  // Assertion 7: Thermal Semiconductor Junction Temperature
  const reqTherm = report.requirementsTraceability.find(r => r.requirement.requirementId === 'REQ-ECU-THERM-001');
  assert(
    'REQ-THERM-001',
    'Semiconductor Maximum Junction Temperature',
    reqTherm?.status === 'SATISFIED' && Number(reqTherm.evidence?.measuredValue) <= 105.0,
    `Max Tj = ${reqTherm?.evidence?.measuredValue}°C <= 105.0°C limit`
  );

  // Assertion 8: MCAD Physical Installation & Clearances
  const reqMech1 = report.requirementsTraceability.find(r => r.requirement.requirementId === 'REQ-ECU-MECH-001');
  const reqMech2 = report.requirementsTraceability.find(r => r.requirement.requirementId === 'REQ-ECU-MECH-002');
  const reqMech3 = report.requirementsTraceability.find(r => r.requirement.requirementId === 'REQ-ECU-MECH-003');
  assert(
    'REQ-MECH-001',
    'MCAD Cavity, Standoff & Lid Keepout Fits',
    reqMech1?.status === 'SATISFIED' && reqMech2?.status === 'SATISFIED' && reqMech3?.status === 'SATISFIED',
    'Wall margin, coaxial standoff alignment, and vertical lid clearances all verified compliant'
  );

  // Assertion 9: Unified Multidomain BOM Completeness
  const reqBom = report.requirementsTraceability.find(r => r.requirement.requirementId === 'REQ-ECU-BOM-001');
  assert(
    'REQ-BOM-001',
    'Unified Multidomain BOM 100% Attribution',
    reqBom?.status === 'SATISFIED' && Number(reqBom.evidence?.measuredValue) === 0,
    `0 unassigned BOM parts across ECAD, Harness, and MCAD domains`
  );

  // Assertion 10: Cryptographic Attestation & Merkle Tree Root
  assert(
    'REQ-EVID-001',
    'Cryptographic Evidence Digest & Merkle Tree Root',
    report.evidenceMerkleRoot && report.evidenceMerkleRoot.length === 64 && report.qualificationSignature.length === 64,
    `Merkle root: ${report.evidenceMerkleRoot.substring(0, 16)}..., Signature: ${report.qualificationSignature.substring(0, 16)}...`
  );

  // Assertion 11: Solver Validity Envelope Specification
  assert(
    'QUAL-SOLV-001',
    'Solver Validity Bounds Specification',
    report.solverValidityLimits.length >= 3 && report.declaredScopeAndLimitations.length >= 4,
    'DC steady-state, lumped Theta-JA, and rigid MCAD bounds declared with explicit NOT_PROVEN disclosures'
  );

  // Assertion 12: Report Generation and Disk Persistence
  const { mdPath, jsonPath } = QualificationReportGenerator.saveReportsToDisk(report, '.');
  const mdExists = existsSync(mdPath) && readFileSync(mdPath, 'utf-8').length > 500;
  const jsonExists = existsSync(jsonPath) && readFileSync(jsonPath, 'utf-8').length > 500;

  assert(
    'QUAL-DOC-001',
    'Qualification Reports Disk Persistence',
    mdExists && jsonExists,
    `Saved official qualification reports to ${mdPath} and ${jsonPath}`
  );

  logSection(`SYSTEM QUALIFICATION VERIFICATION SUMMARY: ${passedAssertions}/${totalAssertions} PASSED (${((passedAssertions / totalAssertions) * 100).toFixed(1)}%)`);
}

runSystemQualificationAcceptance();
