/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 002
 * Anthropometric Dataset Registry & Provenance Manager
 * 
 * Manages authentic, traceable anthropometric datasets from ISO 7250-1 and ANSUR II.
 * Enforces strict validation, SI unit compliance, and missing-data integrity.
 */

import {
  AnthropometricProfile,
  AnthropometricBodyMeasurements,
  AnthropometricValidationResult,
  ANTHROPOMETRIC_BOUNDS,
  PercentileRank
} from '../types/AnthropometricTypes';

export class AnthropometricDatasetRegistry {
  private static instance: AnthropometricDatasetRegistry;
  private datasets: Map<string, AnthropometricProfile> = new Map();

  private constructor() {
    this.initializeAuthenticDatasets();
  }

  public static getInstance(): AnthropometricDatasetRegistry {
    if (!AnthropometricDatasetRegistry.instance) {
      AnthropometricDatasetRegistry.instance = new AnthropometricDatasetRegistry();
    }
    return AnthropometricDatasetRegistry.instance;
  }

  /**
   * Resets registry to initial state (for test isolation)
   */
  public reset(): void {
    this.datasets.clear();
    this.initializeAuthenticDatasets();
  }

  /**
   * Validates an anthropometric profile against physical bounds, SI units, and provenance.
   */
  public static validateProfile(profile: AnthropometricProfile): AnthropometricValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!profile) {
      return { isValid: false, errors: ['Profile is null or undefined.'], warnings: [] };
    }

    // 1. Provenance Validation
    const prov = profile.provenance;
    if (!prov || !prov.datasetId || !prov.datasetName || !prov.sourceCitation) {
      errors.push('Anthropometric profile is missing required provenance details.');
    }
    if (prov && prov.sampleSize <= 0) {
      errors.push(`Invalid provenance sample size: ${prov?.sampleSize}. Must be positive.`);
    }

    // 2. Measurement Physical Bounding & Type Check
    const m = profile.measurements;
    if (!m) {
      errors.push('Anthropometric profile contains no measurements object.');
      return { isValid: false, errors, warnings };
    }

    let definedCount = 0;
    for (const [key, val] of Object.entries(m)) {
      if (val !== undefined && val !== null) {
        definedCount++;
        if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
          errors.push(`Measurement '${key}' contains non-numeric or non-finite value: ${val}`);
          continue;
        }

        const bounds = (ANTHROPOMETRIC_BOUNDS as any)[key];
        if (bounds) {
          if (val < bounds.min || val > bounds.max) {
            errors.push(
              `Measurement '${key}' value ${val} is out of physical anatomical bounds [${bounds.min}, ${bounds.max}].`
            );
          }
        }
      }
    }

    if (definedCount === 0) {
      errors.push('Anthropometric profile contains zero defined measurements.');
    }

    // 3. Proportional Consistency Check (if both stature and sitting height are present)
    if (m.statureMm && m.sittingHeightMm) {
      if (m.sittingHeightMm >= m.statureMm) {
        errors.push(
          `Sitting height (${m.sittingHeightMm} mm) cannot be greater than or equal to total stature (${m.statureMm} mm).`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Initializes verified authentic reference datasets from ANSUR II (2012)
   */
  private initializeAuthenticDatasets(): void {
    // -----------------------------------------------------------------------
    // ANSUR II Male 50th Percentile (P50) — Reference Sample N=4082
    // -----------------------------------------------------------------------
    const ansur2MaleP50: AnthropometricProfile = {
      profileId: 'ANSUR2_MALE_P50',
      name: 'ANSUR II 2012 Male 50th Percentile Reference',
      gender: 'MALE',
      provenance: {
        datasetId: 'ANSUR_II_2012_MALE_P50',
        datasetName: '2012 Anthropometric Survey of U.S. Army Personnel (ANSUR II)',
        publicationYear: 2012,
        populationDescription: 'U.S. Army Active Duty Male Personnel',
        sampleSize: 4082,
        gender: 'MALE',
        percentile: 'P50',
        measurementStandard: 'ANSUR_II',
        sourceCitation: 'Gordon et al., 2014, NATICK/TR-15/007, U.S. Army Natick Soldier RD&E Center'
      },
      measurements: {
        statureMm: 1756,
        sittingHeightMm: 914,
        shoulderHeightMm: 1443,
        shoulderBreadthMm: 412,
        hipBreadthMm: 338,
        upperArmLengthMm: 368,
        forearmLengthMm: 269,
        handLengthMm: 194,
        thighLengthMm: 432,
        lowerLegLengthMm: 435,
        footLengthMm: 269,
        bodyMassKg: 84.6
      },
      segmentMasses: {
        PELVIS: { segmentId: 'PELVIS', massFraction: 0.142, massKg: 12.01 },
        LUMBAR_SPINE: { segmentId: 'LUMBAR_SPINE', massFraction: 0.139, massKg: 11.76 },
        THORACIC_SPINE: { segmentId: 'THORACIC_SPINE', massFraction: 0.216, massKg: 18.27 },
        HEAD_NECK: { segmentId: 'HEAD_NECK', massFraction: 0.081, massKg: 6.85 },
        UPPER_ARM: { segmentId: 'UPPER_ARM', massFraction: 0.028, massKg: 2.37 },
        FOREARM: { segmentId: 'FOREARM', massFraction: 0.016, massKg: 1.35 },
        HAND: { segmentId: 'HAND', massFraction: 0.006, massKg: 0.51 },
        THIGH: { segmentId: 'THIGH', massFraction: 0.100, massKg: 8.46 },
        LOWER_LEG: { segmentId: 'LOWER_LEG', massFraction: 0.0465, massKg: 3.93 },
        FOOT: { segmentId: 'FOOT', massFraction: 0.0145, massKg: 1.23 }
      },
      isValid: true,
      validationErrors: []
    };

    // -----------------------------------------------------------------------
    // ANSUR II Male 5th Percentile (P5) — Small Male
    // -----------------------------------------------------------------------
    const ansur2MaleP5: AnthropometricProfile = {
      profileId: 'ANSUR2_MALE_P5',
      name: 'ANSUR II 2012 Male 5th Percentile Reference',
      gender: 'MALE',
      provenance: {
        datasetId: 'ANSUR_II_2012_MALE_P5',
        datasetName: '2012 Anthropometric Survey of U.S. Army Personnel (ANSUR II)',
        publicationYear: 2012,
        populationDescription: 'U.S. Army Active Duty Male Personnel (5th Percentile)',
        sampleSize: 4082,
        gender: 'MALE',
        percentile: 'P5',
        measurementStandard: 'ANSUR_II',
        sourceCitation: 'Gordon et al., 2014, NATICK/TR-15/007, U.S. Army Natick Soldier RD&E Center'
      },
      measurements: {
        statureMm: 1633,
        sittingHeightMm: 852,
        shoulderHeightMm: 1332,
        shoulderBreadthMm: 380,
        hipBreadthMm: 310,
        upperArmLengthMm: 338,
        forearmLengthMm: 247,
        handLengthMm: 178,
        thighLengthMm: 395,
        lowerLegLengthMm: 398,
        footLengthMm: 248,
        bodyMassKg: 64.2
      },
      segmentMasses: {},
      isValid: true,
      validationErrors: []
    };

    // -----------------------------------------------------------------------
    // ANSUR II Male 95th Percentile (P95) — Large Male
    // -----------------------------------------------------------------------
    const ansur2MaleP95: AnthropometricProfile = {
      profileId: 'ANSUR2_MALE_P95',
      name: 'ANSUR II 2012 Male 95th Percentile Reference',
      gender: 'MALE',
      provenance: {
        datasetId: 'ANSUR_II_2012_MALE_P95',
        datasetName: '2012 Anthropometric Survey of U.S. Army Personnel (ANSUR II)',
        publicationYear: 2012,
        populationDescription: 'U.S. Army Active Duty Male Personnel (95th Percentile)',
        sampleSize: 4082,
        gender: 'MALE',
        percentile: 'P95',
        measurementStandard: 'ANSUR_II',
        sourceCitation: 'Gordon et al., 2014, NATICK/TR-15/007, U.S. Army Natick Soldier RD&E Center'
      },
      measurements: {
        statureMm: 1880,
        sittingHeightMm: 978,
        shoulderHeightMm: 1555,
        shoulderBreadthMm: 446,
        hipBreadthMm: 372,
        upperArmLengthMm: 398,
        forearmLengthMm: 292,
        handLengthMm: 211,
        thighLengthMm: 470,
        lowerLegLengthMm: 472,
        footLengthMm: 291,
        bodyMassKg: 108.5
      },
      segmentMasses: {},
      isValid: true,
      validationErrors: []
    };

    // -----------------------------------------------------------------------
    // ANSUR II Female 50th Percentile (P50) — Reference Sample N=1986
    // -----------------------------------------------------------------------
    const ansur2FemaleP50: AnthropometricProfile = {
      profileId: 'ANSUR2_FEMALE_P50',
      name: 'ANSUR II 2012 Female 50th Percentile Reference',
      gender: 'FEMALE',
      provenance: {
        datasetId: 'ANSUR_II_2012_FEMALE_P50',
        datasetName: '2012 Anthropometric Survey of U.S. Army Personnel (ANSUR II)',
        publicationYear: 2012,
        populationDescription: 'U.S. Army Active Duty Female Personnel',
        sampleSize: 1986,
        gender: 'FEMALE',
        percentile: 'P50',
        measurementStandard: 'ANSUR_II',
        sourceCitation: 'Gordon et al., 2014, NATICK/TR-15/007, U.S. Army Natick Soldier RD&E Center'
      },
      measurements: {
        statureMm: 1628,
        sittingHeightMm: 854,
        shoulderHeightMm: 1332,
        shoulderBreadthMm: 363,
        hipBreadthMm: 351,
        upperArmLengthMm: 334,
        forearmLengthMm: 241,
        handLengthMm: 178,
        thighLengthMm: 401,
        lowerLegLengthMm: 396,
        footLengthMm: 240,
        bodyMassKg: 67.3
      },
      segmentMasses: {},
      isValid: true,
      validationErrors: []
    };

    // Register initial datasets
    this.registerProfile(ansur2MaleP50);
    this.registerProfile(ansur2MaleP5);
    this.registerProfile(ansur2MaleP95);
    this.registerProfile(ansur2FemaleP50);
  }

  public registerProfile(profile: AnthropometricProfile): void {
    const val = AnthropometricDatasetRegistry.validateProfile(profile);
    profile.isValid = val.isValid;
    profile.validationErrors = val.errors;

    if (!val.isValid) {
      throw new Error(`Cannot register invalid anthropometric dataset: ${val.errors.join('; ')}`);
    }

    this.datasets.set(profile.profileId, profile);
  }

  public getProfile(profileId: string): AnthropometricProfile | undefined {
    return this.datasets.get(profileId);
  }

  public getAllProfiles(): AnthropometricProfile[] {
    return Array.from(this.datasets.values());
  }
}
