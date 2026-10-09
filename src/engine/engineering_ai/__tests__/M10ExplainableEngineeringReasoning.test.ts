import { describe, it, expect, beforeEach } from 'vitest';
import { EngineeringReasoningEngine } from '../reasoning/EngineeringReasoningEngine';
import {
  EngineeringReasoningTrace,
  ReasoningStep,
  ReasoningAssumption,
  ReasoningConstraint,
  ReasoningEvidenceBinding,
  ExplainabilityStatus
} from '../reasoning/types';
import { EngineeringUncertaintyEngine } from '../uncertainty/EngineeringUncertaintyEngine';
import { UncertaintyAssessment } from '../uncertainty/types';
import { EngineeringAIEvidenceBinder, AIEvidenceEnvelope } from '../evidence/EngineeringAIEvidenceBinder';
import { IndependentAIVerifier } from '../IndependentAIVerifier';
import { EngineeringAIRuntime } from '../EngineeringAIRuntime';
import { EngineeringAIModelRegistry } from '../EngineeringAIModelRegistry';
import { EngineeringAIContextEngine } from '../EngineeringAIContextEngine';
import { TwinEvidenceGraphEngine } from '../../twin_evidence/TwinEvidenceGraphEngine';
import { EngineeringAIModel, EngineeringAIContext, AIInferenceRecord } from '../types';

describe('M10.6 — Explainable Engineering Reasoning Suite', () => {
  let modelRegistry: EngineeringAIModelRegistry;
  let contextEngine: EngineeringAIContextEngine;
  let evidenceEngine: TwinEvidenceGraphEngine;

  let baseModel: EngineeringAIModel;
  let baseContext: EngineeringAIContext;
  let inferenceRecord: AIInferenceRecord;
  let evidenceEnvelope: AIEvidenceEnvelope;
  let uncertaintyAssessment: UncertaintyAssessment;
  let inputs: Record<string, any>;
  let units: Record<string, string>;

  beforeEach(() => {
    modelRegistry = new EngineeringAIModelRegistry();
    contextEngine = new EngineeringAIContextEngine();
    evidenceEngine = new TwinEvidenceGraphEngine('TWIN-M10.6-PROPULSION');

    const rawModel: Partial<EngineeringAIModel> = {
      modelId: 'SURROGATE-M10.6-NOZZLE',
      modelName: 'Rocket Nozzle Aerothermal Surrogate',
      modelType: 'SURROGATE',
      version: '2.1.0',
      architecture: 'RESNET-EXPLAINABLE-M10',
      trainingDatasetId: 'DATASET-2026-NOZZLE-AERO',
      weights: { chamberPressureBar: 120.0, expansionRatio: 40.0, areaRatio: 12.5 },
      configuration: { activation: 'gelu', precision: 'fp64' },
      inputContract: {
        schemaId: 'SCH-M10.6-NOZZLE',
        units: { chamberPressureBar: 'bar', expansionRatio: 'ratio', areaRatio: 'ratio' },
        dimensions: { chamberPressureBar: [1], expansionRatio: [1], areaRatio: [1] },
        ranges: [
          { field: 'chamberPressureBar', min: 10.0, max: 300.0, unit: 'bar' },
          { field: 'expansionRatio', min: 2.0, max: 100.0, unit: 'ratio' },
          { field: 'areaRatio', min: 1.1, max: 50.0, unit: 'ratio' }
        ],
        requiredFields: ['chamberPressureBar', 'expansionRatio', 'areaRatio'],
        optionalFields: [],
        coordinateSystem: 'CARTESIAN',
        referenceFrame: 'GLOBAL',
        validityRules: []
      },
      outputContract: {
        outputType: 'WALL_HEAT_FLUX',
        unit: 'MW/m2',
        validRange: [0, 500],
        supportUncertainty: true,
        limitations: []
      },
      status: 'QUALIFIED'
    };

    baseModel = modelRegistry.register(rawModel);

    baseContext = EngineeringAIContextEngine.createContext('CTX-M10.6-001', {
      geometryState: {
        modelId: 'NOZZLE_LINER_001',
        geometryHash: '0xGEOM_HASH_NOZZLE_REV_D_9988776655443322',
        throatRadiusMm: 45.0
      },
      materialState: { alloy: 'CuCrZr', yieldStrengthMpa: 340 },
      physicsState: { chamberPressureBar: 120, wallTempK: 850 },
      manufacturingState: { process: 'SLM_ADDITIVE_COPPER' },
      assemblyState: { stageIndex: 2 },
      telemetryState: { thermocoupleId: 'TC-NOZZLE-01' },
      configurationState: {
        revisionId: 'REV_D',
        canonicalRevisionHash: '0xREV_D_HASH_11223344556677889900AABB'
      },
      evidenceSnapshotHash: '0xSNAP_HASH_NOZZLE_TEST'
    });

    inputs = { chamberPressureBar: 120.0, expansionRatio: 40.0, areaRatio: 12.5 };
    units = { chamberPressureBar: 'bar', expansionRatio: 'ratio', areaRatio: 'ratio' };

    inferenceRecord = EngineeringAIRuntime.executeInference({
      model: baseModel,
      context: baseContext,
      inputs,
      units,
      seed: 106,
      determinism: 'DETERMINISTIC',
      evidenceEngine
    });

    const report = IndependentAIVerifier.verifyInferenceDissimilar(
      inferenceRecord,
      baseModel,
      baseContext,
      inputs,
      units
    );

    evidenceEnvelope = EngineeringAIEvidenceBinder.createEvidenceEnvelope(
      inferenceRecord,
      baseModel,
      baseContext,
      report,
      evidenceEngine
    );

    uncertaintyAssessment = EngineeringUncertaintyEngine.createAssessment({
      evidenceId: evidenceEnvelope.evidenceId,
      modelId: baseModel.modelId,
      modelVersion: baseModel.version,
      contextHash: evidenceEnvelope.provenance.contextHash,
      executionHash: evidenceEnvelope.provenance.executionHash,
      canonicalRevisionHash: evidenceEnvelope.subject.canonicalRevisionHash,
      predictionNominal: 42.5,
      confidence: 0.95,
      confidenceMethod: 'CONFORMAL_RESIDUAL',
      epistemic: {
        trainingCoverageScore: 0.94,
        modelInadequacyEstimate: 0.02,
        outOfDistributionScore: 0.03,
        missingInformationFactors: [],
        epistemicIndex: 0.05,
        sourceDescription: 'High-density FEA aero-thermal dataset'
      },
      aleatoric: {
        measurementVariability: 0.01,
        manufacturingToleranceVariance: 0.015,
        operatingConditionVariance: 0.02,
        environmentalVariability: 0.01,
        aleatoricIndex: 0.055,
        sourceDescription: 'Thermocouple noise and SLM surface roughness'
      },
      errorEstimate: { metric: 'RMSE', value: 1.2, unit: 'MW/m2', isEstablished: true },
      calibration: { status: 'CALIBRATED', method: 'CONFORMAL_PREDICTION', referenceDatasetId: 'DATASET-2026-NOZZLE-AERO' }
    });
  });

  // =========================================================================
  // 1. DETERMINISTIC IDENTITY & CANONICAL REASONING CREATION
  // =========================================================================
  describe('1. Deterministic Identity & Canonical Trace Creation', () => {
    it('creates a deterministic EngineeringReasoningTrace with REASON-AI- identity', () => {
      const steps: ReasoningStep[] = [
        { sequenceNumber: 1, stepId: 'STEP-1', role: 'INPUT', description: 'Acquired chamber pressure 120 bar', inputsUsed: ['chamberPressureBar'], outputsProduced: ['P_chamber'] },
        { sequenceNumber: 2, stepId: 'STEP-2', role: 'TRANSFORMATION', description: 'Evaluated 1D expansion flow thermal flux', inputsUsed: ['P_chamber'], outputsProduced: ['q_flux_nominal'] },
        { sequenceNumber: 3, stepId: 'STEP-3', role: 'EVIDENCE_REFERENCE', description: 'Corroborated with FEA CFD evidence', inputsUsed: ['q_flux_nominal'], outputsProduced: [], evidenceRef: evidenceEnvelope.evidenceId },
        { sequenceNumber: 4, stepId: 'STEP-4', role: 'VERIFICATION_REFERENCE', description: 'Verified via dissimilar surrogate solver', inputsUsed: [], outputsProduced: [], verificationRef: 'VERIF-REPORT-106' },
        { sequenceNumber: 5, stepId: 'STEP-5', role: 'CONCLUSION', description: 'Predicted peak heat flux 42.5 MW/m2 is within CuCrZr thermal limit', inputsUsed: ['q_flux_nominal'], outputsProduced: ['CONCLUSION_VALID'] }
      ];

      const assumptions: ReasoningAssumption[] = [
        { assumptionId: 'ASS-1', statement: 'Steady-state supersonic expansion flow', category: 'ENGINEERING_ASSUMPTION', rationale: 'Transients < 100ms neglected', isCanonicalFact: false },
        { assumptionId: 'ASS-2', statement: 'Material conductivity K_CuCrZr = 320 W/m-K', category: 'CANONICAL_FACT', rationale: 'Retrieved from canonical material database', isCanonicalFact: true }
      ];

      const constraints: ReasoningConstraint[] = [
        { constraintId: 'CON-1', name: 'Max Nozzle Wall Heat Flux', thresholdValue: 80.0, actualValue: 42.5, unit: 'MW/m2', status: 'SATISFIED' }
      ];

      const bindings: ReasoningEvidenceBinding[] = [
        { evidenceId: evidenceEnvelope.evidenceId, relationship: 'SUPPORTING', claimReference: 'CLAIM-HEAT-FLUX-SAFE', summary: 'CFD run corroborates 42.5 MW/m2 prediction' }
      ];

      const trace1 = EngineeringReasoningEngine.createReasoningTrace({
        claimId: 'CLAIM-HEAT-FLUX-SAFE',
        evidenceId: evidenceEnvelope.evidenceId,
        uncertaintyAssessmentId: uncertaintyAssessment.assessmentId,
        verificationId: 'VERIF-REPORT-106',
        contextHash: evidenceEnvelope.provenance.contextHash,
        revisionId: 'REV_D',
        canonicalRevisionHash: evidenceEnvelope.subject.canonicalRevisionHash,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        executionHash: evidenceEnvelope.provenance.executionHash,
        inputs,
        assumptions,
        constraints,
        reasoningSteps: steps,
        intermediateFindings: ['Nominal heat flux: 42.5 MW/m2', 'Safety factor: 1.88 vs 80 MW/m2 limit'],
        evidenceBindings: bindings,
        uncertaintyRef: { assessmentId: uncertaintyAssessment.assessmentId, confidence: 0.95 },
        verificationRef: { verdict: 'VERIFIED', independenceLevel: 'FULLY_INDEPENDENT_DISSIMILAR' },
        conclusion: 'Peak heat flux 42.5 MW/m2 is within safe thermal threshold.',
        limitations: ['Valid only for steady-state firing regimes'],
        createdAt: '2026-09-27T02:20:00.000Z'
      });

      const trace2 = EngineeringReasoningEngine.createReasoningTrace({
        claimId: 'CLAIM-HEAT-FLUX-SAFE',
        evidenceId: evidenceEnvelope.evidenceId,
        uncertaintyAssessmentId: uncertaintyAssessment.assessmentId,
        verificationId: 'VERIF-REPORT-106',
        contextHash: evidenceEnvelope.provenance.contextHash,
        revisionId: 'REV_D',
        canonicalRevisionHash: evidenceEnvelope.subject.canonicalRevisionHash,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        executionHash: evidenceEnvelope.provenance.executionHash,
        inputs,
        assumptions,
        constraints,
        reasoningSteps: steps,
        intermediateFindings: ['Nominal heat flux: 42.5 MW/m2', 'Safety factor: 1.88 vs 80 MW/m2 limit'],
        evidenceBindings: bindings,
        uncertaintyRef: { assessmentId: uncertaintyAssessment.assessmentId, confidence: 0.95 },
        verificationRef: { verdict: 'VERIFIED', independenceLevel: 'FULLY_INDEPENDENT_DISSIMILAR' },
        conclusion: 'Peak heat flux 42.5 MW/m2 is within safe thermal threshold.',
        limitations: ['Valid only for steady-state firing regimes'],
        createdAt: '2026-09-27T02:20:00.000Z'
      });

      expect(trace1.reasoningId).toBe(trace2.reasoningId);
      expect(trace1.reasoningContentHash).toBe(trace2.reasoningContentHash);
      expect(trace1.reasoningId.startsWith('REASON-AI-')).toBe(true);
      expect(trace1.authorityTag).toBe('ADVISORY_EVIDENCE');
      expect(trace1.isCanonicalTruth).toBe(false);
      expect(trace1.isCanonicalRelease).toBe(false);
    });

    it('alters reasoningId when inputs, revision, evidence, or conclusion changes', () => {
      const baseParams = {
        claimId: 'CLAIM-HEAT-FLUX-SAFE',
        evidenceId: evidenceEnvelope.evidenceId,
        contextHash: evidenceEnvelope.provenance.contextHash,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        executionHash: evidenceEnvelope.provenance.executionHash,
        inputs,
        assumptions: [],
        constraints: [],
        reasoningSteps: [
          { sequenceNumber: 1, stepId: 'S1', role: 'INPUT' as const, description: 'Input read', inputsUsed: [], outputsProduced: [] },
          { sequenceNumber: 2, stepId: 'S2', role: 'CONCLUSION' as const, description: 'Conclusion reached', inputsUsed: [], outputsProduced: [] }
        ],
        intermediateFindings: [],
        evidenceBindings: [{ evidenceId: evidenceEnvelope.evidenceId, relationship: 'SUPPORTING' as const, claimReference: 'C1', summary: 'S' }],
        conclusion: 'Conclusion A',
        limitations: []
      };

      const traceA = EngineeringReasoningEngine.createReasoningTrace(baseParams);

      const traceB = EngineeringReasoningEngine.createReasoningTrace({
        ...baseParams,
        conclusion: 'Conclusion B' // Different conclusion
      });

      const traceC = EngineeringReasoningEngine.createReasoningTrace({
        ...baseParams,
        inputs: { ...inputs, chamberPressureBar: 180.0 } // Different inputs
      });

      expect(traceA.reasoningId).not.toBe(traceB.reasoningId);
      expect(traceA.reasoningId).not.toBe(traceC.reasoningId);
    });
  });

  // =========================================================================
  // 2. CONTRADICTORY EVIDENCE & EXPLAINABILITY STATUS DERIVATION
  // =========================================================================
  describe('2. Contradictory Evidence & Explanation Status Governance', () => {
    it('sets explanationStatus to CONFLICTED when contradicting evidence exists', () => {
      const bindings: ReasoningEvidenceBinding[] = [
        { evidenceId: evidenceEnvelope.evidenceId, relationship: 'SUPPORTING', claimReference: 'C1', summary: '1D model supports' },
        { evidenceId: 'EV-AI-CONTRADICTING-001', relationship: 'CONTRADICTING', claimReference: 'C1', summary: 'High-altitude telemetry shows thermal hotspot' }
      ];

      const trace = EngineeringReasoningEngine.createReasoningTrace({
        claimId: 'CLAIM-HOTSPOT',
        evidenceId: evidenceEnvelope.evidenceId,
        contextHash: evidenceEnvelope.provenance.contextHash,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        executionHash: evidenceEnvelope.provenance.executionHash,
        inputs,
        assumptions: [],
        constraints: [],
        reasoningSteps: [
          { sequenceNumber: 1, stepId: 'S1', role: 'CONCLUSION', description: 'Evaluated', inputsUsed: [], outputsProduced: [] }
        ],
        intermediateFindings: [],
        evidenceBindings: bindings,
        conclusion: 'Conflict detected between model and telemetry.',
        limitations: []
      });

      expect(trace.explanationStatus).toBe('CONFLICTED');
    });

    it('rejects attempt to claim COMPLETE explanationStatus when contradicting evidence exists', () => {
      const bindings: ReasoningEvidenceBinding[] = [
        { evidenceId: 'EV-CONTRADICTING', relationship: 'CONTRADICTING', claimReference: 'C1', summary: 'Disagrees' }
      ];

      expect(() =>
        EngineeringReasoningEngine.createReasoningTrace({
          claimId: 'C1',
          evidenceId: evidenceEnvelope.evidenceId,
          contextHash: evidenceEnvelope.provenance.contextHash,
          modelId: baseModel.modelId,
          modelVersion: baseModel.version,
          executionHash: evidenceEnvelope.provenance.executionHash,
          inputs,
          assumptions: [],
          constraints: [],
          reasoningSteps: [
            { sequenceNumber: 1, stepId: 'S1', role: 'CONCLUSION', description: 'Done', inputsUsed: [], outputsProduced: [] }
          ],
          intermediateFindings: [],
          evidenceBindings: bindings,
          conclusion: 'Forced complete',
          limitations: [],
          explanationStatus: 'COMPLETE' // FORBIDDEN under contradiction!
        })
      ).toThrow(/REASONING_VALIDATION_ERROR.*CONTRADICTION_UNHANDLED/);
    });
  });

  // =========================================================================
  // 3. ASSUMPTION VS FACT & CONSTRAINT STATUS INTEGRITY
  // =========================================================================
  describe('3. Assumption vs Fact & Constraint Status Integrity', () => {
    it('blocks ENGINEERING_ASSUMPTION from claiming isCanonicalFact = true', () => {
      const badAssumptions: ReasoningAssumption[] = [
        {
          assumptionId: 'A-BAD',
          statement: 'Assumed laminar boundary layer',
          category: 'ENGINEERING_ASSUMPTION',
          rationale: 'Simplification',
          isCanonicalFact: true // FORBIDDEN!
        }
      ];

      expect(() =>
        EngineeringReasoningEngine.createReasoningTrace({
          claimId: 'C1',
          evidenceId: evidenceEnvelope.evidenceId,
          contextHash: evidenceEnvelope.provenance.contextHash,
          modelId: baseModel.modelId,
          modelVersion: baseModel.version,
          executionHash: evidenceEnvelope.provenance.executionHash,
          inputs,
          assumptions: badAssumptions,
          constraints: [],
          reasoningSteps: [
            { sequenceNumber: 1, stepId: 'S1', role: 'CONCLUSION', description: 'Done', inputsUsed: [], outputsProduced: [] }
          ],
          intermediateFindings: [],
          evidenceBindings: [{ evidenceId: evidenceEnvelope.evidenceId, relationship: 'SUPPORTING', claimReference: 'C1', summary: 'S' }],
          conclusion: 'Done',
          limitations: []
        })
      ).toThrow(/REASONING_VALIDATION_ERROR.*INVALID_ASSUMPTION_CATEGORY/);
    });

    it('derives LIMITED status when a constraint status is UNKNOWN or VIOLATED', () => {
      const constraints: ReasoningConstraint[] = [
        { constraintId: 'CON-1', name: 'Aero-acoustic resonance', thresholdValue: 120, status: 'UNKNOWN', rationale: 'High-frequency transducer uncalibrated' }
      ];

      const trace = EngineeringReasoningEngine.createReasoningTrace({
        claimId: 'C1',
        evidenceId: evidenceEnvelope.evidenceId,
        contextHash: evidenceEnvelope.provenance.contextHash,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        executionHash: evidenceEnvelope.provenance.executionHash,
        inputs,
        assumptions: [],
        constraints,
        reasoningSteps: [
          { sequenceNumber: 1, stepId: 'S1', role: 'CONCLUSION', description: 'Done', inputsUsed: [], outputsProduced: [] }
        ],
        intermediateFindings: [],
        evidenceBindings: [{ evidenceId: evidenceEnvelope.evidenceId, relationship: 'SUPPORTING', claimReference: 'C1', summary: 'S' }],
        conclusion: 'Done',
        limitations: []
      });

      expect(trace.explanationStatus).toBe('LIMITED');
    });
  });

  // =========================================================================
  // 4. EVIDENCE BINDING & GRAPH INTEGRATION
  // =========================================================================
  describe('4. Evidence Binding & Twin Evidence Graph Integration', () => {
    it('binds reasoning trace to M10.4 evidence envelope and updates twin graph root hash', () => {
      const trace = EngineeringReasoningEngine.createReasoningTrace({
        claimId: 'C1',
        evidenceId: evidenceEnvelope.evidenceId,
        contextHash: evidenceEnvelope.provenance.contextHash,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        executionHash: evidenceEnvelope.provenance.executionHash,
        inputs,
        assumptions: [],
        constraints: [],
        reasoningSteps: [
          { sequenceNumber: 1, stepId: 'S1', role: 'CONCLUSION', description: 'Done', inputsUsed: [], outputsProduced: [] }
        ],
        intermediateFindings: [],
        evidenceBindings: [{ evidenceId: evidenceEnvelope.evidenceId, relationship: 'SUPPORTING', claimReference: 'C1', summary: 'S' }],
        conclusion: 'Verified reasoning',
        limitations: []
      });

      const initialRoot = evidenceEngine.graph.rootHash;

      EngineeringReasoningEngine.bindToEvidenceEnvelope(trace, evidenceEnvelope, evidenceEngine);

      const node = evidenceEngine.graph.nodes.get(evidenceEnvelope.evidenceId);
      expect(node).toBeDefined();
      expect(node?.attributes.reasoningTrace).toBeDefined();
      expect(node?.attributes.reasoningId).toBe(trace.reasoningId);
      expect(evidenceEngine.graph.rootHash).not.toBe(initialRoot);
    });
  });

  // =========================================================================
  // 5. PERSISTENCE & REHYDRATION (ZERO DRIFT)
  // =========================================================================
  describe('5. Persistence & Rehydration Fidelity (Zero Drift)', () => {
    it('serializes and rehydrates reasoning trace preserving bit-for-bit identity', () => {
      const trace = EngineeringReasoningEngine.createReasoningTrace({
        claimId: 'CLAIM-PERSIST-106',
        evidenceId: evidenceEnvelope.evidenceId,
        uncertaintyAssessmentId: uncertaintyAssessment.assessmentId,
        contextHash: evidenceEnvelope.provenance.contextHash,
        revisionId: 'REV_D',
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        executionHash: evidenceEnvelope.provenance.executionHash,
        inputs,
        assumptions: [
          { assumptionId: 'A1', statement: 'Steady-state', category: 'ENGINEERING_ASSUMPTION', rationale: 'R', isCanonicalFact: false }
        ],
        constraints: [
          { constraintId: 'C1', name: 'Heat Limit', thresholdValue: 80, actualValue: 42.5, status: 'SATISFIED' }
        ],
        reasoningSteps: [
          { sequenceNumber: 1, stepId: 'S1', role: 'INPUT', description: 'Read inputs', inputsUsed: [], outputsProduced: [] },
          { sequenceNumber: 2, stepId: 'S2', role: 'CONCLUSION', description: 'Safe', inputsUsed: [], outputsProduced: [] }
        ],
        intermediateFindings: ['Nominal heat flux 42.5 MW/m2'],
        evidenceBindings: [{ evidenceId: evidenceEnvelope.evidenceId, relationship: 'SUPPORTING', claimReference: 'CLAIM-PERSIST-106', summary: 'Corroborated' }],
        uncertaintyRef: { assessmentId: uncertaintyAssessment.assessmentId },
        verificationRef: { verdict: 'VERIFIED' },
        conclusion: 'Thermal stress is acceptable.',
        limitations: ['Steady firing only']
      });

      const serialized = EngineeringReasoningEngine.serializeTrace(trace);
      const rehydrated = EngineeringReasoningEngine.rehydrateAndValidate(
        serialized,
        evidenceEnvelope,
        uncertaintyAssessment
      );

      expect(rehydrated.valid).toBe(true);
      expect(rehydrated.trace.reasoningId).toBe(trace.reasoningId);
      expect(rehydrated.trace.reasoningContentHash).toBe(trace.reasoningContentHash);
      expect(rehydrated.trace.authorityTag).toBe('ADVISORY_EVIDENCE');
      expect(rehydrated.trace.isCanonicalTruth).toBe(false);
    });

    it('detects tampering during rehydration if reasoning payload is modified', () => {
      const trace = EngineeringReasoningEngine.createReasoningTrace({
        claimId: 'CLAIM-TAMPER',
        evidenceId: evidenceEnvelope.evidenceId,
        contextHash: evidenceEnvelope.provenance.contextHash,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        executionHash: evidenceEnvelope.provenance.executionHash,
        inputs,
        assumptions: [],
        constraints: [],
        reasoningSteps: [
          { sequenceNumber: 1, stepId: 'S1', role: 'CONCLUSION', description: 'Original', inputsUsed: [], outputsProduced: [] }
        ],
        intermediateFindings: [],
        evidenceBindings: [{ evidenceId: evidenceEnvelope.evidenceId, relationship: 'SUPPORTING', claimReference: 'CLAIM-TAMPER', summary: 'S' }],
        conclusion: 'Original conclusion',
        limitations: []
      });

      const serialized = EngineeringReasoningEngine.serializeTrace(trace);
      const parsed = JSON.parse(serialized);

      // Maliciously tamper with conclusion in storage
      parsed.conclusion = 'ATTACKER_TAMPERED_CONCLUSION';
      const tamperedJson = JSON.stringify(parsed);

      expect(() =>
        EngineeringReasoningEngine.rehydrateAndValidate(tamperedJson, evidenceEnvelope)
      ).toThrow(/REASONING_REHYDRATION_ERROR.*Content hash tampered/);
    });
  });

  // =========================================================================
  // 6. ADVERSARIAL INTEGRITY ATTACKS
  // =========================================================================
  describe('6. Adversarial Explanation Attacks', () => {
    it('A1: Injected isCanonicalTruth = true is BLOCKED', () => {
      const raw: any = {
        claimId: 'CLAIM-ATTACK',
        evidenceId: evidenceEnvelope.evidenceId,
        contextHash: evidenceEnvelope.provenance.contextHash,
        executionHash: evidenceEnvelope.provenance.executionHash,
        modelId: baseModel.modelId,
        conclusion: 'Attack',
        authorityTag: 'ADVISORY_EVIDENCE',
        isCanonicalTruth: true, // FORBIDDEN!
        isCanonicalRelease: false,
        reasoningSteps: [{ sequenceNumber: 1, stepId: 'S1', role: 'CONCLUSION', description: 'C', inputsUsed: [], outputsProduced: [] }]
      };

      const val = EngineeringReasoningEngine.validateReasoningTrace(raw);
      expect(val.valid).toBe(false);
      expect(val.errors.some(e => e.code === 'AUTHORITY_ESCALATION_ATTEMPT')).toBe(true);
    });

    it('A2: Injected isCanonicalRelease = true is BLOCKED', () => {
      const raw: any = {
        claimId: 'CLAIM-ATTACK',
        evidenceId: evidenceEnvelope.evidenceId,
        contextHash: evidenceEnvelope.provenance.contextHash,
        executionHash: evidenceEnvelope.provenance.executionHash,
        modelId: baseModel.modelId,
        conclusion: 'Attack',
        authorityTag: 'ADVISORY_EVIDENCE',
        isCanonicalTruth: false,
        isCanonicalRelease: true, // FORBIDDEN!
        reasoningSteps: [{ sequenceNumber: 1, stepId: 'S1', role: 'CONCLUSION', description: 'C', inputsUsed: [], outputsProduced: [] }]
      };

      const val = EngineeringReasoningEngine.validateReasoningTrace(raw);
      expect(val.valid).toBe(false);
      expect(val.errors.some(e => e.code === 'AUTHORITY_ESCALATION_ATTEMPT')).toBe(true);
    });

    it('A3: Out-of-order step sequence is BLOCKED', () => {
      const badSteps: ReasoningStep[] = [
        { sequenceNumber: 1, stepId: 'S1', role: 'INPUT', description: 'Input', inputsUsed: [], outputsProduced: [] },
        { sequenceNumber: 3, stepId: 'S2', role: 'CONCLUSION', description: 'Skipped 2!', inputsUsed: [], outputsProduced: [] } // Sequence broken!
      ];

      expect(() =>
        EngineeringReasoningEngine.createReasoningTrace({
          claimId: 'C1',
          evidenceId: evidenceEnvelope.evidenceId,
          contextHash: evidenceEnvelope.provenance.contextHash,
          modelId: baseModel.modelId,
          modelVersion: baseModel.version,
          executionHash: evidenceEnvelope.provenance.executionHash,
          inputs,
          assumptions: [],
          constraints: [],
          reasoningSteps: badSteps,
          intermediateFindings: [],
          evidenceBindings: [{ evidenceId: evidenceEnvelope.evidenceId, relationship: 'SUPPORTING', claimReference: 'C1', summary: 'S' }],
          conclusion: 'Bad steps',
          limitations: []
        })
      ).toThrow(/REASONING_VALIDATION_ERROR.*INVALID_STEP_ORDERING/);
    });

    it('A4: EVIDENCE_REFERENCE step missing evidenceRef is BLOCKED', () => {
      const badSteps: ReasoningStep[] = [
        { sequenceNumber: 1, stepId: 'S1', role: 'EVIDENCE_REFERENCE', description: 'Missing evidenceRef', inputsUsed: [], outputsProduced: [] }
      ];

      expect(() =>
        EngineeringReasoningEngine.createReasoningTrace({
          claimId: 'C1',
          evidenceId: evidenceEnvelope.evidenceId,
          contextHash: evidenceEnvelope.provenance.contextHash,
          modelId: baseModel.modelId,
          modelVersion: baseModel.version,
          executionHash: evidenceEnvelope.provenance.executionHash,
          inputs,
          assumptions: [],
          constraints: [],
          reasoningSteps: badSteps,
          intermediateFindings: [],
          evidenceBindings: [{ evidenceId: evidenceEnvelope.evidenceId, relationship: 'SUPPORTING', claimReference: 'C1', summary: 'S' }],
          conclusion: 'Bad step ref',
          limitations: []
        })
      ).toThrow(/REASONING_VALIDATION_ERROR.*MISSING_STEP_REFERENCE/);
    });
  });
});
