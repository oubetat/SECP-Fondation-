/**
 * SECP Industrial OS v2 — CAM Production Engine
 * PATCH-255 — Manufacturing Feature Validator
 */

import { ManufacturingFeature, RecognitionState } from './FeatureTypes';
import { FaceGeometryInfo } from './FeatureGeometryAnalyzer';

export interface ValidationReport {
  isValid: boolean;
  totalValidated: number;
  passedCount: number;
  warningCount: number;
  failedCount: number;
  errors: { featureId: string; reason: string; severity: 'ERROR' | 'WARNING' }[];
}

export class ManufacturingFeatureValidator {
  /**
   * Validates all features against geometric rules, topology consistency, and manufacturing viability
   */
  public static validateFeatures(
    features: ManufacturingFeature[],
    faceGeoms: Map<string, FaceGeometryInfo>
  ): ValidationReport {
    const errors: { featureId: string; reason: string; severity: 'ERROR' | 'WARNING' }[] = [];
    let passedCount = 0;
    let warningCount = 0;
    let failedCount = 0;

    for (const feat of features) {
      let featValid = true;

      // 1. Check topology reference validity (no dangling face IDs)
      for (const faceId of feat.faceIds) {
        if (!faceGeoms.has(faceId)) {
          errors.push({
            featureId: feat.id,
            reason: `Dangling face reference: Face ID '${faceId}' does not exist in CAD B-Rep model.`,
            severity: 'ERROR',
          });
          featValid = false;
        }
      }

      // 2. Check parameter validity
      if (feat.parameters) {
        if (feat.parameters.type === 'HOLE') {
          const p = feat.parameters.params;
          if (p.diameterMm <= 0 || !Number.isFinite(p.diameterMm)) {
            errors.push({ featureId: feat.id, reason: `Invalid hole diameter: ${p.diameterMm}mm`, severity: 'ERROR' });
            featValid = false;
          }
          if (p.depthMm <= 0 || !Number.isFinite(p.depthMm)) {
            errors.push({ featureId: feat.id, reason: `Invalid hole depth: ${p.depthMm}mm`, severity: 'ERROR' });
            featValid = false;
          }
        } else if (feat.parameters.type === 'POCKET') {
          const p = feat.parameters.params;
          if (p.widthMm <= 0 || p.lengthMm <= 0 || p.depthMm <= 0) {
            errors.push({ featureId: feat.id, reason: `Invalid pocket dimensions: ${p.widthMm}x${p.lengthMm}x${p.depthMm}mm`, severity: 'ERROR' });
            featValid = false;
          }
        } else if (feat.parameters.type === 'SLOT') {
          const p = feat.parameters.params;
          if (p.widthMm <= 0 || p.lengthMm <= 0 || p.depthMm <= 0) {
            errors.push({ featureId: feat.id, reason: `Invalid slot dimensions: ${p.widthMm}x${p.lengthMm}x${p.depthMm}mm`, severity: 'ERROR' });
            featValid = false;
          }
        }
      }

      // 3. Check confidence status
      if (feat.confidence.state === RecognitionState.AMBIGUOUS) {
        errors.push({
          featureId: feat.id,
          reason: `Feature is flagged as AMBIGUOUS and requires manual engineering review.`,
          severity: 'WARNING',
        });
        warningCount++;
      } else if (feat.confidence.state === RecognitionState.UNRECOGNIZED) {
        errors.push({
          featureId: feat.id,
          reason: `Unrecognized geometry could not be classified.`,
          severity: 'ERROR',
        });
        featValid = false;
      }

      if (featValid) {
        passedCount++;
      } else {
        failedCount++;
      }
    }

    return {
      isValid: failedCount === 0,
      totalValidated: features.length,
      passedCount,
      warningCount,
      failedCount,
      errors,
    };
  }
}
