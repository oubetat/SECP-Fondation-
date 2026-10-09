/**
 * SECP Industrial OS — EPC-014: Proof Case Score Types
 */

export enum ScoreDimensionId {
  REQUIREMENTS = 'REQUIREMENTS',
  CAD = 'CAD',
  ASSEMBLY = 'ASSEMBLY',
  PHYSICS = 'PHYSICS',
  SIMULATION = 'SIMULATION',
  VERIFICATION = 'VERIFICATION',
  MANUFACTURING = 'MANUFACTURING',
  PLM = 'PLM',
  DIGITAL_THREAD = 'DIGITAL_THREAD',
  PHYSICAL_VALIDATION = 'PHYSICAL_VALIDATION'
}

export enum DimensionStatus {
  REQUIRED = 'REQUIRED',
  OPTIONAL = 'OPTIONAL',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  NOT_ESTABLISHED = 'NOT_ESTABLISHED'
}

export enum ScoreBand {
  INSUFFICIENT = 'INSUFFICIENT',   // 0–39
  DEVELOPING = 'DEVELOPING',       // 40–59
  ENGINEERED = 'ENGINEERED',       // 60–74
  VERIFIED = 'VERIFIED',           // 75–89
  HIGH_CONFIDENCE = 'HIGH_CONFIDENCE' // 90–100
}

export interface DimensionSubScore {
  coverage: number;     // 0-100
  execution: number;    // 0-100
  verification: number; // 0-100
  evidence: number;     // 0-100
}

export interface ProofCaseDimensionScore {
  dimensionId: ScoreDimensionId;
  name: string;
  weight: number;      // 0.0 - 1.0
  score: number;       // 0-100
  weightedScore: number;
  status: DimensionStatus;
  subScores: DimensionSubScore;
  evidenceStatus: string;
  limitations: string[];
  evidenceReferences: string[];
}

export interface ScoreExplanation {
  dimensionId: ScoreDimensionId;
  summary: string;
  strengths: string[];
  gaps: string[];
  impactOnOverallScore: number;
}

export interface ProofCaseScore {
  proofCaseId: string;
  overallScore: number;
  band: ScoreBand;
  dimensionScores: ProofCaseDimensionScore[];
  criticalFailures: string[];
  evidenceGaps: string[];
  verificationGaps: string[];
  explanations: ScoreExplanation[];
  scoreVersion: string;
  policyVersion: string;
  timestamp: string;
  scoreHash: string;
}

export interface ProofCaseScorePolicy {
  version: string;
  weights: Record<ScoreDimensionId, number>;
  criticalRequirementCap: number; // Max overall score if a critical requirement fails
  scoreBands: Record<ScoreBand, [number, number]>;
}

export interface ScoreAuditRecord {
  scoreRunId: string;
  proofCaseId: string;
  timestamp: string;
  overallScore: number;
  policyVersion: string;
  hash: string;
}
