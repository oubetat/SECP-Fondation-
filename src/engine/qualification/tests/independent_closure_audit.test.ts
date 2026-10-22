/**
 * SECP Industrial OS — Engineering Truth OS
 * SECP-PHASE-5-001: independent_closure_audit.test.ts
 * 
 * Test suite executing the 5 independent closure audit gates (P5-C1 through P5-C5)
 * and persisting the resulting verification audit artifacts.
 */

import { createReferenceEcuSystem } from '../EngineeringSystemCanonicalModel';
import { IndependentClosureAuditEngine } from '../IndependentClosureAuditEngine';
import { existsSync, readFileSync } from 'fs';

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

async function runIndependentClosureAuditTest() {
  logSection('SECP PHASE 5 — INDEPENDENT CLOSURE AUDIT SUITE (GATES P5-C1 TO P5-C5)');

  const ecu = createReferenceEcuSystem();
  const startTime = performance.now();

  const auditReport = IndependentClosureAuditEngine.runAudit(ecu);
  const elapsedMs = (performance.now() - startTime).toFixed(2);

  // Assertion 1: Execution Completion
  assert(
    'AUDIT-EXEC-001',
    'Independent Audit Engine Execution',
    auditReport !== null && auditReport !== undefined,
    `Executed 5 audit gates in ${elapsedMs}ms`
  );

  // Assertion 2: Overall Verdict
  assert(
    'AUDIT-VERDICT-001',
    'Overall Audit Verdict Approval',
    auditReport.overallAuditVerdict === 'APPROVED_FOR_DECLARED_SCOPE',
    `Verdict: ${auditReport.overallAuditVerdict}`
  );

  // Assertion 3: Gate P5-C1 (Requirements Source & Canonical Binding)
  const g1 = auditReport.gates.find(g => g.gateId === 'P5-C1');
  assert(
    'P5-C1',
    'Requirements Canonical Binding Audit Gate',
    g1?.status === 'PASS' && g1.passedAssertions === g1.checkedAssertions,
    `Gate P5-C1 passed (${g1?.passedAssertions}/${g1?.checkedAssertions} requirements verified)`
  );

  // Assertion 4: Gate P5-C2 (Independent Solver Verification)
  const g2 = auditReport.gates.find(g => g.gateId === 'P5-C2');
  assert(
    'P5-C2',
    'Independent Solver Mathematical Verification Gate',
    g2?.status === 'PASS',
    `Gate P5-C2 passed (MNA convergence and energy conservation verified)`
  );

  // Assertion 5: Gate P5-C3 (Adversarial Mutation Resistance)
  const g3 = auditReport.gates.find(g => g.gateId === 'P5-C3');
  assert(
    'P5-C3',
    'Adversarial Mutation Resistance Gate',
    g3?.status === 'PASS',
    `Gate P5-C3 passed (Fault injection successfully rejected)`
  );

  // Assertion 6: Gate P5-C4 (Evidence Ledger & Revision Provenance)
  const g4 = auditReport.gates.find(g => g.gateId === 'P5-C4');
  assert(
    'P5-C4',
    'Evidence Invalidation & Provenance Audit Gate',
    g4?.status === 'PASS',
    `Gate P5-C4 passed (Stale evidence blocked on revision mutation)`
  );

  // Assertion 7: Gate P5-C5 (Clean Reproduction of Verdict)
  const g5 = auditReport.gates.find(g => g.gateId === 'P5-C5');
  assert(
    'P5-C5',
    'Clean Reproduction of Verdict Gate',
    g5?.status === 'PASS',
    `Gate P5-C5 passed (Deterministic Merkle root and verdict reproduced)`
  );

  // Assertion 8: Audit Report Disk Persistence
  const { mdPath, jsonPath } = IndependentClosureAuditEngine.saveAuditReportToDisk(auditReport, '.');
  const mdExists = existsSync(mdPath) && readFileSync(mdPath, 'utf-8').length > 500;
  const jsonExists = existsSync(jsonPath) && readFileSync(jsonPath, 'utf-8').length > 500;

  assert(
    'AUDIT-DOC-001',
    'Independent Audit Report Persistence',
    mdExists && jsonExists,
    `Saved official independent audit reports to ${mdPath} and ${jsonPath}`
  );

  logSection(`INDEPENDENT AUDIT SUMMARY: ${passedAssertions}/${totalAssertions} PASSED (${((passedAssertions / totalAssertions) * 100).toFixed(1)}%)`);
}

runIndependentClosureAuditTest();
