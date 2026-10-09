import { describe, it, expect } from 'vitest';
import { EngineeringAIRuntime } from '../EngineeringAIRuntime';
import { EngineeringAIContextEngine } from '../EngineeringAIContextEngine';
import { EngineeringAIModelRegistry } from '../EngineeringAIModelRegistry';
import { CanonicalAISerializer } from '../CanonicalAISerializer';
import { EngineeringAIGuardrailEngine } from '../EngineeringAIGuardrailEngine';
import { IndependentAIVerifier } from '../IndependentAIVerifier';
import { EngineeringAIEvidenceBinder } from '../evidence/EngineeringAIEvidenceBinder';
import { EngineeringReasoningEngine } from '../reasoning/EngineeringReasoningEngine';
import { CrossDomainIntelligenceEngine } from '../cross_domain/CrossDomainIntelligenceEngine';
import { EngineeringUncertaintyEngine } from '../uncertainty/EngineeringUncertaintyEngine';
import { TwinEvidenceGraphEngine } from '../../twin_evidence/TwinEvidenceGraphEngine';
import { IndependentVerificationSerializer } from '../verification/IndependentVerificationSerializer';

describe('M10.9 — Persistence, Rehydration, Recovery & Replay Hardening', () => {

  // --- Positive Controls & Helper Factories ---
  function createSampleContext() {
    return EngineeringAIContextEngine.createContext('CTX-M109-001', {
      geometryState: { volumeMm3: 1500, surfaceAreaMm2: 3500 },
      materialState: { materialId: 'STEEL_316L', yieldStrengthMpa: 220 },
      physicsState: { maxStressMpa: 180, operatingTempK: 350 }
    });
  }

  function createSampleModel() {
    const registry = new EngineeringAIModelRegistry();
    return registry.register({
      modelId: 'ENG-SURROGATE-STRESS-v2',
      modelName: 'Stress Surrogate Model',
      modelType: 'SURROGATE_MODEL',
      version: '2.0.0',
      domain: 'MECHANICAL',
      architecture: 'MLP',
      trainingDatasetId: 'DS-STRESS-01',
      featureSchemaId: 'FS-STRESS-01',
      parameterHash: 'PH-STRESS-01',
      modelHash: 'MH-STRESS-01',
      weights: { loadForceN: 0.05, thicknessMm: -2.1 },
      inputContract: { requiredFields: ['loadForceN', 'thicknessMm'], units: { loadForceN: 'N', thicknessMm: 'mm' }, dimensions: {}, ranges: [] },
      status: 'QUALIFIED',
      qualificationDate: '2026-01-01T00:00:00Z',
      qualifiedBy: 'VERIFIER-01',
      benchmarkScore: 0.98
    });
  }

  function createSampleInference() {
    const model = createSampleModel();
    const context = createSampleContext();
    return EngineeringAIRuntime.executeInference({
      model,
      context,
      inputs: { loadForceN: 5000, thicknessMm: 12 },
      units: { loadForceN: 'N', thicknessMm: 'mm' },
      seed: 42
    });
  }

  // --- 1. Positive Controls ---
  describe('1. Positive Persistence Controls', () => {
    it('P01: Valid M10.8 state persists and rehydrates with zero identity drift', () => {
      const model = createSampleModel();
      const context = createSampleContext();
      const reasoningTrace = EngineeringReasoningEngine.createReasoningTrace({
        claimId: 'CLAIM-STRESS-01',
        evidenceId: 'EVID-M109-001',
        contextHash: context.contextHash,
        executionHash: 'EXEC-HASH-001',
        modelId: model.modelId,
        modelVersion: model.version,
        inputs: { loadForceN: 5000 },
        assumptions: [{ assumptionId: 'A1', description: 'Isotropic material', category: 'ENGINEERING_ASSUMPTION', isCanonicalFact: false }],
        constraints: [{ constraintId: 'C1', description: 'Stress < Yield', status: 'SATISFIED' }],
        reasoningSteps: [
          { sequenceNumber: 1, role: 'INPUT', description: 'Load input', rationale: 'From CAD boundary' },
          { sequenceNumber: 2, role: 'CONCLUSION', description: 'Stress compliant', rationale: 'Evaluated' }
        ],
        intermediateFindings: ['Nominal stress within bounds'],
        evidenceBindings: [{ evidenceId: 'EVID-M109-001', relationship: 'SUPPORTING' }],
        conclusion: 'Stress meets safety margin',
        limitations: ['Static load only']
      });

      const serialized = EngineeringReasoningEngine.serializeTrace(reasoningTrace);
      const rehydrated = EngineeringReasoningEngine.rehydrateAndValidate(serialized);

      expect(rehydrated.valid).toBe(true);
      expect(rehydrated.trace.reasoningId).toBe(reasoningTrace.reasoningId);
      expect(rehydrated.recomputedContentHash).toBe(reasoningTrace.reasoningContentHash);
      expect(rehydrated.trace.authorityTag).toBe('ADVISORY_EVIDENCE');
      expect(rehydrated.trace.isCanonicalTruth).toBe(false);
      expect(rehydrated.trace.isCanonicalRelease).toBe(false);
    });

    it('P02: Rehydrate cycle maintains deterministic identities through multiple iterations', () => {
      const model = createSampleModel();
      const context = createSampleContext();
      const reasoningTrace = EngineeringReasoningEngine.createReasoningTrace({
        claimId: 'CLAIM-STRESS-02',
        evidenceId: 'EVID-M109-002',
        contextHash: context.contextHash,
        executionHash: 'EXEC-HASH-002',
        modelId: model.modelId,
        modelVersion: model.version,
        inputs: { pressureBar: 12 },
        assumptions: [],
        constraints: [],
        reasoningSteps: [{ sequenceNumber: 1, role: 'CONCLUSION', description: 'Pressure test PASS', rationale: 'Valid' }],
        intermediateFindings: [],
        evidenceBindings: [{ evidenceId: 'EVID-M109-002', relationship: 'SUPPORTING' }],
        conclusion: 'Pressure test PASS',
        limitations: []
      });

      const json1 = EngineeringReasoningEngine.serializeTrace(reasoningTrace);
      const trace1 = EngineeringReasoningEngine.rehydrateAndValidate(json1).trace;
      const json2 = EngineeringReasoningEngine.serializeTrace(trace1);
      const trace2 = EngineeringReasoningEngine.rehydrateAndValidate(json2).trace;

      expect(json1).toBe(json2);
      expect(trace1.reasoningContentHash).toBe(trace2.reasoningContentHash);
      expect(trace1.reasoningId).toBe(trace2.reasoningId);
    });
  });

  // --- 2. Identity Tampering Attacks ---
  describe('2. Identity Tampering Attacks', () => {
    it('A01: Rejects rehydration when reasoningId is modified but content remains same', () => {
      const model = createSampleModel();
      const context = createSampleContext();
      const trace = EngineeringReasoningEngine.createReasoningTrace({
        claimId: 'CLAIM-01',
        evidenceId: 'EVID-01',
        contextHash: context.contextHash,
        executionHash: 'EXEC-01',
        modelId: model.modelId,
        modelVersion: model.version,
        inputs: { x: 10 },
        assumptions: [],
        constraints: [],
        reasoningSteps: [{ sequenceNumber: 1, role: 'CONCLUSION', description: 'Done', rationale: 'Done' }],
        intermediateFindings: [],
        evidenceBindings: [{ evidenceId: 'EVID-01', relationship: 'SUPPORTING' }],
        conclusion: 'Done',
        limitations: []
      });

      const parsed = JSON.parse(EngineeringReasoningEngine.serializeTrace(trace));
      parsed.reasoningId = 'REASON-AI-TAMPERED-FAKE-ID';

      expect(() => {
        EngineeringReasoningEngine.rehydrateAndValidate(JSON.stringify(parsed));
      }).toThrow(/REASONING_REHYDRATION_ERROR/);
    });

    it('A02: Rejects rehydration when modelId or contextHash is altered in uncertainty assessment', () => {
      const model = createSampleModel();
      const context = createSampleContext();
      const assessment = EngineeringUncertaintyEngine.createAssessment({
        evidenceId: 'EVID-UNCERT-01',
        modelId: model.modelId,
        modelVersion: model.version,
        contextHash: context.contextHash,
        executionHash: 'EXEC-UNCERT-01',
        predictionNominal: 100,
        confidence: 0.95,
        confidenceMethod: 'BAYESIAN_POSTERIOR',
        epistemic: { trainingCoverageScore: 0.9, modelInadequacyEstimate: 0.05, outOfDistributionScore: 0.02, epistemicIndex: 0.1 },
        aleatoric: { measurementVariability: 0.01, manufacturingToleranceVariance: 0.01, operatingConditionVariance: 0.01, environmentalVariability: 0.01, aleatoricIndex: 0.04 },
        errorEstimate: { metric: 'RMSE', value: 2.5, isEstablished: true },
        calibration: { status: 'CALIBRATED', method: 'TEMPERATURE_SCALING', referenceDatasetId: 'CAL-DS-01', expectedCalibrationError: 0.02 }
      });

      const parsed = JSON.parse(EngineeringUncertaintyEngine.serializeAssessment(assessment));
      parsed.modelId = 'ATTACKER-SUBSTITUTED-MODEL';

      expect(() => {
        EngineeringUncertaintyEngine.rehydrateAndValidate(JSON.stringify(parsed));
      }).toThrow(/UNCERTAINTY_REHYDRATION_ERROR/);
    });
  });

  // --- 3. Authority State Tampering Attacks ---
  describe('3. Authority State Tampering Attacks', () => {
    it('A03: Rejects persisted reasoning trace with authorityTag set to AUTHORITATIVE', () => {
      const model = createSampleModel();
      const context = createSampleContext();
      const trace = EngineeringReasoningEngine.createReasoningTrace({
        claimId: 'CLAIM-AUTH-01',
        evidenceId: 'EVID-AUTH-01',
        contextHash: context.contextHash,
        executionHash: 'EXEC-AUTH-01',
        modelId: model.modelId,
        modelVersion: model.version,
        inputs: {},
        assumptions: [],
        constraints: [],
        reasoningSteps: [{ sequenceNumber: 1, role: 'CONCLUSION', description: 'Done', rationale: 'Done' }],
        intermediateFindings: [],
        evidenceBindings: [{ evidenceId: 'EVID-AUTH-01', relationship: 'SUPPORTING' }],
        conclusion: 'Done',
        limitations: []
      });

      const parsed = JSON.parse(EngineeringReasoningEngine.serializeTrace(trace));
      parsed.authorityTag = 'AUTHORITATIVE';

      expect(() => {
        EngineeringReasoningEngine.rehydrateAndValidate(JSON.stringify(parsed));
      }).toThrow(/REASONING_REHYDRATION_ERROR/);
    });

    it('A04: Rejects persisted reasoning trace attempting to set isCanonicalTruth = true', () => {
      const model = createSampleModel();
      const context = createSampleContext();
      const trace = EngineeringReasoningEngine.createReasoningTrace({
        claimId: 'CLAIM-AUTH-02',
        evidenceId: 'EVID-AUTH-02',
        contextHash: context.contextHash,
        executionHash: 'EXEC-AUTH-02',
        modelId: model.modelId,
        modelVersion: model.version,
        inputs: {},
        assumptions: [],
        constraints: [],
        reasoningSteps: [{ sequenceNumber: 1, role: 'CONCLUSION', description: 'Done', rationale: 'Done' }],
        intermediateFindings: [],
        evidenceBindings: [{ evidenceId: 'EVID-AUTH-02', relationship: 'SUPPORTING' }],
        conclusion: 'Done',
        limitations: []
      });

      const parsed = JSON.parse(EngineeringReasoningEngine.serializeTrace(trace));
      parsed.isCanonicalTruth = true;

      expect(() => {
        EngineeringReasoningEngine.rehydrateAndValidate(JSON.stringify(parsed));
      }).toThrow(/REASONING_REHYDRATION_ERROR/);
    });

    it('A05: Rejects persisted reasoning trace attempting to set isCanonicalRelease = true', () => {
      const model = createSampleModel();
      const context = createSampleContext();
      const trace = EngineeringReasoningEngine.createReasoningTrace({
        claimId: 'CLAIM-AUTH-03',
        evidenceId: 'EVID-AUTH-03',
        contextHash: context.contextHash,
        executionHash: 'EXEC-AUTH-03',
        modelId: model.modelId,
        modelVersion: model.version,
        inputs: {},
        assumptions: [],
        constraints: [],
        reasoningSteps: [{ sequenceNumber: 1, role: 'CONCLUSION', description: 'Done', rationale: 'Done' }],
        intermediateFindings: [],
        evidenceBindings: [{ evidenceId: 'EVID-AUTH-03', relationship: 'SUPPORTING' }],
        conclusion: 'Done',
        limitations: []
      });

      const parsed = JSON.parse(EngineeringReasoningEngine.serializeTrace(trace));
      parsed.isCanonicalRelease = true;

      expect(() => {
        EngineeringReasoningEngine.rehydrateAndValidate(JSON.stringify(parsed));
      }).toThrow(/REASONING_REHYDRATION_ERROR/);
    });
  });

  // --- 4. Verification Tampering Attacks ---
  describe('4. Verification Tampering Attacks', () => {
    it('A06: Prevents replacing independent verification result with raw AI inference claim', () => {
      const model = createSampleModel();
      const context = createSampleContext();
      const record = createSampleInference();

      // Tamper record prediction to simulate forgery
      const tamperedRecord = { ...record, prediction: 999999 };

      const result = IndependentAIVerifier.verifyInference(
        tamperedRecord,
        model,
        context,
        record.inputs,
        { loadForceN: 'N', thicknessMm: 'mm' }
      );

      expect(result.verdict).not.toBe('VERIFIED');
      expect(result.verdict).toBe('INVALID');
    });

    it('A07: Independent verifier maintains FULLY_INDEPENDENT_DISSIMILAR classification', () => {
      expect(IndependentAIVerifier.INDEPENDENCE_CLASSIFICATION).toBe('FULLY_INDEPENDENT_DISSIMILAR');
      const metrics = IndependentAIVerifier.getIndependenceMetrics();
      expect(metrics.commonModeVulnerabilityScore).toBe(0.0);
      expect(metrics.dissimilarityRatio).toBe(1.0);
      expect(metrics.sharedCodeLines).toBe(0);
    });
  });

  // --- 5. Uncertainty & Confidence Tampering Attacks ---
  describe('5. Uncertainty & Confidence Tampering Attacks', () => {
    it('A08: Rejects uncertainty assessment with confidence outside [0.0, 1.0]', () => {
      const model = createSampleModel();
      const context = createSampleContext();

      expect(() => {
        EngineeringUncertaintyEngine.createAssessment({
          evidenceId: 'EVID-BAD-CONF',
          modelId: model.modelId,
          modelVersion: model.version,
          contextHash: context.contextHash,
          executionHash: 'EXEC-BAD-CONF',
          predictionNominal: 50,
          confidence: 1.5, // Invalid
          confidenceMethod: 'BAYESIAN_POSTERIOR',
          epistemic: { trainingCoverageScore: 0.9, modelInadequacyEstimate: 0.05, outOfDistributionScore: 0.02, epistemicIndex: 0.1 },
          aleatoric: { measurementVariability: 0.01, manufacturingToleranceVariance: 0.01, operatingConditionVariance: 0.01, environmentalVariability: 0.01, aleatoricIndex: 0.04 },
          errorEstimate: { metric: 'RMSE', value: 2.5, isEstablished: true },
          calibration: { status: 'UNCALIBRATED' }
        });
      }).toThrow(/UNCERTAINTY_VALIDATION_ERROR/);
    });

    it('A09: Rejects uncertainty assessment with fabricated calibration (active method when UNCALIBRATED)', () => {
      const model = createSampleModel();
      const context = createSampleContext();

      expect(() => {
        EngineeringUncertaintyEngine.createAssessment({
          evidenceId: 'EVID-FAB-CAL',
          modelId: model.modelId,
          modelVersion: model.version,
          contextHash: context.contextHash,
          executionHash: 'EXEC-FAB-CAL',
          predictionNominal: 50,
          confidence: 0.8,
          confidenceMethod: 'BAYESIAN_POSTERIOR',
          epistemic: { trainingCoverageScore: 0.9, modelInadequacyEstimate: 0.05, outOfDistributionScore: 0.02, epistemicIndex: 0.1 },
          aleatoric: { measurementVariability: 0.01, manufacturingToleranceVariance: 0.01, operatingConditionVariance: 0.01, environmentalVariability: 0.01, aleatoricIndex: 0.04 },
          errorEstimate: { metric: 'RMSE', value: 2.5, isEstablished: true },
          calibration: { status: 'UNCALIBRATED', method: 'TEMPERATURE_SCALING' } // Fabricated
        });
      }).toThrow(/UNCERTAINTY_VALIDATION_ERROR/);
    });
  });

  // --- 6. Reasoning Trace Tampering Attacks ---
  describe('6. Reasoning Trace Tampering Attacks', () => {
    it('A10: Rejects reasoning trace rehydration when assumptions or steps are modified in transit', () => {
      const model = createSampleModel();
      const context = createSampleContext();
      const trace = EngineeringReasoningEngine.createReasoningTrace({
        claimId: 'CLAIM-TAMPER-STEPS',
        evidenceId: 'EVID-TAMPER-STEPS',
        contextHash: context.contextHash,
        executionHash: 'EXEC-TAMPER-STEPS',
        modelId: model.modelId,
        modelVersion: model.version,
        inputs: { v: 10 },
        assumptions: [],
        constraints: [],
        reasoningSteps: [{ sequenceNumber: 1, role: 'CONCLUSION', description: 'Original', rationale: 'Valid' }],
        intermediateFindings: [],
        evidenceBindings: [{ evidenceId: 'EVID-TAMPER-STEPS', relationship: 'SUPPORTING' }],
        conclusion: 'Original',
        limitations: []
      });

      const parsed = JSON.parse(EngineeringReasoningEngine.serializeTrace(trace));
      parsed.reasoningSteps[0].description = 'TAMPERED_STEP_DESCRIPTION';

      expect(() => {
        EngineeringReasoningEngine.rehydrateAndValidate(JSON.stringify(parsed));
      }).toThrow(/REASONING_REHYDRATION_ERROR/);
    });
  });

  // --- 7. Cross-Domain State Tampering & Conflict Preservation ---
  describe('7. Cross-Domain State Tampering & Conflict Preservation', () => {
    it('A11: Rejects cross-domain rehydration when status is RECONCILED but conflicting findings exist', () => {
      const cdTrace = CrossDomainIntelligenceEngine.createInferenceTrace({
        contextId: 'CTX-CD-01',
        contextHash: 'CTX-HASH-CD-01',
        modelId: 'ENG-CD-MODEL-v1',
        modelVersion: '1.0.0',
        executionHash: 'EXEC-CD-01',
        dependencies: [{
          dependencyId: CrossDomainIntelligenceEngine.computeDependencyId('CAD', 'REV-01', 'RES-01', 'CTX-HASH-CD-01', 'DEPENDS_ON'),
          sourceDomain: 'CAD',
          sourceRevisionHash: 'REV-01',
          sourceResultHash: 'RES-01',
          sourceContextHash: 'CTX-HASH-CD-01',
          relationship: 'DEPENDS_ON',
          freshness: 'CURRENT'
        }],
        findings: [{
          findingId: 'FINDING-01',
          primaryDomain: 'CAD',
          secondaryDomain: 'FEM',
          status: 'CONFLICT',
          description: 'CAD and FEM geometry volume mismatch'
        }]
      });

      const parsed = JSON.parse(JSON.stringify(cdTrace));
      parsed.reconciliationStatus = 'RECONCILED'; // Attempt silent conflict resolution

      expect(() => {
        CrossDomainIntelligenceEngine.rehydrateAndValidate(JSON.stringify(parsed));
      }).toThrow(/CROSS_DOMAIN_REHYDRATION_ERROR/);
    });

    it('A12: Rehydrated cross-domain trace preserves CONFLICTED state and never silently repairs it', () => {
      const cdTrace = CrossDomainIntelligenceEngine.createInferenceTrace({
        contextId: 'CTX-CD-02',
        contextHash: 'CTX-HASH-CD-02',
        modelId: 'ENG-CD-MODEL-v1',
        modelVersion: '1.0.0',
        executionHash: 'EXEC-CD-02',
        dependencies: [{
          dependencyId: CrossDomainIntelligenceEngine.computeDependencyId('CAD', 'REV-02', 'RES-02', 'CTX-HASH-CD-02', 'DEPENDS_ON'),
          sourceDomain: 'CAD',
          sourceRevisionHash: 'REV-02',
          sourceResultHash: 'RES-02',
          sourceContextHash: 'CTX-HASH-CD-02',
          relationship: 'DEPENDS_ON',
          freshness: 'CURRENT'
        }],
        findings: [{
          findingId: 'FINDING-02',
          primaryDomain: 'CAD',
          secondaryDomain: 'METROLOGY',
          status: 'CONFLICT',
          description: 'CMM measurement exceeds CAD tolerance'
        }]
      });

      expect(cdTrace.reconciliationStatus).toBe('CONFLICTED');
      const rehydrated = CrossDomainIntelligenceEngine.rehydrateAndValidate(JSON.stringify(cdTrace));
      expect(rehydrated.valid).toBe(true);
      expect(rehydrated.trace.reconciliationStatus).toBe('CONFLICTED');
    });
  });

  // --- 8. Replay Attacks & Evidence Binding Boundaries ---
  describe('8. Replay Attacks & Evidence Binding Boundaries', () => {
    it('A13: Replaying an inference record against evidence binder fails when envelope context is mismatched', () => {
      const model = createSampleModel();
      const context = createSampleContext();
      const record = createSampleInference();
      const report = IndependentAIVerifier.verifyInferenceDissimilar(
        record,
        model,
        context,
        record.inputs,
        { loadForceN: 'N', thicknessMm: 'mm' }
      );

      const envelope = EngineeringAIEvidenceBinder.createEvidenceEnvelope(record, model, context, report);

      const mismatchedContext = EngineeringAIContextEngine.createContext('CTX-MISMATCH', {
        geometryState: { volumeMm3: 99999 }
      });

      const serialized = EngineeringAIEvidenceBinder.serializeEnvelope(envelope);
      expect(() => {
        EngineeringAIEvidenceBinder.rehydrateAndValidate(serialized, mismatchedContext);
      }).toThrow(/EVIDENCE_REHYDRATION_ERROR/);
    });

    it('A14: Evidence binding retains strict advisory authority and cannot grant release or canonical truth', () => {
      const model = createSampleModel();
      const context = createSampleContext();
      const record = createSampleInference();
      const report = IndependentAIVerifier.verifyInferenceDissimilar(
        record,
        model,
        context,
        record.inputs,
        { loadForceN: 'N', thicknessMm: 'mm' }
      );

      const envelope = EngineeringAIEvidenceBinder.createEvidenceEnvelope(record, model, context, report);

      expect(envelope.verification.authorityTag).toBe('ADVISORY_EVIDENCE');
      expect(envelope.isCanonicalRelease).toBe(false);
      expect((envelope as any).isCanonicalTruth).toBeUndefined();
    });
  });

});
