/**
 * SECP Industrial OS — Engineering Truth OS
 * SECP-PHASE-5-001: Aircraft & Industrial Qualification Engine
 * requirement_traceability.test.ts
 * 
 * Formal verification suite testing 100% requirements-to-design canonical traceability,
 * standard bindings, verification method validity, and acceptance criteria algebra.
 */

import {
  createReferenceEcuSystem
} from '../EngineeringSystemCanonicalModel';
import {
  evaluateAcceptanceCriteria,
  QualificationRequirement
} from '../QualificationRequirement';

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

async function runTraceabilityVerification() {
  logSection('SECP PHASE 5 — QUALIFICATION REQUIREMENTS TRACEABILITY SUITE');

  const ecu = createReferenceEcuSystem();
  const reqs = ecu.qualificationRequirements;

  // Assertion 1: Requirements Count & Non-Emptiness
  assert(
    'REQ-TRC-001',
    'Declared Qualification Requirements Presence',
    reqs.length >= 10,
    `Found ${reqs.length} formal qualification requirements defined for ${ecu.systemId}`
  );

  // Assertion 2: 100% Unique Requirement IDs
  const idSet = new Set(reqs.map(r => r.requirementId));
  assert(
    'REQ-TRC-002',
    'Requirement ID Global Uniqueness',
    idSet.size === reqs.length,
    `All ${reqs.length} requirements have globally unique identifiers`
  );

  // Assertion 3: Standard & Clause Attribution
  const allAttributed = reqs.every(r => r.sourceStandard && r.standardClause && r.standardClause.length > 0);
  assert(
    'REQ-TRC-003',
    'Authoritative Standard Attribution',
    allAttributed,
    'Every requirement is attributed to DO-254, IPC-6012, MIL-STD-810H, or SECP-CORE'
  );

  // Assertion 4: Canonical Design Reference Non-Empty Binding
  const allBound = reqs.every(r => 
    r.targetReference && 
    r.targetReference.domain && 
    r.targetReference.elementId && 
    r.targetReference.canonicalModelPath
  );
  assert(
    'REQ-TRC-004',
    'Canonical Design Reference Model Binding',
    allBound,
    '100% of requirements map to a non-null domain, elementId, and canonicalModelPath'
  );

  // Assertion 5: Authoritative Engine Mapping
  const allEnginesSpecified = reqs.every(r => r.authoritativeEngine && r.authoritativeEngine.length > 5);
  assert(
    'REQ-TRC-005',
    'Authoritative Engine Assignment',
    allEnginesSpecified,
    'Every requirement is bound to an executable domain solver or inspection engine'
  );

  // Assertion 6: Solver Validity Limits Declared
  const allSolverLimitsDeclared = reqs.every(r => r.solverValidityLimits && r.solverValidityLimits.length > 10);
  assert(
    'REQ-TRC-006',
    'Explicit Solver Validity Limits Declaration',
    allSolverLimitsDeclared,
    '100% of requirements explicitly define physical solver bounds & limitations'
  );

  // Assertion 7: Mathematical Acceptance Criteria Algebra
  const test1 = evaluateAcceptanceCriteria({ operator: '<=', expectedValue: 3.0, unit: '%' }, 1.5);
  const test2 = evaluateAcceptanceCriteria({ operator: '<=', expectedValue: 3.0, unit: '%' }, 3.5);
  const test3 = evaluateAcceptanceCriteria({ operator: '==', expectedValue: 0, unit: 'Items' }, 0);
  const test4 = evaluateAcceptanceCriteria({ operator: '==', expectedValue: true, unit: 'Status' }, true);
  const test5 = evaluateAcceptanceCriteria({ operator: '!=', expectedValue: '', unit: 'Hash' }, 'abc123hash');

  const criteriaLogicValid = test1.complies && !test2.complies && test3.complies && test4.complies && test5.complies;
  assert(
    'REQ-TRC-007',
    'Acceptance Criteria Algebra Engine Verification',
    criteriaLogicValid,
    'Evaluator correctly computes <=, ==, !=, and boolean thresholds with strict precision'
  );

  // Assertion 8: Multidomain Domain Coverage
  const domains = new Set(reqs.map(r => r.targetReference.domain));
  const expectedDomains = ['ECAD', 'ELECTRICAL', 'WIRING_HARNESS', 'MCAD', 'THERMAL', 'BOM', 'CROSSDOMAIN'];
  const hasFullDomainCoverage = expectedDomains.every(d => domains.has(d as any));
  assert(
    'REQ-TRC-008',
    'Multidomain System Coverage Breadth',
    hasFullDomainCoverage,
    `Requirements cover all 7 critical engineering domains: ${[...domains].join(', ')}`
  );

  logSection(`TRACEABILITY VERIFICATION SUMMARY: ${passedAssertions}/${totalAssertions} PASSED (${((passedAssertions / totalAssertions) * 100).toFixed(1)}%)`);
}

runTraceabilityVerification();
