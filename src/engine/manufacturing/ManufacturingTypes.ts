export enum ProcessType { MILLING_3AXIS = 'MILLING_3AXIS', MILLING_5AXIS = 'MILLING_5AXIS', DRILLING = 'DRILLING' }
export enum ManufacturingFeatureType { HOLE = 'HOLE' }
export enum RuleSeverity { WARNING = 'WARNING' }

export interface ManufacturingViolation {
  id: string;
  severity: RuleSeverity;
  message: string;
}

export interface MultiTierValidationResult {
  overallStatus: 'PASS' | 'FAIL' | 'WARNING';
  violations: ManufacturingViolation[];
  provenanceHash: string;
}
