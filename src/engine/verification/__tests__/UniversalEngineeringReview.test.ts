import { describe, it, expect } from 'vitest';
import {
  UniversalVerificationPackage,
  UniversalVerificationPackageEngine
} from '../UniversalVerificationPackage';
import {
  UniversalEngineeringReviewEngine,
  EngineeringReviewRecord
} from '../UniversalEngineeringReview';

describe('EPC-033 — UNIVERSAL ENGINEERING REVIEW', () => {

  const buildBaseVerificationPackage = (revision: string = 'REV-A'): UniversalVerificationPackage => {
    return {
      packageId: 'PKG-DRONE-033',
      caseId: 'CASE-EPC-033',
      productId: 'DRONE-V1',
      productRevision: revision,
      configurationId: 'CONF-OPT-029',
      createdAt: '2026-09-01T12:00:00Z',
      createdBy: 'CHIEF_QA_OFFICER',
      status: 'COMPLETE',
      cad: {
        cadModelId: 'CAD-1',
        cadRevision: revision,
        parametricFeatures: [],
        material: 'MAT-1',
        assemblyId: 'ASM-1',
        massProperties: { mass: 1.0, cg: { x: 0, y: 0, z: 0 }, inertiaTensor: [] },
        designParameters: {}
      },
      fea: {
        analysisId: 'FEA-1',
        modelId: 'CAD-1',
        configurationId: 'CONF-1',
        input: {},
        solver: 'SOLVER-1',
        parameters: {},
        executionId: 'EXEC-FEA-1',
        result: {},
        units: 'Pa',
        tolerance: 0,
        verdict: 'PASS'
      },
      simulation: {
        scenarioId: 'SIM-1',
        geometryRevision: revision,
        materialRevision: revision,
        parameterSet: {},
        loads: {},
        boundaryConditions: {},
        solver: 'SIM-SOLVER',
        mesh: { nodeCount: 1, elementCount: 1, quality: 1 },
        controls: {},
        executionTimestamp: '',
        result: {},
        resultHash: '',
        status: 'VERIFIED'
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
          verificationMethod: 'PHYSICAL_TEST',
          validationMethod: 'PHYSICAL_TEST',
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
          caseId: 'CASE-EPC-033',
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

  it('should create an independent Engineering Review from a Verification Package', () => {
    const pkg = buildBaseVerificationPackage();
    const scope = ['CAD', 'FEA', 'Simulation', 'Manufacturing'];
    
    const review = UniversalEngineeringReviewEngine.createReview(
      'REV-001',
      pkg,
      'AUDITOR_SMITH',
      'INDEPENDENT_AUDITOR',
      scope
    );

    expect(review.reviewId).toBe('REV-001');
    expect(review.reviewStatus).toBe('DRAFT');
    expect(review.reviewer).toBe('AUDITOR_SMITH');
    expect(review.requirementAssessments.length).toBe(1);
    expect(review.requirementAssessments[0].requirementId).toBe('REQ-CRIT-101');
    expect(review.requirementAssessments[0].assessment).toBe('PASS'); // derived from verification package
  });

  it('should compile and pass the review when there are no open findings', () => {
    const pkg = buildBaseVerificationPackage();
    const scope = ['CAD', 'FEA'];
    
    let review = UniversalEngineeringReviewEngine.createReview(
      'REV-001',
      pkg,
      'AUDITOR_SMITH',
      'INDEPENDENT_AUDITOR',
      scope
    );

    review = UniversalEngineeringReviewEngine.finalizeReview(review, 'COMPLETED');
    expect(review.finalReviewVerdict).toBe('PASS');

    const report = UniversalEngineeringReviewEngine.generateReport(review);
    expect(report.verdict).toBe('PASS');
    expect(report.openIssuesCount).toBe(0);
    expect(report.executiveSummary).toContain('SMITH');
  });

  it('should immediately fail the review if there is a CRITICAL finding', () => {
    const pkg = buildBaseVerificationPackage();
    let review = UniversalEngineeringReviewEngine.createReview(
      'REV-001',
      pkg,
      'AUDITOR_SMITH',
      'INDEPENDENT_AUDITOR',
      ['FEA']
    );

    // Auditor discovers a critical issue (e.g. missing simulation validation data)
    review = UniversalEngineeringReviewEngine.addFinding(review, {
      findingId: 'FIND-CRIT-01',
      severity: 'CRITICAL',
      category: 'EVIDENCE_GAP',
      description: 'Chassis material verification data was omitted from raw test logging.'
    });

    review = UniversalEngineeringReviewEngine.finalizeReview(review, 'REJECTED');
    expect(review.finalReviewVerdict).toBe('FAIL');

    const report = UniversalEngineeringReviewEngine.generateReport(review);
    expect(report.verdict).toBe('FAIL');
    expect(report.openIssuesCount).toBe(1);
    expect(report.findings[0].severity).toBe('CRITICAL');
  });

  it('should produce an INCONCLUSIVE verdict if there is a MAJOR finding', () => {
    const pkg = buildBaseVerificationPackage();
    let review = UniversalEngineeringReviewEngine.createReview(
      'REV-001',
      pkg,
      'AUDITOR_SMITH',
      'INDEPENDENT_AUDITOR',
      ['CAD']
    );

    // Auditor discovers a major issue that doesn't completely fail but leaves doubts
    review = UniversalEngineeringReviewEngine.addFinding(review, {
      findingId: 'FIND-MAJ-01',
      severity: 'MAJOR',
      category: 'DOCUMENTATION_GAP',
      description: 'Minor mismatch in component assembly secondary descriptions.'
    });

    review = UniversalEngineeringReviewEngine.finalizeReview(review, 'COMPLETED');
    expect(review.finalReviewVerdict).toBe('INCONCLUSIVE');

    const report = UniversalEngineeringReviewEngine.generateReport(review);
    expect(report.verdict).toBe('INCONCLUSIVE');
  });

  it('should enforce immutability: finalizing a review locks it and subsequent modifications require new revisions', () => {
    const pkg = buildBaseVerificationPackage();
    let review = UniversalEngineeringReviewEngine.createReview(
      'REV-001',
      pkg,
      'AUDITOR_SMITH',
      'INDEPENDENT_AUDITOR',
      ['CAD']
    );

    review = UniversalEngineeringReviewEngine.finalizeReview(review, 'COMPLETED');

    // Attempting to add a finding to a finalized review should throw an error
    expect(() => {
      UniversalEngineeringReviewEngine.addFinding(review, {
        findingId: 'FIND-LATE-01',
        severity: 'MINOR',
        category: 'LATE',
        description: 'Late finding'
      });
    }).toThrow('finalized or closed review record');

    // To add changes, reviewer must spawn a new review revision
    let newRevision = UniversalEngineeringReviewEngine.createNewRevision(review);
    expect(newRevision.reviewRevision).toBe(2);
    expect(newRevision.reviewStatus).toBe('DRAFT');

    // Adding findings now succeeds on the new revision
    newRevision = UniversalEngineeringReviewEngine.addFinding(newRevision, {
      findingId: 'FIND-REVISION-01',
      severity: 'MINOR',
      category: 'REVISION',
      description: 'Verified minor parameter consistency.'
    });

    expect(newRevision.findings.length).toBe(1);
  });
});
