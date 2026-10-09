/**
 * SECP Industrial OS v2 — AP242 Validation Types
 * PATCH-036: AP242 Validation
 */

export type AP242ValidationVerdict = 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE' | 'INVALID';

export type AP242ValidationSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface AP242ValidationIssue {
  code: string;
  severity: AP242ValidationSeverity;
  category:
    | 'HEADER'
    | 'SCHEMA'
    | 'ENTITY'
    | 'REFERENCE'
    | 'RELATIONSHIP'
    | 'GEOMETRY'
    | 'TOPOLOGY'
    | 'PMI'
    | 'CONSISTENCY';
  message: string;
  entityId?: string;
  sourceLine?: number;
}

export interface AP242ValidationResult {
  verdict: AP242ValidationVerdict;
  valid: boolean;
  fileHash: string;
  schemaIdentifier?: string;
  entityCount: number;
  issues: AP242ValidationIssue[];
  checks: {
    header: boolean;
    schema: boolean;
    entities: boolean;
    references: boolean;
    relationships: boolean;
    geometry: boolean;
    topology: boolean;
    pmi: boolean;
    consistency: boolean;
  };
  evidence: {
    inputHash: string;
    validatorVersion: string;
    checkedAt: string;
  };
}
