/**
 * SECP Industrial OS v2 — JT Fidelity Types
 * PATCH-038: JT Fidelity
 */

export type JTFidelityVerdict =
  | 'PASS'
  | 'FAIL'
  | 'UNPROVEN'
  | 'INCONCLUSIVE'
  | 'INVALID';

export type JTFidelitySeverity =
  | 'INFO'
  | 'WARNING'
  | 'ERROR'
  | 'CRITICAL';

export type JTFidelityCategory =
  | 'FORMAT'
  | 'STRUCTURE'
  | 'GEOMETRY'
  | 'BREP'
  | 'TESSELLATION'
  | 'TOPOLOGY'
  | 'ASSEMBLY'
  | 'PMI'
  | 'METADATA'
  | 'TRANSFORM'
  | 'PRECISION'
  | 'ROUND_TRIP';

export interface JTCapability {
  id: string;
  name: string;
  status: 'SUPPORTED' | 'PARTIAL' | 'UNSUPPORTED' | 'UNPROVEN';
  description: string;
}

export interface JTFidelityIssue {
  code: string;
  severity: JTFidelitySeverity;
  category: JTFidelityCategory;
  message: string;
  sourceNodeId?: string;
  targetNodeId?: string;
  sourceEntityType?: string;
}

export interface JTFidelityResult {
  verdict: JTFidelityVerdict;
  inputHash: string;
  outputHash?: string;
  sourceFormat: 'JT';
  targetFormat?: string;
  capabilities: JTCapability[];

  structure: {
    nodesInput: number;
    nodesParsed: number;
    nodesConverted: number;
    unsupportedNodes: number;
  };

  geometry: {
    checked: boolean;
    passed: number;
    failed: number;
    unproven: number;
  };

  tessellation: {
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

  assembly: {
    checked: boolean;
    passed: number;
    failed: number;
    unproven: number;
  };

  pmi: {
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

  issues: JTFidelityIssue[];

  evidence: {
    validatorVersion: string;
    inputHash: string;
    configurationHash: string;
    checkedAt: string;
  };
}
