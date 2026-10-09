/**
 * SECP Industrial OS v2 — QIF 3.0 / MBD Closed-Loop Manufacturing Types
 * ISO 23952:2020 / ANSI QIF 3.0 Compliant Architecture
 */

export type QifVerdict = 
  | 'PASS' 
  | 'FAIL' 
  | 'INDETERMINATE' 
  | 'REJECTED' 
  | 'UNVERIFIED' 
  | 'CALIBRATION_EXPIRED' 
  | 'DESIGN_AUTHORITY_UNRESOLVED'
  | 'REVISION_GEOMETRY_MISMATCH'
  | 'REVISION_SEMANTIC_MISMATCH';

export type QifCharacteristicType = 
  | 'LINEAR_DISTANCE'
  | 'ANGULAR'
  | 'DIAMETER'
  | 'RADIAL'
  | 'FLATNESS'
  | 'PERPENDICULARITY'
  | 'POSITION'
  | 'CONCENTRICITY'
  | 'SURFACE_FINISH';

export type QifToleranceType = 'SYMMETRIC' | 'BILATERAL' | 'LIMITS' | 'PLUS_MINUS';

export type QifDecisionRule = 'SIMPLE_ACCEPTANCE' | 'GUARD_BANDED_95_CONFIDENCE' | 'STRICT_ZERO_DEFECT';

/**
 * Design Authority & Deterministic Traceability Chain
 */
export interface DesignAuthorityBinding {
  readonly designAuthorityId: string;
  readonly canonicalDocumentId: string;
  readonly revisionId: string; // 'REV-A', 'REV-B', etc.
  readonly geometryPersistentId: string;
  readonly pmiId: string;
  readonly qualityCharacteristicId: string;
  readonly measurementFeatureId: string;
  readonly qifResultId: string;
  readonly traceabilityHash: string;
}

export interface QifUnitSystem {
  readonly lengthUnit: 'MILLIMETRE' | 'METRE' | 'INCH';
  readonly angleUnit: 'DEGREE' | 'RADIAN';
  readonly scaleFactorToMm: number;
}

export interface QifTolerance {
  readonly type: QifToleranceType;
  readonly upperLimitMm: number;
  readonly lowerLimitMm: number;
  readonly upperDeviationMm: number;
  readonly lowerDeviationMm: number;
}

export interface QifDatumReference {
  readonly datumLabel: string; // 'A', 'B', 'C'
  readonly precedence: 'PRIMARY' | 'SECONDARY' | 'TERTIARY';
  readonly materialCondition?: 'MMC' | 'LMC' | 'RFS';
  readonly targetGeometryId: string;
}

export interface QifCharacteristic {
  readonly id: string;
  readonly type: QifCharacteristicType;
  readonly name: string;
  readonly nominalValue: number;
  readonly unit: string;
  readonly tolerance: QifTolerance;
  readonly datumReferences: readonly QifDatumReference[];
  readonly targetGeometryId: string;
  readonly pmiId: string;
  readonly isCriticalToQuality: boolean;
}

export interface QifFeature {
  readonly id: string;
  readonly name: string;
  readonly featureType: 'SURFACE' | 'CYLINDER' | 'HOLE' | 'PLANE' | 'SPHERE' | 'SLOT';
  readonly persistentTopologyId: string;
  readonly associatedCharacteristicIds: readonly string[];
}

export interface QifCalibrationRecord {
  readonly calibrationId: string;
  readonly instrumentId: string;
  readonly calibratedAt: string;
  readonly expiresAt: string;
  readonly calibrationStandardId: string;
  readonly verifiedAccuracyMm: number;
  readonly isValid: boolean;
}

export interface QifInstrument {
  readonly instrumentId: string;
  readonly name: string;
  readonly type: 'ZEISS_CMM_PROBE' | 'LASER_TRACKER' | 'DIGITAL_MICROMETER' | 'OPTICAL_COMPARATOR';
  readonly resolutionMm: number;
  readonly inherentUncertaintyMm: number;
  readonly calibration: QifCalibrationRecord;
}

export interface QifMeasurementUncertainty {
  readonly standardUncertaintyMm: number;
  readonly instrumentContributionMm: number;
  readonly environmentalContributionMm: number;
  readonly repeatabilityMm: number;
  readonly coverageFactor: number; // k = 2 for 95% confidence
  readonly expandedUncertaintyMm: number; // U = k * u_c
  readonly confidenceLevelPercent: number; // 95.0
}

export interface QifMeasurementContext {
  readonly instrument: QifInstrument;
  readonly operatorId: string;
  readonly measurementMethod: string;
  readonly temperatureCelsius: number;
  readonly partSerialNumber: string;
  readonly lotId: string;
  readonly revisionId: string;
  readonly timestamp: string;
  readonly coordinateSystem: string;
}

export interface QifMeasurementResult {
  readonly resultId: string;
  readonly featureId: string;
  readonly characteristicId: string;
  readonly designRevisionId: string;
  readonly partSerialNumber: string;
  readonly lotId: string;
  readonly nominalValue: number;
  readonly measuredValue: number;
  readonly deviationMm: number;
  readonly unit: string;
  readonly uncertainty: QifMeasurementUncertainty;
  readonly context: QifMeasurementContext;
  readonly decisionRule: QifDecisionRule;
  readonly verdict: QifVerdict;
  readonly binding: DesignAuthorityBinding;
  readonly evidenceHash: string;
}

export interface QifInspectionPlan {
  readonly planId: string;
  readonly designAuthorityId: string;
  readonly revisionId: string;
  readonly features: readonly QifFeature[];
  readonly characteristics: readonly QifCharacteristic[];
  readonly unitSystem: QifUnitSystem;
  readonly planHash: string;
}

export interface QifDocument {
  readonly qifDocumentId: string;
  readonly header: {
    readonly title: string;
    readonly author: string;
    readonly organization: string;
    readonly timestamp: string;
    readonly schemaVersion: '3.0';
  };
  readonly plan: QifInspectionPlan;
  readonly results: readonly QifMeasurementResult[];
}

export interface EngineeringFeedback {
  readonly feedbackId: string;
  readonly triggerResultId: string;
  readonly affectedCharacteristicId: string;
  readonly affectedFeatureId: string;
  readonly detectedDeviationMm: number;
  readonly proposedAction: 'ADJUST_TOOL_OFFSET' | 'REDUCE_FEED_RATE' | 'CAD_REGENERATION' | 'REVISION_UPDATE_PROPOSAL';
  readonly parameterAdjustmentValue: number;
  readonly sourceRevisionId: string;
  readonly proposedRevisionId: string;
  readonly isRevisionProposalCreated: boolean;
  readonly status: 'PENDING' | 'APPROVED' | 'REJECTED';
  readonly provenanceHash: string;
}
