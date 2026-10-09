export type ShaftMaterialGrade = 
  | 'CARBON_STEEL_C45' 
  | 'ALLOY_STEEL_42CRMO4' 
  | 'STAINLESS_STEEL_304' 
  | 'STAINLESS_STEEL_316' 
  | 'ALUMINUM_6061_T6';

export interface ShaftMaterialProperties {
  grade: ShaftMaterialGrade;
  name: string;
  yieldStrengthMPa: number;
  tensileStrengthMPa: number;
  elasticModulusGPa: number;
  poissonsRatio: number;
  densityKgM3: number;
  thermalExpansionPpmK: number;
}

export const SHAFT_MATERIALS: Record<ShaftMaterialGrade, ShaftMaterialProperties> = {
  CARBON_STEEL_C45: {
    grade: 'CARBON_STEEL_C45',
    name: 'Medium Carbon Steel (C45 / 1.0503)',
    yieldStrengthMPa: 310,
    tensileStrengthMPa: 580,
    elasticModulusGPa: 210,
    poissonsRatio: 0.3,
    densityKgM3: 7850,
    thermalExpansionPpmK: 11.7
  },
  ALLOY_STEEL_42CRMO4: {
    grade: 'ALLOY_STEEL_42CRMO4',
    name: 'Alloy Steel (42CrMo4 / 1.7225)',
    yieldStrengthMPa: 650,
    tensileStrengthMPa: 900,
    elasticModulusGPa: 210,
    poissonsRatio: 0.3,
    densityKgM3: 7850,
    thermalExpansionPpmK: 11.7
  },
  STAINLESS_STEEL_304: {
    grade: 'STAINLESS_STEEL_304',
    name: 'Austenitic Stainless Steel (304 / 1.4301)',
    yieldStrengthMPa: 215,
    tensileStrengthMPa: 505,
    elasticModulusGPa: 193,
    poissonsRatio: 0.29,
    densityKgM3: 8000,
    thermalExpansionPpmK: 17.2
  },
  STAINLESS_STEEL_316: {
    grade: 'STAINLESS_STEEL_316',
    name: 'Austenitic Stainless Steel (316 / 1.4401)',
    yieldStrengthMPa: 205,
    tensileStrengthMPa: 515,
    elasticModulusGPa: 193,
    poissonsRatio: 0.29,
    densityKgM3: 8000,
    thermalExpansionPpmK: 16.0
  },
  ALUMINUM_6061_T6: {
    grade: 'ALUMINUM_6061_T6',
    name: 'Aluminum Alloy (6061-T6)',
    yieldStrengthMPa: 240,
    tensileStrengthMPa: 290,
    elasticModulusGPa: 69,
    poissonsRatio: 0.33,
    densityKgM3: 2700,
    thermalExpansionPpmK: 23.6
  }
};

export interface ShaftSection {
  diameter: number;
  length: number;
  type?: 'CYLINDRICAL' | 'STEPPED' | 'TAPERED' | 'HOLLOW';
  endDiameter?: number;
  innerDiameter?: number;
  surfaceFinishRa?: number;
  toleranceClass?: string;
  designation?: string;
}

export type FeatureType = 'KEYWAY' | 'SNAP_RING_GROOVE' | 'THREAD' | 'CROSS_HOLE' | 'FLAT' | 'SHOULDER';

export interface GenericShaftFeature {
  featureId: string;
  type: FeatureType;
  name: string;
  sectionIndex: number;
  offsetFromSectionStart: number;
  angularOrientationDeg: number;
  suppressed: boolean;
  [key: string]: any;
}

export interface KeywayFeature extends GenericShaftFeature {
  type: 'KEYWAY';
  standard: string;
  keyType: string;
  width: number;
  depth: number;
  length: number;
}

export interface SnapRingGrooveFeature extends GenericShaftFeature {
  type: 'SNAP_RING_GROOVE';
  standard: string;
  grooveDiameter: number;
  grooveWidth: number;
}

export interface ThreadedShaftFeature extends GenericShaftFeature {
  type: 'THREAD';
  threadSize: string;
  threadPitch: number;
  threadLength: number;
}

export interface CrossHoleFeature extends GenericShaftFeature {
  type: 'CROSS_HOLE';
  holeDiameter: number;
  isThroughHole: boolean;
}

export interface FlatFeature extends GenericShaftFeature {
  type: 'FLAT';
  flatDepth: number;
  flatLength: number;
}

export interface ShaftDefinition {
  shaftId: string;
  name: string;
  material: ShaftMaterialGrade;
  sections: ShaftSection[];
  features: GenericShaftFeature[];
  totalLength: number;
  maxDiameter: number;
  massKg: number;
  centerOfMass: { x: number; y: number; z: number };
  topologySummary?: any;
  massProperties?: any;
  bearingSeats?: any[];
  strengthPreparation?: any;
  featureTree?: any[];
  stepData?: any;
  igesData?: any;
}
