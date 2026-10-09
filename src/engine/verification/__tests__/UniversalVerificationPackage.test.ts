import { describe, it, expect } from 'vitest';
import {
  UniversalVerificationPackage,
  UniversalVerificationPackageEngine,
  RequirementEvidence,
  DesignEvidence,
  AnalysisEvidence,
  SimulationEvidence,
  ManufacturingEvidence,
  TestEvidence,
  EvidenceRecord
} from '../UniversalVerificationPackage';

describe('EPC-032 — UNIVERSAL VERIFICATION PACKAGE', () => {

  const createDummyPayload = (id: string, name: string) => ({
    id,
    name,
    timestamp: '2026-09-01T12:00:00Z',
    salt: 'secp-validation-entropy'
  });

  const buildValidPackage = (revision: string = 'REV-A'): UniversalVerificationPackage => {
    const rawDesignPayload = createDummyPayload('CAD-DRONE-MAIN', 'Drone Main Chassis CAD');
    const designHash = UniversalVerificationPackageEngine.computeHash(rawDesignPayload);

    const reqs: RequirementEvidence[] = [
      {
        requirementId: 'REQ-CRIT-001',
        description: 'Drone main frame must withstand 350N load factor without yield failure.',
        parameter: 'Structural Strength',
        unit: 'Newton',
        targetValue: 350,
        tolerance: 0,
        priority: 'CRITICAL',
        verificationMethod: 'PHYSICAL_MEASUREMENT',
        validationMethod: 'LAB_BENCH_TEST',
        linkedDesignId: 'CAD-DRONE-MAIN',
        linkedAnalysisId: 'FEA-001',
        linkedTestId: 'TEST-BENCH-001',
        linkedEvidenceId: 'EV-TEST-001'
      }
    ];

    const design: DesignEvidence = {
      cadModelId: 'CAD-DRONE-MAIN',
      cadRevision: revision,
      parametricFeatures: ['Shell', 'Fillet_20', 'Pocket_3'],
      material: 'MAT-AL-7075-T6',
      assemblyId: 'ASM-DRONE-MAIN',
      massProperties: {
        mass: 1.42,
        cg: { x: 0, y: 0, z: -0.05 },
        inertiaTensor: [
          [0.12, 0, 0],
          [0, 0.12, 0],
          [0, 0, 0.22]
        ]
      },
      designParameters: { thickness: 2.5 }
    };

    const fea: AnalysisEvidence = {
      analysisId: 'FEA-001',
      modelId: 'CAD-DRONE-MAIN',
      configurationId: 'CONF-001',
      input: { load: '350N_Z_NEGATIVE' },
      solver: 'SECP_STRUCTURAL_FEM',
      parameters: { meshElementSize: 2.0 },
      executionId: 'EXEC-FEA-001',
      result: { maxStressPa: 220e6, marginOfSafety: 1.4 },
      units: 'Pascal',
      tolerance: 0.05,
      verdict: 'PASS'
    };

    const simulation: SimulationEvidence = {
      scenarioId: 'SCEN-DRONE-001',
      geometryRevision: revision,
      materialRevision: revision,
      parameterSet: { thrustCoefficient: 1.15 },
      loads: { wind: '5m/s' },
      boundaryConditions: { groundClamp: true },
      solver: 'SECP_FLIGHT_DYNAMICS_SOLVER',
      mesh: { nodeCount: 12000, elementCount: 84000, quality: 0.94 },
      controls: { attitudeGain: 4.5 },
      executionTimestamp: '2026-09-01T12:00:00Z',
      result: { stabilityMargin: 0.32 },
      resultHash: 'HASH-SIM-RESULT-V1',
      status: 'VERIFIED'
    };

    const manufacturing: ManufacturingEvidence = {
      mfgDefinitionId: 'MFG-DRONE-001',
      partDefinition: { partId: 'PART-FRAME', name: 'Main Frame Upper Plate' },
      material: 'MAT-AL-7075-T6',
      process: ['Raw Stock Cutting', '3-Axis Milling Roughing', '3-Axis Finishing', 'Drilling'],
      bomId: 'BOM-DRONE-MAIN',
      camOperation: 'OP-FINISH-MILL',
      toolpathId: 'TP-MILL-001',
      mfgRevision: revision
    };

    const tests: TestEvidence[] = [
      {
        testId: 'TEST-BENCH-001',
        testType: 'PHYSICAL',
        testCondition: 'Chassis clamped; pneumatic piston applied 350N force vertically downwards',
        input: { forceN: 350 },
        expectedResult: { plasticDeformationMm: 0.0 },
        measuredResult: { plasticDeformationMm: 0.0 },
        acceptanceCriterion: 'plasticDeformationMm <= 0.05',
        timestamp: '2026-09-01T12:00:00Z',
        instrumentation: { deviceName: 'Instron 5969 Load Cell Frame', lastCalibrated: '2026-06-01T00:00:00Z' },
        calibration: 'NIST-CAL-1284',
        uncertainty: 0.01,
        verdict: 'PASS'
      }
    ];

    const rawTestPayload = createDummyPayload('EV-TEST-001', 'Test Bench Physical Report');
    const testHash = UniversalVerificationPackageEngine.computeHash(rawTestPayload);

    const evidence: EvidenceRecord[] = [
      {
        evidenceId: 'EV-TEST-001',
        evidenceType: 'TEST',
        caseId: 'CASE-EPC-032-001',
        sourceType: 'TEST_BENCH_INSTRUMENT',
        sourceId: 'TEST-BENCH-001',
        sourceRevision: revision,
        executionId: 'EXEC-TEST-001',
        createdAt: '2026-09-01T12:00:00Z',
        createdBy: 'SENIOR_VERIFICATION_ENGINEER',
        inputReferences: ['REQ-CRIT-001'],
        outputReferences: ['TEST-RESULT-DATA'],
        hash: testHash,
        provenance: {
          who: 'SENIOR_VERIFICATION_ENGINEER',
          what: 'Physical Stress Calibration Test',
          when: '2026-09-01T12:00:00Z',
          source: 'Instron 5969 Serial Number 8329',
          version: '1.2.0',
          input: '350N loading configuration',
          process: 'ASTM E4 strain rate standard loading cycle',
          output: '0.00 plastic deformation curve file'
        },
        status: 'VERIFIED',
        rawPayload: rawTestPayload
      }
    ];

    return {
      packageId: 'PKG-DRONE-001',
      caseId: 'CASE-EPC-032-001',
      productId: 'DRONE-V1',
      productRevision: revision,
      configurationId: 'CONF-OPT-029',
      createdAt: '2026-09-01T12:00:00Z',
      createdBy: 'CHIEF_QA_OFFICER',
      status: 'COMPLETE',
      requirements: reqs,
      design,
      cad: design,
      assembly: {
        assemblyId: 'ASM-DRONE-MAIN',
        components: ['PART-FRAME', 'PART-ARM-LF', 'PART-ARM-RF']
      },
      cae: {
        caeModelId: 'CAE-DRONE-MAIN',
        analysisCases: ['FEA-001']
      },
      fea,
      simulation,
      manufacturing,
      bom: {
        bomId: 'BOM-DRONE-MAIN',
        revision
      },
      tests,
      measurements: tests,
      evidence
    };
  };

  it('should successfully pass a valid, structurally and revision-consistent package', () => {
    const pkg = buildValidPackage('REV-A');
    const result = UniversalVerificationPackageEngine.evaluatePackage(pkg);

    expect(result.status).toBe('COMPLETE');
    expect(result.verdict).toBe('PASS');
    expect(result.coverage.totalCritical).toBe(1);
    expect(result.coverage.verifiedCritical).toBe(1);
    expect(result.failures.length).toBe(0);
    expect(result.consistencyErrors.length).toBe(0);
  });

  it('should fail with CONFIGURATION_MISMATCH/STALE_EVIDENCE if any domain revisions are out of sync', () => {
    const pkg = buildValidPackage('REV-A');
    // Mutate CAD to be Revision B while simulation geometry revision is still REV-A
    if (pkg.cad) {
      pkg.cad.cadRevision = 'REV-B';
    }

    const result = UniversalVerificationPackageEngine.evaluatePackage(pkg);
    expect(result.verdict).toBe('FAIL');
    expect(result.consistencyErrors.length).toBeGreaterThan(0);
    expect(result.consistencyErrors[0]).toContain('CONFIGURATION_MISMATCH');
  });

  it('should fail validation with INTEGRITY_FAILURE if raw payload does not match computed hash', () => {
    const pkg = buildValidPackage('REV-A');
    // Tamper with the raw payload content
    pkg.evidence[0].rawPayload.name = 'Tampered Payload Content';

    const result = UniversalVerificationPackageEngine.evaluatePackage(pkg);
    expect(result.verdict).toBe('FAIL');
    expect(result.failures.some(f => f.includes('integrity check failed'))).toBe(true);
  });

  it('should flag the package as INCOMPLETE if a mandatory section is missing', () => {
    const pkg = buildValidPackage('REV-A');
    // Delete simulation section
    delete pkg.simulation;

    const result = UniversalVerificationPackageEngine.evaluatePackage(pkg);
    expect(result.status).toBe('INCOMPLETE');
    // Since it is incomplete, overall status calculation must reflect missing simulation
  });

  it('should mark critical requirements as UNVERIFIED if they lack correct evidence paths', () => {
    const pkg = buildValidPackage('REV-A');
    // Disconnect evidence on the requirement
    pkg.requirements[0].linkedEvidenceId = undefined;
    pkg.requirements[0].linkedTestId = undefined;
    pkg.requirements[0].linkedAnalysisId = undefined;

    const result = UniversalVerificationPackageEngine.evaluatePackage(pkg);
    expect(result.verdict).toBe('INCONCLUSIVE');
    expect(result.coverage.unverifiedCritical).toBe(1);
    expect(result.failures.some(f => f.includes('UNVERIFIED'))).toBe(true);
  });

  it('should fail the package if simulation result is erroneously registered as physical measurement', () => {
    const pkg = buildValidPackage('REV-A');
    // Set test type to SIMULATION_REPLAY, but verify method is PHYSICAL_MEASUREMENT
    pkg.tests[0].testType = 'SIMULATION_REPLAY';
    pkg.requirements[0].verificationMethod = 'PHYSICAL_MEASUREMENT';

    const result = UniversalVerificationPackageEngine.evaluatePackage(pkg);
    expect(result.verdict).toBe('FAIL');
    expect(result.failures.some(f => f.includes('Simulation result registered as PHYSICAL_MEASUREMENT'))).toBe(true);
  });

  it('should fail the package if any of the evidence is missing complete provenance info', () => {
    const pkg = buildValidPackage('REV-A');
    // Nullify provenance
    pkg.evidence[0].provenance = null;

    const result = UniversalVerificationPackageEngine.evaluatePackage(pkg);
    expect(result.verdict).toBe('FAIL');
    expect(result.failures.some(f => f.includes('PROVENANCE_INCOMPLETE'))).toBe(true);
  });

  it('should successfully rebuild traceability chain from the package', () => {
    const pkg = buildValidPackage('REV-A');
    const chain = UniversalVerificationPackageEngine.rebuildTraceabilityChain(pkg);

    expect(chain.length).toBe(1);
    expect(chain[0].requirementId).toBe('REQ-CRIT-001');
    expect(chain[0].designId).toBe('CAD-DRONE-MAIN');
  });
});
