
export type ProductionCadStatus = 'PROVEN' | 'FAIL' | 'SIMULATED' | 'UNPROVEN';

export interface ProductionCadCheck {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'UNPROVEN';
  description: string;
  evidenceHash?: string;
}

export interface ZeroCodeChallengeResult {
  partId: string;
  partName: string;
  steps: string[];
  isNoCodeCompliant: boolean;
  brepIntegrityHash: string;
  validationStatus: 'VALID' | 'INVALID';
  timestamp: string;
}

export interface HardAcceptanceGate210Result {
  verdict: ProductionCadStatus;
  overallScore: number;
  checks: ProductionCadCheck[];
  challenge?: ZeroCodeChallengeResult;
  timestamp: string;
}
