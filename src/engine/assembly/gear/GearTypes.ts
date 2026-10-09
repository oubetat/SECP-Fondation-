export type GearType = 
  | 'SPUR_EXTERNAL' 
  | 'SPUR_INTERNAL' 
  | 'HELICAL_EXTERNAL' 
  | 'HELICAL_INTERNAL' 
  | 'BEVEL_STRAIGHT' 
  | 'BEVEL_SPIRAL' 
  | 'WORM' 
  | 'WORM_GEAR' 
  | 'RACK';

export type GearMaterialGrade = 
  | 'CASE_HARDENED_16MNCR5' 
  | 'NITRIDED_31CRMOV9' 
  | 'THROUGH_HARDENED_42CRMO4' 
  | 'CAST_IRON_GG25' 
  | 'BRONZE_CUAL10NI' 
  | 'POLYMERC_POM_GF30';

export interface GearMaterialProperties {
  grade: GearMaterialGrade;
  name: string;
  allowableContactStressMPa: number;
  allowableBendingStressMPa: number;
  elasticModulusGPa: number;
  poissonsRatio: number;
  densityKgM3: number;
}

export const GEAR_MATERIALS: Record<GearMaterialGrade, GearMaterialProperties> = {
  CASE_HARDENED_16MNCR5: {
    grade: 'CASE_HARDENED_16MNCR5',
    name: 'Case Hardened Steel (16MnCr5 / 1.7131)',
    allowableContactStressMPa: 1500,
    allowableBendingStressMPa: 450,
    elasticModulusGPa: 210,
    poissonsRatio: 0.3,
    densityKgM3: 7850
  },
  NITRIDED_31CRMOV9: {
    grade: 'NITRIDED_31CRMOV9',
    name: 'Nitrided Steel (31CrMoV9 / 1.8519)',
    allowableContactStressMPa: 1200,
    allowableBendingStressMPa: 400,
    elasticModulusGPa: 210,
    poissonsRatio: 0.3,
    densityKgM3: 7850
  },
  THROUGH_HARDENED_42CRMO4: {
    grade: 'THROUGH_HARDENED_42CRMO4',
    name: 'Through Hardened Steel (42CrMo4 / 1.7225)',
    allowableContactStressMPa: 1000,
    allowableBendingStressMPa: 350,
    elasticModulusGPa: 210,
    poissonsRatio: 0.3,
    densityKgM3: 7850
  },
  CAST_IRON_GG25: {
    grade: 'CAST_IRON_GG25',
    name: 'Grey Cast Iron (EN-GJL-250 / GG25)',
    allowableContactStressMPa: 500,
    allowableBendingStressMPa: 180,
    elasticModulusGPa: 105,
    poissonsRatio: 0.26,
    densityKgM3: 7200
  },
  BRONZE_CUAL10NI: {
    grade: 'BRONZE_CUAL10NI',
    name: 'Aluminium Bronze (CuAl10Ni5Fe4)',
    allowableContactStressMPa: 400,
    allowableBendingStressMPa: 150,
    elasticModulusGPa: 115,
    poissonsRatio: 0.33,
    densityKgM3: 7600
  },
  POLYMERC_POM_GF30: {
    grade: 'POLYMERC_POM_GF30',
    name: 'Polyoxymethylene 30% Glass Fiber (POM GF30)',
    allowableContactStressMPa: 80,
    allowableBendingStressMPa: 45,
    elasticModulusGPa: 9,
    poissonsRatio: 0.35,
    densityKgM3: 1600
  }
};

export interface GearGeometrySummary {
  pitchDiameter: number;
  baseDiameter: number;
  tipDiameter: number;
  rootDiameter: number;
  addendum: number;
  dedendum: number;
  toothThicknessPitch: number;
  circularPitch: number;
  centerDistance?: number;
}

export interface GearDefinition {
  gearId: string;
  name: string;
  type: GearType;
  module: number;
  teethCount: number;
  pressureAngleDeg: number;
  helixAngleDeg: number;
  helixDirection: 'RIGHT_HAND' | 'LEFT_HAND' | 'NONE';
  faceWidthMm: number;
  profileShiftCoefficient: number;
  material: GearMaterialGrade;
  qualityGradeISO: number;
  bore: {
    diameterMm: number;
    hasKeyway: boolean;
    keywayWidthMm?: number;
    keywayDepthMm?: number;
  };
  geometry: GearGeometrySummary;
  operatingLoads: {
    torqueNm?: number;
    powerKw?: number;
    speedRpm?: number;
  };
  strengthPreparation?: any;
  diagnostics?: string[];
  stepData?: any;
  igesData?: any;
  camPreparation?: any;
  tipDiameterMm?: number;
  pitchDiameterMm?: number;
  baseDiameterMm?: number;
  rootDiameterMm?: number;
  massProperties?: any;
  involuteProfile?: any;
  transverseModule?: number;
  featureTree?: any;
  topologySummary?: any;
}

export interface GearPairDefinition {
  pairId: string;
  pinionId: string;
  wheelId: string;
  centerDistanceMm: number;
  gearRatio: number;
  transmissionError?: number;
  contactRatio?: number;
  wheelRotationDirection?: string;
  wheelSpeedRpm?: number;
  pinionSpeedRpm?: number;
  pinionRotationDirection?: string;
  meshingStatus?: string;
  diagnostics?: string[];
  hasInterference?: boolean;
  nominalCenterDistanceMm?: number;
  contactRatioProfileEpsilonAlpha?: number;
}
