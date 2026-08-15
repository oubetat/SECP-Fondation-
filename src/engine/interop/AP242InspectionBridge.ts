/**
 * PATCH-SECP-080: AP242 Semantic PMI to CMM / Metrology Inspection Bridge
 * 
 * Maps ISO 10303-242 semantic dimensions and GD&T tolerances directly into
 * deterministic Metrology Plans, CMM touch-point specifications, and
 * Quality Verification Certificates.
 */

import {
  AP242SemanticModel,
  AP242GeometricTolerance,
  AP242SemanticDimension
} from './AP242Types';
import {
  MeasurementPlan,
  ToleranceSpecification,
  ToleranceCharacteristicType
} from '../quality-metrology/MetrologyTypes';

export interface InspectionRequirementItem {
  requirementId: string;
  sourcePmiId: string;
  pmiType: 'DIMENSION' | 'GDT';
  targetFeatureId: string;
  characteristic: ToleranceCharacteristicType | string;
  nominalMm: number;
  toleranceUpperMm: number;
  toleranceLowerMm: number;
  datumReferences: string[];
  pointsToSample: number;
  isCtq: boolean;
}

export interface CmmInspectionPlanBridgeResult {
  planId: string;
  partId: string;
  requirements: InspectionRequirementItem[];
  metrologyPlan: MeasurementPlan;
  traceabilityHash: string;
  fullyAssociated: boolean;
  unsupportedPmiCount: number;
}

export class AP242InspectionBridge {
  /**
   * Translates an AP242 Semantic Model into an executable CMM / Metrology Measurement Plan.
   */
  public static generateInspectionPlan(model: AP242SemanticModel, partId = 'PART_AP242_001'): CmmInspectionPlanBridgeResult {
    const requirements: InspectionRequirementItem[] = [];
    const specs: ToleranceSpecification[] = [];
    const pointsPerFeature: Record<string, number> = {};
    let unsupportedCount = 0;

    // 1. Map Semantic Dimensions
    for (const dim of model.dimensions) {
      const primaryFace = dim.referencedGeometryIds[0] || 'FACE_UNKNOWN';
      const upper = dim.tolerance?.upperDeviationMm ?? (dim.nominalValue * 0.005);
      const lower = dim.tolerance?.lowerDeviationMm ?? (-dim.nominalValue * 0.005);

      const reqId = `INSP_DIM_${dim.id}`;
      const charType: ToleranceCharacteristicType = dim.dimensionType === 'DIAMETER' ? 'DIAMETER' : 'POSITION';

      requirements.push({
        requirementId: reqId,
        sourcePmiId: dim.id,
        pmiType: 'DIMENSION',
        targetFeatureId: primaryFace,
        characteristic: charType,
        nominalMm: dim.nominalValue,
        toleranceUpperMm: upper,
        toleranceLowerMm: lower,
        datumReferences: [],
        pointsToSample: dim.dimensionType === 'DIAMETER' ? 8 : 4,
        isCtq: dim.isCriticalToQuality
      });

      specs.push({
        specId: reqId,
        featureId: `FEAT_${primaryFace}`,
        topologyId: primaryFace,
        characteristicType: charType,
        nominalMm: dim.nominalValue,
        toleranceUpperMm: upper,
        toleranceLowerMm: lower
      });

      pointsPerFeature[`FEAT_${primaryFace}`] = dim.dimensionType === 'DIAMETER' ? 8 : 4;
    }

    // 2. Map Geometric Tolerances (GD&T)
    for (const gdt of model.geometricTolerances) {
      const primaryFace = gdt.referencedGeometryIds[0] || 'FACE_UNKNOWN';
      const datums = gdt.datumReferences.map(d => `${d.datumLabel}(${d.materialCondition})`);

      let charType: ToleranceCharacteristicType;
      switch (gdt.characteristic) {
        case 'FLATNESS':
          charType = 'FLATNESS';
          break;
        case 'CYLINDRICITY':
          charType = 'CYLINDRICITY';
          break;
        case 'CONCENTRICITY':
          charType = 'CONCENTRICITY';
          break;
        case 'POSITION':
          charType = 'POSITION';
          break;
        case 'PROFILE_OF_A_LINE':
        case 'PROFILE_OF_A_SURFACE':
          charType = 'LINE_PROFILE';
          break;
        default:
          charType = 'POSITION';
          unsupportedCount++;
          break;
      }

      const reqId = `INSP_GDT_${gdt.id}`;
      requirements.push({
        requirementId: reqId,
        sourcePmiId: gdt.id,
        pmiType: 'GDT',
        targetFeatureId: primaryFace,
        characteristic: charType,
        nominalMm: 0.0,
        toleranceUpperMm: gdt.toleranceValue,
        toleranceLowerMm: 0.0,
        datumReferences: datums,
        pointsToSample: gdt.characteristic === 'CYLINDRICITY' ? 16 : 9,
        isCtq: gdt.isCriticalToQuality
      });

      specs.push({
        specId: reqId,
        featureId: `FEAT_${primaryFace}`,
        topologyId: primaryFace,
        characteristicType: charType,
        nominalMm: 0.0,
        toleranceUpperMm: gdt.toleranceValue,
        toleranceLowerMm: 0.0
      });

      pointsPerFeature[`FEAT_${primaryFace}`] = Math.max(pointsPerFeature[`FEAT_${primaryFace}`] || 0, gdt.characteristic === 'CYLINDRICITY' ? 16 : 9);
    }

    const planId = `PLAN_${model.header.fileName.replace(/\.stp$/, '')}_${Date.now()}`;
    const metrologyPlan: MeasurementPlan = {
      planId,
      partId,
      partRevision: 'REV_A',
      specifications: specs,
      pointsPerFeature,
      timestampCreated: new Date().toISOString(),
      planHash: `0x${Array.from(planId).map(c => c.charCodeAt(0).toString(16)).join('').slice(0, 32)}`
    };

    const fullyAssociated = requirements.every(r => r.targetFeatureId !== 'FACE_UNKNOWN');

    return {
      planId,
      partId,
      requirements,
      metrologyPlan,
      traceabilityHash: metrologyPlan.planHash,
      fullyAssociated,
      unsupportedPmiCount: unsupportedCount
    };
  }
}
