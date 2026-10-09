
export type VerificationStatus = 'PASS' | 'FAIL' | 'UNSUPPORTED' | 'UNPROVEN';

export interface ConstraintVerificationResult {
  constraintId: string;
  type: string;
  referencedInstances: string[];
  expectedRelationship: any;
  actualRelationship: any;
  residual: number;
  tolerance: number;
  status: VerificationStatus;
  diagnostic?: string;
}

export interface DOFVerificationResult {
  totalAssemblyDOF: number;
  componentDOFs: Record<string, {
    instanceId: string;
    remainingDOF: number;
    status: 'FULLY_CONSTRAINED' | 'PARTIALLY_CONSTRAINED' | 'UNCONSTRAINED';
  }>;
  status: VerificationStatus;
  diagnostic?: string;
}

export interface InterferenceVerificationResult {
  hasInterference: boolean;
  clashCount: number;
  totalClashVolumeMm3: number;
  clashes: Array<{
    id: string;
    instanceAId: string;
    instanceBId: string;
    volumeMm3: number;
  }>;
  status: VerificationStatus;
}

export interface RegenerationVerificationResult {
  transformsMatch: boolean;
  residualsMatch: boolean;
  dofMatches: boolean;
  maxDivergence: number;
  status: VerificationStatus;
}

export interface AssemblyVerificationReport {
  documentId: string;
  revision: number;
  timestamp: string;
  constraints: ConstraintVerificationResult[];
  dof: DOFVerificationResult;
  interference: InterferenceVerificationResult;
  regeneration?: RegenerationVerificationResult;
  verdict: VerificationStatus;
  evidenceHash: string;
}
