/**
 * SECP Industrial OS v2 — IGES Fidelity Types
 * PATCH-037: IGES Fidelity
 */

export type IGESFidelityVerdict =
  | 'PASS'
  | 'FAIL'
  | 'UNPROVEN'
  | 'INCONCLUSIVE'
  | 'INVALID';

export type IGESFidelityCategory =
  | 'FORMAT'
  | 'ENTITY'
  | 'GEOMETRY'
  | 'TOPOLOGY'
  | 'TRANSFORMATION'
  | 'METADATA'
  | 'PRECISION'
  | 'ROUND_TRIP';

export interface IGESFidelityIssue {
  code: string;
  category: IGESFidelityCategory;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  entityId?: string;
  sourceEntityType?: number;
  targetEntityId?: string;
}

export interface IGESFidelityResult {
  verdict: IGESFidelityVerdict;

  inputHash: string;
  outputHash?: string;

  sourceFormat: 'IGES';
  targetFormat?: string;

  entities: {
    input: number;
    parsed: number;
    converted: number;
    unsupported: number;
  };

  geometry: {
    checked: boolean;
    passed: number;
    failed: number;
    unproven: number;
  };

  topology: {
    checked: boolean;
    passed: number;
    failed: number;
    unproven: number;
  };

  metadata: {
    checked: boolean;
    preserved: number;
    lost: number;
    unproven: number;
  };

  issues: IGESFidelityIssue[];

  evidence: {
    validatorVersion: string;
    inputHash: string;
    configurationHash: string;
    checkedAt: string;
  };
}
