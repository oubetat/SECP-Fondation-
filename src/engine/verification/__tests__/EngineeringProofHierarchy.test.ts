import { describe, it, expect } from 'vitest';
import { 
  EngineeringProofHierarchyEvaluator, 
  ProofTierLevel, 
  PROOF_TIER_DEFINITIONS 
} from '../EngineeringProofHierarchy';
import { UniversalVerificationPackage } from '../UniversalVerificationPackage';
import { DroneProofReport } from '../DroneProofReport';

describe('SECP-PROOF-TIERS-6 — 6-Tier Engineering Proof Hierarchy', () => {
  const samplePkg: UniversalVerificationPackage = {
    packageId: 'PKG-TEST-PROOF-01',
    caseId: 'CASE-EPC-035',
    productId: 'DRONE-V1',
    productRevision: 'REV-A',
    configurationId: 'CONF-OPT-029',
    createdAt: '2026-09-01T12:00:00Z',
    createdBy: 'CHIEF_AUDITOR',
    status: 'COMPLETE',
    cad: {
      cadModelId: 'CAD-1',
      cadRevision: 'REV-A',
      parametricFeatures: ['Main Spars', 'Rotor Arms'],
      material: 'MAT-CF-3K',
      assemblyId: 'ASM-1'
    },
    fea: {
      analysisId: 'FEA-1',
      modelId: 'CAD-1',
      configurationId: 'CONF-OPT-029',
      input: {},
      solver: 'NASTRAN_SECP',
      parameters: {},
      executionId: 'EXEC-1',
      result: { marginOfSafety: 1.5 },
      units: 'Pa',
      tolerance: 0,
      verdict: 'PASS'
    },
    simulation: {
      scenarioId: 'SIM-1',
      geometryRevision: 'REV-A',
      materialRevision: 'REV-A',
      parameterSet: {},
      loads: {},
      boundaryConditions: {},
      solver: 'NASTRAN_SECP',
      mesh: { nodeCount: 100000, elementCount: 50000, quality: 0.95 },
      controls: {},
      executionTimestamp: '2026-09-01T12:00:00Z',
      result: {},
      resultHash: 'HASH-SIM-123',
      status: 'VERIFIED'
    },
    requirements: [
      {
        requirementId: 'REQ-1',
        description: 'Withstand load',
        parameter: 'Stress',
        unit: 'Pa',
        targetValue: 300,
        tolerance: 0,
        priority: 'CRITICAL',
        verificationMethod: 'SIMULATION',
        validationMethod: 'SIMULATION',
        linkedDesignId: 'CAD-1',
        linkedAnalysisId: 'FEA-1',
        linkedTestId: '',
        linkedEvidenceId: 'EV-1'
      }
    ],
    tests: [],
    measurements: [],
    evidence: [
      {
        evidenceId: 'EV-1',
        evidenceType: 'SIMULATION',
        caseId: 'CASE-EPC-035',
        sourceType: 'SOLVER_ENGINE',
        sourceId: 'SIM-1',
        sourceRevision: 'REV-A',
        executionId: 'EXEC-1',
        createdAt: '2026-09-01T12:00:00Z',
        createdBy: 'CHIEF_AUDITOR',
        inputReferences: [],
        outputReferences: [],
        hash: '96b957e8412803b08e7dfd110fbc2867ef654ee011d87e07663d251ef0bca97c',
        provenance: {
          who: 'CHIEF_AUDITOR',
          what: 'Simulation evidence',
          when: '2026-09-01T12:00:00Z',
          source: 'System',
          version: '1.0',
          input: 'Input',
          process: 'FEM',
          output: 'PASS'
        },
        status: 'VERIFIED'
      }
    ]
  };

  const sampleReport: DroneProofReport = {
    reportId: 'REP-PROOF-TEST-01',
    caseId: 'CASE-EPC-035',
    productId: 'DRONE-V1',
    productRevision: 'REV-A',
    configurationId: 'CONF-OPT-029',
    reportRevision: 1,
    createdAt: '2026-09-01T12:00:00Z',
    createdBy: 'AUDITOR',
    executiveSummary: {
      product: 'DRONE-V1',
      mission: 'Logistics',
      operatingEnvironment: 'Industrial',
      payload: '2kg',
      enduranceTarget: '30min',
      primaryPerformanceRequirements: ['Stress margin > 1.2'],
      engineeringScope: ['CAD', 'FEA'],
      verificationScope: ['FEM'],
      manufacturingScope: ['CNC'],
      evidenceStatus: 'COMPLETE',
      reviewStatus: 'COMPLETE',
      finalVerdict: 'PASS'
    },
    configurationBaseline: {
      cadRevision: 'REV-A',
      materialConfiguration: 'MAT-CF-3K',
      parameterSet: {},
      assemblyRevision: 'ASM-1',
      caeModels: ['CAE-1'],
      simulationScenarios: ['SIM-1'],
      mesh: { nodeCount: 100000, elementCount: 50000, quality: 0.95 },
      solver: 'NASTRAN_SECP',
      controls: {},
      manufacturingDefinitionId: 'MFG-1',
      camRevision: 'REV-A',
      bomRevision: 'BOM-1'
    },
    requirementsCompliance: {
      matrix: [
        {
          requirementId: 'REQ-1',
          description: 'Withstand load',
          verificationMethod: 'SIMULATION',
          complianceStatus: 'COMPLIANT',
          linkedEvidenceId: 'EV-1'
        }
      ],
      totalRequirements: 1,
      compliantCount: 1,
      nonCompliantCount: 0,
      inconclusiveCount: 0
    },
    evidenceAudit: {
      evidenceRecords: [
        {
          evidenceId: 'EV-1',
          evidenceType: 'SIMULATION',
          hash: '96b957e8412803b08e7dfd110fbc2867ef654ee011d87e07663d251ef0bca97c',
          status: 'VERIFIED'
        }
      ],
      totalEvidenceCount: 1,
      validHashCount: 1,
      invalidHashCount: 0
    },
    independentReview: {
      reviewId: 'REV-01',
      reviewer: 'DR. ELEANOR',
      reviewerRole: 'AUDITOR',
      reviewRevision: 1,
      createdAt: '2026-09-01T12:00:00Z',
      reviewScope: ['FEA'],
      findingsCount: 0,
      criticalFindingsCount: 0,
      reviewVerdict: 'PASS'
    },
    physicalValidationStatus: 'NOT_PERFORMED',
    engineeringVerdict: 'PASS',
    reportStatus: 'APPROVED',
    reportHash: 'a89c897365efc19280183746a839736184a71928374a89c1928374659281a8c3'
  };

  it('Tier 1-6 Definitions correctly map fundamental questions and physical requirements', () => {
    expect(PROOF_TIER_DEFINITIONS[ProofTierLevel.TIER_1_CRYPTOGRAPHIC_PROVENANCE].fundamentalQuestion)
      .toBe('Did the record remain unchanged?');
    expect(PROOF_TIER_DEFINITIONS[ProofTierLevel.TIER_2_DIGITAL_THREAD].fundamentalQuestion)
      .toBe('Are artifacts correctly linked?');
    expect(PROOF_TIER_DEFINITIONS[ProofTierLevel.TIER_3_CAD_MATHEMATICAL_VALIDITY].fundamentalQuestion)
      .toBe('Is the geometry/topology correct?');
    expect(PROOF_TIER_DEFINITIONS[ProofTierLevel.TIER_4_NUMERICAL_VERIFICATION].fundamentalQuestion)
      .toBe('Does the solver compute correctly?');
    expect(PROOF_TIER_DEFINITIONS[ProofTierLevel.TIER_5_EXPERIMENTAL_VALIDATION].fundamentalQuestion)
      .toBe('Does reality match the model?');
    expect(PROOF_TIER_DEFINITIONS[ProofTierLevel.TIER_6_PHYSICAL_FLIGHT_TRUTH].fundamentalQuestion)
      .toBe('Does the actual system work in the real world?');

    expect(PROOF_TIER_DEFINITIONS[ProofTierLevel.TIER_1_CRYPTOGRAPHIC_PROVENANCE].requiresPhysicalArtifacts).toBe(false);
    expect(PROOF_TIER_DEFINITIONS[ProofTierLevel.TIER_5_EXPERIMENTAL_VALIDATION].requiresPhysicalArtifacts).toBe(true);
    expect(PROOF_TIER_DEFINITIONS[ProofTierLevel.TIER_6_PHYSICAL_FLIGHT_TRUTH].requiresPhysicalArtifacts).toBe(true);
  });

  it('Digital-only case qualifies digital qualification (Tiers 1-4) while strictly keeping Tiers 5-6 NOT_PERFORMED', () => {
    const report = EngineeringProofHierarchyEvaluator.evaluateProofChain(samplePkg, sampleReport);

    expect(report.digitalQualificationApproved).toBe(true);
    expect(report.physicalFlightProvenApproved).toBe(false);
    expect(report.highestAchievedTierNumber).toBe(4);
    expect(report.highestAchievedTier).toBe(ProofTierLevel.TIER_4_NUMERICAL_VERIFICATION);

    const tier1 = report.tierEvaluations.find(t => t.tier === ProofTierLevel.TIER_1_CRYPTOGRAPHIC_PROVENANCE);
    const tier4 = report.tierEvaluations.find(t => t.tier === ProofTierLevel.TIER_4_NUMERICAL_VERIFICATION);
    const tier5 = report.tierEvaluations.find(t => t.tier === ProofTierLevel.TIER_5_EXPERIMENTAL_VALIDATION);
    const tier6 = report.tierEvaluations.find(t => t.tier === ProofTierLevel.TIER_6_PHYSICAL_FLIGHT_TRUTH);

    expect(tier1?.status).toBe('VERIFIED');
    expect(tier4?.status).toBe('COMPUTED_IN_SILICO');
    expect(tier5?.status).toBe('NOT_PERFORMED');
    expect(tier6?.status).toBe('NOT_PERFORMED');

    // Strict semantic boundary warning must be present
    expect(report.strictVerdictSemantics.boundaryWarning)
      .toContain('Axiom Enforced: Evidence integrity (Tier 1) ≠ Numerical convergence (Tier 4) ≠ Physical Truth (Tier 6)');
    expect(report.strictVerdictSemantics.verdictSummary)
      .toContain('Physical Validation & Flight Truth were NOT PERFORMED');
  });

  it('Physical test case qualifies both digital qualification and physical flight proven status', () => {
    const physicalPkg: UniversalVerificationPackage = {
      ...samplePkg,
      tests: [
        {
          testId: 'TEST-PHYS-LOAD-01',
          testType: 'PHYSICAL_STATIC_LOAD',
          configurationId: 'CONF-OPT-029',
          operator: 'CHIEF_AUDITOR',
          timestamp: '2026-09-01T12:00:00Z',
          parameters: { loadForceN: 350 },
          measuredValues: { maxYieldStrain: 0.002 },
          acceptanceCriteria: { maxYieldStrainLimit: 0.004 },
          verdict: 'PASS',
          evidenceHash: 'HASH-PHYS-TEST-LOAD'
        },
        {
          testId: 'TEST-FLIGHT-01',
          testType: 'FLIGHT_TEST',
          configurationId: 'CONF-OPT-029',
          operator: 'CHIEF_PILOT',
          timestamp: '2026-09-01T12:00:00Z',
          parameters: { durationMin: 35 },
          measuredValues: { flightStability: 0.99 },
          acceptanceCriteria: { minStability: 0.95 },
          verdict: 'PASS',
          evidenceHash: 'HASH-FLIGHT-TEST'
        }
      ]
    };

    const report = EngineeringProofHierarchyEvaluator.evaluateProofChain(physicalPkg, sampleReport);
    expect(report.digitalQualificationApproved).toBe(true);
    expect(report.physicalFlightProvenApproved).toBe(true);
    expect(report.highestAchievedTierNumber).toBe(6);
    expect(report.highestAchievedTier).toBe(ProofTierLevel.TIER_6_PHYSICAL_FLIGHT_TRUTH);
  });
});
