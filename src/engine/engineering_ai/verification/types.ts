import {
  EngineeringAIModel,
  EngineeringAIContext,
  AIInferenceRecord,
  AIVerificationVerdict
} from '../types';

export type VerifierIndependenceLevel =
  | 'DEPENDENT'
  | 'PARTIALLY_INDEPENDENT'
  | 'STRICTLY_INDEPENDENT'
  | 'FULLY_INDEPENDENT_DISSIMILAR';

export interface DissimilarVerificationMetrics {
  commonModeVulnerabilityScore: number; // 0.0 = completely immune, 1.0 = shared single point of failure
  dissimilarityRatio: number; // 1.0 = completely distinct code path
  sharedCodeLines: number;
  independentCheckStages: number;
  physicsConservationEnforced: boolean;
  temporalInvarianceEnforced: boolean;
  numericalAdmissibilityEnforced: boolean;
  zeroRuntimeMemoizationTrust: boolean;
}

export interface DetailedVerificationStageResult {
  stage: string;
  passed: boolean;
  verdict: AIVerificationVerdict;
  details: string;
  computedValue?: string | number;
  expectedValue?: string | number;
}

export interface HardenedVerificationReport {
  verdict: AIVerificationVerdict;
  overallPassed: boolean;
  independenceLevel: VerifierIndependenceLevel;
  authorityTag: 'ADVISORY_EVIDENCE'; // Invariant: AI Verification is never Canonical Authority
  details: string;
  timestamp: string;
  stages: DetailedVerificationStageResult[];
  recomputedModelHash: string;
  recomputedContextHash: string;
  recomputedInputHash: string;
  recomputedOutputHash: string;
  recomputedExecutionHash: string;
  dissimilarDigest?: string;
  metrics: DissimilarVerificationMetrics;
}
