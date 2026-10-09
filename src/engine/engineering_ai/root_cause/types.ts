export type FailureCategory =
  | 'INPUT_FAILURE'
  | 'GEOMETRY_FAILURE'
  | 'TOPOLOGY_FAILURE'
  | 'MESH_FAILURE'
  | 'BOUNDARY_FAILURE'
  | 'INITIAL_CONDITION_FAILURE'
  | 'MATERIAL_FAILURE'
  | 'MODEL_FAILURE'
  | 'NUMERICAL_FAILURE'
  | 'SOLVER_FAILURE'
  | 'COUPLING_FAILURE'
  | 'CONSERVATION_FAILURE'
  | 'CONVERGENCE_FAILURE'
  | 'RUNTIME_FAILURE'
  | 'IMPLEMENTATION_FAILURE'
  | 'EVIDENCE_FAILURE';

export type HypothesisStatus =
  | 'PROPOSED'
  | 'SUPPORTED'
  | 'WEAKLY_SUPPORTED'
  | 'CONTRADICTED'
  | 'REFUTED'
  | 'VERIFIED'
  | 'UNVERIFIED'
  | 'INCONCLUSIVE';

export type RootCauseVerdict =
  | 'VERIFIED_ROOT_CAUSE'
  | 'SUPPORTED_ROOT_CAUSE'
  | 'LIKELY_ROOT_CAUSE'
  | 'MULTIPLE_ROOT_CAUSES'
  | 'REFUTED_ROOT_CAUSE'
  | 'UNVERIFIED_ROOT_CAUSE'
  | 'CAUSAL_IDENTIFICATION_INSUFFICIENT'
  | 'INSUFFICIENT_EVIDENCE'
  | 'NO_ROOT_CAUSE_ESTABLISHED'
  | 'VERIFICATION_FAILURE'
  | 'EVIDENCE_INTEGRITY_FAILURE';

export type EvidenceStrength =
  | 'NONE'
  | 'WEAK'
  | 'MODERATE'
  | 'STRONG'
  | 'DECISIVE';

export interface FailureSignature {
  failureId: string;
  domain: string;
  category: FailureCategory;
  observable: string;
  metric: string;
  observedValue: number;
  expectedRange: [number, number];
  threshold: number;
  timeIndex?: number;
  spatialRegion?: string;
  severity: 'INFO' | 'WARNING' | 'MAJOR' | 'CRITICAL' | 'BLOCKING';
  source: string;
}

export interface CausalHypothesis {
  hypothesisId: string;
  statement: string;
  causeVariable: string;
  effectVariable: string;
  domain: string;
  mechanism: string;
  predictedObservation: string;
  requiredEvidence: string[];
  discriminatingExperiment?: string;
  status: HypothesisStatus;
  confidence: number;
}

export type CausalRelationType =
  | 'CAUSES'
  | 'ENABLES'
  | 'CONSTRAINS'
  | 'CORRELATES_WITH'
  | 'PRECEDES'
  | 'SUPPORTS'
  | 'CONTRADICTS'
  | 'REFUTES';

export interface CausalNode {
  id: string;
  type: 'Cause' | 'Condition' | 'Mechanism' | 'Observation' | 'Failure' | 'Evidence' | 'Intervention' | 'Outcome';
  label: string;
  metadata: Record<string, any>;
}

export interface CausalEdge {
  sourceId: string;
  targetId: string;
  relation: CausalRelationType;
  mechanism: string;
  evidenceId?: string;
}

export interface RootCauseRecord {
  rootCauseId: string;
  simulationId: string;
  failureId: string;
  failureClass: FailureCategory;
  candidateCauses: string[];
  causalGraphHash: string;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  experiments: string[];
  interventions: string[];
  counterfactuals: string[];
  verificationResults: string[];
  confidence: number;
  verdict: RootCauseVerdict;
  evidenceHash: string;
  createdAt: string;
}

export interface RootCauseIntervention {
  interventionId: string;
  targetParameter: string;
  baselineValue: any;
  modifiedValue: any;
  reason: string;
  expectedOutcome: string;
  actualOutcome?: string;
  simulationHash: string;
  status: 'PLANNED' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
}

export interface CounterfactualCase {
  baselineCaseId: string;
  modifiedVariable: string;
  originalValue: any;
  counterfactualValue: any;
  expectedEffect: string;
  observedEffect?: string;
  verdict?: 'SUPPORTED' | 'REFUTED' | 'INCONCLUSIVE';
}
