import { describe, it, expect, beforeEach } from 'vitest';
import {
  EngineeringUncertaintyEngine
} from '../uncertainty/EngineeringUncertaintyEngine';
import {
  UncertaintyAssessment,
  EpistemicUncertainty,
  AleatoricUncertainty,
  ConfidenceInterval,
  ErrorEstimate,
  CalibrationRecord
} from '../uncertainty/types';
import { EngineeringAIEvidenceBinder, AIEvidenceEnvelope } from '../evidence/EngineeringAIEvidenceBinder';
import { IndependentAIVerifier } from '../IndependentAIVerifier';
import { EngineeringAIRuntime } from '../EngineeringAIRuntime';
import { EngineeringAIModelRegistry } from '../EngineeringAIModelRegistry';
import { EngineeringAIContextEngine } from '../EngineeringAIContextEngine';
import { TwinEvidenceGraphEngine } from '../../twin_evidence/TwinEvidenceGraphEngine';
import { EngineeringAIModel, EngineeringAIContext, AIInferenceRecord } from '../types';

describe('M10.5 — Uncertainty & Confidence Engineering Suite', () => {
  let modelRegistry: EngineeringAIModelRegistry;
  let contextEngine: EngineeringAIContextEngine;
  let evidenceEngine: TwinEvidenceGraphEngine;

  let baseModel: EngineeringAIModel;
  let baseContext: EngineeringAIContext;
  let inferenceRecord: AIInferenceRecord;
  let evidenceEnvelope: AIEvidenceEnvelope;
  let inputs: Record<string, any>;
  let units: Record<string, string>;

  beforeEach(() => {
    modelRegistry = new EngineeringAIModelRegistry();
    contextEngine = new EngineeringAIContextEngine();
    evidenceEngine = new TwinEvidenceGraphEngine('TWIN-M10.5-TURBINE');

    const rawModel: Partial<EngineeringAIModel> = {
      modelId: 'SURROGATE-M10.5-TURBINE',
      modelName: 'Turbine Blade Thermal-Stress Surrogate',
      modelType: 'SURROGATE',
      version: '1.2.0',
      architecture: 'RESNET-PROBABILISTIC-M10',
      trainingDatasetId: 'DATASET-2026-TURBINE-THERMAL',
      weights: { inletTemp: 1450.0, pressureRatio: 28.5, rpm: 12000 },
      configuration: { activation: 'gelu', precision: 'fp64' },
      inputContract: {
        schemaId: 'SCH-M10.5-TURBINE',
        units: { inletTemp: 'K', pressureRatio: 'ratio', rpm: 'rpm' },
        dimensions: { inletTemp: [1], pressureRatio: [1], rpm: [1] },
        ranges: [
          { field: 'inletTemp', min: 300.0, max: 2000.0, unit: 'K' },
          { field: 'pressureRatio', min: 1.0, max: 50.0, unit: 'ratio' },
          { field: 'rpm', min: 0.0, max: 25000.0, unit: 'rpm' }
        ],
        requiredFields: ['inletTemp', 'pressureRatio', 'rpm'],
        optionalFields: [],
        coordinateSystem: 'CARTESIAN',
        referenceFrame: 'GLOBAL',
        validityRules: []
      },
      outputContract: {
        outputType: 'THERMAL_STRESS',
        unit: 'MPa',
        validRange: [0, 2500],
        supportUncertainty: true,
        limitations: []
      },
      status: 'QUALIFIED'
    };

    baseModel = modelRegistry.register(rawModel);

    baseContext = EngineeringAIContextEngine.createContext('CTX-M10.5-001', {
      geometryState: {
        modelId: 'TURBINE_ROTOR_001',
        geometryHash: '0xGEOM_HASH_ROTOR_REV_C_778899AABBCCDDEE',
        rootRadiusMm: 350.0
      },
      materialState: { alloy: 'Inconel-718', yieldStrengthMpa: 1100 },
      physicsState: { inletTempK: 1450, ambientPressureKpa: 101.3 },
      manufacturingState: { process: 'DIRECT_METAL_LASER_SINTERING' },
      assemblyState: { stageIndex: 1 },
      telemetryState: { pyrometerId: 'PYRO-STAGE1-09' },
      configurationState: {
        revisionId: 'REV_C',
        canonicalRevisionHash: '0xREV_C_HASH_AABBCCDDEEFF001122334455'
      },
      evidenceSnapshotHash: '0xSNAP_HASH_TURBINE_STAGE1'
    });

    inputs = { inletTemp: 1450.0, pressureRatio: 28.5, rpm: 12000 };
    units = { inletTemp: 'K', pressureRatio: 'ratio', rpm: 'rpm' };

    inferenceRecord = EngineeringAIRuntime.executeInference({
      model: baseModel,
      context: baseContext,
      inputs,
      units,
      seed: 105,
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
  });

  // =========================================================================
  // 1. DETERMINISTIC IDENTITY & CANONICAL UNCERTAINTY CREATION (GATE G01, G02)
  // =========================================================================
  describe('1. Deterministic Identity & Canonical Uncertainty Creation', () => {
    it('creates a fully validated UncertaintyAssessment with deterministic ID', () => {
      const epistemic: EpistemicUncertainty = {
        trainingCoverageScore: 0.92,
        modelInadequacyEstimate: 0.03,
        outOfDistributionScore: 0.05,
        missingInformationFactors: [],
        epistemicIndex: 0.08,
        sourceDescription: 'High-density FEA thermal validation grid coverage'
      };

      const aleatoric: AleatoricUncertainty = {
        measurementVariability: 0.015,
        manufacturingToleranceVariance: 0.02,
        operatingConditionVariance: 0.025,
        environmentalVariability: 0.01,
        aleatoricIndex: 0.07,
        sourceDescription: 'DMLS surface roughness and pyrometer noise'
      };

      const interval: ConfidenceInterval = {
        lowerBound: 410.5,
        upperBound: 435.2,
        nominalValue: 422.8,
        coverageProbability: 0.95,
        intervalType: 'CONFORMAL',
        unit: 'MPa'
      };

      const errorEstimate: ErrorEstimate = {
        metric: 'RMSE',
        value: 6.35,
        unit: 'MPa',
        evaluatedAgainstDatasetId: 'DATASET-2026-TURBINE-THERMAL',
        isEstablished: true
      };

      const calibration: CalibrationRecord = {
        status: 'CALIBRATED',
        method: 'CONFORMAL_PREDICTION',
        referenceDatasetId: 'DATASET-2026-TURBINE-THERMAL',
        expectedCalibrationError: 0.021,
        brierScore: 0.035,
        calibratedAt: new Date().toISOString(),
        notes: 'Calibrated via 500-sample holdout conformal residual band'
      };

      const assessment1 = EngineeringUncertaintyEngine.createAssessment({
        evidenceId: evidenceEnvelope.evidenceId,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        contextHash: evidenceEnvelope.provenance.contextHash,
        executionHash: evidenceEnvelope.provenance.executionHash,
        canonicalRevisionHash: evidenceEnvelope.subject.canonicalRevisionHash,
        predictionNominal: 422.8,
        confidence: 0.965,
        confidenceMethod: 'CONFORMAL_RESIDUAL',
        epistemic,
        aleatoric,
        interval,
        errorEstimate,
        calibration,
        createdAt: '2026-09-27T02:00:00.000Z'
      });

      const assessment2 = EngineeringUncertaintyEngine.createAssessment({
        evidenceId: evidenceEnvelope.evidenceId,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        contextHash: evidenceEnvelope.provenance.contextHash,
        executionHash: evidenceEnvelope.provenance.executionHash,
        canonicalRevisionHash: evidenceEnvelope.subject.canonicalRevisionHash,
        predictionNominal: 422.8,
        confidence: 0.965,
        confidenceMethod: 'CONFORMAL_RESIDUAL',
        epistemic,
        aleatoric,
        interval,
        errorEstimate,
        calibration,
        createdAt: '2026-09-27T02:00:00.000Z'
      });

      expect(assessment1.assessmentId).toBe(assessment2.assessmentId);
      expect(assessment1.assessmentContentHash).toBe(assessment2.assessmentContentHash);
      expect(assessment1.assessmentId.startsWith('UNCERT-AI-')).toBe(true);
      expect(assessment1.isCanonicalTruth).toBe(false);
    });

    it('changes assessment identity when confidence or context hash changes', () => {
      const epistemic: EpistemicUncertainty = {
        trainingCoverageScore: 0.9,
        modelInadequacyEstimate: 0.05,
        outOfDistributionScore: 0.05,
        missingInformationFactors: [],
        epistemicIndex: 0.1,
        sourceDescription: 'Grid test'
      };
      const aleatoric: AleatoricUncertainty = {
        measurementVariability: 0.02,
        manufacturingToleranceVariance: 0.02,
        operatingConditionVariance: 0.02,
        environmentalVariability: 0.02,
        aleatoricIndex: 0.08,
        sourceDescription: 'Noise test'
      };
      const errorEstimate: ErrorEstimate = {
        metric: 'RMSE',
        value: 5.0,
        isEstablished: true
      };
      const calibration: CalibrationRecord = {
        status: 'CALIBRATED',
        method: 'PLATT_SCALING',
        referenceDatasetId: 'DATASET-1',
        expectedCalibrationError: 0.03
      };

      const a1 = EngineeringUncertaintyEngine.createAssessment({
        evidenceId: evidenceEnvelope.evidenceId,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        contextHash: evidenceEnvelope.provenance.contextHash,
        executionHash: evidenceEnvelope.provenance.executionHash,
        predictionNominal: 100,
        confidence: 0.95,
        confidenceMethod: 'RESIDUAL_CALIBRATED',
        epistemic,
        aleatoric,
        errorEstimate,
        calibration
      });

      const a2 = EngineeringUncertaintyEngine.createAssessment({
        evidenceId: evidenceEnvelope.evidenceId,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        contextHash: evidenceEnvelope.provenance.contextHash,
        executionHash: evidenceEnvelope.provenance.executionHash,
        predictionNominal: 100,
        confidence: 0.88, // Different confidence
        confidenceMethod: 'RESIDUAL_CALIBRATED',
        epistemic,
        aleatoric,
        errorEstimate,
        calibration
      });

      expect(a1.assessmentId).not.toBe(a2.assessmentId);
    });
  });

  // =========================================================================
  // 2. EPISTEMIC VS ALEATORIC DECOMPOSITION (GATE G04)
  // =========================================================================
  describe('2. Epistemic vs Aleatoric Uncertainty Separation', () => {
    it('preserves distinct epistemic and aleatoric representations without scalar collapse', () => {
      const epistemic: EpistemicUncertainty = {
        trainingCoverageScore: 0.65, // Lower coverage -> high epistemic uncertainty
        modelInadequacyEstimate: 0.12,
        outOfDistributionScore: 0.28,
        missingInformationFactors: ['UNTESTED_TRANSIENT_RPM_REGIME', 'UNKNOWN_CREEP_DAMAGE_ACCUMULATION'],
        epistemicIndex: 0.35,
        sourceDescription: 'Extrapolated edge of thermal flight envelope'
      };

      const aleatoric: AleatoricUncertainty = {
        measurementVariability: 0.01,
        manufacturingToleranceVariance: 0.015,
        operatingConditionVariance: 0.02,
        environmentalVariability: 0.01,
        aleatoricIndex: 0.055,
        sourceDescription: 'Nominal sensor white noise'
      };

      const assessment = EngineeringUncertaintyEngine.createAssessment({
        evidenceId: evidenceEnvelope.evidenceId,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        contextHash: evidenceEnvelope.provenance.contextHash,
        executionHash: evidenceEnvelope.provenance.executionHash,
        predictionNominal: 520.0,
        confidence: 0.72,
        confidenceMethod: 'ENSEMBLE_VARIANCE',
        epistemic,
        aleatoric,
        errorEstimate: { metric: 'STD_DEV', value: 14.2, isEstablished: true },
        calibration: { status: 'CALIBRATION_UNAVAILABLE' }
      });

      // Assert that both dimensions remain independently accessible and fully traceable
      expect(assessment.epistemic.epistemicIndex).toBe(0.35);
      expect(assessment.epistemic.missingInformationFactors.length).toBe(2);
      expect(assessment.aleatoric.aleatoricIndex).toBe(0.055);
      expect(assessment.epistemic.epistemicIndex).not.toBe(assessment.aleatoric.aleatoricIndex);
    });
  });

  // =========================================================================
  // 3. PROBABILITY VS CONFIDENCE DISTINCTION (GATE G03)
  // =========================================================================
  describe('3. Probability vs Confidence Distinction', () => {
    it('distinguishes model confidence from hypothesis probability distribution', () => {
      const assessment = EngineeringUncertaintyEngine.createAssessment({
        evidenceId: evidenceEnvelope.evidenceId,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        contextHash: evidenceEnvelope.provenance.contextHash,
        executionHash: evidenceEnvelope.provenance.executionHash,
        predictionNominal: 450.0,
        confidence: 0.94, // Model certainty in output
        confidenceMethod: 'PROBABILISTIC_BAYESIAN',
        probability: {
          value: 0.012, // Probability that stress exceeds yield (P(Stress > 1100MPa))
          hypothesis: 'EXCEEDS_MATERIAL_YIELD_1100MPA',
          distributionType: 'LOG_NORMAL'
        },
        epistemic: {
          trainingCoverageScore: 0.95,
          modelInadequacyEstimate: 0.02,
          outOfDistributionScore: 0.03,
          missingInformationFactors: [],
          epistemicIndex: 0.05,
          sourceDescription: 'Full coverage'
        },
        aleatoric: {
          measurementVariability: 0.02,
          manufacturingToleranceVariance: 0.02,
          operatingConditionVariance: 0.02,
          environmentalVariability: 0.02,
          aleatoricIndex: 0.08,
          sourceDescription: 'Normal noise'
        },
        errorEstimate: { metric: 'RMSE', value: 4.5, isEstablished: true },
        calibration: { status: 'CALIBRATED', method: 'TEMPERATURE_SCALING', referenceDatasetId: 'DATASET-1', expectedCalibrationError: 0.015 }
      });

      expect(assessment.confidence).toBe(0.94);
      expect(assessment.probability?.value).toBe(0.012);
      expect(assessment.probability?.hypothesis).toBe('EXCEEDS_MATERIAL_YIELD_1100MPA');
      expect(assessment.confidence).not.toBe(assessment.probability?.value);
    });
  });

  // =========================================================================
  // 4. SENSITIVITY & PERTURBATION ANALYSIS (GATE G06)
  // =========================================================================
  describe('4. Sensitivity & Input Perturbation Profile', () => {
    it('computes parameter sensitivities, local derivatives, and elasticities deterministically', () => {
      const evaluateStress = (p: Record<string, number>) => {
        // Stress = 0.25 * inletTemp + 5.0 * pressureRatio + 0.01 * rpm
        return 0.25 * p.inletTemp + 5.0 * p.pressureRatio + 0.01 * p.rpm;
      };

      const sensitivity = EngineeringUncertaintyEngine.analyzeSensitivity(
        { inletTemp: 1450.0, pressureRatio: 28.5, rpm: 12000 },
        0.05,
        evaluateStress
      );

      expect(sensitivity.parameters.length).toBe(3);
      expect(sensitivity.maxElasticity).toBeGreaterThan(0);
      expect(sensitivity.isLocallyStable).toBe(true);

      const tempSens = sensitivity.parameters.find(p => p.parameterName === 'inletTemp');
      expect(tempSens).toBeDefined();
      expect(tempSens?.localDerivative).toBeCloseTo(0.25, 2);
    });
  });

  // =========================================================================
  // 5. THRESHOLD GOVERNANCE: CONFIDENCE != ACCEPTANCE != RELEASE (GATE G08)
  // =========================================================================
  describe('5. Threshold Governance & Authority Invariance', () => {
    it('enforces that high AI confidence never authorizes engineering release or automatic acceptance', () => {
      const assessment = EngineeringUncertaintyEngine.createAssessment({
        evidenceId: evidenceEnvelope.evidenceId,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        contextHash: evidenceEnvelope.provenance.contextHash,
        executionHash: evidenceEnvelope.provenance.executionHash,
        predictionNominal: 380.0,
        confidence: 0.995, // Extremely high AI confidence
        confidenceMethod: 'CONFORMAL_RESIDUAL',
        epistemic: {
          trainingCoverageScore: 0.98,
          modelInadequacyEstimate: 0.01,
          outOfDistributionScore: 0.02,
          missingInformationFactors: [],
          epistemicIndex: 0.03,
          sourceDescription: 'High coverage'
        },
        aleatoric: {
          measurementVariability: 0.01,
          manufacturingToleranceVariance: 0.01,
          operatingConditionVariance: 0.01,
          environmentalVariability: 0.01,
          aleatoricIndex: 0.04,
          sourceDescription: 'Low noise'
        },
        errorEstimate: { metric: 'RMSE', value: 2.1, isEstablished: true },
        calibration: { status: 'CALIBRATED', method: 'CONFORMAL_PREDICTION', referenceDatasetId: 'DATASET-1' }
      });

      const decision = EngineeringUncertaintyEngine.evaluateThresholdGovernance(
        assessment,
        0.90, // Model confidence threshold
        { maxEpistemicIndex: 0.10 } // Engineering acceptance threshold
      );

      expect(decision.modelConfidenceSatisfied).toBe(true);
      expect(decision.engineeringAcceptanceSatisfied).toBe(true);
      expect(decision.engineeringDisposition).toBe('ACCEPTED_FOR_ADVISORY');
      // Crucial Invariant: releaseAuthorized is ALWAYS false
      expect(decision.releaseAuthorized).toBe(false);
    });

    it('rejects engineering acceptance when epistemic index is high despite high model confidence', () => {
      const assessment = EngineeringUncertaintyEngine.createAssessment({
        evidenceId: evidenceEnvelope.evidenceId,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        contextHash: evidenceEnvelope.provenance.contextHash,
        executionHash: evidenceEnvelope.provenance.executionHash,
        predictionNominal: 380.0,
        confidence: 0.96, // High confidence claimed by model
        confidenceMethod: 'HEURISTIC_ESTIMATE',
        epistemic: {
          trainingCoverageScore: 0.30,
          modelInadequacyEstimate: 0.45,
          outOfDistributionScore: 0.60, // Out of distribution!
          missingInformationFactors: ['UNVERIFIED_HIGH_TEMPERATURE_ALLOY'],
          epistemicIndex: 0.65, // Exceeds threshold!
          sourceDescription: 'Extrapolation'
        },
        aleatoric: {
          measurementVariability: 0.05,
          manufacturingToleranceVariance: 0.05,
          operatingConditionVariance: 0.05,
          environmentalVariability: 0.05,
          aleatoricIndex: 0.20,
          sourceDescription: 'Noise'
        },
        errorEstimate: { metric: 'UNCERTAINTY_NOT_ESTABLISHED', isEstablished: false },
        calibration: { status: 'CALIBRATION_UNAVAILABLE' }
      });

      const decision = EngineeringUncertaintyEngine.evaluateThresholdGovernance(
        assessment,
        0.90,
        { maxEpistemicIndex: 0.20 }
      );

      expect(decision.modelConfidenceSatisfied).toBe(true); // AI model says 0.96 >= 0.90
      expect(decision.engineeringAcceptanceSatisfied).toBe(false); // Engineering gate rejects!
      expect(decision.engineeringDisposition).toBe('REJECTED_OUT_OF_DISTRIBUTION');
      expect(decision.releaseAuthorized).toBe(false);
    });
  });

  // =========================================================================
  // 6. EVIDENCE BINDING & GRAPH INTEGRATION (GATE G09, G10)
  // =========================================================================
  describe('6. Evidence Binding & Twin Evidence Graph Integration', () => {
    it('binds uncertainty assessment to M10.4 evidence envelope and updates twin graph root hash', () => {
      const epistemic: EpistemicUncertainty = {
        trainingCoverageScore: 0.9,
        modelInadequacyEstimate: 0.05,
        outOfDistributionScore: 0.05,
        missingInformationFactors: [],
        epistemicIndex: 0.1,
        sourceDescription: 'Traceable'
      };
      const aleatoric: AleatoricUncertainty = {
        measurementVariability: 0.02,
        manufacturingToleranceVariance: 0.02,
        operatingConditionVariance: 0.02,
        environmentalVariability: 0.02,
        aleatoricIndex: 0.08,
        sourceDescription: 'Traceable'
      };

      const assessment = EngineeringUncertaintyEngine.createAssessment({
        evidenceId: evidenceEnvelope.evidenceId,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        contextHash: evidenceEnvelope.provenance.contextHash,
        executionHash: evidenceEnvelope.provenance.executionHash,
        predictionNominal: 400.0,
        confidence: 0.95,
        confidenceMethod: 'CONFORMAL_RESIDUAL',
        epistemic,
        aleatoric,
        errorEstimate: { metric: 'RMSE', value: 3.5, isEstablished: true },
        calibration: { status: 'CALIBRATED', method: 'CONFORMAL_PREDICTION', referenceDatasetId: 'DATASET-1' }
      });

      const initialRoot = evidenceEngine.graph.rootHash;

      // Bind to evidence envelope and register into TwinEvidenceGraph
      EngineeringUncertaintyEngine.bindToEvidenceEnvelope(
        assessment,
        evidenceEnvelope,
        evidenceEngine
      );

      const node = evidenceEngine.graph.nodes.get(evidenceEnvelope.evidenceId);
      expect(node).toBeDefined();
      expect(node?.attributes.uncertaintyAssessment).toBeDefined();
      expect(node?.attributes.confidence).toBe(0.95);
      expect(evidenceEngine.graph.rootHash).not.toBe(initialRoot);
    });

    it('rejects binding when evidenceId or contextHash mismatches', () => {
      const epistemic: EpistemicUncertainty = {
        trainingCoverageScore: 0.9,
        modelInadequacyEstimate: 0.05,
        outOfDistributionScore: 0.05,
        missingInformationFactors: [],
        epistemicIndex: 0.1,
        sourceDescription: 'Test'
      };
      const aleatoric: AleatoricUncertainty = {
        measurementVariability: 0.02,
        manufacturingToleranceVariance: 0.02,
        operatingConditionVariance: 0.02,
        environmentalVariability: 0.02,
        aleatoricIndex: 0.08,
        sourceDescription: 'Test'
      };

      const assessment = EngineeringUncertaintyEngine.createAssessment({
        evidenceId: 'EV-AI-DIFFERENT_EVIDENCE_ID',
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        contextHash: evidenceEnvelope.provenance.contextHash,
        executionHash: evidenceEnvelope.provenance.executionHash,
        predictionNominal: 400.0,
        confidence: 0.95,
        confidenceMethod: 'CONFORMAL_RESIDUAL',
        epistemic,
        aleatoric,
        errorEstimate: { metric: 'RMSE', value: 3.5, isEstablished: true },
        calibration: { status: 'CALIBRATION_UNAVAILABLE' }
      });

      expect(() =>
        EngineeringUncertaintyEngine.bindToEvidenceEnvelope(assessment, evidenceEnvelope)
      ).toThrow(/EVIDENCE_BINDING_MISMATCH.*evidenceId/);
    });
  });

  // =========================================================================
  // 7. PERSISTENCE & REHYDRATION WITHOUT IDENTITY DRIFT (GATE G11)
  // =========================================================================
  describe('7. Persistence & Rehydration Fidelity (Zero Drift)', () => {
    it('serializes and rehydrates UncertaintyAssessment preserving bit-for-bit integrity', () => {
      const assessment = EngineeringUncertaintyEngine.createAssessment({
        evidenceId: evidenceEnvelope.evidenceId,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        contextHash: evidenceEnvelope.provenance.contextHash,
        executionHash: evidenceEnvelope.provenance.executionHash,
        predictionNominal: 450.0,
        confidence: 0.935,
        confidenceMethod: 'CONFORMAL_RESIDUAL',
        interval: {
          lowerBound: 440.0,
          upperBound: 460.0,
          nominalValue: 450.0,
          coverageProbability: 0.95,
          intervalType: 'CONFORMAL',
          unit: 'MPa'
        },
        epistemic: {
          trainingCoverageScore: 0.92,
          modelInadequacyEstimate: 0.04,
          outOfDistributionScore: 0.04,
          missingInformationFactors: [],
          epistemicIndex: 0.08,
          sourceDescription: 'Full coverage'
        },
        aleatoric: {
          measurementVariability: 0.02,
          manufacturingToleranceVariance: 0.02,
          operatingConditionVariance: 0.02,
          environmentalVariability: 0.02,
          aleatoricIndex: 0.08,
          sourceDescription: 'Normal noise'
        },
        errorEstimate: { metric: 'RMSE', value: 4.8, isEstablished: true },
        calibration: { status: 'CALIBRATED', method: 'CONFORMAL_PREDICTION', referenceDatasetId: 'DATASET-1' }
      });

      const serialized = EngineeringUncertaintyEngine.serializeAssessment(assessment);
      const rehydrated = EngineeringUncertaintyEngine.rehydrateAndValidate(
        serialized,
        evidenceEnvelope
      );

      expect(rehydrated.valid).toBe(true);
      expect(rehydrated.assessment.assessmentId).toBe(assessment.assessmentId);
      expect(rehydrated.assessment.assessmentContentHash).toBe(assessment.assessmentContentHash);
      expect(rehydrated.assessment.confidence).toBe(0.935);
      expect(rehydrated.assessment.isCanonicalTruth).toBe(false);
    });

    it('detects tampering when payload is modified during storage', () => {
      const assessment = EngineeringUncertaintyEngine.createAssessment({
        evidenceId: evidenceEnvelope.evidenceId,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        contextHash: evidenceEnvelope.provenance.contextHash,
        executionHash: evidenceEnvelope.provenance.executionHash,
        predictionNominal: 450.0,
        confidence: 0.85,
        confidenceMethod: 'RESIDUAL_CALIBRATED',
        epistemic: {
          trainingCoverageScore: 0.85,
          modelInadequacyEstimate: 0.08,
          outOfDistributionScore: 0.07,
          missingInformationFactors: [],
          epistemicIndex: 0.15,
          sourceDescription: 'Coverage'
        },
        aleatoric: {
          measurementVariability: 0.03,
          manufacturingToleranceVariance: 0.03,
          operatingConditionVariance: 0.03,
          environmentalVariability: 0.03,
          aleatoricIndex: 0.12,
          sourceDescription: 'Noise'
        },
        errorEstimate: { metric: 'RMSE', value: 6.0, isEstablished: true },
        calibration: { status: 'CALIBRATION_UNAVAILABLE' }
      });

      const serialized = EngineeringUncertaintyEngine.serializeAssessment(assessment);
      const parsed = JSON.parse(serialized);

      // Maliciously boost confidence in storage
      parsed.confidence = 0.999;
      const tamperedJson = JSON.stringify(parsed);

      expect(() =>
        EngineeringUncertaintyEngine.rehydrateAndValidate(tamperedJson, evidenceEnvelope)
      ).toThrow(/UNCERTAINTY_REHYDRATION_ERROR.*Content hash tampered/);
    });
  });

  // =========================================================================
  // 8. ADVERSARIAL INTEGRITY MATRIX (GATE G05, G07, G12)
  // =========================================================================
  describe('8. Adversarial Integrity Matrix', () => {
    const validEpistemic: EpistemicUncertainty = {
      trainingCoverageScore: 0.9,
      modelInadequacyEstimate: 0.05,
      outOfDistributionScore: 0.05,
      missingInformationFactors: [],
      epistemicIndex: 0.1,
      sourceDescription: 'Valid'
    };
    const validAleatoric: AleatoricUncertainty = {
      measurementVariability: 0.02,
      manufacturingToleranceVariance: 0.02,
      operatingConditionVariance: 0.02,
      environmentalVariability: 0.02,
      aleatoricIndex: 0.08,
      sourceDescription: 'Valid'
    };
    const validError: ErrorEstimate = { metric: 'RMSE', value: 5.0, isEstablished: true };
    const validCal: CalibrationRecord = { status: 'CALIBRATION_UNAVAILABLE' };

    it('A1: Out-of-bounds confidence (c > 1.0) is BLOCKED', () => {
      expect(() =>
        EngineeringUncertaintyEngine.createAssessment({
          evidenceId: evidenceEnvelope.evidenceId,
          modelId: baseModel.modelId,
          modelVersion: baseModel.version,
          contextHash: evidenceEnvelope.provenance.contextHash,
          executionHash: evidenceEnvelope.provenance.executionHash,
          predictionNominal: 100,
          confidence: 1.5, // FORBIDDEN!
          confidenceMethod: 'HEURISTIC_ESTIMATE',
          epistemic: validEpistemic,
          aleatoric: validAleatoric,
          errorEstimate: validError,
          calibration: validCal
        })
      ).toThrow(/UNCERTAINTY_VALIDATION_ERROR.*INVALID_CONFIDENCE_RANGE/);
    });

    it('A2: Negative confidence (c < 0.0) is BLOCKED', () => {
      expect(() =>
        EngineeringUncertaintyEngine.createAssessment({
          evidenceId: evidenceEnvelope.evidenceId,
          modelId: baseModel.modelId,
          modelVersion: baseModel.version,
          contextHash: evidenceEnvelope.provenance.contextHash,
          executionHash: evidenceEnvelope.provenance.executionHash,
          predictionNominal: 100,
          confidence: -0.1, // FORBIDDEN!
          confidenceMethod: 'HEURISTIC_ESTIMATE',
          epistemic: validEpistemic,
          aleatoric: validAleatoric,
          errorEstimate: validError,
          calibration: validCal
        })
      ).toThrow(/UNCERTAINTY_VALIDATION_ERROR.*INVALID_CONFIDENCE_RANGE/);
    });

    it('A3: Out-of-bounds probability (p > 1.0) is BLOCKED', () => {
      expect(() =>
        EngineeringUncertaintyEngine.createAssessment({
          evidenceId: evidenceEnvelope.evidenceId,
          modelId: baseModel.modelId,
          modelVersion: baseModel.version,
          contextHash: evidenceEnvelope.provenance.contextHash,
          executionHash: evidenceEnvelope.provenance.executionHash,
          predictionNominal: 100,
          confidence: 0.9,
          confidenceMethod: 'PROBABILISTIC_BAYESIAN',
          probability: { value: 2.0, hypothesis: 'FAIL', distributionType: 'BERNOULLI' }, // FORBIDDEN!
          epistemic: validEpistemic,
          aleatoric: validAleatoric,
          errorEstimate: validError,
          calibration: validCal
        })
      ).toThrow(/UNCERTAINTY_VALIDATION_ERROR.*INVALID_PROBABILITY_RANGE/);
    });

    it('A4: Inverted interval (lowerBound > upperBound) is BLOCKED', () => {
      expect(() =>
        EngineeringUncertaintyEngine.createAssessment({
          evidenceId: evidenceEnvelope.evidenceId,
          modelId: baseModel.modelId,
          modelVersion: baseModel.version,
          contextHash: evidenceEnvelope.provenance.contextHash,
          executionHash: evidenceEnvelope.provenance.executionHash,
          predictionNominal: 100,
          confidence: 0.9,
          confidenceMethod: 'CONFORMAL_RESIDUAL',
          interval: {
            lowerBound: 150.0,
            upperBound: 120.0, // Inverted!
            nominalValue: 100.0,
            coverageProbability: 0.95,
            intervalType: 'CONFORMAL',
            unit: 'MPa'
          },
          epistemic: validEpistemic,
          aleatoric: validAleatoric,
          errorEstimate: validError,
          calibration: validCal
        })
      ).toThrow(/UNCERTAINTY_VALIDATION_ERROR.*INVALID_INTERVAL_BOUNDS/);
    });

    it('A5: Negative error estimate value is BLOCKED', () => {
      expect(() =>
        EngineeringUncertaintyEngine.createAssessment({
          evidenceId: evidenceEnvelope.evidenceId,
          modelId: baseModel.modelId,
          modelVersion: baseModel.version,
          contextHash: evidenceEnvelope.provenance.contextHash,
          executionHash: evidenceEnvelope.provenance.executionHash,
          predictionNominal: 100,
          confidence: 0.9,
          confidenceMethod: 'RESIDUAL_CALIBRATED',
          epistemic: validEpistemic,
          aleatoric: validAleatoric,
          errorEstimate: { metric: 'RMSE', value: -4.5, isEstablished: true }, // FORBIDDEN!
          calibration: validCal
        })
      ).toThrow(/UNCERTAINTY_VALIDATION_ERROR.*NEGATIVE_ERROR_ESTIMATE/);
    });

    it('A6: Fabricated CALIBRATED status without reference dataset is BLOCKED', () => {
      expect(() =>
        EngineeringUncertaintyEngine.createAssessment({
          evidenceId: evidenceEnvelope.evidenceId,
          modelId: baseModel.modelId,
          modelVersion: baseModel.version,
          contextHash: evidenceEnvelope.provenance.contextHash,
          executionHash: evidenceEnvelope.provenance.executionHash,
          predictionNominal: 100,
          confidence: 0.9,
          confidenceMethod: 'RESIDUAL_CALIBRATED',
          epistemic: validEpistemic,
          aleatoric: validAleatoric,
          errorEstimate: validError,
          calibration: {
            status: 'CALIBRATED',
            method: 'NONE', // Missing method & dataset!
            expectedCalibrationError: 0.05
          }
        })
      ).toThrow(/UNCERTAINTY_VALIDATION_ERROR.*FABRICATED_CALIBRATION/);
    });

    it('A7: Active calibration method claimed under UNCALIBRATED status is BLOCKED', () => {
      expect(() =>
        EngineeringUncertaintyEngine.createAssessment({
          evidenceId: evidenceEnvelope.evidenceId,
          modelId: baseModel.modelId,
          modelVersion: baseModel.version,
          contextHash: evidenceEnvelope.provenance.contextHash,
          executionHash: evidenceEnvelope.provenance.executionHash,
          predictionNominal: 100,
          confidence: 0.9,
          confidenceMethod: 'RESIDUAL_CALIBRATED',
          epistemic: validEpistemic,
          aleatoric: validAleatoric,
          errorEstimate: validError,
          calibration: {
            status: 'UNCALIBRATED',
            method: 'PLATT_SCALING' // Contradictory / fabricated method!
          }
        })
      ).toThrow(/UNCERTAINTY_VALIDATION_ERROR.*FABRICATED_CALIBRATION/);
    });

    it('A8: Canonical truth claim attempt (isCanonicalTruth = true) is BLOCKED', () => {
      const raw: any = {
        evidenceId: evidenceEnvelope.evidenceId,
        modelId: baseModel.modelId,
        modelVersion: baseModel.version,
        contextHash: evidenceEnvelope.provenance.contextHash,
        executionHash: evidenceEnvelope.provenance.executionHash,
        predictionNominal: 100,
        confidence: 0.95,
        confidenceMethod: 'CONFORMAL_RESIDUAL',
        epistemic: validEpistemic,
        aleatoric: validAleatoric,
        errorEstimate: validError,
        calibration: validCal,
        isCanonicalTruth: true // FORBIDDEN!
      };

      const val = EngineeringUncertaintyEngine.validateAssessment(raw);
      expect(val.valid).toBe(false);
      expect(val.errors.some(e => e.code === 'AUTHORITY_ESCALATION_ATTEMPT')).toBe(true);
    });
  });
});
