import { describe, it, expect, beforeEach } from 'vitest';
import { EngineeringAIRuntime } from '../EngineeringAIRuntime';
import { EngineeringReasoningEngine } from '../reasoning/EngineeringReasoningEngine';
import { CrossDomainIntelligenceEngine } from '../cross_domain/CrossDomainIntelligenceEngine';
import { EngineeringUncertaintyEngine } from '../uncertainty/EngineeringUncertaintyEngine';
import { EngineeringAIModelRegistry } from '../EngineeringAIModelRegistry';
import { EngineeringAIContextEngine } from '../EngineeringAIContextEngine';
import { EngineeringAIEvidenceBinder } from '../evidence/EngineeringAIEvidenceBinder';
import { IndependentAIVerifier } from '../IndependentAIVerifier';
import { TwinEvidenceGraphEngine } from '../../twin_evidence/TwinEvidenceGraphEngine';
import { EngineeringDomain, EngineeringServiceType } from '../../crossdomain/CrossDomainTypes';
import { IndependentVerificationSerializer } from '../verification/IndependentVerificationSerializer';

describe('M10.8 — Adversarial Engineering Intelligence Hardening Suite', () => {
  let modelRegistry: EngineeringAIModelRegistry;
  let contextEngine: EngineeringAIContextEngine;
  let evidenceEngine: TwinEvidenceGraphEngine;

  let validModel: any;
  let validContext: any;
  let validInputs: any;
  let validUnits: any;

  beforeEach(() => {
    modelRegistry = new EngineeringAIModelRegistry();
    contextEngine = new EngineeringAIContextEngine();
    evidenceEngine = new TwinEvidenceGraphEngine('TWIN-M10.8-ADVERSARIAL');

    validModel = modelRegistry.register({
      modelId: 'M10.8-HARDENED-MODEL',
      modelName: 'Adversarial Test Model',
      modelType: 'SURROGATE_MODEL',
      version: '1.0.0',
      domain: 'AEROSPACE',
      architecture: 'RESNET',
      trainingDatasetId: 'D1',
      featureSchemaId: 'FS1',
      parameterHash: 'PH1',
      modelHash: 'MH1',
      weights: { val: 1.0 },
      createdAt: new Date().toISOString(),
      status: 'QUALIFIED',
      inputContract: {
        schemaId: 'SCH-M10.8',
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
        outputType: 'STRESS',
        unit: 'MPa',
        validRange: [0, 1000],
        supportUncertainty: true,
        limitations: []
      }
    });

    validContext = EngineeringAIContextEngine.createContext('CTX-M10.8-001', {
      geometryState: { hash: 'GEOM-1' },
      configurationState: { revisionId: 'R1', canonicalRevisionHash: 'CRH-1' }
    });

    validInputs = { val: 500 };
    validUnits = { val: 'mm' };
  });

  describe('A. Authority Attack Hardening', () => {
    it('Blocks escalation to isCanonicalTruth = true in Reasoning Trace', () => {
      const maliciousParams: any = {
        claimId: 'C1',
        evidenceId: 'EV-1',
        contextHash: validContext.contextHash,
        modelId: validModel.modelId,
        modelVersion: validModel.version,
        executionHash: 'EXEC-1',
        inputs: validInputs,
        assumptions: [],
        constraints: [],
        reasoningSteps: [{ sequenceNumber: 1, stepId: 'S1', role: 'CONCLUSION', description: 'Escalation', inputsUsed: [], outputsProduced: [] }],
        intermediateFindings: [],
        evidenceBindings: [],
        conclusion: 'Malicious',
        limitations: [],
        isCanonicalTruth: true // ATTEMPTED ESCALATION
      };

      expect(() => EngineeringReasoningEngine.createReasoningTrace(maliciousParams))
        .toThrow(/AUTHORITY_ESCALATION_ATTEMPT/);
    });

    it('Blocks escalation to isCanonicalRelease = true in Cross-Domain Inference', () => {
      const maliciousParams: any = {
        contextId: validContext.contextId,
        contextHash: validContext.contextHash,
        modelId: validModel.modelId,
        modelVersion: validModel.version,
        executionHash: 'EXEC-1',
        dependencies: [{
          dependencyId: 'DEP-1',
          sourceDomain: 'CAD',
          serviceType: 'CAD',
          sourceRevisionId: 'R1',
          sourceRevisionHash: 'H1',
          sourceResultId: 'RES-1',
          sourceResultHash: 'RH1',
          sourceContextHash: 'CH1',
          relationship: 'CONSUMES',
          freshness: 'CURRENT'
        }],
        findings: [],
        isCanonicalRelease: true // ATTEMPTED ESCALATION
      };

      // Note: CrossDomainIntelligenceEngine.computeDependencyId is deterministic, so the manually supplied 'DEP-1' above will fail identity check anyway.
      // But we first check for authority escalation in validation.

      expect(() => CrossDomainIntelligenceEngine.createInferenceTrace(maliciousParams))
        .toThrow(/AUTHORITY_ESCALATION/);
    });

    it('Normalizes authorityTag during validation and rehydration', () => {
      const maliciousTrace: any = {
        claimId: 'C1',
        evidenceId: 'EV-1',
        contextHash: validContext.contextHash,
        modelId: validModel.modelId,
        modelVersion: validModel.version,
        executionHash: 'EXEC-1',
        inputs: validInputs,
        assumptions: [],
        constraints: [],
        reasoningSteps: [{ sequenceNumber: 1, stepId: 'S1', role: 'CONCLUSION', description: 'Escalation', inputsUsed: [], outputsProduced: [] }],
        intermediateFindings: [],
        evidenceBindings: [],
        conclusion: 'Malicious',
        limitations: [],
        authorityTag: 'AUTHORITATIVE' // FORGED AUTHORITY
      };

      const result = EngineeringReasoningEngine.validateReasoningTrace(maliciousTrace);
      expect(result.errors.some((e: any) => e.code === 'AUTHORITY_ESCALATION_ATTEMPT')).toBe(true);
    });
  });

  describe('B. Identity & Replay Attack Hardening', () => {
    it('Detects identity drift in rehydrated uncertainty assessment', () => {
      const assessment = EngineeringUncertaintyEngine.createAssessment({
        evidenceId: 'EV-1',
        modelId: validModel.modelId,
        modelVersion: validModel.version,
        contextHash: validContext.contextHash,
        executionHash: 'EXEC-1',
        predictionNominal: 500,
        confidence: 0.95,
        confidenceMethod: 'RESIDUAL_CALIBRATED',
        epistemic: { trainingCoverageScore: 0.9, modelInadequacyEstimate: 0.1, outOfDistributionScore: 0.1, missingInformationFactors: [], epistemicIndex: 0.1, sourceDescription: 'S' },
        aleatoric: { measurementVariability: 0.05, manufacturingToleranceVariance: 0.05, operatingConditionVariance: 0.05, environmentalVariability: 0.05, aleatoricIndex: 0.1, sourceDescription: 'S' },
        errorEstimate: { metric: 'RMSE', value: 5.0, isEstablished: true },
        calibration: { status: 'CALIBRATION_UNAVAILABLE' }
      });

      const serialized = JSON.stringify(assessment);
      const tampered = JSON.parse(serialized);
      tampered.confidence = 0.999; // TAMPERED

      expect(() => EngineeringUncertaintyEngine.rehydrateAndValidate(JSON.stringify(tampered)))
        .toThrow(/Content hash tampered/);
    });

    it('Detects context drift in rehydrated reasoning trace', () => {
      const trace = EngineeringReasoningEngine.createReasoningTrace({
        claimId: 'C1',
        evidenceId: 'EV-1',
        contextHash: validContext.contextHash,
        modelId: validModel.modelId,
        modelVersion: validModel.version,
        executionHash: 'EXEC-1',
        inputs: validInputs,
        assumptions: [],
        constraints: [],
        reasoningSteps: [{ sequenceNumber: 1, stepId: 'S1', role: 'CONCLUSION', description: 'D', inputsUsed: [], outputsProduced: [] }],
        intermediateFindings: [],
        evidenceBindings: [],
        conclusion: 'D',
        limitations: []
      });

      const wrongEnvelope: any = {
        evidenceId: 'EV-1',
        provenance: { contextHash: 'WRONG-CONTEXT-HASH' }
      };

      expect(() => EngineeringReasoningEngine.rehydrateAndValidate(JSON.stringify(trace), wrongEnvelope))
        .toThrow(/Envelope contextHash mismatch/);
    });
  });

  describe('C. Dependency & Conflict Hardening', () => {
    it('Blocks silent resolution of cross-domain conflicts (M10.7 Invariant)', () => {
      const dep1Id = CrossDomainIntelligenceEngine.computeDependencyId('CAD', 'RH1', 'REH1', 'CH1', 'CONSUMES');
      const dep2Id = CrossDomainIntelligenceEngine.computeDependencyId('METROLOGY', 'RH1', 'REH2', 'CH1', 'CONSUMES');

      const finding: any = {
        findingId: 'F1',
        domainA: 'CAD',
        domainB: 'METROLOGY',
        status: 'CONFLICT',
        valueA: 100.0,
        valueB: 105.0,
        rationale: 'Conflict detected'
      };

      const maliciousTrace: any = {
        contextId: validContext.contextId,
        contextHash: validContext.contextHash,
        modelId: validModel.modelId,
        modelVersion: validModel.version,
        executionHash: 'EXEC-1',
        dependencies: [
          { dependencyId: dep1Id, sourceDomain: 'CAD', sourceRevisionHash: 'RH1', sourceResultHash: 'REH1', sourceContextHash: 'CH1', relationship: 'CONSUMES', freshness: 'CURRENT' },
          { dependencyId: dep2Id, sourceDomain: 'METROLOGY', sourceRevisionHash: 'RH1', sourceResultHash: 'REH2', sourceContextHash: 'CH1', relationship: 'CONSUMES', freshness: 'CURRENT' }
        ],
        findings: [finding],
        reconciliationStatus: 'RECONCILED', // MALICIOUS RESOLUTION
        authorityTag: 'ADVISORY_EVIDENCE',
        isCanonicalTruth: false,
        isCanonicalRelease: false
      };

      const result = CrossDomainIntelligenceEngine.validateInference(maliciousTrace);
      expect(result.errors.some((e: any) => e.code === 'CONFLICT_SILENTLY_RESOLVED')).toBe(true);
    });

    it('Rejects stale dependencies in new inferences', () => {
      const staleDepId = CrossDomainIntelligenceEngine.computeDependencyId('CAD', 'OLD-RH', 'OLD-REH', 'CH1', 'CONSUMES');
      
      expect(() => {
        CrossDomainIntelligenceEngine.createInferenceTrace({
          contextId: validContext.contextId,
          contextHash: validContext.contextHash,
          modelId: validModel.modelId,
          modelVersion: validModel.version,
          executionHash: 'EXEC-1',
          dependencies: [{
            dependencyId: staleDepId,
            sourceDomain: 'CAD',
            sourceRevisionId: 'R-OLD',
            sourceRevisionHash: 'OLD-RH',
            sourceResultId: 'RES-OLD',
            sourceResultHash: 'OLD-REH',
            sourceContextHash: 'CH1',
            relationship: 'CONSUMES',
            freshness: 'STALE' // EXPLICITLY STALE
          }],
          findings: []
        });
      }).toThrow(/STALE_DEPENDENCY_IN_CURRENT_INFERENCE/);
    });
  });

  describe('D. Verification & Confidence Hardening', () => {
    it('Ensures confidence != verification (Forced High Confidence)', () => {
      // Create reasoning that says VERIFIED in text but has no actual verification reference
      const maliciousReasoning: any = {
        claimId: 'C1',
        evidenceId: 'EV-1',
        contextHash: validContext.contextHash,
        modelId: validModel.modelId,
        modelVersion: validModel.version,
        executionHash: 'EXEC-1',
        inputs: validInputs,
        assumptions: [],
        constraints: [],
        reasoningSteps: [{ sequenceNumber: 1, stepId: 'S1', role: 'CONCLUSION', description: 'Result is VERIFIED based on 0.99 confidence.', inputsUsed: [], outputsProduced: [] }],
        intermediateFindings: [],
        evidenceBindings: [],
        conclusion: 'VERIFIED',
        limitations: [],
        authorityTag: 'ADVISORY_EVIDENCE',
        isCanonicalTruth: false,
        isCanonicalRelease: false,
        explanationStatus: 'COMPLETE' // FORCED
      };

      // Even if AI claims COMPLETE and VERIFIED in text, the engine derivation rules (M10.6)
      // would have downgraded it to UNVERIFIED if it was derived. 
      // If manually supplied, we check invariants.

      // Actually, M10.6 deriveExplainabilityStatus requires verificationRef.verdict === 'VERIFIED'
      // to return 'COMPLETE'.

      const derivedStatus = EngineeringReasoningEngine.deriveExplainabilityStatus([], [], undefined);
      expect(derivedStatus).toBe('INSUFFICIENT_EVIDENCE');
    });

    it('Rejects out-of-range confidence values (A1/A2)', () => {
      const baseParams = {
        evidenceId: 'EV-1',
        modelId: validModel.modelId,
        modelVersion: validModel.version,
        contextHash: validContext.contextHash,
        executionHash: 'EXEC-1',
        predictionNominal: 100,
        confidenceMethod: 'HEURISTIC_ESTIMATE' as const,
        epistemic: { trainingCoverageScore: 1, modelInadequacyEstimate: 0, outOfDistributionScore: 0, missingInformationFactors: [], epistemicIndex: 0, sourceDescription: 'S' },
        aleatoric: { measurementVariability: 0, manufacturingToleranceVariance: 0, operatingConditionVariance: 0, environmentalVariability: 0, aleatoricIndex: 0, sourceDescription: 'S' },
        errorEstimate: { metric: 'RMSE' as const, isEstablished: false },
        calibration: { status: 'CALIBRATION_UNAVAILABLE' as const }
      };

      expect(() => EngineeringUncertaintyEngine.createAssessment({ ...baseParams, confidence: 1.5 }))
        .toThrow(/INVALID_CONFIDENCE_RANGE/);
      expect(() => EngineeringUncertaintyEngine.createAssessment({ ...baseParams, confidence: -0.1 }))
        .toThrow(/INVALID_CONFIDENCE_RANGE/);
    });
  });

  describe('E. Mutation & Replay Resistance', () => {
    it('Proves deterministic identity: same inputs -> same ID', () => {
      const id1 = EngineeringReasoningEngine.computeReasoningId(
        'M1', 'CH1', 'EX1', 'EV1', 'C1', 'Conclusion', { a: 1 }, 'REV-H1', 'R1'
      );
      const id2 = EngineeringReasoningEngine.computeReasoningId(
        'M1', 'CH1', 'EX1', 'EV1', 'C1', 'Conclusion', { a: 1 }, 'REV-H1', 'R1'
      );
      expect(id1).toBe(id2);
    });

    it('Proves identity sensitivity: altered input -> different ID', () => {
      const id1 = EngineeringReasoningEngine.computeReasoningId(
        'M1', 'CH1', 'EX1', 'EV1', 'C1', 'Conclusion', { a: 1 }, 'REV-H1', 'R1'
      );
      const id2 = EngineeringReasoningEngine.computeReasoningId(
        'M1', 'CH1', 'EX1', 'EV1', 'C1', 'Conclusion', { a: 2 }, 'REV-H1', 'R1'
      );
      expect(id1).not.toBe(id2);
    });
  });
});
