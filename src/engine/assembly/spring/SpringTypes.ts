import { Vector3D } from '../../cadKernel';

export type SpringType = 'COMPRESSION' | 'EXTENSION' | 'TORSION' | 'CONICAL' | 'BARREL' | 'BELLEVILLE' | 'WAVE';

export type SpringEndType = 
  | 'CLOSED_AND_GROUND' 
  | 'CLOSED_UNGROUND' 
  | 'PLAIN_END' 
  | 'PLAIN_AND_GROUND' 
  | 'MACHINE_HOOK' 
  | 'SIDE_LOOP' 
  | 'EXTENDED_HOOK' 
  | 'TANGENTIAL_LEG' 
  | 'RADIAL_LEG' 
  | 'FLAT_WASHER';

export type HelixHandDirection = 'RIGHT_HAND' | 'LEFT_HAND';

export type SpringMaterialGrade = 
  | 'MUSIC_WIRE_ASTM_A228' 
  | 'OIL_TEMPERED_ASTM_A229' 
  | 'HARD_DRAWN_ASTM_A227' 
  | 'CHROME_SILICON_ASTM_A401' 
  | 'STAINLESS_STEEL_302' 
  | 'PHOSPHOR_BRONZE_ASTM_B159';

export interface SpringMaterialProperties {
  grade: SpringMaterialGrade;
  name: string;
  densityKgM3: number;
  youngsModulusE_Gpa: number;
  shearModulusG_Gpa: number;
  poissonsRatio: number;
  torsionalYieldStrengthSysMpa: number;
  specificationStandard: string;
  bendingYieldStrengthSyMpa?: number;
  torsionalEnduranceLimitTauEMpa?: number;
  [key: string]: any;
}

export interface SpringMechanicalAnalysis {
  [key: string]: any;
}

export const SPRING_MATERIALS: Record<SpringMaterialGrade, SpringMaterialProperties> = {
  MUSIC_WIRE_ASTM_A228: {
    grade: 'MUSIC_WIRE_ASTM_A228',
    name: 'Music Wire (ASTM A228)',
    densityKgM3: 7850,
    youngsModulusE_Gpa: 207,
    shearModulusG_Gpa: 80,
    poissonsRatio: 0.3,
    torsionalYieldStrengthSysMpa: 827,
    specificationStandard: 'ASTM A228'
  },
  OIL_TEMPERED_ASTM_A229: {
    grade: 'OIL_TEMPERED_ASTM_A229',
    name: 'Oil Tempered Wire (ASTM A229)',
    densityKgM3: 7850,
    youngsModulusE_Gpa: 207,
    shearModulusG_Gpa: 80,
    poissonsRatio: 0.3,
    torsionalYieldStrengthSysMpa: 724,
    specificationStandard: 'ASTM A229'
  },
  HARD_DRAWN_ASTM_A227: {
    grade: 'HARD_DRAWN_ASTM_A227',
    name: 'Hard Drawn Wire (ASTM A227)',
    densityKgM3: 7850,
    youngsModulusE_Gpa: 207,
    shearModulusG_Gpa: 80,
    poissonsRatio: 0.3,
    torsionalYieldStrengthSysMpa: 620,
    specificationStandard: 'ASTM A227'
  },
  CHROME_SILICON_ASTM_A401: {
    grade: 'CHROME_SILICON_ASTM_A401',
    name: 'Chrome Silicon (ASTM A401)',
    densityKgM3: 7850,
    youngsModulusE_Gpa: 207,
    shearModulusG_Gpa: 80,
    poissonsRatio: 0.3,
    torsionalYieldStrengthSysMpa: 1034,
    specificationStandard: 'ASTM A401'
  },
  STAINLESS_STEEL_302: {
    grade: 'STAINLESS_STEEL_302',
    name: 'Stainless Steel 302 (ASTM A313)',
    densityKgM3: 7900,
    youngsModulusE_Gpa: 193,
    shearModulusG_Gpa: 69,
    poissonsRatio: 0.3,
    torsionalYieldStrengthSysMpa: 517,
    specificationStandard: 'ASTM A313'
  },
  PHOSPHOR_BRONZE_ASTM_B159: {
    grade: 'PHOSPHOR_BRONZE_ASTM_B159',
    name: 'Phosphor Bronze (ASTM B159)',
    densityKgM3: 8850,
    youngsModulusE_Gpa: 103,
    shearModulusG_Gpa: 41,
    poissonsRatio: 0.33,
    torsionalYieldStrengthSysMpa: 345,
    specificationStandard: 'ASTM B159'
  }
};

export interface SpringEndConfiguration {
  startEndType: SpringEndType;
  endEndType: SpringEndType;
  groundCoilsCount: number;
  inactiveCoilsCount: number;
  hookRadiusMm?: number;
  hookOpeningMm?: number;
  torsionLeg1LengthMm?: number;
  torsionLeg2LengthMm?: number;
  torsionLegAngleDeg?: number;
}

export interface SpringWireSection2D {
  shape: 'CIRCULAR' | 'SQUARE' | 'RECTANGULAR';
  wireDiameterMm: number;
  widthMm?: number;
  heightMm?: number;
}

export interface SpringFeatureTreeNode {
  nodeId: string;
  name: string;
  type: string;
  status: 'ACTIVE' | 'SUPPRESSED';
  parentNodes: string[];
  parameters: Record<string, any>;
}

export interface SpringManufacturingMetadata {
  partNumber: string;
  standardCatalog: string;
  wireSpecification: string;
  coilingProcess: 'COLD_COILED' | 'HOT_COILED';
  heatTreatment: string;
  surfaceTreatment: string;
  shotPeened: boolean;
  freeLengthToleranceMm: number;
  wireDiameterToleranceMm: number;
  springRateTolerancePercent: number;
  qualityClass: string;
  notes: string;
}

export interface SpringAssemblyInterface {
  innerBoreClearanceZone: {
    minInnerDiameterMm: number;
    recommendedGuideRodDiameterMm: number;
  };
  outerHousingClearanceZone: {
    maxOuterDiameterMm: number;
    recommendedHousingBoreDiameterMm: number;
  };
  seatingPlanes: {
    bottomSeatingZ: number;
    topSeatingZ: number;
  };
  kinematicLimits: {
    minCompressedLengthMm: number;
    maxExtendedLengthMm: number;
    solidStopLengthMm: number;
  };
}

export interface SpringDefinition {
  springId: string;
  name: string;
  type: SpringType;
  material: SpringMaterialProperties;
  wireDiameterMm: number;
  meanDiameterMm: number;
  outerDiameterMm: number;
  innerDiameterMm: number;
  activeCoilsCount: number;
  totalCoilsCount: number;
  freeLengthMm: number;
  pitchMm: number;
  solidHeightMm: number;
  springIndex: number;
  helixDirection: HelixHandDirection;
  endConfiguration: SpringEndConfiguration;
  wireSection: SpringWireSection2D;
  helicalPath: Vector3D[];
  mechanicalAnalysis: {
    springRate_K_N_mm: number;
    wahlFactorKw: number;
    shearStressPreloadMpa: number;
    shearStressSolidMpa: number;
    bucklingLimitMm: number;
    naturalFrequencyHz: number;
  };
  massProperties: {
    volumeMm3: number;
    massKg: number;
    effectiveDynamicMassKg: number;
    centerOfMass: Vector3D;
    momentOfInertiaIxxKgMm2: number;
    momentOfInertiaIyyKgMm2: number;
    momentOfInertiaIzzKgMm2: number;
  };
  topologySummary: {
    solidType: string;
    shellCount: number;
    faceCount: number;
    edgeCount: number;
    vertexCount: number;
    isWatertight: boolean;
    eulerCharacteristic: number;
  };
  featureTree: SpringFeatureTreeNode[];
  manufacturingMetadata: SpringManufacturingMetadata;
  assemblyInterface: SpringAssemblyInterface;
  stepData: string;
  igesData: string;
  evidenceHash: string;
}
