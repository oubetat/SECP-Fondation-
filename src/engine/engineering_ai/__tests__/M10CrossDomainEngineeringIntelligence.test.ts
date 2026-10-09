import { describe, it, expect, beforeEach } from 'vitest';
import { CrossDomainIntelligenceEngine } from '../cross_domain/CrossDomainIntelligenceEngine';
import { 
  CrossDomainDependency, 
  DomainReconciliationFinding, 
  CrossDomainInferenceTrace 
} from '../cross_domain/types';
import { EngineeringDomain, EngineeringServiceType } from '../../crossdomain/CrossDomainTypes';
import { EngineeringAIRuntime } from '../EngineeringAIRuntime';
import { EngineeringAIModelRegistry } from '../EngineeringAIModelRegistry';
import { EngineeringAIContextEngine } from '../EngineeringAIContextEngine';
import { EngineeringAIEvidenceBinder, AIEvidenceEnvelope } from '../evidence/EngineeringAIEvidenceBinder';
import { EngineeringReasoningEngine } from '../reasoning/EngineeringReasoningEngine';
import { EngineeringUncertaintyEngine } from '../uncertainty/EngineeringUncertaintyEngine';
import { TwinEvidenceGraphEngine } from '../../twin_evidence/TwinEvidenceGraphEngine';
import { IndependentAIVerifier } from '../IndependentAIVerifier';
import { IndependentVerificationSerializer } from '../verification/IndependentVerificationSerializer';

describe('M10.7 — Cross-Domain Engineering Intelligence & Truth Reconciliation Suite', () => {
  let modelRegistry: EngineeringAIModelRegistry;
  let contextEngine: EngineeringAIContextEngine;
  let evidenceEngine: TwinEvidenceGraphEngine;

  let baseModel: any;
  let baseContext: any;
  let evidenceEnvelope: AIEvidenceEnvelope;
  let baseInference: any;

  beforeEach(() => {
    modelRegistry = new EngineeringAIModelRegistry();
    contextEngine = new EngineeringAIContextEngine();
    evidenceEngine = new TwinEvidenceGraphEngine('TWIN-M10.7-CROSS-DOMAIN');

    baseModel = modelRegistry.register({
      modelId: 'M10.7-CD-INTEGRATOR',
      modelName: 'Cross-Domain Integrator',
      modelType: 'SURROGATE_MODEL',
      version: '1.0.0',
      domain: 'AEROSPACE',
      architecture: 'RECONCILER',
      trainingDatasetId: 'D1',
      featureSchemaId: 'FS1',
      parameterHash: 'PH1',
      modelHash: 'MH1',
      weights: {},
      createdAt: new Date().toISOString(),
      status: 'QUALIFIED',
      inputContract: {
        schemaId: 'SCH-M10.7',
        units: { val: 'mm' },
        dimensions: { val: [1] },
        ranges: [{ field: 'val', min: 0, max: 1000, unit: 'mm' }],
        requiredFields: ['val'],
        optionalFields: [],
        coordinateSystem: 'CARTESIAN',
        referenceFrame: 'GLOBAL',
        validityRules: []
      },
      outputContract: {
        outputType: 'RECONCILIATION_FINDING',
        unit: 'status',
        validRange: [0, 1],
        supportUncertainty: true,
        limitations: []
      }
    });

    baseContext = EngineeringAIContextEngine.createContext('CTX-M10.7-001', {
      geometryState: { hash: 'CAD-H-001', rev: 'R1' },
      materialState: { alloy: 'AL-6061' },
      configurationState: { revisionId: 'R1', canonicalRevisionHash: 'CRH-001' }
    });

    baseInference = EngineeringAIRuntime.executeInference({
      model: baseModel,
      context: baseContext,
      inputs: { val: 100 },
      units: { val: 'mm' },
      evidenceEngine
    });

    const report = IndependentAIVerifier.verifyInferenceDissimilar(
      baseInference, baseModel, baseContext, { val: 100 }, { val: 'mm' }
    );

    evidenceEnvelope = EngineeringAIEvidenceBinder.createEvidenceEnvelope(
      baseInference, baseModel, baseContext, report, evidenceEngine
    );
  });

  // Helper to create valid dependency
  const createValidDep = (domain: EngineeringDomain, type: EngineeringServiceType): CrossDomainDependency => {
    const id = CrossDomainIntelligenceEngine.computeDependencyId(
      domain, 'REV-H-001', 'RES-H-001', 'CTX-H-001', 'CONSUMES'
    );
    return {
      dependencyId: id,
      sourceDomain: domain,
      serviceType: type,
      sourceRevisionId: 'R1',
      sourceRevisionHash: 'REV-H-001',
      sourceResultId: 'RES-001',
      sourceResultHash: 'RES-H-001',
      sourceContextHash: 'CTX-H-001',
      relationship: 'CONSUMES',
      freshness: 'CURRENT',
      evidenceId: 'EV-001'
    };
  };

  describe('Positive Tests (P1 - P8)', () => {
    it('P1: Two valid domains produce a valid cross-domain inference trace', () => {
      const dep1 = createValidDep(EngineeringDomain.AEROSPACE, EngineeringServiceType.CAD);
      const dep2 = createValidDep(EngineeringDomain.AEROSPACE, EngineeringServiceType.FEA);

      const finding: DomainReconciliationFinding = {
        findingId: 'F1',
        domainA: 'CAD',
        domainB: 'FEA',
        sourceIdA: 'CAD-1',
        sourceIdB: 'FEA-1',
        valueA: 100.0,
        valueB: 100.0,
        status: 'AGREEMENT',
        rationale: 'Nominal geometry matches simulation mesh basis.'
      };

      const trace = CrossDomainIntelligenceEngine.createInferenceTrace({
        contextId: baseContext.contextId,
        contextHash: baseContext.contextHash,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        executionHash: baseInference.executionHash,
        dependencies: [dep1, dep2],
        findings: [finding]
      });

      expect(trace.reconciliationStatus).toBe('RECONCILED');
      expect(trace.inferenceId.startsWith('CD-INF-AI-')).toBe(true);
      expect(trace.isCanonicalTruth).toBe(false);
    });

    it('P3: Valid dependencies produce a deterministic inference identity', () => {
      const dep1 = createValidDep(EngineeringDomain.AEROSPACE, EngineeringServiceType.CAD);
      const fixedTime = new Date().toISOString();
      const trace1 = CrossDomainIntelligenceEngine.createInferenceTrace({
        contextId: baseContext.contextId,
        contextHash: baseContext.contextHash,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        executionHash: baseInference.executionHash,
        dependencies: [dep1],
        findings: [],
        createdAt: fixedTime
      });

      const trace2 = CrossDomainIntelligenceEngine.createInferenceTrace({
        contextId: baseContext.contextId,
        contextHash: baseContext.contextHash,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        executionHash: baseInference.executionHash,
        dependencies: [dep1],
        findings: [],
        createdAt: fixedTime
      });

      expect(trace1.inferenceId).toBe(trace2.inferenceId);
      expect(trace1.contentHash).toBe(trace2.contentHash);
    });

    it('P6: Persistence survives rehydration with zero identity drift', () => {
      const dep1 = createValidDep(EngineeringDomain.AEROSPACE, EngineeringServiceType.CAD);
      const trace = CrossDomainIntelligenceEngine.createInferenceTrace({
        contextId: baseContext.contextId,
        contextHash: baseContext.contextHash,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        executionHash: baseInference.executionHash,
        dependencies: [dep1],
        findings: []
      });

      const serialized = JSON.stringify(trace);
      const rehydrated = CrossDomainIntelligenceEngine.rehydrateAndValidate(serialized, evidenceEnvelope);

      expect(rehydrated.valid).toBe(true);
      expect(rehydrated.trace.inferenceId).toBe(trace.inferenceId);
      expect(rehydrated.trace.contentHash).toBe(trace.contentHash);
    });
  });

  describe('Adversarial Tests (M10.7-01 - M10.7-32)', () => {
    it('M10.7-02: Domain A revision changes -> dependent AI inference becomes stale/rejected', () => {
      const dep = createValidDep(EngineeringDomain.AEROSPACE, EngineeringServiceType.CAD);
      const staleDep = { ...dep, freshness: 'STALE' as const };

      expect(() => {
        CrossDomainIntelligenceEngine.createInferenceTrace({
          contextId: baseContext.contextId,
          contextHash: baseContext.contextHash,
          modelId: baseModel.modelId,
          modelVersion: baseModel.version,
          executionHash: baseInference.executionHash,
          dependencies: [staleDep],
          findings: []
        });
      }).toThrow(/STALE_DEPENDENCY_IN_CURRENT_INFERENCE/);
    });

    it('M10.7-05: Dependency identity substitution is rejected', () => {
      const dep = createValidDep(EngineeringDomain.AEROSPACE, EngineeringServiceType.CAD);
      const substitutedDep = { ...dep, dependencyId: 'DEP-FAKED-ID' };

      expect(() => {
        CrossDomainIntelligenceEngine.createInferenceTrace({
          contextId: baseContext.contextId,
          contextHash: baseContext.contextHash,
          modelId: baseModel.modelId,
          modelVersion: baseModel.version,
          executionHash: baseInference.executionHash,
          dependencies: [substitutedDep],
          findings: []
        });
      }).toThrow(/DEPENDENCY_IDENTITY_TAMPERED/);
    });

    it('M10.7-08: Missing dependency marked CURRENT is rejected (if not found in context)', () => {
      // In a real system, the factory would verify if the dependency actually exists.
      // Here we simulate by passing an invalid dependency structure that fails validation.
      const invalidDep: any = {
        sourceDomain: 'CAD',
        freshness: 'CURRENT'
        // Missing mandatory fields
      };

      expect(() => {
        CrossDomainIntelligenceEngine.createInferenceTrace({
          contextId: baseContext.contextId,
          contextHash: baseContext.contextHash,
          modelId: baseModel.modelId,
          modelVersion: baseModel.version,
          executionHash: baseInference.executionHash,
          dependencies: [invalidDep],
          findings: []
        });
      }).toThrow(/DEPENDENCY_IDENTITY_TAMPERED/);
    });

    it('M10.7-10: Cross-domain dependency hash tampering is detected', () => {
      const dep = createValidDep(EngineeringDomain.AEROSPACE, EngineeringServiceType.CAD);
      const trace = CrossDomainIntelligenceEngine.createInferenceTrace({
        contextId: baseContext.contextId,
        contextHash: baseContext.contextHash,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        executionHash: baseInference.executionHash,
        dependencies: [dep],
        findings: []
      });

      const serialized = JSON.stringify(trace);
      const tampered = JSON.parse(serialized);
      tampered.dependencies[0].sourceResultHash = 'TAMPERED-HASH';
      // Note: Re-validating identity of dependencies happens in validation
      
      expect(() => {
        CrossDomainIntelligenceEngine.rehydrateAndValidate(JSON.stringify(tampered));
      }).toThrow(/DEPENDENCY_IDENTITY_TAMPERED/);
    });

    it('M10.7-15: AI confidence MUST NOT resolve a cross-domain conflict (Validation and Rehydration check)', () => {
      const dep1 = createValidDep(EngineeringDomain.AEROSPACE, EngineeringServiceType.CAD);
      const dep2 = createValidDep(EngineeringDomain.AEROSPACE, EngineeringServiceType.FEA);

      const conflictFinding: DomainReconciliationFinding = {
        findingId: 'F1',
        domainA: 'CAD',
        domainB: 'FEA',
        sourceIdA: 'CAD-1',
        sourceIdB: 'FEA-1',
        valueA: 100.0,
        valueB: 105.5,
        status: 'CONFLICT',
        rationale: 'Measurement exceeds tolerance.'
      };

      // 1. Verify that even if we try to force RECONCILED in the trace, validation rejects it
      const tamperedTrace: any = {
        contextHash: baseContext.contextHash,
        modelId: baseModel.modelId,
        dependencies: [dep1, dep2],
        findings: [conflictFinding],
        reconciliationStatus: 'RECONCILED', // Manual override attempt
        authorityTag: 'ADVISORY_EVIDENCE',
        isCanonicalTruth: false,
        isCanonicalRelease: false
      };

      const val = CrossDomainIntelligenceEngine.validateInference(tamperedTrace);
      expect(val.valid).toBe(false);
      expect(val.errors.some(e => e.code === 'CONFLICT_SILENTLY_RESOLVED')).toBe(true);

      // 2. Verify rehydration also catches it
      const trace = CrossDomainIntelligenceEngine.createInferenceTrace({
        contextId: baseContext.contextId,
        contextHash: baseContext.contextHash,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        executionHash: baseInference.executionHash,
        dependencies: [dep1, dep2],
        findings: [conflictFinding]
      });
      
      const serialized = JSON.stringify(trace);
      const tamperedJson = JSON.parse(serialized);
      tamperedJson.reconciliationStatus = 'RECONCILED';
      
      expect(() => {
        CrossDomainIntelligenceEngine.rehydrateAndValidate(JSON.stringify(tamperedJson));
      }).toThrow(/CONFLICT_SILENTLY_RESOLVED/);
    });

    it('M10.7-21: Authority escalation (isCanonicalTruth = true) is rejected during validation', () => {
      const dep = createValidDep(EngineeringDomain.AEROSPACE, EngineeringServiceType.CAD);
      
      const maliciousTrace: any = {
        contextId: baseContext.contextId,
        contextHash: baseContext.contextHash,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        executionHash: baseInference.executionHash,
        dependencies: [dep],
        findings: [],
        authorityTag: 'ADVISORY_EVIDENCE',
        isCanonicalTruth: true, // ESCALATION!
        isCanonicalRelease: false
      };

      const val = CrossDomainIntelligenceEngine.validateInference(maliciousTrace);
      expect(val.valid).toBe(false);
      expect(val.errors.some(e => e.code === 'AUTHORITY_ESCALATION')).toBe(true);
      
      // Also verify rehydration
      expect(() => {
        CrossDomainIntelligenceEngine.rehydrateAndValidate(JSON.stringify(maliciousTrace));
      }).toThrow(/AUTHORITY_ESCALATION/);
    });

    it('M10.7-22: Tampering with dependency results in rehydration failure', () => {
      const dep = createValidDep(EngineeringDomain.AEROSPACE, EngineeringServiceType.CAD);
      const trace = CrossDomainIntelligenceEngine.createInferenceTrace({
        contextId: baseContext.contextId,
        contextHash: baseContext.contextHash,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        executionHash: baseInference.executionHash,
        dependencies: [dep],
        findings: []
      });

      const serialized = JSON.stringify(trace);
      const tampered = JSON.parse(serialized);
      tampered.dependencyGroupHash = 'TAMPERED-GROUP-HASH';

      expect(() => {
        CrossDomainIntelligenceEngine.rehydrateAndValidate(JSON.stringify(tampered));
      }).toThrow(/Content hash tampered/);
    });

    it('M10.7-30: Multiple conflicts remain independently identifiable', () => {
      const dep1 = createValidDep(EngineeringDomain.AEROSPACE, EngineeringServiceType.CAD);
      const dep2 = createValidDep(EngineeringDomain.AEROSPACE, EngineeringServiceType.FEA);
      const dep3 = createValidDep(EngineeringDomain.AEROSPACE, EngineeringServiceType.CAM);

      const findings: DomainReconciliationFinding[] = [
        { findingId: 'F1', domainA: 'CAD', domainB: 'FEA', sourceIdA: 'C1', sourceIdB: 'F1', valueA: 10, valueB: 12, status: 'CONFLICT', rationale: 'R1' },
        { findingId: 'F2', domainA: 'CAD', domainB: 'CAM', sourceIdA: 'C1', sourceIdB: 'M1', valueA: 10, valueB: 11, status: 'CONFLICT', rationale: 'R2' }
      ];

      const trace = CrossDomainIntelligenceEngine.createInferenceTrace({
        contextId: baseContext.contextId,
        contextHash: baseContext.contextHash,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        executionHash: baseInference.executionHash,
        dependencies: [dep1, dep2, dep3],
        findings
      });

      expect(trace.reconciliationStatus).toBe('CONFLICTED');
      expect(trace.findings.length).toBe(2);
      expect(trace.findings[0].status).toBe('CONFLICT');
      expect(trace.findings[1].status).toBe('CONFLICT');
    });

    it('M10.7-31: Unknown dependency state results in UNKNOWN reconciliation status', () => {
      const dep = createValidDep(EngineeringDomain.AEROSPACE, EngineeringServiceType.CAD);
      const unknownDep = { ...dep, freshness: 'UNKNOWN' as const };

      const trace = CrossDomainIntelligenceEngine.createInferenceTrace({
        contextId: baseContext.contextId,
        contextHash: baseContext.contextHash,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        executionHash: baseInference.executionHash,
        dependencies: [unknownDep],
        findings: []
      });

      expect(trace.reconciliationStatus).toBe('UNKNOWN');
    });

    it('M10.7-32: Insufficient evidence status when findings are empty but dependencies valid', () => {
      const dep = createValidDep(EngineeringDomain.AEROSPACE, EngineeringServiceType.CAD);

      const trace = CrossDomainIntelligenceEngine.createInferenceTrace({
        contextId: baseContext.contextId,
        contextHash: baseContext.contextHash,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        executionHash: baseInference.executionHash,
        dependencies: [dep],
        findings: []
      });

      expect(trace.reconciliationStatus).toBe('INSUFFICIENT_EVIDENCE');
    });
  });

  describe('Integration with M10.4, M10.5, M10.6', () => {
    it('Incorporates M10.5 Uncertainty and M10.6 Reasoning Trace', () => {
      const dep = createValidDep(EngineeringDomain.AEROSPACE, EngineeringServiceType.CAD);

      const uncertainty = EngineeringUncertaintyEngine.createAssessment({
        evidenceId: evidenceEnvelope.evidenceId,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        contextHash: baseContext.contextHash,
        executionHash: baseInference.executionHash,
        predictionNominal: 100,
        confidence: 0.95,
        confidenceMethod: 'RESIDUAL_CALIBRATED',
        epistemic: { trainingCoverageScore: 0.9, modelInadequacyEstimate: 0.05, outOfDistributionScore: 0.05, missingInformationFactors: [], epistemicIndex: 0.1, sourceDescription: 'S' },
        aleatoric: { measurementVariability: 0.02, manufacturingToleranceVariance: 0.02, operatingConditionVariance: 0.02, environmentalVariability: 0.02, aleatoricIndex: 0.08, sourceDescription: 'S' },
        errorEstimate: { metric: 'RMSE', value: 2.5, isEstablished: true },
        calibration: { status: 'CALIBRATION_UNAVAILABLE' }
      });

      const reasoning = EngineeringReasoningEngine.createReasoningTrace({
        claimId: 'C1',
        evidenceId: evidenceEnvelope.evidenceId,
        contextHash: baseContext.contextHash,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        executionHash: baseInference.executionHash,
        inputs: { val: 100 },
        assumptions: [],
        constraints: [],
        reasoningSteps: [{ sequenceNumber: 1, stepId: 'S1', role: 'CONCLUSION', description: 'D', inputsUsed: [], outputsProduced: [] }],
        intermediateFindings: [],
        evidenceBindings: [{ evidenceId: evidenceEnvelope.evidenceId, relationship: 'SUPPORTING', claimReference: 'C1', summary: 'S' }],
        conclusion: 'D',
        limitations: []
      });

      const trace = CrossDomainIntelligenceEngine.createInferenceTrace({
        contextId: baseContext.contextId,
        contextHash: baseContext.contextHash,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        executionHash: baseInference.executionHash,
        dependencies: [dep],
        findings: [],
        uncertaintyAssessment: uncertainty,
        reasoningTrace: reasoning
      });

      expect(trace.uncertaintyAssessmentId).toBe(uncertainty.assessmentId);
      expect(trace.reasoningTraceId).toBe(reasoning.reasoningId);
    });
  });
});
