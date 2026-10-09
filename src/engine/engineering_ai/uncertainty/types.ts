/**
 * SECP Industrial OS — M10.5: Uncertainty & Confidence Engineering Types
 * 
 * Formal representation of uncertainty, confidence, error intervals, sensitivity,
 * epistemic vs aleatoric decomposition, and threshold governance for Engineering AI.
 * 
 * Governing Invariants:
 * 1. Confidence != Verification != Acceptance != Canonical Truth != Release Authorization.
 * 2. Strict mathematical validation (bounds, ordering, non-negativity).
 * 3. Separation of Epistemic (knowledge deficit) and Aleatoric (system randomness) uncertainty.
 * 4. Explicit uncalibrated states (no fabricated calibration or zero error).
 * 5. Full determinism and bidirectional binding to M10.4 AIEvidenceEnvelope.
 */

export type ConfidenceMethod =
  | 'ENSEMBLE_VARIANCE'
  | 'CONFORMAL_RESIDUAL'
  | 'PROBABILISTIC_BAYESIAN'
  | 'RESIDUAL_CALIBRATED'
  | 'HEURISTIC_ESTIMATE';

export type IntervalType =
  | 'SYMMETRIC'
  | 'ASYMMETRIC'
  | 'ONE_SIDED_LOWER'
  | 'ONE_SIDED_UPPER'
  | 'CONFORMAL';

export type ErrorMetricType =
  | 'RMSE'
  | 'MAE'
  | 'STD_DEV'
  | 'MAX_ABS_ERROR'
  | 'RELATIVE_ERROR_PCT'
  | 'UNCERTAINTY_NOT_ESTABLISHED';

export type SensitivityClassification =
  | 'INSENSITIVE'
  | 'MODERATE'
  | 'CRITICAL_HIGH_SENSITIVITY';

export type CalibrationStatus =
  | 'CALIBRATED'
  | 'UNCALIBRATED'
  | 'CALIBRATION_UNAVAILABLE'
  | 'CALIBRATION_EXPIRED';

export type CalibrationMethod =
  | 'PLATT_SCALING'
  | 'ISOTONIC_REGRESSION'
  | 'CONFORMAL_PREDICTION'
  | 'TEMPERATURE_SCALING'
  | 'NONE';

export type EngineeringDisposition =
  | 'ACCEPTED_FOR_ADVISORY'
  | 'FLAGGED_EXCESSIVE_UNCERTAINTY'
  | 'REJECTED_OUT_OF_DISTRIBUTION'
  | 'REQUIRES_PHYSICAL_SIMULATION';

export interface EpistemicUncertainty {
  readonly trainingCoverageScore: number; // [0, 1]
  readonly modelInadequacyEstimate: number; // >= 0
  readonly outOfDistributionScore: number; // [0, 1]
  readonly missingInformationFactors: readonly string[];
  readonly epistemicIndex: number; // [0, 1] composite knowledge deficit
  readonly sourceDescription: string;
}

export interface AleatoricUncertainty {
  readonly measurementVariability: number; // >= 0
  readonly manufacturingToleranceVariance: number; // >= 0
  readonly operatingConditionVariance: number; // >= 0
  readonly environmentalVariability: number; // >= 0
  readonly aleatoricIndex: number; // >= 0 composite stochastic variance
  readonly sourceDescription: string;
}

export interface ConfidenceInterval {
  readonly lowerBound: number;
  readonly upperBound: number;
  readonly nominalValue: number;
  readonly coverageProbability: number; // (0, 1), e.g. 0.95
  readonly intervalType: IntervalType;
  readonly unit: string;
}

export interface ErrorEstimate {
  readonly metric: ErrorMetricType;
  readonly value?: number; // >= 0 when established
  readonly unit?: string;
  readonly evaluatedAgainstDatasetId?: string;
  readonly isEstablished: boolean;
}

export interface ParameterSensitivity {
  readonly parameterName: string;
  readonly nominalValue: number;
  readonly perturbationPercent: number;
  readonly perturbedValue: number;
  readonly outputNominal: number;
  readonly outputPerturbed: number;
  readonly localDerivative: number; // (outputPerturbed - outputNominal) / (perturbedValue - nominalValue)
  readonly elasticity: number; // (% delta output) / (% delta input)
  readonly classification: SensitivityClassification;
}

export interface SensitivityProfile {
  readonly parameters: readonly ParameterSensitivity[];
  readonly maxElasticity: number;
  readonly dominantParameter: string;
  readonly isLocallyStable: boolean;
}

export interface CalibrationRecord {
  readonly status: CalibrationStatus;
  readonly method?: CalibrationMethod;
  readonly referenceDatasetId?: string;
  readonly expectedCalibrationError?: number; // ECE in [0, 1]
  readonly brierScore?: number;
  readonly calibratedAt?: string;
  readonly notes?: string;
}

export interface ProbabilityAssessment {
  readonly value: number; // [0, 1]
  readonly hypothesis: string;
  readonly distributionType: 'NORMAL' | 'BERNOULLI' | 'UNIFORM' | 'LOG_NORMAL' | 'EMPIRICAL';
}

/**
 * The Canonical Uncertainty Assessment object (M10.5).
 */
export interface UncertaintyAssessment {
  readonly assessmentId: string;
  readonly schemaVersion: '1.0.0-M10.5';
  readonly evidenceId: string;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly contextHash: string;
  readonly executionHash: string;
  readonly canonicalRevisionHash?: string;
  readonly predictionNominal: number | Readonly<Record<string, any>>;
  readonly confidence: number; // [0.0, 1.0]
  readonly confidenceMethod: ConfidenceMethod;
  readonly probability?: ProbabilityAssessment;
  readonly epistemic: EpistemicUncertainty;
  readonly aleatoric: AleatoricUncertainty;
  readonly interval?: ConfidenceInterval;
  readonly errorEstimate: ErrorEstimate;
  readonly sensitivity?: SensitivityProfile;
  readonly calibration: CalibrationRecord;
  readonly assumptions: readonly string[];
  readonly limitations: readonly string[];
  readonly assessmentContentHash: string;
  readonly createdAt: string;
  readonly isCanonicalTruth: false; // Invariant: Uncertainty is never canonical truth
}

export interface ThresholdGovernanceDecision {
  readonly modelConfidence: number;
  readonly modelConfidenceThreshold: number;
  readonly modelConfidenceSatisfied: boolean;
  readonly engineeringAcceptanceThreshold: number;
  readonly engineeringAcceptanceSatisfied: boolean;
  readonly engineeringDisposition: EngineeringDisposition;
  readonly releaseAuthorized: false; // Invariant: AI never authorizes release
  readonly rationale: string;
}

export interface UncertaintyValidationError {
  readonly code:
    | 'INVALID_CONFIDENCE_RANGE'
    | 'INVALID_PROBABILITY_RANGE'
    | 'INVALID_INTERVAL_BOUNDS'
    | 'NEGATIVE_ERROR_ESTIMATE'
    | 'NEGATIVE_VARIABILITY'
    | 'FABRICATED_CALIBRATION'
    | 'EVIDENCE_ID_MISMATCH'
    | 'CONTEXT_HASH_MISMATCH'
    | 'AUTHORITY_ESCALATION_ATTEMPT'
    | 'MISSING_REQUIRED_FIELD';
  readonly message: string;
  readonly path?: string;
}

export interface UncertaintyValidationResult {
  readonly valid: boolean;
  readonly errors: readonly UncertaintyValidationError[];
}
