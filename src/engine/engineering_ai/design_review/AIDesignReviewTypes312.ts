/**
 * PHASE 28 — ENGINEERING AI
 * PATCH-312 — AI Design Review
 * Type Definitions & Data Structures
 * 
 * CORE PRINCIPLE:
 * AI Reviews ≠ Engineering Validation ≠ Engineering Truth
 * AI identifies potential issues and proposes recommendations.
 * CAD/Physics/Manufacturing engines validate evidence deterministically.
 * Human engineers maintain sole decision-making authority over approvals, waivers, and releases.
 */

export type ReviewScope =
  | 'GEOMETRY'
  | 'CAD'
  | 'ASSEMBLY'
  | 'SIMULATION'
  | 'MANUFACTURING'
  | 'MATERIALS'
  | 'SAFETY'
  | 'STANDARDS'
  | 'PERFORMANCE'
  | 'PLM';

export type ReviewStatus =
  | 'DRAFT'
  | 'RUNNING'
  | 'COMPLETED'
  | 'REQUIRES_ENGINEER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUPERSEDED';

export type ReviewMode =
  | 'QUICK_REVIEW'
  | 'FULL_ENGINEERING_REVIEW'
  | 'MANUFACTURING_REVIEW'
  | 'SIMULATION_REVIEW'
  | 'SAFETY_REVIEW'
  | 'RELEASE_REVIEW';

export type VerificationState =
  | 'AI_SUSPECTED'
  | 'ENGINEERING_VALIDATED'
  | 'ENGINEERING_FAILED'
  | 'UNKNOWN';

export type FindingSeverity =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export type FindingCategory =
  | 'GEOMETRY_FAILURE'
  | 'FEATURE_REGENERATION_FAILURE'
  | 'REQUIREMENT_TRACEABILITY_MISSING'
  | 'DIMENSION_INCONSISTENCY'
  | 'TOLERANCE_GD_T'
  | 'MANUFACTURABILITY_RISK'
  | 'COLLISION_CONFIRMED'
  | 'MATERIAL_MISSING'
  | 'MATERIAL_INCOMPATIBILITY'
  | 'STRUCTURAL_FEM_REQUIRED'
  | 'SIMULATION_REQUIRES_INPUT'
  | 'CFD_GEOMETRY_READINESS'
  | 'THERMAL_REVIEW_RECOMMENDED'
  | 'FSI_REVIEW_RECOMMENDED'
  | 'FATIGUE_ANALYSIS_RECOMMENDED'
  | 'SAFETY_FACTOR_REQUIRES_REVIEW'
  | 'ASSEMBLY_INTERFERENCE'
  | 'CLEARANCE_INSUFFICIENT'
  | 'CONSTRAINT_CONFLICT'
  | 'FASTENER_HOLE_MISMATCH'
  | 'STANDARD_CONFLICT'
  | 'COST_DRIVER';

export type FindingStatus =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'RESOLVED'
  | 'WAIVED'
  | 'REQUIRES_VALIDATION';

export type LocationType =
  | 'BODY'
  | 'FACE'
  | 'EDGE'
  | 'VERTEX'
  | 'FEATURE'
  | 'ASSEMBLY_COMPONENT'
  | 'SIMULATION_REGION'
  | 'CAM_FEATURE';

export interface FindingLocation {
  type: LocationType;
  entityId: string;
  featureId?: string;
  name: string;
  coordinates?: [number, number, number];
  cadPath?: string;
}

export interface FindingEvidence {
  evidenceId: string;
  sourceEngine: 'CAD_KERNEL' | 'FEM_SOLVER' | 'CFD_SOLVER' | 'CAM_VALIDATOR' | 'MATERIAL_DB' | 'GD_T_CHECKER' | 'AI_HEURISTIC';
  rawOutput: string;
  numericValues?: Record<string, number>;
  isDeterministicProof: boolean; // MUST be true for CONFIRMED, false for AI_SUSPECTED
  timestamp: string;
}

export interface DesignReviewFinding {
  findingId: string;
  category: FindingCategory;
  severity: FindingSeverity;
  verificationState: VerificationState; // AI_SUSPECTED vs ENGINEERING_VALIDATED vs ENGINEERING_FAILED vs UNKNOWN
  status: FindingStatus;
  title: string;
  description: string;
  location: FindingLocation;
  evidence: FindingEvidence[];
  ruleId?: string;
  ruleVersion?: string;
  recommendation: string;
  aiExplanation: {
    whyFlagged: string;
    triggerEvidence: string;
    engineerActionRecommended: string;
  };
  reopenCount?: number;
  revalidatedAt?: string;
}

export type RiskCategory =
  | 'STRUCTURAL'
  | 'THERMAL'
  | 'CFD'
  | 'MANUFACTURING'
  | 'ASSEMBLY'
  | 'MATERIAL'
  | 'SAFETY'
  | 'GEOMETRY'
  | 'SIMULATION'
  | 'PROCESS';

export interface EngineeringDesignRisk {
  riskId: string;
  category: RiskCategory;
  description: string;
  severity: FindingSeverity;
  likelihood: 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'CERTAIN';
  evidenceType: 'Observed' | 'Inferred' | 'AI_Suspected' | 'Validated';
  mitigation: string;
  status: 'IDENTIFIED' | 'MITIGATED' | 'ACCEPTED' | 'REJECTED';
  priorityScore: number; // Computed deterministically: severity (1-4) * likelihood (1-4)
}

export interface EngineeringRiskMatrix {
  risks: EngineeringDesignRisk[];
  highestSeverity: FindingSeverity;
  criticalCount: number;
  unmitigatedCount: number;
}

export interface ChecklistItem {
  id: string;
  category: ReviewScope;
  title: string;
  status: 'PASS' | 'FAIL' | 'UNKNOWN' | 'N_A' | 'REVIEW_REQUIRED';
  notes: string;
}

export interface DesignCompletenessSummary {
  geometryComplete: boolean;
  featuresComplete: boolean;
  dimensionsComplete: boolean;
  materialDefined: boolean;
  interfacesDefined: boolean;
  constraintsValid: boolean;
  manufacturingDataReady: boolean;
  simulationDataReady: boolean;
  documentationComplete: boolean;
  completenessScorePct: number; // Deterministic checklist score
  checklist: ChecklistItem[];
}

export interface WaiverRecord {
  waiverId: string;
  findingId: string;
  reason: string;
  engineerId: string;
  approvedAt: string;
  scope: string;
  expirationDate?: string;
  policyAllowed: boolean;
}

export interface EngineeringDesignReview {
  reviewId: string;
  reviewSessionId: string;
  designId: string;
  designRevision: string;
  branchId: string;
  reviewScope: ReviewScope[];
  reviewMode: ReviewMode;
  findings: DesignReviewFinding[];
  riskMatrix: EngineeringRiskMatrix;
  completeness: DesignCompletenessSummary;
  waivers: WaiverRecord[];
  overallRiskLevel: FindingSeverity;
  status: ReviewStatus;
  approvalState: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WAIVED_RELEASE';
  createdAt: string;
  reviewHash: string; // DesignReviewHash binding revision + rules + AI version + findings + evidence
}

export interface AIDesignReviewSession {
  sessionId: string;
  projectId: string;
  revisionId: string;
  branchId: string;
  userId: string;
  designId: string;
  aiModelVersion: string;
  policyVersion: string;
  reviewRuleVersion: string;
  status: ReviewStatus;
  createdAt: string;
  activeReview?: EngineeringDesignReview;
  historicalReviews: EngineeringDesignReview[];
  plmEcoLink?: {
    projectId: string;
    revisionId: string;
    ecoId?: string;
  };
}

export interface EngineeringDesignReviewReport {
  reportId: string;
  sessionId: string;
  designRevision: string;
  reviewScope: ReviewScope[];
  reviewMode: ReviewMode;
  findings: DesignReviewFinding[];
  evidenceList: FindingEvidence[];
  validatedResults: string[];
  openRisks: EngineeringDesignRisk[];
  engineerDecisions: Array<{ findingId: string; decision: FindingStatus; engineer: string; timestamp: string }>;
  approvalState: string;
  digitalThreadChain: string[];
  provenance: {
    aiModel: string;
    aiVersion: string;
    ruleVersion: string;
    solverVersion: string;
    cadKernelVersion: string;
    timestamp: string;
  };
}
