/**
 * SECP Golden Turbine Test Article (GTTA-101)
 * Hardware Test Specimen for Cyber-Physical Verification
 */

import { FeatureMeasurementRecord } from './CyberPhysicalContracts';

export interface GTTAFeatureSpec {
  featureId: string;
  featureName: string;
  nominalMm: number;
  toleranceUpperMm: number;
  toleranceLowerMm: number;
  criticality: 'CRITICAL_SAFETY' | 'MAJOR_FIT' | 'MINOR_FINISH';
}

export const GTTA_101_FEATURES: readonly GTTAFeatureSpec[] = [
  {
    featureId: 'FEAT-BORE-01',
    featureName: 'Central Shaft Precision Bore Diameter',
    nominalMm: 25.000,
    toleranceUpperMm: 0.005,
    toleranceLowerMm: -0.005,
    criticality: 'CRITICAL_SAFETY'
  },
  {
    featureId: 'FEAT-BLADE-TIP-01',
    featureName: 'Turbine Blade Tip Outer Diameter',
    nominalMm: 120.000,
    toleranceUpperMm: 0.020,
    toleranceLowerMm: -0.020,
    criticality: 'CRITICAL_SAFETY'
  },
  {
    featureId: 'FEAT-BLADE-ROOT-01',
    featureName: 'Sculpted Blade Root Wall Thickness',
    nominalMm: 3.500,
    toleranceUpperMm: 0.010,
    toleranceLowerMm: -0.010,
    criticality: 'MAJOR_FIT'
  },
  {
    featureId: 'FEAT-DATUM-FACE-A',
    featureName: 'Primary Datum Face Planarity',
    nominalMm: 0.000,
    toleranceUpperMm: 0.003,
    toleranceLowerMm: 0.000,
    criticality: 'CRITICAL_SAFETY'
  },
  {
    featureId: 'FEAT-HUB-HEIGHT-01',
    featureName: 'Turbine Rotor Hub Height',
    nominalMm: 45.000,
    toleranceUpperMm: 0.015,
    toleranceLowerMm: -0.015,
    criticality: 'MAJOR_FIT'
  }
];

export class GoldenTurbineTestArticle {
  public static readonly SPEC_ID = 'GTTA-101';
  public static readonly CANONICAL_REVISION_A = 'REV-A1B2C3D4';
  public static readonly CANONICAL_REVISION_B = 'REV-MUTATED-B5C6';
  public static readonly DEFAULT_PART_SERIAL = 'SN-GTTA101-2026-001';

  public static generateNominalMeasurements(partSerial: string = GoldenTurbineTestArticle.DEFAULT_PART_SERIAL): FeatureMeasurementRecord[] {
    return GTTA_101_FEATURES.map(spec => ({
      featureId: spec.featureId,
      featureName: spec.featureName,
      nominalValueMm: spec.nominalMm,
      measuredValueMm: spec.nominalMm + (Math.random() * 0.002 - 0.001), // Minor realistic variation within tolerance
      toleranceUpperMm: spec.toleranceUpperMm,
      toleranceLowerMm: spec.toleranceLowerMm,
      deviationMm: 0.0005,
      passed: true
    }));
  }

  public static generateMutatedMeasurements(partSerial: string = GoldenTurbineTestArticle.DEFAULT_PART_SERIAL): FeatureMeasurementRecord[] {
    return GTTA_101_FEATURES.map(spec => {
      if (spec.featureId === 'FEAT-BORE-01') {
        // Bore is out of tolerance in Revision B geometry!
        const deviation = 0.025; // 25 microns deviation, exceeds +/- 5 micron limit
        return {
          featureId: spec.featureId,
          featureName: spec.featureName,
          nominalValueMm: spec.nominalMm,
          measuredValueMm: spec.nominalMm + deviation,
          toleranceUpperMm: spec.toleranceUpperMm,
          toleranceLowerMm: spec.toleranceLowerMm,
          deviationMm: deviation,
          passed: false
        };
      }
      return {
        featureId: spec.featureId,
        featureName: spec.featureName,
        nominalValueMm: spec.nominalMm,
        measuredValueMm: spec.nominalMm + 0.001,
        toleranceUpperMm: spec.toleranceUpperMm,
        toleranceLowerMm: spec.toleranceLowerMm,
        deviationMm: 0.001,
        passed: true
      };
    });
  }
}
