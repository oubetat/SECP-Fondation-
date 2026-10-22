/**
 * SECP Engineering Truth OS — Spatial PCB Structural Mechanics Model
 * Canonical Definitions, Isotropic/Multilayer Elastic Properties,
 * Boundary Support Constraints, Mechanical Loads, and Deterministic Digest.
 */

import { createHash } from 'crypto';

export type PcbSubstrateMaterialType = 'FR4' | 'ALUMINUM' | 'POLYIMIDE' | 'ROGERS' | 'CUSTOM';

export interface ElasticMaterialProperties {
  name: string;
  youngModulusGpa: number; // E [GPa]
  poissonRatio: number;      // nu [-]
  densityKgM3: number;       // rho [kg/m^3]
  yieldStrengthMpa: number;  // sigma_yield [MPa]
}

export const STANDARD_PCB_STRUCTURAL_MATERIALS: Record<PcbSubstrateMaterialType, ElasticMaterialProperties> = {
  FR4: {
    name: 'FR-4 Woven Glass/Epoxy',
    youngModulusGpa: 24.0,
    poissonRatio: 0.14,
    densityKgM3: 1850.0,
    yieldStrengthMpa: 200.0
  },
  ALUMINUM: {
    name: 'Aluminum 6061-T6 Substrate',
    youngModulusGpa: 70.0,
    poissonRatio: 0.33,
    densityKgM3: 2700.0,
    yieldStrengthMpa: 276.0
  },
  POLYIMIDE: {
    name: 'Polyimide Flex Core',
    youngModulusGpa: 3.5,
    poissonRatio: 0.34,
    densityKgM3: 1420.0,
    yieldStrengthMpa: 90.0
  },
  ROGERS: {
    name: 'Rogers RO4350B Hydrocarbon/Ceramic',
    youngModulusGpa: 19.0,
    poissonRatio: 0.18,
    densityKgM3: 1860.0,
    yieldStrengthMpa: 250.0
  },
  CUSTOM: {
    name: 'User Defined Custom Substrate',
    youngModulusGpa: 20.0,
    poissonRatio: 0.20,
    densityKgM3: 1800.0,
    yieldStrengthMpa: 150.0
  }
};

export type StructuralBoundaryType =
  | 'FOUR_EDGES_SIMPLY_SUPPORTED'
  | 'FOUR_EDGES_CLAMPED'
  | 'FOUR_CORNERS_SUPPORTED'
  | 'CANTILEVER_ONE_EDGE_CLAMPED'
  | 'STANDOFF_SUPPORTED';

export interface StandoffSupportLocation {
  id: string;
  xMm: number;
  yMm: number;
  radiusMm?: number;
  isClamped?: boolean; // true = fixed slope (clamped), false = simple pin support
}

export interface ComponentMechanicalSpec {
  refDes: string;
  xMm: number;
  yMm: number;
  massGrams: number;
  widthMm?: number;
  heightMm?: number;
}

export interface ConcentratedLoadSpec {
  id?: string;
  xMm: number;
  yMm: number;
  forceN: number;
  description?: string;
}

export interface StructuralLoadDefinition {
  uniformPressurePa?: number; // e.g. 80.0 or 500.0 N/m^2
  gravityAccelerationMS2?: number; // default 9.80665
  includeSubstrateSelfWeight?: boolean; // default true
  componentPointLoads?: ConcentratedLoadSpec[];
}

export interface PcbStructuralBoardConfig {
  designId?: string;
  lengthMm: number; // Dimension along X (a)
  widthMm: number;  // Dimension along Y (b)
  thicknessMm: number; // Plate thickness h
  materialType?: PcbSubstrateMaterialType;
  youngModulusGpa?: number;
  poissonRatio?: number;
  densityKgM3?: number;
  yieldStrengthMpa?: number;
  boundaryType: StructuralBoundaryType;
  standoffs?: StandoffSupportLocation[];
  components?: ComponentMechanicalSpec[];
  loads?: StructuralLoadDefinition;
  gridResolutionX?: number; // Default 21
  gridResolutionY?: number; // Default 21
}

function deterministicStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(deterministicStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => `${JSON.stringify(k)}:${deterministicStringify(obj[k])}`).join(',') + '}';
}

/**
 * Computes deterministic SHA-256 hash of a structural configuration
 */
export function calculateStructuralModelHash(config: PcbStructuralBoardConfig): string {
  const norm = {
    lengthMm: config.lengthMm,
    widthMm: config.widthMm,
    thicknessMm: config.thicknessMm,
    materialType: config.materialType ?? 'FR4',
    youngModulusGpa: config.youngModulusGpa,
    poissonRatio: config.poissonRatio,
    boundaryType: config.boundaryType,
    gridResolutionX: config.gridResolutionX,
    gridResolutionY: config.gridResolutionY,
    standoffs: (config.standoffs || []).map(s => ({ id: s.id, x: s.xMm, y: s.yMm })),
    loads: config.loads
  };
  return createHash('sha256').update(deterministicStringify(norm)).digest('hex');
}
