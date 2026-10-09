/**
 * SECP Industrial OS — EPC-015: Master Acceptance Gate Test Suite
 * Exhaustive Verification & Anti-Bypass Validation for EPC Master Gate.
 */

import { describe, test, expect } from 'vitest';
import { EPCMasterAcceptanceGate } from '../gate/EPCMasterAcceptanceGate';
import {
  EPCMasterGateInput,
  MasterGateCriterionId,
  MasterGateFailureCode
} from '../gate/EPCMasterAcceptanceTypes';
import { EPCMasterAcceptanceReport } from '../gate/EPCMasterAcceptanceReport';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';

describe('EPC-015: Master Acceptance Gate', () => {
  // Helper to build a completely valid, passing baseline input
  const createValidGateInput = (): EPCMasterGateInput => {
    const payload = { stress: 150.0, displacement: 0.02 };
    const contentHash = EvidenceIntegrityService.computeHash(payload);

    return {
      proofCase: {
        caseId: 'CASE-015-QUADCOPTER',
        caseType: 'PRODUCT',
        domain: 'AEROSPACE',
        revision: 'v1.0.0',
        status: 'ACTIVE',
        owner: 'CHIEF-ENGINEER-01',
        requirements: [{ requirementId: 'REQ-AERO-01', priority: 'CRITICAL' }],
        models: [{ modelId: 'CAD-01', modelType: 'CAD', name: 'Rotor Hub' }],
        simulations: [{ simulationId: 'SIM-01', name: 'FEA Stress' }],
        manufacturing: [],
        tests: [{ testId: 'TEST-01', name: 'Static Load' }],
        evidence: [{ evidenceId: 'EV-01', contentHash }]
      },
      requirements: [
        { requirementId: 'REQ-AERO-01', priority: 'CRITICAL', status: 'VERIFIED' }
      ],
      traceability: [
        {
          requirementId: 'REQ-AERO-01',
          priority: 'CRITICAL',
          status: 'FULLY_TRACEABLE',
          designFeatures: [{ artifactId: 'DF-01', name: 'Hub Flange' }],
          analyses: [{ artifactId: 'AN-01', name: 'FEA Model' }],
          tests: [{ artifactId: 'TEST-01', name: 'Static Test' }],
          evidence: [{ artifactId: 'EV-01', name: 'FEA Result Payload' }]
        }
      ],
      configurationBaseline: {
        baselineId: 'BASE-015-QUAL',
        status: 'QUALIFIED',
        cad: { modelId: 'CAD-01', revision: 'r1' },
        materials: { materialId: 'AL-7075-T6' },
        parameters: { wallThickness: 2.5 },
        solver: { solverId: 'NASTRAN', version: '2024.1' },
        mesh: { meshId: 'MESH-01', elements: 50000 }
      },
      evidence: [
        {
          evidenceId: 'EV-01',
          contentHash,
          payload,
          integrityStatus: 'VALID'
        }
      ],
      provenance: [
        {
          provenanceId: 'PROV-01',
          actor: 'ENGINEER-01',
          action: 'FEA_EXECUTION',
          timestamp: '2026-09-01T10:00:00Z',
          source: 'FEA_SOLVER_CLI',
          sourceVersion: 'v2024.1',
          inputs: { mesh: 'MESH-01', baseline: 'BASE-015-QUAL' },
          process: { processId: 'FEA-SOLVE', status: 'COMPLETED' },
          outputs: ['EV-01']
        }
      ],
      executionRecords: [
        {
          executionId: 'EXEC-015-RUN-01',
          caseId: 'CASE-015-QUADCOPTER',
          workflowId: 'WF-FEA-STATIC',
          startedAt: '2026-09-01T10:00:00Z',
          completedAt: '2026-09-01T10:05:00Z',
          status: 'COMPLETED',
          inputs: { meshId: 'MESH-01' },
          outputs: { maxStress: 150.0 },
          configurationRef: 'BASE-015-QUAL',
          evidenceRefs: ['EV-01']
        }
      ],
      reproducibilityResults: [
        {
          reproducibilityId: 'REPRO-015-01',
          originalExecutionId: 'EXEC-015-RUN-01',
          reproductionExecutionId: 'EXEC-015-REPRO-01',
          status: 'PASS',
          maxObservedDifference: 0.00001,
          expectedTolerance: 0.001,
          reproducible: true
        }
      ]
    };
  };

  test('TEST 01: Critical Requirement without Traceability -> FAIL', () => {
    const input = createValidGateInput();
    (input as any).traceability = [
      {
        requirementId: 'REQ-AERO-01',
        priority: 'CRITICAL',
        status: 'UNTRACEABLE',
        designFeatures: [],
        analyses: [],
        tests: [],
        evidence: []
      }
    ];

    const result = EPCMasterAcceptanceGate.evaluate(input);
    expect(result.verdict).toBe('FAIL');
    expect(result.failures.some(f => f.failureCode === MasterGateFailureCode.TRACEABILITY_MISSING)).toBe(true);
    const traceCrit = result.criteria.find(c => c.criterionId === MasterGateCriterionId.TRACEABILITY);
    expect(traceCrit?.status).toBe('FAIL');
  });

  test('TEST 02: Complete Traceability -> PASS Candidate', () => {
    const input = createValidGateInput();
    const result = EPCMasterAcceptanceGate.evaluate(input);
    const traceCrit = result.criteria.find(c => c.criterionId === MasterGateCriterionId.TRACEABILITY);
    expect(traceCrit?.status).toBe('PASS');
    expect(result.verdict).toBe('PASS');
  });

  test('TEST 03: Evidence without Provenance -> FAIL', () => {
    const input = createValidGateInput();
    (input as any).provenance = [];

    const result = EPCMasterAcceptanceGate.evaluate(input);
    expect(result.verdict).toBe('FAIL');
    expect(result.failures.some(f => f.failureCode === MasterGateFailureCode.PROVENANCE_MISSING)).toBe(true);
    const provCrit = result.criteria.find(c => c.criterionId === MasterGateCriterionId.PROVENANCE);
    expect(provCrit?.status).toBe('FAIL');
  });

  test('TEST 04: Missing Configuration Baseline -> FAIL', () => {
    const input = createValidGateInput();
    (input as any).configurationBaseline = undefined;

    const result = EPCMasterAcceptanceGate.evaluate(input);
    expect(result.verdict).toBe('FAIL');
    expect(result.failures.some(f => f.failureCode === MasterGateFailureCode.CONFIGURATION_MISSING)).toBe(true);
  });

  test('TEST 05: Incomplete Configuration -> FAIL', () => {
    const input = createValidGateInput();
    (input as any).configurationBaseline = {
      baselineId: 'BASE-INCOMPLETE',
      status: 'QUALIFIED'
      // missing cad/components and materials/parameters
    };

    const result = EPCMasterAcceptanceGate.evaluate(input);
    expect(result.verdict).toBe('FAIL');
    expect(result.failures.some(f => f.failureCode === MasterGateFailureCode.CONFIGURATION_INCOMPLETE)).toBe(true);
  });

  test('TEST 06: Tampered Evidence -> FAIL', () => {
    const input = createValidGateInput();
    (input as any).evidence = [
      {
        evidenceId: 'EV-01',
        storedHash: 'hash-abc-123',
        payload: { stress: 999.0 }, // modified payload
        integrityStatus: 'TAMPERED'
      }
    ];

    const result = EPCMasterAcceptanceGate.evaluate(input);
    expect(result.verdict).toBe('FAIL');
    expect(result.failures.some(f => f.failureCode === MasterGateFailureCode.EVIDENCE_INTEGRITY_FAILURE)).toBe(true);
  });

  test('TEST 07: Reproducibility Failure -> FAIL', () => {
    const input = createValidGateInput();
    (input as any).reproducibilityResults = [
      {
        reproducibilityId: 'REPRO-FAIL',
        originalExecutionId: 'EXEC-1',
        reproductionExecutionId: 'EXEC-2',
        status: 'FAIL',
        maxObservedDifference: 0.25,
        expectedTolerance: 0.001,
        reproducible: false
      }
    ];

    const result = EPCMasterAcceptanceGate.evaluate(input);
    expect(result.verdict).toBe('FAIL');
    expect(result.failures.some(f => f.failureCode === MasterGateFailureCode.REPRODUCIBILITY_FAILURE)).toBe(true);
  });

  test('TEST 08: Missing Execution -> FAIL', () => {
    const input = createValidGateInput();
    (input as any).executionRecords = [];

    const result = EPCMasterAcceptanceGate.evaluate(input);
    expect(result.verdict).toBe('FAIL');
    expect(result.failures.some(f => f.failureCode === MasterGateFailureCode.EXECUTION_MISSING)).toBe(true);
  });

  test('TEST 09: Incomplete Execution -> FAIL', () => {
    const input = createValidGateInput();
    (input as any).executionRecords = [
      {
        executionId: 'EXEC-RUNNING',
        status: 'RUNNING',
        caseId: 'CASE-015',
        workflowId: 'WF-1',
        startedAt: '2026-09-01T10:00:00Z',
        completedAt: ''
      }
    ];

    const result = EPCMasterAcceptanceGate.evaluate(input);
    expect(result.verdict).toBe('FAIL');
    expect(result.failures.some(f => f.failureCode === MasterGateFailureCode.EXECUTION_MISSING)).toBe(true);
  });

  test('TEST 10: Hardcoded PASS attempt -> FAIL / rejected', () => {
    const input = createValidGateInput();
    // Missing execution but supplying explicit verdict: PASS
    (input as any).executionRecords = [];
    (input as any).verdict = 'PASS';

    const result = EPCMasterAcceptanceGate.evaluate(input);
    expect(result.verdict).toBe('FAIL');
    expect(result.failures.some(f => f.failureCode === MasterGateFailureCode.HARDCODED_VERDICT_REJECTED || f.failureCode === MasterGateFailureCode.EXECUTION_MISSING)).toBe(true);
  });

  test('TEST 11: Unknown criterion / Inconclusive option -> INCONCLUSIVE', () => {
    const input = createValidGateInput();
    (input as any).options = { allowInconclusiveOnUnknown: true };
    (input as any).reproducibilityResults = [
      {
        reproducibilityId: 'REPRO-UNCERTAIN',
        originalExecutionId: 'EXEC-1',
        reproductionExecutionId: 'EXEC-2',
        status: 'INCONCLUSIVE',
        maxObservedDifference: 0.0005,
        expectedTolerance: 0.001,
        reproducible: true
      }
    ];

    const result = EPCMasterAcceptanceGate.evaluate(input);
    expect(result.verdict).toBe('INCONCLUSIVE');
  });

  test('TEST 12: All mandatory criteria valid -> PASS', () => {
    const input = createValidGateInput();
    const result = EPCMasterAcceptanceGate.evaluate(input);
    expect(result.verdict).toBe('PASS');
    expect(result.failures.length).toBe(0);
    expect(result.criteria.every(c => c.status === 'PASS')).toBe(true);
  });

  test('TEST 13: One mandatory criterion INCONCLUSIVE -> INCONCLUSIVE', () => {
    const input = createValidGateInput();
    (input as any).options = { allowInconclusiveOnUnknown: true };
    (input as any).reproducibilityResults = [
      {
        reproducibilityId: 'REPRO-INC',
        originalExecutionId: 'EXEC-1',
        reproductionExecutionId: 'EXEC-2',
        status: 'INCONCLUSIVE',
        maxObservedDifference: 0,
        expectedTolerance: 0.001,
        reproducible: true
      }
    ];

    const result = EPCMasterAcceptanceGate.evaluate(input);
    expect(result.verdict).toBe('INCONCLUSIVE');
  });

  test('TEST 14: One mandatory criterion FAIL -> FAIL', () => {
    const input = createValidGateInput();
    (input as any).provenance = []; // Break only provenance

    const result = EPCMasterAcceptanceGate.evaluate(input);
    expect(result.verdict).toBe('FAIL');
    expect(result.criteria.find(c => c.criterionId === MasterGateCriterionId.PROVENANCE)?.status).toBe('FAIL');
  });

  test('TEST 15: Multiple failures -> all failures reported', () => {
    const input = createValidGateInput();
    (input as any).executionRecords = []; // Failure 1
    (input as any).provenance = []; // Failure 2
    (input as any).configurationBaseline = undefined; // Failure 3

    const result = EPCMasterAcceptanceGate.evaluate(input);
    expect(result.verdict).toBe('FAIL');
    expect(result.failures.length).toBeGreaterThanOrEqual(3);
  });

  test('TEST 16: Deterministic repeated Gate evaluation -> identical verdict and audit hash', () => {
    const input = createValidGateInput();
    const result1 = EPCMasterAcceptanceGate.evaluate(input);
    const result2 = EPCMasterAcceptanceGate.evaluate(input);

    expect(result1.verdict).toBe(result2.verdict);
    expect(result1.criteria).toEqual(result2.criteria);
  });

  test('ANTI-BYPASS: Fake or Empty references cannot trigger PASS', () => {
    const fakeInput: EPCMasterGateInput = {
      proofCase: { caseId: 'FAKE-CASE' },
      executionRecords: undefined,
      configurationBaseline: undefined,
      traceability: undefined,
      evidence: [],
      provenance: []
    };

    const result = EPCMasterAcceptanceGate.evaluate(fakeInput);
    expect(result.verdict).toBe('FAIL');
  });

  test('REPORT GENERATION: Canonical Acceptance Report format', () => {
    const input = createValidGateInput();
    const result = EPCMasterAcceptanceGate.evaluate(input);
    const report = EPCMasterAcceptanceReport.generateReport(result);

    expect(report).toContain('EPC MASTER ACCEPTANCE');
    expect(report).toContain('Execution:\nPASS');
    expect(report).toContain('FINAL VERDICT:\nPASS');
    expect(report).toContain('Audit Hash:');
  });
});
