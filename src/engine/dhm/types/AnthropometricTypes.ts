/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 002
 * Anthropometric Types & Measurement Standards Definitions
 * 
 * Complies with ISO 7250-1:2017 (Basic human body measurements for technological design)
 * and ANSUR II (2012 Anthropometric Survey of U.S. Army Personnel).
 */

export type AnthropometricUnit = 'mm' | 'kg';

export type PercentileRank = 'P5' | 'P50' | 'P95' | 'CUSTOM';

export interface AnthropometricMeasurementProvenance {
  datasetId: string;
  datasetName: string;
  publicationYear: number;
  populationDescription: string;
  sampleSize: number;
  gender: 'MALE' | 'FEMALE' | 'COMBINED';
  percentile: PercentileRank;
  measurementStandard: 'ISO_7250_1' | 'ANSUR_II' | 'NHANES' | 'CUSTOM_MEASURED';
  sourceCitation: string;
}

export interface AnthropometricBodyMeasurements {
  /** Total body height standing (ISO 7250-1 4.1.2) [mm] */
  statureMm?: number;
  
  /** Vertical distance from sitting surface to vertex of head (ISO 7250-1 4.2.1) [mm] */
  sittingHeightMm?: number;
  
  /** Vertical distance from standing surface to acromion (ISO 7250-1 4.1.7) [mm] */
  shoulderHeightMm?: number;
  
  /** Distance between acromia (ISO 7250-1 4.1.11) [mm] */
  shoulderBreadthMm?: number;
  
  /** Maximum horizontal breadth of hip/pelvis area standing (ISO 7250-1 4.1.13) [mm] */
  hipBreadthMm?: number;
  
  /** Distance from acromion to olecranon (ISO 7250-1 4.3.1) [mm] */
  upperArmLengthMm?: number;
  
  /** Distance from olecranon to styloid process (ISO 7250-1 4.3.2) [mm] */
  forearmLengthMm?: number;
  
  /** Distance from wrist crease to tip of middle finger (ISO 7250-1 4.3.5) [mm] */
  handLengthMm?: number;
  
  /** Distance from trochanterion / hip pivot to lateral epicondyle / knee pivot [mm] */
  thighLengthMm?: number;
  
  /** Distance from lateral epicondyle / knee pivot to lateral malleolus / ankle pivot [mm] */
  lowerLegLengthMm?: number;
  
  /** Distance from posterior heel to tip of longest toe (ISO 7250-1 4.4.1) [mm] */
  footLengthMm?: number;
  
  /** Total nude body mass [kg] */
  bodyMassKg?: number;
}

export interface SegmentMassFraction {
  segmentId: string;
  massFraction: number; // 0.0 to 1.0 (e.g. Head & Neck ~0.081, Torso ~0.497)
  massKg: number;
}

export interface AnthropometricProfile {
  profileId: string;
  name: string;
  gender: 'MALE' | 'FEMALE' | 'COMBINED';
  provenance: AnthropometricMeasurementProvenance;
  measurements: AnthropometricBodyMeasurements;
  segmentMasses: Record<string, SegmentMassFraction>;
  isValid: boolean;
  validationErrors: string[];
}

export interface AnthropometricValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Anatomical Physical Limits for Bounding Inspection (in SI units)
 */
export const ANTHROPOMETRIC_BOUNDS = {
  statureMm: { min: 1000, max: 2400 },
  sittingHeightMm: { min: 500, max: 1300 },
  shoulderHeightMm: { min: 700, max: 2000 },
  shoulderBreadthMm: { min: 250, max: 700 },
  hipBreadthMm: { min: 200, max: 650 },
  upperArmLengthMm: { min: 180, max: 550 },
  forearmLengthMm: { min: 160, max: 500 },
  handLengthMm: { min: 120, max: 270 },
  thighLengthMm: { min: 250, max: 750 },
  lowerLegLengthMm: { min: 250, max: 700 },
  footLengthMm: { min: 150, max: 400 },
  bodyMassKg: { min: 30, max: 250 }
};
