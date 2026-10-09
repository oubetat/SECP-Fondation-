/**
 * PATCH-275: Design Space Exploration Types
 * Defines data structures for Multi-Variable Design Space Exploration, Candidate Sampling,
 * Pareto Front Analysis, AI Exploration Assistant Proposals, and Cryptographic Evidence.
 */

export type DesignVariableType =
  | 'CONTINUOUS' // Length, width, thickness, diameter, radius, angle
  | 'INTEGER'    // Hole count, rib count, pattern count
  | 'DISCRETE'   // Specific structural options or standard hardware sizes
  | 'MATERIAL'   // Material selection from material kernel
  | 'TOPOLOGY';  // Topology optimization variants

export interface DesignVariable {
  id: string;
  name: string;
  type: DesignVariableType;
  cadParameterOrFeatureId: string;
  unit: string;
  minValue?: number;
  maxValue?: number;
  step?: number;
  discreteOptions?: string[];
  currentBaselineValue: number | string;
  isLocked: boolean; // Protected variable
}

export type SamplingStrategy =
  | 'GRID_SAMPLING'
  | 'RANDOM_SAMPLING'
  | 'LATIN_HYPERCUBE'
  | 'SPACE_FILLING';

export interface HardDesignRule {
  id: string;
  name: string;
  expression: string; // e.g., "Thickness >= 3.0mm"
  isSatisfied: boolean;
}

export interface DesignCandidate {
  candidateId: string;
  candidateHash: string;
  sampleIndex: number;
  variableValues: Record<string, number | string>;
  materialId: string;
  materialName: string;
  cadStatus: 'REGENERATED_VALID' | 'CAD_REGENERATION_FAILED' | 'NON_MANIFOLD';
  meshElementsCount: number;
  physicsResults: {
    massKg: number;
    maxVonMisesStressPa: number;
    maxDisplacementMm: number;
    safetyFactorFoS: number;
    failureIndex: number;
    complianceNm: number;
    manufacturabilityScore: number;
    estimatedCostUsd: number;
  };
  feasibilityStatus: 'FEASIBLE' | 'INFEASIBLE' | 'CAD_FAILED' | 'SAFETY_FAILED';
  isParetoOptimal: boolean;
  paretoRank: number; // 1 = Non-dominated frontier
  overallScore: number; // 0 - 100
}

export interface ParetoFront {
  objectiveX: string; // e.g., "Mass (kg)"
  objectiveY: string; // e.g., "Max Stress (MPa)" or "Displacement (mm)"
  objectiveZ: string; // e.g., "Safety Factor FoS"
  totalCandidatesEvaluated: number;
  feasibleCandidatesCount: number;
  paretoFrontierCount: number;
  frontierCandidates: DesignCandidate[];
}

export interface AICandidateProposal {
  proposalId: string;
  suggestedVariables: Record<string, number | string>;
  reasoning: string;
  confidenceScore: number;
  status: 'PENDING_PHYSICS_SOLVER' | 'SOLVER_VERIFIED' | 'REJECTED_BY_SOLVER';
  verifiedCandidate?: DesignCandidate;
}

export interface DesignSpaceExplorationStudy {
  studyId: string;
  name: string;
  baselineModelId: string;
  variables: DesignVariable[];
  samplingStrategy: SamplingStrategy;
  samplingSeed: number;
  maxCandidatesBudget: number;
  hardRules: HardDesignRule[];
  baselineCandidate: DesignCandidate;
  evaluatedCandidates: DesignCandidate[];
  paretoFront: ParetoFront;
  aiProposals: AICandidateProposal[];
  bestCandidateFound: DesignCandidate;
  explorationCoveragePct: number;
  diversityMetric: number;
  evidence: {
    digitalCertificateSHA256: string;
    studyHash: string;
    isDeterministic: boolean;
    provenanceTrail: string[];
  };
  status: 'COMPLETED' | 'BUDGET_REACHED' | 'FAILED';
}
