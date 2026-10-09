/**
 * SECP Industrial OS v2 — AP242 PMI Types
 * PATCH-035: AP242 PMI
 */

import { EngineeringObjectType } from '../../../identity/CanonicalEngineeringIdentity';

export type PmiCategory = 
  | 'DIMENSION'
  | 'GEOMETRIC_TOLERANCE'
  | 'DATUM'
  | 'FEATURE_CONTROL_FRAME'
  | 'SURFACE_FINISH'
  | 'MATERIAL_NOTE'
  | 'WELD_ANNOTATION'
  | 'GENERAL_NOTE'
  | 'SEMANTIC_PMI'
  | 'GRAPHICAL_PMI';

export type PmiCriticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface PmiGeometryAssociation {
  readonly associationId: string;
  readonly pmiId: string;
  readonly geometryId: string;
  readonly associationType: 'TARGET' | 'REFERENCE' | 'ANNOTATION_PLANE';
  readonly confidence: number; // 0.0 to 1.0
  readonly sourceReference?: string;
}

export type DimensionType = 'LINEAR' | 'ANGULAR' | 'RADIAL' | 'DIAMETER' | 'ARC_LENGTH' | 'COORDINATE';

export interface PmiTolerance {
  readonly type: 'SYMMETRIC' | 'BILATERAL' | 'UNILATERAL' | 'LIMITS' | 'BASIC' | 'REFERENCE';
  readonly upperTolerance: number;
  readonly lowerTolerance: number;
}

export interface PmiObject {
  readonly id: string;
  readonly category: PmiCategory;
  readonly semanticType: string;
  readonly text?: string;
  readonly value?: number;
  readonly unit?: string;
  readonly tolerance?: PmiTolerance;
  readonly datumReferences?: string[];
  readonly geometryReferences: string[];
  readonly presentation?: string;
  readonly sourceEntity: string;
  readonly sourceFile: string;
  readonly sourceHash: string;
  readonly schemaVersion: string;
  readonly supportStatus: 'SUPPORTED' | 'PARTIAL' | 'UNSUPPORTED' | 'UNPROVEN';
  readonly criticality: PmiCriticality;
  readonly isSemantic: boolean;
}

export interface DimensionPmi extends PmiObject {
  readonly category: 'DIMENSION';
  readonly dimensionType: DimensionType;
  readonly nominalValue: number;
}

export interface DatumPmi extends PmiObject {
  readonly category: 'DATUM';
  readonly datumLabel: string;
  readonly precedence?: number;
}

export interface FeatureControlFramePmi extends PmiObject {
  readonly category: 'FEATURE_CONTROL_FRAME';
  readonly geometricCharacteristic: string;
  readonly toleranceZoneShape?: string;
  readonly materialCondition?: string;
}

export interface PmiValidationResult {
  readonly status: 'VALID' | 'INVALID' | 'UNPROVEN';
  readonly errors: string[];
  readonly warnings: string[];
  readonly pmiId: string;
}

export type PmiFidelityVerdict =
  | 'EXACT'
  | 'SEMANTICALLY_EQUIVALENT'
  | 'DEGRADED'
  | 'LOSS_DETECTED'
  | 'INVALID'
  | 'UNPROVEN';

export interface PmiFidelityReport {
  readonly verdict: PmiFidelityVerdict;
  readonly totalPmi: number;
  readonly preservedPmi: number;
  readonly semanticPreserved: number;
  readonly graphicalPreserved: number;
  readonly lostPmi: number;
  readonly unsupportedPmi: number;
  readonly associationLoss: number;
  readonly toleranceLoss: number;
  readonly datumLoss: number;
  readonly modifierLoss: number;
  readonly fidelityRatio: number;
  readonly criticalPmiLosses: string[];
  readonly lossDetails: string[];
}
