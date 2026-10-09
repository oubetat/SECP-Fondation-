import {
  UncertaintyAssessment,
  UncertaintyValidationResult,
  UncertaintyValidationError,
  EpistemicUncertainty,
  AleatoricUncertainty,
  ConfidenceInterval,
  ErrorEstimate,
  SensitivityProfile,
  ParameterSensitivity,
  CalibrationRecord,
  ProbabilityAssessment,
  ConfidenceMethod,
  ThresholdGovernanceDecision,
  EngineeringDisposition
} from './types';
import { IndependentVerificationSerializer } from '../verification/IndependentVerificationSerializer';
import { AIEvidenceEnvelope } from '../evidence/EngineeringAIEvidenceBinder';
import { TwinEvidenceGraphEngine } from '../../twin_evidence/TwinEvidenceGraphEngine';
import { EvidenceCanonicalizer } from '../../twin_evidence/EvidenceCanonicalizer';

export interface CreateAssessmentParams {
  readonly evidenceId: string;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly contextHash: string;
  readonly executionHash: string;
  readonly canonicalRevisionHash?: string;
  readonly predictionNominal: number | Readonly<Record<string, any>>;
  readonly confidence: number;
  readonly confidenceMethod: ConfidenceMethod;
  readonly probability?: ProbabilityAssessment;
  readonly epistemic: EpistemicUncertainty;
  readonly aleatoric: AleatoricUncertainty;
  readonly interval?: ConfidenceInterval;
  readonly errorEstimate: ErrorEstimate;
  readonly sensitivity?: SensitivityProfile;
  readonly calibration: CalibrationRecord;
  readonly assumptions?: readonly string[];
  readonly limitations?: readonly string[];
  readonly createdAt?: string;
}

export interface RehydratedUncertaintyResult {
  readonly valid: boolean;
  readonly assessment: UncertaintyAssessment;
  readonly recomputedContentHash: string;
  readonly details: string;
}

/**
 * EngineeringUncertaintyEngine (M10.5)
 * 
 * Formal Uncertainty & Confidence Engineering Engine.
 * 
 * Invariants:
 * 1. Confidence is NOT Truth (Confidence != Verification != Acceptance != Release).
 * 2. Strict mathematical bounds: confidence in [0, 1], lower <= upper, errors >= 0.
 * 3. Epistemic and Aleatoric uncertainties are preserved distinctly and never collapsed.
 * 4. Explicit uncalibrated states (no fabricated calibration or zero-error claims).
 * 5. Full determinism and bidirectional binding to M10.4 AIEvidenceEnvelope.
 */
export class EngineeringUncertaintyEngine {
  public static readonly SCHEMA_VERSION = '1.0.0-M10.5';

  /**
   * Deterministically derives the uncertainty assessment identity.
   */
  public static computeAssessmentId(
    evidenceId: string,
    modelId: string,
    contextHash: string,
    executionHash: string,
    confidence: number
  ): string {
    const raw = `SECP_UNCERTAINTY_ASSESSMENT|${evidenceId}|${modelId}|${contextHash}|${executionHash}|${confidence.toFixed(6)}`;
    return `UNCERT-AI-${IndependentVerificationSerializer.hash(raw).substring(0, 24)}`;
  }

  /**
   * Performs rigorous mathematical, structural, and semantic validation on an UncertaintyAssessment.
   */
  public static validateAssessment(assessment: Partial<UncertaintyAssessment>): UncertaintyValidationResult {
    const errors: UncertaintyValidationError[] = [];

    // 1. Mandatory Fields
    if (!assessment.evidenceId) {
      errors.push({ code: 'MISSING_REQUIRED_FIELD', message: 'evidenceId is required.', path: 'evidenceId' });
    }
    if (!assessment.modelId) {
      errors.push({ code: 'MISSING_REQUIRED_FIELD', message: 'modelId is required.', path: 'modelId' });
    }
    if (!assessment.contextHash) {
      errors.push({ code: 'MISSING_REQUIRED_FIELD', message: 'contextHash is required.', path: 'contextHash' });
    }
    if (!assessment.executionHash) {
      errors.push({ code: 'MISSING_REQUIRED_FIELD', message: 'executionHash is required.', path: 'executionHash' });
    }

    // 2. Confidence Validation [0.0, 1.0]
    if (assessment.confidence === undefined || typeof assessment.confidence !== 'number' || isNaN(assessment.confidence)) {
      errors.push({ code: 'INVALID_CONFIDENCE_RANGE', message: 'Confidence must be a valid number.', path: 'confidence' });
    } else if (assessment.confidence < 0.0 || assessment.confidence > 1.0) {
      errors.push({
        code: 'INVALID_CONFIDENCE_RANGE',
        message: `Confidence must be in range [0.0, 1.0], received ${assessment.confidence}`,
        path: 'confidence'
      });
    }

    // 3. Probability Validation [0.0, 1.0] if present
    if (assessment.probability) {
      if (typeof assessment.probability.value !== 'number' || isNaN(assessment.probability.value)) {
        errors.push({ code: 'INVALID_PROBABILITY_RANGE', message: 'Probability value must be a valid number.', path: 'probability.value' });
      } else if (assessment.probability.value < 0.0 || assessment.probability.value > 1.0) {
        errors.push({
          code: 'INVALID_PROBABILITY_RANGE',
          message: `Probability value must be in range [0.0, 1.0], received ${assessment.probability.value}`,
          path: 'probability.value'
        });
      }
    }

    // 4. Interval Validation: lowerBound <= upperBound, coverage in (0, 1)
    if (assessment.interval) {
      const { lowerBound, upperBound, coverageProbability } = assessment.interval;
      if (typeof lowerBound !== 'number' || typeof upperBound !== 'number') {
        errors.push({ code: 'INVALID_INTERVAL_BOUNDS', message: 'Interval bounds must be numerical.', path: 'interval' });
      } else if (lowerBound > upperBound) {
        errors.push({
          code: 'INVALID_INTERVAL_BOUNDS',
          message: `Interval lowerBound (${lowerBound}) cannot exceed upperBound (${upperBound}).`,
          path: 'interval.bounds'
        });
      }

      if (typeof coverageProbability !== 'number' || coverageProbability <= 0.0 || coverageProbability >= 1.0) {
        errors.push({
          code: 'INVALID_INTERVAL_BOUNDS',
          message: `Coverage probability must be in open interval (0.0, 1.0), received ${coverageProbability}`,
          path: 'interval.coverageProbability'
        });
      }
    }

    // 5. Error Estimate: Non-negative if established, explicit if not established
    if (assessment.errorEstimate) {
      const { metric, value, isEstablished } = assessment.errorEstimate;
      if (metric === 'UNCERTAINTY_NOT_ESTABLISHED') {
        if (isEstablished) {
          errors.push({
            code: 'NEGATIVE_ERROR_ESTIMATE',
            message: 'Error estimate marked as UNCERTAINTY_NOT_ESTABLISHED cannot have isEstablished=true.',
            path: 'errorEstimate'
          });
        }
      } else if (isEstablished) {
        if (typeof value !== 'number' || isNaN(value) || value < 0.0) {
          errors.push({
            code: 'NEGATIVE_ERROR_ESTIMATE',
            message: `Error estimate value must be a non-negative number, received ${value}`,
            path: 'errorEstimate.value'
          });
        }
      }
    } else {
      errors.push({ code: 'MISSING_REQUIRED_FIELD', message: 'errorEstimate is required.', path: 'errorEstimate' });
    }

    // 6. Epistemic Uncertainty Validation
    if (assessment.epistemic) {
      const { trainingCoverageScore, modelInadequacyEstimate, outOfDistributionScore, epistemicIndex } = assessment.epistemic;
      if (trainingCoverageScore < 0.0 || trainingCoverageScore > 1.0) {
        errors.push({ code: 'INVALID_CONFIDENCE_RANGE', message: 'trainingCoverageScore must be in [0, 1]', path: 'epistemic.trainingCoverageScore' });
      }
      if (outOfDistributionScore < 0.0 || outOfDistributionScore > 1.0) {
        errors.push({ code: 'INVALID_CONFIDENCE_RANGE', message: 'outOfDistributionScore must be in [0, 1]', path: 'epistemic.outOfDistributionScore' });
      }
      if (epistemicIndex < 0.0 || epistemicIndex > 1.0) {
        errors.push({ code: 'INVALID_CONFIDENCE_RANGE', message: 'epistemicIndex must be in [0, 1]', path: 'epistemic.epistemicIndex' });
      }
      if (modelInadequacyEstimate < 0.0) {
        errors.push({ code: 'NEGATIVE_ERROR_ESTIMATE', message: 'modelInadequacyEstimate cannot be negative', path: 'epistemic.modelInadequacyEstimate' });
      }
    } else {
      errors.push({ code: 'MISSING_REQUIRED_FIELD', message: 'epistemic uncertainty is required.', path: 'epistemic' });
    }

    // 7. Aleatoric Uncertainty Validation
    if (assessment.aleatoric) {
      const { measurementVariability, manufacturingToleranceVariance, operatingConditionVariance, environmentalVariability, aleatoricIndex } = assessment.aleatoric;
      if (measurementVariability < 0.0 || manufacturingToleranceVariance < 0.0 || operatingConditionVariance < 0.0 || environmentalVariability < 0.0 || aleatoricIndex < 0.0) {
        errors.push({ code: 'NEGATIVE_VARIABILITY', message: 'Aleatoric variances cannot be negative', path: 'aleatoric' });
      }
    } else {
      errors.push({ code: 'MISSING_REQUIRED_FIELD', message: 'aleatoric uncertainty is required.', path: 'aleatoric' });
    }

    // 8. Calibration Validation: Prevent fabricated calibration
    if (assessment.calibration) {
      const { status, method, referenceDatasetId, expectedCalibrationError } = assessment.calibration;
      if (status === 'CALIBRATED') {
        if (!method || method === 'NONE') {
          errors.push({ code: 'FABRICATED_CALIBRATION', message: 'CALIBRATED status requires an explicit calibration method.', path: 'calibration.method' });
        }
        if (!referenceDatasetId) {
          errors.push({ code: 'FABRICATED_CALIBRATION', message: 'CALIBRATED status requires referenceDatasetId.', path: 'calibration.referenceDatasetId' });
        }
        if (expectedCalibrationError !== undefined && (expectedCalibrationError < 0.0 || expectedCalibrationError > 1.0)) {
          errors.push({ code: 'FABRICATED_CALIBRATION', message: 'expectedCalibrationError must be in [0, 1].', path: 'calibration.expectedCalibrationError' });
        }
      } else if (status === 'CALIBRATION_UNAVAILABLE' || status === 'UNCALIBRATED') {
        if (method && method !== 'NONE') {
          errors.push({ code: 'FABRICATED_CALIBRATION', message: `Cannot specify active calibration method '${method}' when calibration status is ${status}.`, path: 'calibration' });
        }
      }
    } else {
      errors.push({ code: 'MISSING_REQUIRED_FIELD', message: 'calibration record is required.', path: 'calibration' });
    }

    // 9. Authority Invariant: isCanonicalTruth must be strictly false
    if (assessment.isCanonicalTruth !== false) {
      errors.push({
        code: 'AUTHORITY_ESCALATION_ATTEMPT',
        message: 'UncertaintyAssessment must have isCanonicalTruth strictly set to false.',
        path: 'isCanonicalTruth'
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Creates a certified, deterministic UncertaintyAssessment object.
   */
  public static createAssessment(params: CreateAssessmentParams): UncertaintyAssessment {
    const rawAssessment: Partial<UncertaintyAssessment> = {
      evidenceId: params.evidenceId,
      modelId: params.modelId,
      modelVersion: params.modelVersion,
      contextHash: params.contextHash,
      executionHash: params.executionHash,
      canonicalRevisionHash: params.canonicalRevisionHash,
      predictionNominal: params.predictionNominal,
      confidence: params.confidence,
      confidenceMethod: params.confidenceMethod,
      probability: params.probability,
      epistemic: params.epistemic,
      aleatoric: params.aleatoric,
      interval: params.interval,
      errorEstimate: params.errorEstimate,
      sensitivity: params.sensitivity,
      calibration: params.calibration,
      assumptions: params.assumptions || [],
      limitations: params.limitations || [],
      createdAt: params.createdAt || new Date().toISOString(),
      isCanonicalTruth: false
    };

    // Validate
    const validation = this.validateAssessment(rawAssessment);
    if (!validation.valid) {
      throw new Error(`UNCERTAINTY_VALIDATION_ERROR: ${validation.errors.map(e => `[${e.code}] ${e.message}`).join('; ')}`);
    }

    // Derive deterministic assessment ID
    const assessmentId = this.computeAssessmentId(
      params.evidenceId,
      params.modelId,
      params.contextHash,
      params.executionHash,
      params.confidence
    );

    // Compute canonical content hash
    const contentPayload = {
      assessmentId,
      evidenceId: params.evidenceId,
      modelId: params.modelId,
      modelVersion: params.modelVersion,
      contextHash: params.contextHash,
      executionHash: params.executionHash,
      canonicalRevisionHash: params.canonicalRevisionHash,
      predictionNominal: params.predictionNominal,
      confidence: params.confidence,
      confidenceMethod: params.confidenceMethod,
      probability: params.probability,
      epistemic: params.epistemic,
      aleatoric: params.aleatoric,
      interval: params.interval,
      errorEstimate: params.errorEstimate,
      sensitivity: params.sensitivity,
      calibration: params.calibration,
      assumptions: params.assumptions || [],
      limitations: params.limitations || [],
      createdAt: rawAssessment.createdAt,
      isCanonicalTruth: false
    };

    const assessmentContentHash = IndependentVerificationSerializer.hash(
      IndependentVerificationSerializer.canonicalJson(contentPayload)
    );

    const assessment: UncertaintyAssessment = {
      assessmentId,
      schemaVersion: this.SCHEMA_VERSION,
      evidenceId: params.evidenceId,
      modelId: params.modelId,
      modelVersion: params.modelVersion,
      contextHash: params.contextHash,
      executionHash: params.executionHash,
      canonicalRevisionHash: params.canonicalRevisionHash,
      predictionNominal: params.predictionNominal,
      confidence: params.confidence,
      confidenceMethod: params.confidenceMethod,
      probability: params.probability,
      epistemic: Object.freeze({ ...params.epistemic }),
      aleatoric: Object.freeze({ ...params.aleatoric }),
      interval: params.interval ? Object.freeze({ ...params.interval }) : undefined,
      errorEstimate: Object.freeze({ ...params.errorEstimate }),
      sensitivity: params.sensitivity ? Object.freeze({ ...params.sensitivity }) : undefined,
      calibration: Object.freeze({ ...params.calibration }),
      assumptions: Object.freeze([...(params.assumptions || [])]),
      limitations: Object.freeze([...(params.limitations || [])]),
      assessmentContentHash,
      createdAt: rawAssessment.createdAt!,
      isCanonicalTruth: false
    };

    return Object.freeze(assessment);
  }

  /**
   * Conducts deterministic local sensitivity analysis across input parameters.
   */
  public static analyzeSensitivity(
    nominalInputs: Record<string, number>,
    perturbationPercent: number = 0.05,
    evaluateFn: (inputs: Record<string, number>) => number
  ): SensitivityProfile {
    const nominalOutput = evaluateFn(nominalInputs);
    const parameters: ParameterSensitivity[] = [];

    for (const [paramName, nominalVal] of Object.entries(nominalInputs)) {
      const delta = nominalVal !== 0 ? nominalVal * perturbationPercent : perturbationPercent;
      const perturbedVal = nominalVal + delta;
      const perturbedInputs = { ...nominalInputs, [paramName]: perturbedVal };
      const outputPerturbed = evaluateFn(perturbedInputs);

      const deltaOutput = outputPerturbed - nominalOutput;
      const deltaInput = perturbedVal - nominalVal;

      const localDerivative = deltaInput !== 0 ? deltaOutput / deltaInput : 0;
      const pctChangeOutput = nominalOutput !== 0 ? (deltaOutput / nominalOutput) * 100 : deltaOutput * 100;
      const pctChangeInput = perturbationPercent * 100;
      const elasticity = pctChangeInput !== 0 ? Math.abs(pctChangeOutput / pctChangeInput) : 0;

      let classification: ParameterSensitivity['classification'] = 'INSENSITIVE';
      if (elasticity > 1.5) {
        classification = 'CRITICAL_HIGH_SENSITIVITY';
      } else if (elasticity > 0.5) {
        classification = 'MODERATE';
      }

      parameters.push({
        parameterName: paramName,
        nominalValue: nominalVal,
        perturbationPercent,
        perturbedValue: perturbedVal,
        outputNominal: nominalOutput,
        outputPerturbed,
        localDerivative: parseFloat(localDerivative.toFixed(6)),
        elasticity: parseFloat(elasticity.toFixed(4)),
        classification
      });
    }

    const maxElasticity = parameters.length > 0 ? Math.max(...parameters.map(p => p.elasticity)) : 0;
    const dominant = parameters.reduce((prev, curr) => (curr.elasticity > prev.elasticity ? curr : prev), parameters[0]);

    return {
      parameters,
      maxElasticity,
      dominantParameter: dominant ? dominant.parameterName : 'NONE',
      isLocallyStable: maxElasticity < 2.0
    };
  }

  /**
   * Enforces Threshold Governance:
   * Separates Model Confidence Threshold from Engineering Acceptance Threshold and Release Authorization.
   */
  public static evaluateThresholdGovernance(
    assessment: UncertaintyAssessment,
    modelConfidenceThreshold: number,
    engineeringThresholdRules: {
      maxEpistemicIndex?: number;
      maxAleatoricIndex?: number;
      maxIntervalWidthRatio?: number; // (upper - lower) / nominal
      requireCalibration?: boolean;
    } = {}
  ): ThresholdGovernanceDecision {
    const modelConfidenceSatisfied = assessment.confidence >= modelConfidenceThreshold;
    let engineeringAcceptanceSatisfied = true;
    const reasons: string[] = [];

    // 1. Model Confidence Check
    if (!modelConfidenceSatisfied) {
      reasons.push(`Model confidence (${assessment.confidence.toFixed(3)}) is below required threshold (${modelConfidenceThreshold.toFixed(3)}).`);
    }

    // 2. Epistemic Uncertainty Check
    const maxEpistemic = engineeringThresholdRules.maxEpistemicIndex ?? 0.35;
    if (assessment.epistemic.epistemicIndex > maxEpistemic) {
      engineeringAcceptanceSatisfied = false;
      reasons.push(`Epistemic uncertainty index (${assessment.epistemic.epistemicIndex.toFixed(3)}) exceeds engineering threshold (${maxEpistemic}).`);
    }

    // 3. Out-Of-Distribution Check
    if (assessment.epistemic.outOfDistributionScore > 0.5) {
      engineeringAcceptanceSatisfied = false;
      reasons.push(`Input is severely out-of-distribution (OOD score: ${assessment.epistemic.outOfDistributionScore.toFixed(3)}).`);
    }

    // 4. Interval Width Check
    if (assessment.interval && engineeringThresholdRules.maxIntervalWidthRatio && typeof assessment.predictionNominal === 'number') {
      const width = assessment.interval.upperBound - assessment.interval.lowerBound;
      const ratio = Math.abs(width / assessment.predictionNominal);
      if (ratio > engineeringThresholdRules.maxIntervalWidthRatio) {
        engineeringAcceptanceSatisfied = false;
        reasons.push(`Confidence interval relative width (${ratio.toFixed(3)}) exceeds allowed ratio (${engineeringThresholdRules.maxIntervalWidthRatio}).`);
      }
    }

    // 5. Calibration Requirement Check
    if (engineeringThresholdRules.requireCalibration && assessment.calibration.status !== 'CALIBRATED') {
      engineeringAcceptanceSatisfied = false;
      reasons.push(`Model calibration status '${assessment.calibration.status}' does not satisfy strict CALIBRATED requirement.`);
    }

    // Determine Engineering Disposition
    let engineeringDisposition: EngineeringDisposition = 'ACCEPTED_FOR_ADVISORY';
    if (assessment.epistemic.outOfDistributionScore > 0.5) {
      engineeringDisposition = 'REJECTED_OUT_OF_DISTRIBUTION';
    } else if (!engineeringAcceptanceSatisfied) {
      engineeringDisposition = assessment.epistemic.epistemicIndex > 0.6
        ? 'REQUIRES_PHYSICAL_SIMULATION'
        : 'FLAGGED_EXCESSIVE_UNCERTAINTY';
    }

    return {
      modelConfidence: assessment.confidence,
      modelConfidenceThreshold,
      modelConfidenceSatisfied,
      engineeringAcceptanceThreshold: maxEpistemic,
      engineeringAcceptanceSatisfied,
      engineeringDisposition,
      releaseAuthorized: false, // Invariant: AI never authorizes release
      rationale: reasons.length > 0 ? reasons.join(' ') : 'Assessment satisfies model confidence and engineering acceptance rules for advisory use.'
    };
  }

  /**
   * Binds the UncertaintyAssessment to an M10.4 AIEvidenceEnvelope and optionally updates TwinEvidenceGraph.
   */
  public static bindToEvidenceEnvelope(
    assessment: UncertaintyAssessment,
    envelope: AIEvidenceEnvelope,
    evidenceEngine?: TwinEvidenceGraphEngine
  ): void {
    if (assessment.evidenceId !== envelope.evidenceId) {
      throw new Error(`EVIDENCE_BINDING_MISMATCH: Assessment evidenceId '${assessment.evidenceId}' does not match Envelope evidenceId '${envelope.evidenceId}'`);
    }

    if (assessment.contextHash !== envelope.provenance.contextHash) {
      throw new Error(`EVIDENCE_BINDING_MISMATCH: Assessment contextHash '${assessment.contextHash}' does not match Envelope contextHash '${envelope.provenance.contextHash}'`);
    }

    if (assessment.modelId !== envelope.subject.modelId) {
      throw new Error(`EVIDENCE_BINDING_MISMATCH: Assessment modelId '${assessment.modelId}' does not match Envelope modelId '${envelope.subject.modelId}'`);
    }

    // If TwinEvidenceGraphEngine is provided, register/update the node
    if (evidenceEngine) {
      let node = evidenceEngine.graph.nodes.get(envelope.evidenceId);
      if (node) {
        node.attributes = {
          ...node.attributes,
          uncertaintyAssessment: assessment,
          uncertaintyContentHash: assessment.assessmentContentHash,
          confidence: assessment.confidence,
          epistemicIndex: assessment.epistemic.epistemicIndex,
          aleatoricIndex: assessment.aleatoric.aleatoricIndex
        };
        node.contentHash = EvidenceCanonicalizer.computeNodeHash(node);
        evidenceEngine.updateRootHash();
      }
    }
  }

  /**
   * Serializes an UncertaintyAssessment to canonical JSON for storage.
   */
  public static serializeAssessment(assessment: UncertaintyAssessment): string {
    return IndependentVerificationSerializer.canonicalJson(assessment);
  }

  /**
   * Rehydrates and strictly validates an UncertaintyAssessment from persistent storage.
   */
  public static rehydrateAndValidate(
    serializedJson: string,
    expectedEnvelope?: AIEvidenceEnvelope
  ): RehydratedUncertaintyResult {
    let parsed: any;
    try {
      parsed = JSON.parse(serializedJson);
    } catch (e: any) {
      throw new Error(`UNCERTAINTY_REHYDRATION_ERROR: Malformed JSON payload (${e.message})`);
    }

    // 1. Validate structural rules
    const validation = this.validateAssessment(parsed);
    if (!validation.valid) {
      throw new Error(`UNCERTAINTY_REHYDRATION_ERROR: ${validation.errors.map(e => `[${e.code}] ${e.message}`).join('; ')}`);
    }

    // 2. Recompute Content Hash to detect tampering
    const contentPayload = {
      assessmentId: parsed.assessmentId,
      evidenceId: parsed.evidenceId,
      modelId: parsed.modelId,
      modelVersion: parsed.modelVersion,
      contextHash: parsed.contextHash,
      executionHash: parsed.executionHash,
      canonicalRevisionHash: parsed.canonicalRevisionHash,
      predictionNominal: parsed.predictionNominal,
      confidence: parsed.confidence,
      confidenceMethod: parsed.confidenceMethod,
      probability: parsed.probability,
      epistemic: parsed.epistemic,
      aleatoric: parsed.aleatoric,
      interval: parsed.interval,
      errorEstimate: parsed.errorEstimate,
      sensitivity: parsed.sensitivity,
      calibration: parsed.calibration,
      assumptions: parsed.assumptions || [],
      limitations: parsed.limitations || [],
      createdAt: parsed.createdAt,
      isCanonicalTruth: false
    };

    const recomputedHash = IndependentVerificationSerializer.hash(
      IndependentVerificationSerializer.canonicalJson(contentPayload)
    );

    if (recomputedHash !== parsed.assessmentContentHash) {
      throw new Error(`UNCERTAINTY_REHYDRATION_ERROR: Content hash tampered: expected ${parsed.assessmentContentHash}, computed ${recomputedHash}`);
    }

    // 3. Recompute Assessment ID
    const recomputedId = this.computeAssessmentId(
      parsed.evidenceId,
      parsed.modelId,
      parsed.contextHash,
      parsed.executionHash,
      parsed.confidence
    );

    if (recomputedId !== parsed.assessmentId) {
      throw new Error(`UNCERTAINTY_REHYDRATION_ERROR: Assessment ID tampered: expected ${parsed.assessmentId}, computed ${recomputedId}`);
    }

    // 4. If expected envelope provided, verify cross-binding
    if (expectedEnvelope) {
      if (parsed.evidenceId !== expectedEnvelope.evidenceId) {
        throw new Error(`UNCERTAINTY_REHYDRATION_ERROR: Envelope evidenceId mismatch (${parsed.evidenceId} vs ${expectedEnvelope.evidenceId})`);
      }
      if (parsed.contextHash !== expectedEnvelope.provenance.contextHash) {
        throw new Error(`UNCERTAINTY_REHYDRATION_ERROR: Envelope contextHash mismatch (${parsed.contextHash} vs ${expectedEnvelope.provenance.contextHash})`);
      }
    }

    return {
      valid: true,
      assessment: Object.freeze(parsed as UncertaintyAssessment),
      recomputedContentHash: recomputedHash,
      details: 'UNCERTAINTY_REHYDRATION_VERIFIED'
    };
  }
}
