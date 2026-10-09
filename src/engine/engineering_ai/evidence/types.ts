export type ClaimType =
  | 'VERIFIED_FACT'
  | 'MEASURED_FACT'
  | 'VALIDATED_RESULT'
  | 'SIMULATION_RESULT'
  | 'OBSERVATION'
  | 'INFERENCE'
  | 'PREDICTION'
  | 'RECOMMENDATION'
  | 'ASSUMPTION'
  | 'UNKNOWN';

export type EvidenceSourceType =
  | 'CAD'
  | 'B_REP'
  | 'NURBS'
  | 'SIMULATION'
  | 'SOLVER'
  | 'MESH'
  | 'MATERIAL_DATABASE'
  | 'LAB_TEST'
  | 'INSPECTION'
  | 'MANUFACTURING'
  | 'MACHINE_TELEMETRY'
  | 'DIGITAL_TWIN'
  | 'PLM'
  | 'ENGINEERING_STANDARD'
  | 'HISTORICAL_CASE'
  | 'USER_INPUT'
  | 'AI_GENERATED';

export type EvidenceAuthority =
  | 'PRIMARY_VERIFIED'
  | 'SECONDARY_VALIDATED'
  | 'INTERNAL_APPROVED'
  | 'OBSERVED'
  | 'UNVERIFIED'
  | 'AI_GENERATED';

export type EvidenceState =
  | 'VALID'
  | 'EXPIRED'
  | 'SUPERSEDED'
  | 'REVOKED'
  | 'CONFLICTED'
  | 'UNVERIFIED'
  | 'MISSING';

export type ClaimSupportState =
  | 'FULLY_SUPPORTED'
  | 'PARTIALLY_SUPPORTED'
  | 'WEAKLY_SUPPORTED'
  | 'CONTRADICTED'
  | 'UNSUPPORTED'
  | 'UNKNOWN';

export type ContradictionState =
  | 'NO_CONFLICT'
  | 'POTENTIAL_CONFLICT'
  | 'CONFIRMED_CONFLICT'
  | 'UNRESOLVED_CONFLICT';

export interface EngineeringEvidence {
  evidenceId: string;
  sourceType: EvidenceSourceType;
  sourceId: string;
  sourceRevision: string;
  contentHash: string;
  createdAt: string;
  validFrom?: string;
  validTo?: string;
  verificationState: 'VERIFIED' | 'UNVERIFIED' | 'REVOKED';
  state: EvidenceState;
  authority: EvidenceAuthority;
  confidence: number;
  context: Record<string, any>;
  measurement?: number;
  units?: string;
  provenance: Record<string, any>;
}

export interface EngineeringClaim {
  claimId: string;
  text: string;
  claimType: ClaimType;
  domain: string;
  importance: 'LOW_RISK' | 'ENGINEERING_REVIEW' | 'HIGH_IMPACT' | 'CRITICAL';
  requiredEvidence: string[];
  supportingEvidence: string[];
  contradictingEvidence: string[];
  status: ClaimSupportState;
  confidence: number;
  uncertainty?: number;
}

export interface EvidenceManifest {
  manifestId: string;
  claims: EngineeringClaim[];
  evidence: EngineeringEvidence[];
  dependencies: string[];
  policies: string[];
  contradictions: string[];
  assumptions: any[];
  verification: 'PASS' | 'FAIL' | 'BLOCKED' | 'CANNOT_BE_FULLY_VERIFIED';
  hash: string;
  timestamp: string;
}

export interface EngineeringAssumption {
  assumptionId: string;
  statement: string;
  source: string;
  reason: string;
  impact: 'LOW' | 'HIGH' | 'CRITICAL';
  approvedBy?: string;
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED';
}
