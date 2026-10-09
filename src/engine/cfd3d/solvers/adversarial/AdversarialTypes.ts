/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-075: CFD Adversarial Verification Types & Data Models
 */

export type CFDVerdict = 'CONVERGED' | 'NOT_CONVERGED' | 'CONSERVATION_FAILURE' | 'INVALID';

export type MutationType =
  | 'NAN_INJECTION'
  | 'INF_INJECTION'
  | 'MASS_IMBALANCE'
  | 'MOMENTUM_IMBALANCE'
  | 'ENERGY_IMBALANCE'
  | 'RESIDUAL_RESET'
  | 'RESIDUAL_STAGNATION'
  | 'RESIDUAL_OSCILLATION'
  | 'RESIDUAL_DIVERGENCE'
  | 'RESIDUAL_TRUNCATION'
  | 'PREMATURE_TERMINATION'
  | 'MESH_INVERTED_CELL'
  | 'MESH_ZERO_VOLUME'
  | 'MESH_TOPOLOGY_BREAK'
  | 'BC_UNIT_MISMATCH'
  | 'BC_SIGN_REVERSAL'
  | 'REPORT_MANIPULATION'
  | 'QOI_MANIPULATION'
  | 'CACHE_POISONING';

export interface ConvergencePolicy {
  readonly residualThreshold: number;
  readonly minIterations: number;
  readonly maxIterations: number;
  readonly stagnationWindow: number;
  readonly stagnationTolerance: number;
  readonly allowedOscillationCount: number;
  readonly policyVersion: string;
}

export interface ConservationPolicy {
  readonly maxMassImbalance: number;
  readonly maxMomentumImbalance: number;
  readonly maxEnergyImbalance: number;
  readonly policyVersion: string;
}

export interface ValidityPolicy {
  readonly allowNegativePressure: boolean;
  readonly allowNegativeDensity: boolean;
  readonly allowNegativeViscosity: boolean;
  readonly strictMeshOrthogonality: boolean;
  readonly policyVersion: string;
}

export interface AdversarialMutation {
  readonly mutationId: string;
  readonly sourceCaseId: string;
  readonly targetCaseId: string;
  readonly mutationType: MutationType;
  readonly affectedArtifact: string;
  readonly beforeHash: string;
  readonly afterHash: string;
  readonly mutationParameters: Readonly<Record<string, unknown>>;
  readonly timestamp: string;
  readonly generatorVersion: string;
}

export interface AdversarialCaseManifest {
  readonly adversarialCaseId: string;
  readonly baseCaseId: string;
  readonly runId: string;
  readonly mutation: AdversarialMutation;
  readonly expectedOracleVerdict: CFDVerdict;
  readonly evidenceRootHash: string;
  readonly schemaVersion: string;
  readonly createdAt: string;
}

export interface VerdictEvidence {
  readonly caseId: string;
  readonly runId: string;
  readonly timestamp: string;
  readonly hasNaNOrInf: boolean;
  readonly meshValid: boolean;
  readonly bcValid: boolean;
  readonly residualValid: boolean;
  readonly finalResidual: number;
  readonly convergenceAchieved: boolean;
  readonly massImbalance: number;
  readonly conservationAchieved: boolean;
  readonly solverReportedStatus: string;
  readonly solverExitCode: number;
  readonly evidenceRootHash: string;
}

export interface VerdictExplanation {
  readonly verdict: CFDVerdict;
  readonly primaryReason: string;
  readonly details: readonly string[];
  readonly triggeredRules: readonly string[];
  readonly failedRules: readonly string[];
}

export interface AdversarialCoverage {
  readonly totalMutationsTested: number;
  readonly detectedCount: number;
  readonly survivalCount: number;
  readonly mutationCategoriesCovered: readonly string[];
  readonly falsePositiveCount: number;
  readonly falseNegativeCount: number;
}
