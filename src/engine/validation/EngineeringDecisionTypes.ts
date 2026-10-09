/**
 * PATCH-SECP-050 — Final Engineering Decision & System Acceptance Contracts
 */

import { ComprehensiveValidationResult } from '../intent/DesignIntentTypes';
import { MultiTierValidationResult } from '../manufacturing/ManufacturingTypes';

export enum FinalEngineeringDecision {
  ENGINEERING_VALID = 'ENGINEERING_VALID',
  GEOMETRIC_INVALID = 'GEOMETRIC_INVALID',
  DESIGN_INTENT_FAIL = 'DESIGN_INTENT_FAIL',
  MANUFACTURABILITY_FAIL = 'MANUFACTURABILITY_FAIL',
  MULTIPLE_ENGINEERING_FAILURES = 'MULTIPLE_ENGINEERING_FAILURES',
  VALIDATION_INDETERMINATE = 'VALIDATION_INDETERMINATE'
}

export interface SystemProvenanceRecord {
  systemVersion: 'SECP CAD CORE v1.0';
  timestamp: string;
  kernelIdentity: {
    name: string;
    buildId: string;
    checksum: string;
  };
  revisions: {
    modelId: string;
    featureHistoryRev: number;
    intentGraphRev: number;
    manufacturingPlanRev: number;
  };
  inputHash: string;
  outputHash: string;
  provenanceSignature: string;
}

export interface UnifiedEngineeringReport {
  patch: 'SECP-050';
  systemVersion: 'SECP CAD CORE v1.0';
  timestamp: string;
  
  // Final Decision
  decision: FinalEngineeringDecision;
  isAcceptableForProduction: boolean;

  // Layered Spectrum (No information loss)
  tier1Geometry: {
    valid: boolean;
    volumeMm3?: number;
    faceCount?: number;
    edgeCount?: number;
    message?: string;
  };

  tier2DesignIntent: {
    satisfied: boolean;
    totalIntentsEvaluated: number;
    violationsCount: number;
    details: ComprehensiveValidationResult;
  };

  tier3Manufacturability: {
    feasible: boolean;
    recognizedFeaturesCount: number;
    criticalViolationsCount: number;
    details: MultiTierValidationResult;
  };

  provenance: SystemProvenanceRecord;
}
