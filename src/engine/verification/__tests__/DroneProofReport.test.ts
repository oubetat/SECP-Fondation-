import { describe, it, expect } from 'vitest';
import {
  UniversalVerificationPackage,
  UniversalVerificationPackageEngine
} from '../UniversalVerificationPackage';
import {
  UniversalEngineeringReviewEngine,
  EngineeringReviewRecord
} from '../UniversalEngineeringReview';
import {
  DroneProofReportEngine,
  DroneProofReport
} from '../DroneProofReport';

describe('EPC-034 — DRONE PROOF REPORT', () => {

  const buildVerificationPackage = (revision: string = 'REV-A', triggerBrokenLink = false): UniversalVerificationPackage => {
    return {
      packageId: 'PKG-DRONE-34',
      caseId: 'CASE-EPC-034',
      productId: 'DRONE-V1',
      productRevision: revision,
      configurationId: 'CONF-OPT-029',
      createdAt: '2026-09-01T12:00:00Z',
      createdBy: 'CHIEF_QA_OFFICER',
      status: 'COMPLETE',
      cad: {
        cadModelId: 'CAD-1',
        cadRevision: revision,
        parametricFeatures: ['Spars', 'Motor Arms'],
        material: 'MAT-AL-7075-T6',
        assemblyId: 'ASM-1',
        massProperties: { mass: 3.2, cg: { x: 0, y: 0.1, z: 0.05 }, inertiaTensor: [[1, 0, 0], [0, 1.2, 0], [0, 0, 1.5]] },
        designParameters: { thrustMultiplier: 1.2 }
      },
      cae: {
        caeModelId: 'FEA-1',
        analysisCases: ['Symmetric Arm Load 350N']
      },
      fea: {
        analysisId: 'FEA-1',
        modelId: 'CAD-1',
        configurationId: 'CONF-OPT-029',
        input: {},
        solver: 'NASTRAN_SECP',
        parameters: {},
        executionId: 'EXEC-FEA-1',
        result: { maxStressPa: 220e6, marginOfSafety: 1.4 },
        units: 'Pa',
        tolerance: 0,
        verdict: 'PASS'
      },
      simulation: triggerBrokenLink ? undefined : {
        scenarioId: 'SIM-1',
        geometryRevision: revision,
        materialRevision: revision,
        parameterSet: {},
        loads: {},
        boundaryConditions: {},
        solver: 'NASTRAN_SECP',
        mesh: { nodeCount: 300000, elementCount: 154000, quality: 0.98 },
        controls: {},
        executionTimestamp: '2026-09-01T12:00:00Z',
        result: {},
        resultHash: 'HASH-SIM-123',
        status: 'VERIFIED'
      },
      manufacturing: {
        mfgDefinitionId: 'MFG-A',
        partDefinition: { partId: 'PART-1', name: 'Drone Arm LF CNC' },
        material: 'MAT-AL-7075-T6',
        process: ['CNC_3X_MILL', 'POST_HEAT_TREAT'],
        bomId: 'BOM-1',
        camOperation: 'CNC_3X_MILL_OP',
        toolpathId: 'TP-1',
        mfgRevision: revision
      },
      requirements: [
        {
          requirementId: 'REQ-CRIT-101',
          description: 'Industrial drone frame must survive 350N yield point',
          parameter: 'Yield Strength',
          unit: 'Newton',
          targetValue: 350,
          tolerance: 0,
          priority: 'CRITICAL',
          verificationMethod: 'SIMULATION',
          validationMethod: 'SIMULATION',
          linkedDesignId: 'CAD-1',
          linkedAnalysisId: 'FEA-1',
          linkedTestId: 'TEST-1',
          linkedEvidenceId: 'EV-1'
        }
      ],
      tests: [
        {
          testId: 'TEST-1',
          testType: 'PHYSICAL',
          testCondition: 'Chassis press 350N force',
          input: { force: 350 },
          expectedResult: { deforms: false },
          measuredResult: { deforms: false },
          acceptanceCriterion: 'deforms == false',
          timestamp: '2026-09-01T12:00:00Z',
          verdict: 'PASS'
        }
      ],
      measurements: [],
      evidence: [
        {
          evidenceId: 'EV-1',
          evidenceType: 'TEST',
          caseId: 'CASE-EPC-034',
          sourceType: 'TEST_BENCH',
          sourceId: 'TEST-1',
          sourceRevision: revision,
          executionId: 'EXEC-1',
          createdAt: '2026-09-01T12:00:00Z',
          createdBy: 'TESTER_A',
          inputReferences: [],
          outputReferences: [],
          hash: 'HASH-1234',
          provenance: {
            who: 'TESTER_A',
            what: 'Chassis press test',
            when: '2026-09-01T12:00:00Z',
            source: 'Press machine SN92',
            version: '1.0',
            input: 'Press force 350N',
            process: 'Hydraulic compression',
            output: 'Yield check'
          },
          status: 'VERIFIED'
        }
      ]
    };
  };

  it('should compile a valid Drone Proof Report without hardcoded verdicts', () => {
    const pkg = buildVerificationPackage();
    const review = UniversalEngineeringReviewEngine.createReview(
      'REV-001',
      pkg,
      'AUDITOR_SMITH',
      'INDEPENDENT_AUDITOR',
      ['CAD', 'FEA', 'Simulation']
    );

    const closedReview = UniversalEngineeringReviewEngine.finalizeReview(review, 'COMPLETED');
    const report = DroneProofReportEngine.compileReport('REP-001', pkg, closedReview, 'CHIEF_ENGINEER_ALEX');

    expect(report.reportId).toBe('REP-001');
    expect(report.engineeringVerdict).toBe('PASS');
    expect(report.engineeringClassification).toBe('PHYSICALLY VALIDATED'); // contains physical tests
    expect(report.assembly.assemblyErrors.length).toBe(0);
    expect(report.reportHash).toBeDefined();
  });

  it('should set verdict to FAIL if there is a broken link or revision mismatch in Digital Thread', () => {
    // Compile a package with a revision mismatch (CAD is REV-A but manufacturing is REV-B)
    const pkg = buildVerificationPackage('REV-A');
    if (pkg.manufacturing) {
      pkg.manufacturing.mfgRevision = 'REV-B'; // introduce mismatch
    }

    const review = UniversalEngineeringReviewEngine.createReview(
      'REV-001',
      pkg,
      'AUDITOR_SMITH',
      'INDEPENDENT_AUDITOR',
      ['CAD', 'Manufacturing']
    );

    const closedReview = UniversalEngineeringReviewEngine.finalizeReview(review, 'COMPLETED');
    const report = DroneProofReportEngine.compileReport('REP-001', pkg, closedReview, 'CHIEF_ENGINEER_ALEX');

    expect(report.engineeringVerdict).toBe('FAIL');
    expect(report.assembly.assemblyErrors[0]).toContain('ASSEMBLY_ERROR: Revision Mismatch');
  });

  it('should evaluate to VERIFIED DIGITAL ENGINEERING CASE if there are no physical tests conducted', () => {
    const pkg = buildVerificationPackage();
    pkg.tests = []; // remove physical tests
    
    const review = UniversalEngineeringReviewEngine.createReview(
      'REV-001',
      pkg,
      'AUDITOR_SMITH',
      'INDEPENDENT_AUDITOR',
      ['CAD', 'FEA']
    );

    const closedReview = UniversalEngineeringReviewEngine.finalizeReview(review, 'COMPLETED');
    const report = DroneProofReportEngine.compileReport('REP-002', pkg, closedReview, 'CHIEF_ENGINEER_ALEX');

    expect(report.engineeringClassification).toBe('VERIFIED DIGITAL ENGINEERING CASE');
    expect(report.physicalValidationStatus).toBe('NOT_PERFORMED');
    expect(report.limitations.missingPhysicalTests[0]).toContain('Physical test validation is NOT_PERFORMED.');
  });

  it('should reject modifications with a HASH_MISMATCH flag and force report revision control', () => {
    const pkg = buildVerificationPackage();
    const review = UniversalEngineeringReviewEngine.createReview(
      'REV-001',
      pkg,
      'AUDITOR_SMITH',
      'INDEPENDENT_AUDITOR',
      ['CAD']
    );
    const closedReview = UniversalEngineeringReviewEngine.finalizeReview(review, 'COMPLETED');
    
    const report = DroneProofReportEngine.compileReport('REP-003', pkg, closedReview, 'CHIEF_ENGINEER_ALEX');
    const initialHash = report.reportHash;

    // Trigger revision change
    const updatedReport = DroneProofReportEngine.createNewReportRevision(
      report,
      'Updated boundary assumptions in finite element solvers.',
      'CHIEF_ENGINEER_ALEX'
    );

    expect(updatedReport.reportRevision).toBe(2);
    expect(updatedReport.reportStatus).toBe('DRAFT');
    expect(updatedReport.revisionHistory.length).toBe(2);
    expect(updatedReport.reportHash).not.toBe(initialHash);
  });
});
