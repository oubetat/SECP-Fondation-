export type ClosureChainStageId =
  | 'STAGE_01_ENGINEERING_DOCUMENT'
  | 'STAGE_02_MUTATION'
  | 'STAGE_03_REVISION'
  | 'STAGE_04_EVALUATION'
  | 'STAGE_05_BREP'
  | 'STAGE_06_MESH'
  | 'STAGE_07_RENDERING'
  | 'STAGE_08_PICKING'
  | 'STAGE_09_SELECTION_LIFECYCLE'
  | 'STAGE_10_WORKBENCH_SWITCHING'
  | 'STAGE_11_INVALIDATION_REVALIDATION'
  | 'STAGE_12_DOWNSTREAM_ENGINEERING'
  | 'STAGE_13_EVIDENCE';

export interface ChainStageAuditResult {
  stageId: ClosureChainStageId;
  stageNumber: number;
  name: string;
  description: string;
  verifiedInvariants: string[];
  assertionsPassed: number;
  assertionsTotal: number;
  status: 'VERIFIED' | 'FAILED' | 'BYPASSED_CORRUPTED';
  evidenceHash: string;
  auditNotes: string[];
}

export type DualTruthCheckId =
  | 'CHECK_ZERO_DUAL_SOT'
  | 'CHECK_LEGACY_PATHWAY_ISOLATION'
  | 'CHECK_SANDBOX_SHADOW_BINDING'
  | 'CHECK_DIRECT_MUTATION_BLOCK';

export interface DualTruthAuditResult {
  checkId: DualTruthCheckId;
  name: string;
  description: string;
  status: 'SAFE_SINGLE_SOT' | 'VIOLATION_PARALLEL_TRUTH';
  inspectedPaths: string[];
  evidenceHash: string;
  details: string;
}

export type FinalForensicVerdict =
  | 'FORENSIC_CLOSURE_VERIFIED'
  | 'DUAL_TRUTH_VIOLATION_DETECTED'
  | 'CHAIN_BREAKAGE_DETECTED'
  | 'INCOMPLETE_CLOSURE';

export interface FinalEngineeringClosureReport {
  reportId: string;
  auditTimestamp: string;
  gitCommitHash: string;
  environmentId: string;
  chainStageResults: ChainStageAuditResult[];
  dualTruthResults: DualTruthAuditResult[];
  overallChainVerified: boolean;
  zeroParallelTruthVerified: boolean;
  finalVerdict: FinalForensicVerdict;
  totalAssertionsPassed: number;
  totalAssertionsAudited: number;
  forensicMerkleRootHash: string;
  auditExecutionDurationMs: number;
}
