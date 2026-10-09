/**
 * PATCH-222 — Bearing Catalog Database & Search Engine
 * Parametric specifications for standard bearing series across all required rolling bearing classes:
 * Deep Groove Ball, Angular Contact, Self-Aligning, Cylindrical Roller, Tapered Roller,
 * Spherical Roller, Needle Roller, Thrust Ball, and Thrust Roller bearings.
 */

import { BearingType, BearingConfiguration, BearingStandard, ToleranceClass, RadialClearanceClass, BearingMaterialGrade } from './BearingTypes';

export interface CatalogBearingEntry {
  partNumber: string;
  series: string;
  bearingType: BearingType;
  standard: BearingStandard;
  standardDoc: string;
  boreDiameter: number;      // d (mm)
  outerDiameter: number;     // D (mm)
  width: number;             // B / T / H (mm)
  chamferMin: number;        // r_min (mm)
  dynamicLoadRatingC_kN: number;
  staticLoadRatingC0_kN: number;
  limitingSpeedRpm: number;
  referenceSpeedRpm: number;
  supportedConfigurations: BearingConfiguration[];
  defaultConfiguration: BearingConfiguration;
  defaultToleranceClass: ToleranceClass;
  defaultRadialClearance: RadialClearanceClass;
  defaultMaterial: BearingMaterialGrade;
  contactAngleDeg?: number;
  flangeDiameter?: number;
  flangeWidth?: number;
  description: string;
}

export class BearingCatalog {
  private static readonly ENTRIES: CatalogBearingEntry[] = [
    // ----------------------------------------------------------------
    // 1. DEEP GROOVE BALL BEARINGS (ISO 15 / DIN 625)
    // ----------------------------------------------------------------
    // 6000 Series (Extra Light)
    {
      partNumber: '6000',
      series: '60',
      bearingType: 'DEEP_GROOVE_BALL',
      standard: 'ISO',
      standardDoc: 'ISO 15 / DIN 625',
      boreDiameter: 10,
      outerDiameter: 26,
      width: 8,
      chamferMin: 0.3,
      dynamicLoadRatingC_kN: 4.75,
      staticLoadRatingC0_kN: 1.96,
      limitingSpeedRpm: 38000,
      referenceSpeedRpm: 60000,
      supportedConfigurations: ['OPEN', 'SHIELDED_ZZ', 'SEALED_2RS', 'SNAP_RING_GROOVE'],
      defaultConfiguration: 'OPEN',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Single row deep groove ball bearing 10x26x8 mm'
    },
    {
      partNumber: '6004',
      series: '60',
      bearingType: 'DEEP_GROOVE_BALL',
      standard: 'ISO',
      standardDoc: 'ISO 15 / DIN 625',
      boreDiameter: 20,
      outerDiameter: 42,
      width: 12,
      chamferMin: 0.6,
      dynamicLoadRatingC_kN: 9.95,
      staticLoadRatingC0_kN: 5.0,
      limitingSpeedRpm: 22000,
      referenceSpeedRpm: 36000,
      supportedConfigurations: ['OPEN', 'SHIELDED_ZZ', 'SEALED_2RS', 'SNAP_RING_GROOVE'],
      defaultConfiguration: 'OPEN',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Single row deep groove ball bearing 20x42x12 mm'
    },
    // 6200 Series (Light) - including golden benchmark 6204
    {
      partNumber: '6200',
      series: '62',
      bearingType: 'DEEP_GROOVE_BALL',
      standard: 'ISO',
      standardDoc: 'ISO 15 / DIN 625',
      boreDiameter: 10,
      outerDiameter: 30,
      width: 9,
      chamferMin: 0.6,
      dynamicLoadRatingC_kN: 5.4,
      staticLoadRatingC0_kN: 2.36,
      limitingSpeedRpm: 30000,
      referenceSpeedRpm: 48000,
      supportedConfigurations: ['OPEN', 'SHIELDED_ZZ', 'SEALED_2RS', 'SNAP_RING_GROOVE'],
      defaultConfiguration: 'OPEN',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Single row deep groove ball bearing 10x30x9 mm'
    },
    {
      partNumber: '6201',
      series: '62',
      bearingType: 'DEEP_GROOVE_BALL',
      standard: 'ISO',
      standardDoc: 'ISO 15 / DIN 625',
      boreDiameter: 12,
      outerDiameter: 32,
      width: 10,
      chamferMin: 0.6,
      dynamicLoadRatingC_kN: 7.28,
      staticLoadRatingC0_kN: 3.1,
      limitingSpeedRpm: 28000,
      referenceSpeedRpm: 43000,
      supportedConfigurations: ['OPEN', 'SHIELDED_ZZ', 'SEALED_2RS'],
      defaultConfiguration: 'OPEN',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Single row deep groove ball bearing 12x32x10 mm'
    },
    {
      partNumber: '6202',
      series: '62',
      bearingType: 'DEEP_GROOVE_BALL',
      standard: 'ISO',
      standardDoc: 'ISO 15 / DIN 625',
      boreDiameter: 15,
      outerDiameter: 35,
      width: 11,
      chamferMin: 0.6,
      dynamicLoadRatingC_kN: 8.06,
      staticLoadRatingC0_kN: 3.75,
      limitingSpeedRpm: 24000,
      referenceSpeedRpm: 38000,
      supportedConfigurations: ['OPEN', 'SHIELDED_ZZ', 'SEALED_2RS', 'SNAP_RING_GROOVE'],
      defaultConfiguration: 'OPEN',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Single row deep groove ball bearing 15x35x11 mm'
    },
    {
      partNumber: '6203',
      series: '62',
      bearingType: 'DEEP_GROOVE_BALL',
      standard: 'ISO',
      standardDoc: 'ISO 15 / DIN 625',
      boreDiameter: 17,
      outerDiameter: 40,
      width: 12,
      chamferMin: 0.6,
      dynamicLoadRatingC_kN: 9.95,
      staticLoadRatingC0_kN: 4.75,
      limitingSpeedRpm: 20000,
      referenceSpeedRpm: 32000,
      supportedConfigurations: ['OPEN', 'SHIELDED_ZZ', 'SEALED_2RS'],
      defaultConfiguration: 'OPEN',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Single row deep groove ball bearing 17x40x12 mm'
    },
    {
      partNumber: '6204',
      series: '62',
      bearingType: 'DEEP_GROOVE_BALL',
      standard: 'ISO',
      standardDoc: 'ISO 15 / DIN 625',
      boreDiameter: 20,
      outerDiameter: 47,
      width: 14,
      chamferMin: 1.0,
      dynamicLoadRatingC_kN: 13.5,
      staticLoadRatingC0_kN: 6.55,
      limitingSpeedRpm: 18000,
      referenceSpeedRpm: 28000,
      supportedConfigurations: ['OPEN', 'SHIELDED_ZZ', 'SEALED_2RS', 'SNAP_RING_GROOVE'],
      defaultConfiguration: 'OPEN',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Single row deep groove ball bearing 20x47x14 mm (ISO Golden Standard)'
    },
    {
      partNumber: '6205',
      series: '62',
      bearingType: 'DEEP_GROOVE_BALL',
      standard: 'ISO',
      standardDoc: 'ISO 15 / DIN 625',
      boreDiameter: 25,
      outerDiameter: 52,
      width: 15,
      chamferMin: 1.0,
      dynamicLoadRatingC_kN: 14.8,
      staticLoadRatingC0_kN: 7.8,
      limitingSpeedRpm: 15000,
      referenceSpeedRpm: 24000,
      supportedConfigurations: ['OPEN', 'SHIELDED_ZZ', 'SEALED_2RS', 'SNAP_RING_GROOVE'],
      defaultConfiguration: 'OPEN',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Single row deep groove ball bearing 25x52x15 mm'
    },
    {
      partNumber: '6206',
      series: '62',
      bearingType: 'DEEP_GROOVE_BALL',
      standard: 'ISO',
      standardDoc: 'ISO 15 / DIN 625',
      boreDiameter: 30,
      outerDiameter: 62,
      width: 16,
      chamferMin: 1.0,
      dynamicLoadRatingC_kN: 20.3,
      staticLoadRatingC0_kN: 11.2,
      limitingSpeedRpm: 13000,
      referenceSpeedRpm: 20000,
      supportedConfigurations: ['OPEN', 'SHIELDED_ZZ', 'SEALED_2RS'],
      defaultConfiguration: 'OPEN',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Single row deep groove ball bearing 30x62x16 mm'
    },
    // 6300 Series (Medium)
    {
      partNumber: '6304',
      series: '63',
      bearingType: 'DEEP_GROOVE_BALL',
      standard: 'ISO',
      standardDoc: 'ISO 15 / DIN 625',
      boreDiameter: 20,
      outerDiameter: 52,
      width: 15,
      chamferMin: 1.1,
      dynamicLoadRatingC_kN: 16.8,
      staticLoadRatingC0_kN: 7.8,
      limitingSpeedRpm: 16000,
      referenceSpeedRpm: 24000,
      supportedConfigurations: ['OPEN', 'SHIELDED_ZZ', 'SEALED_2RS'],
      defaultConfiguration: 'OPEN',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Medium series deep groove ball bearing 20x52x15 mm'
    },
    {
      partNumber: '6305',
      series: '63',
      bearingType: 'DEEP_GROOVE_BALL',
      standard: 'ISO',
      standardDoc: 'ISO 15 / DIN 625',
      boreDiameter: 25,
      outerDiameter: 62,
      width: 17,
      chamferMin: 1.1,
      dynamicLoadRatingC_kN: 23.4,
      staticLoadRatingC0_kN: 11.6,
      limitingSpeedRpm: 13000,
      referenceSpeedRpm: 20000,
      supportedConfigurations: ['OPEN', 'SHIELDED_ZZ', 'SEALED_2RS'],
      defaultConfiguration: 'OPEN',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Medium series deep groove ball bearing 25x62x17 mm'
    },

    // ----------------------------------------------------------------
    // 2. ANGULAR CONTACT BALL BEARINGS (ISO 15 / DIN 628)
    // ----------------------------------------------------------------
    {
      partNumber: '7204-B',
      series: '72',
      bearingType: 'ANGULAR_CONTACT_BALL',
      standard: 'ISO',
      standardDoc: 'ISO 15 / DIN 628',
      boreDiameter: 20,
      outerDiameter: 47,
      width: 14,
      chamferMin: 1.0,
      contactAngleDeg: 40,
      dynamicLoadRatingC_kN: 14.0,
      staticLoadRatingC0_kN: 7.65,
      limitingSpeedRpm: 19000,
      referenceSpeedRpm: 24000,
      supportedConfigurations: ['OPEN', 'SEALED_2RS', 'SINGLE_ROW'],
      defaultConfiguration: 'SINGLE_ROW',
      defaultToleranceClass: 'ABEC_3_P6',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Single row angular contact ball bearing (40° contact angle) 20x47x14 mm'
    },
    {
      partNumber: '7205-B',
      series: '72',
      bearingType: 'ANGULAR_CONTACT_BALL',
      standard: 'ISO',
      standardDoc: 'ISO 15 / DIN 628',
      boreDiameter: 25,
      outerDiameter: 52,
      width: 15,
      chamferMin: 1.0,
      contactAngleDeg: 40,
      dynamicLoadRatingC_kN: 15.6,
      staticLoadRatingC0_kN: 9.3,
      limitingSpeedRpm: 16000,
      referenceSpeedRpm: 20000,
      supportedConfigurations: ['OPEN', 'SEALED_2RS', 'SINGLE_ROW'],
      defaultConfiguration: 'SINGLE_ROW',
      defaultToleranceClass: 'ABEC_3_P6',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Single row angular contact ball bearing (40° contact angle) 25x52x15 mm'
    },
    {
      partNumber: '3204-A',
      series: '32',
      bearingType: 'ANGULAR_CONTACT_BALL',
      standard: 'ISO',
      standardDoc: 'ISO 15 / DIN 628-3',
      boreDiameter: 20,
      outerDiameter: 47,
      width: 20.6,
      chamferMin: 1.0,
      contactAngleDeg: 30,
      dynamicLoadRatingC_kN: 20.0,
      staticLoadRatingC0_kN: 12.0,
      limitingSpeedRpm: 15000,
      referenceSpeedRpm: 18000,
      supportedConfigurations: ['OPEN', 'SHIELDED_ZZ', 'SEALED_2RS', 'DOUBLE_ROW'],
      defaultConfiguration: 'DOUBLE_ROW',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Double row angular contact ball bearing 20x47x20.6 mm'
    },

    // ----------------------------------------------------------------
    // 3. SELF-ALIGNING BALL BEARINGS (DIN 630 / ISO 15)
    // ----------------------------------------------------------------
    {
      partNumber: '1204',
      series: '12',
      bearingType: 'SELF_ALIGNING_BALL',
      standard: 'ISO',
      standardDoc: 'ISO 15 / DIN 630',
      boreDiameter: 20,
      outerDiameter: 47,
      width: 14,
      chamferMin: 1.0,
      dynamicLoadRatingC_kN: 10.0,
      staticLoadRatingC0_kN: 2.6,
      limitingSpeedRpm: 18000,
      referenceSpeedRpm: 24000,
      supportedConfigurations: ['OPEN', 'SEALED_2RS', 'DOUBLE_ROW'],
      defaultConfiguration: 'DOUBLE_ROW',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Self-aligning ball bearing with spherical outer raceway 20x47x14 mm'
    },
    {
      partNumber: '1205',
      series: '12',
      bearingType: 'SELF_ALIGNING_BALL',
      standard: 'ISO',
      standardDoc: 'ISO 15 / DIN 630',
      boreDiameter: 25,
      outerDiameter: 52,
      width: 15,
      chamferMin: 1.0,
      dynamicLoadRatingC_kN: 12.5,
      staticLoadRatingC0_kN: 3.4,
      limitingSpeedRpm: 15000,
      referenceSpeedRpm: 20000,
      supportedConfigurations: ['OPEN', 'SEALED_2RS', 'DOUBLE_ROW'],
      defaultConfiguration: 'DOUBLE_ROW',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Self-aligning ball bearing 25x52x15 mm'
    },

    // ----------------------------------------------------------------
    // 4. CYLINDRICAL ROLLER BEARINGS (ISO 15 / DIN 5412)
    // ----------------------------------------------------------------
    {
      partNumber: 'NU204',
      series: 'NU2',
      bearingType: 'CYLINDRICAL_ROLLER',
      standard: 'ISO',
      standardDoc: 'ISO 15 / DIN 5412',
      boreDiameter: 20,
      outerDiameter: 47,
      width: 14,
      chamferMin: 1.0,
      dynamicLoadRatingC_kN: 26.5,
      staticLoadRatingC0_kN: 15.6,
      limitingSpeedRpm: 18000,
      referenceSpeedRpm: 17000,
      supportedConfigurations: ['OPEN', 'SINGLE_ROW'],
      defaultConfiguration: 'OPEN',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Cylindrical roller bearing (separable inner ring, non-locating) 20x47x14 mm'
    },
    {
      partNumber: 'NJ205',
      series: 'NJ2',
      bearingType: 'CYLINDRICAL_ROLLER',
      standard: 'ISO',
      standardDoc: 'ISO 15 / DIN 5412',
      boreDiameter: 25,
      outerDiameter: 52,
      width: 15,
      chamferMin: 1.0,
      dynamicLoadRatingC_kN: 31.0,
      staticLoadRatingC0_kN: 19.3,
      limitingSpeedRpm: 15000,
      referenceSpeedRpm: 14000,
      supportedConfigurations: ['OPEN', 'SINGLE_ROW'],
      defaultConfiguration: 'OPEN',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Cylindrical roller bearing (single flange inner ring) 25x52x15 mm'
    },

    // ----------------------------------------------------------------
    // 5. TAPERED ROLLER BEARINGS (ISO 355 / DIN 720)
    // ----------------------------------------------------------------
    {
      partNumber: '30204',
      series: '302',
      bearingType: 'TAPERED_ROLLER',
      standard: 'ISO',
      standardDoc: 'ISO 355 / DIN 720',
      boreDiameter: 20,
      outerDiameter: 47,
      width: 15.25,
      chamferMin: 1.0,
      contactAngleDeg: 14,
      dynamicLoadRatingC_kN: 27.5,
      staticLoadRatingC0_kN: 23.6,
      limitingSpeedRpm: 14000,
      referenceSpeedRpm: 11000,
      supportedConfigurations: ['OPEN', 'SINGLE_ROW'],
      defaultConfiguration: 'OPEN',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Metric tapered roller bearing (cone and cup separable) 20x47x15.25 mm'
    },
    {
      partNumber: '30205',
      series: '302',
      bearingType: 'TAPERED_ROLLER',
      standard: 'ISO',
      standardDoc: 'ISO 355 / DIN 720',
      boreDiameter: 25,
      outerDiameter: 52,
      width: 16.25,
      chamferMin: 1.0,
      contactAngleDeg: 14,
      dynamicLoadRatingC_kN: 33.0,
      staticLoadRatingC0_kN: 29.0,
      limitingSpeedRpm: 12000,
      referenceSpeedRpm: 9500,
      supportedConfigurations: ['OPEN', 'SINGLE_ROW'],
      defaultConfiguration: 'OPEN',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Metric tapered roller bearing 25x52x16.25 mm'
    },

    // ----------------------------------------------------------------
    // 6. SPHERICAL ROLLER BEARINGS (DIN 635 / ISO 15)
    // ----------------------------------------------------------------
    {
      partNumber: '22205-E',
      series: '222',
      bearingType: 'SPHERICAL_ROLLER',
      standard: 'ISO',
      standardDoc: 'ISO 15 / DIN 635-2',
      boreDiameter: 25,
      outerDiameter: 52,
      width: 18,
      chamferMin: 1.0,
      dynamicLoadRatingC_kN: 48.5,
      staticLoadRatingC0_kN: 44.0,
      limitingSpeedRpm: 12000,
      referenceSpeedRpm: 9000,
      supportedConfigurations: ['OPEN', 'SEALED_2RS', 'DOUBLE_ROW'],
      defaultConfiguration: 'DOUBLE_ROW',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Spherical roller bearing with symmetrical barrel rollers 25x52x18 mm'
    },
    {
      partNumber: '22206-E',
      series: '222',
      bearingType: 'SPHERICAL_ROLLER',
      standard: 'ISO',
      standardDoc: 'ISO 15 / DIN 635-2',
      boreDiameter: 30,
      outerDiameter: 62,
      width: 20,
      chamferMin: 1.0,
      dynamicLoadRatingC_kN: 64.0,
      staticLoadRatingC0_kN: 60.0,
      limitingSpeedRpm: 9500,
      referenceSpeedRpm: 7500,
      supportedConfigurations: ['OPEN', 'SEALED_2RS', 'DOUBLE_ROW'],
      defaultConfiguration: 'DOUBLE_ROW',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Spherical roller bearing 30x62x20 mm'
    },

    // ----------------------------------------------------------------
    // 7. NEEDLE ROLLER BEARINGS (ISO 1206 / DIN 617)
    // ----------------------------------------------------------------
    {
      partNumber: 'HK2016',
      series: 'HK',
      bearingType: 'NEEDLE_ROLLER',
      standard: 'ISO',
      standardDoc: 'ISO 3245 / DIN 618',
      boreDiameter: 20,
      outerDiameter: 26,
      width: 16,
      chamferMin: 0.8,
      dynamicLoadRatingC_kN: 12.8,
      staticLoadRatingC0_kN: 19.3,
      limitingSpeedRpm: 14000,
      referenceSpeedRpm: 12000,
      supportedConfigurations: ['OPEN', 'SINGLE_ROW'],
      defaultConfiguration: 'OPEN',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Drawn cup needle roller bearing with open ends 20x26x16 mm'
    },
    {
      partNumber: 'NA4904',
      series: 'NA49',
      bearingType: 'NEEDLE_ROLLER',
      standard: 'ISO',
      standardDoc: 'ISO 1206 / DIN 617',
      boreDiameter: 20,
      outerDiameter: 37,
      width: 17,
      chamferMin: 0.6,
      dynamicLoadRatingC_kN: 21.6,
      staticLoadRatingC0_kN: 28.0,
      limitingSpeedRpm: 16000,
      referenceSpeedRpm: 14000,
      supportedConfigurations: ['OPEN', 'SEALED_2RS'],
      defaultConfiguration: 'OPEN',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Machined ring needle roller bearing with inner ring 20x37x17 mm'
    },

    // ----------------------------------------------------------------
    // 8. THRUST BALL BEARINGS (ISO 104 / DIN 711)
    // ----------------------------------------------------------------
    {
      partNumber: '51104',
      series: '511',
      bearingType: 'THRUST_BALL',
      standard: 'ISO',
      standardDoc: 'ISO 104 / DIN 711',
      boreDiameter: 20,
      outerDiameter: 35,
      width: 10,
      chamferMin: 0.3,
      dynamicLoadRatingC_kN: 14.3,
      staticLoadRatingC0_kN: 24.5,
      limitingSpeedRpm: 7500,
      referenceSpeedRpm: 5300,
      supportedConfigurations: ['OPEN', 'SINGLE_ROW'],
      defaultConfiguration: 'OPEN',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Single direction thrust ball bearing (shaft & housing washer) 20x35x10 mm'
    },
    {
      partNumber: '51105',
      series: '511',
      bearingType: 'THRUST_BALL',
      standard: 'ISO',
      standardDoc: 'ISO 104 / DIN 711',
      boreDiameter: 25,
      outerDiameter: 42,
      width: 11,
      chamferMin: 0.6,
      dynamicLoadRatingC_kN: 18.2,
      staticLoadRatingC0_kN: 35.5,
      limitingSpeedRpm: 6300,
      referenceSpeedRpm: 4500,
      supportedConfigurations: ['OPEN', 'SINGLE_ROW'],
      defaultConfiguration: 'OPEN',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Single direction thrust ball bearing 25x42x11 mm'
    },

    // ----------------------------------------------------------------
    // 9. THRUST ROLLER BEARINGS (ISO 104 / DIN 722)
    // ----------------------------------------------------------------
    {
      partNumber: '81104',
      series: '811',
      bearingType: 'THRUST_ROLLER',
      standard: 'ISO',
      standardDoc: 'ISO 104 / DIN 722',
      boreDiameter: 20,
      outerDiameter: 35,
      width: 10,
      chamferMin: 0.3,
      dynamicLoadRatingC_kN: 27.5,
      staticLoadRatingC0_kN: 64.0,
      limitingSpeedRpm: 6000,
      referenceSpeedRpm: 4000,
      supportedConfigurations: ['OPEN', 'SINGLE_ROW'],
      defaultConfiguration: 'OPEN',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Cylindrical roller thrust bearing 20x35x10 mm'
    },
    {
      partNumber: '81105',
      series: '811',
      bearingType: 'THRUST_ROLLER',
      standard: 'ISO',
      standardDoc: 'ISO 104 / DIN 722',
      boreDiameter: 25,
      outerDiameter: 42,
      width: 11,
      chamferMin: 0.6,
      dynamicLoadRatingC_kN: 33.5,
      staticLoadRatingC0_kN: 86.5,
      limitingSpeedRpm: 5000,
      referenceSpeedRpm: 3400,
      supportedConfigurations: ['OPEN', 'SINGLE_ROW'],
      defaultConfiguration: 'OPEN',
      defaultToleranceClass: 'ABEC_1_NORMAL',
      defaultRadialClearance: 'CN',
      defaultMaterial: 'BEARING_STEEL_100CR6',
      description: 'Cylindrical roller thrust bearing 25x42x11 mm'
    }
  ];

  /**
   * Retrieves all bearing catalog entries
   */
  public static getAllEntries(): CatalogBearingEntry[] {
    return [...this.ENTRIES];
  }

  /**
   * Finds entry by exact Part Number
   */
  public static getByPartNumber(partNumber: string): CatalogBearingEntry | undefined {
    const clean = partNumber.toUpperCase().trim();
    // Match base part number e.g. 6204-2RS -> 6204
    const basePart = clean.split('-')[0];
    return this.ENTRIES.find(e => e.partNumber.toUpperCase() === clean || e.partNumber.toUpperCase() === basePart);
  }

  /**
   * Multi-criteria search query
   * Examples:
   *  - "6204"
   *  - "20x47x14"
   *  - "Deep Groove"
   *  - "20 mm bore"
   *  - "Sealed"
   *  - "ISO"
   */
  public static search(query: string): CatalogBearingEntry[] {
    if (!query || query.trim() === '') {
      return this.getAllEntries();
    }

    const q = query.toLowerCase().trim();
    
    // Check dimensional query like "20x47" or "20x47x14"
    const dimMatch = q.match(/(\d+)\s*[xX*]\s*(\d+)(?:\s*[xX*]\s*(\d+))?/);
    if (dimMatch) {
      const d = parseFloat(dimMatch[1]);
      const D = parseFloat(dimMatch[2]);
      const B = dimMatch[3] ? parseFloat(dimMatch[3]) : undefined;
      return this.ENTRIES.filter(e => {
        const matchD = e.boreDiameter === d && e.outerDiameter === D;
        return B !== undefined ? (matchD && Math.abs(e.width - B) < 0.5) : matchD;
      });
    }

    return this.ENTRIES.filter(e => {
      return (
        e.partNumber.toLowerCase().includes(q) ||
        e.series.toLowerCase().includes(q) ||
        e.bearingType.toLowerCase().replace(/_/g, ' ').includes(q) ||
        e.standard.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        `${e.boreDiameter}mm`.includes(q) ||
        `${e.boreDiameter} mm`.includes(q) ||
        `${e.outerDiameter}mm`.includes(q) ||
        `${e.outerDiameter} mm`.includes(q)
      );
    });
  }

  /**
   * Filter by category and dimensions
   */
  public static filter(params: {
    bearingType?: BearingType;
    standard?: BearingStandard;
    minBore?: number;
    maxBore?: number;
    minOD?: number;
    maxOD?: number;
  }): CatalogBearingEntry[] {
    return this.ENTRIES.filter(e => {
      if (params.bearingType && e.bearingType !== params.bearingType) return false;
      if (params.standard && e.standard !== params.standard) return false;
      if (params.minBore !== undefined && e.boreDiameter < params.minBore) return false;
      if (params.maxBore !== undefined && e.boreDiameter > params.maxBore) return false;
      if (params.minOD !== undefined && e.outerDiameter < params.minOD) return false;
      if (params.maxOD !== undefined && e.outerDiameter > params.maxOD) return false;
      return true;
    });
  }
}
