/**
 * SECP Industrial OS — Engineering Truth OS
 * src/engine/cfd3d/solvers/fsi/index.ts
 *
 * Primary entry point for 3D Fluid-Structure Interaction (FSI) solvers,
 * contracts, benchmarks, and real acceptance gates.
 */

export enum FSIPhenomenon {
  ONE_WAY_FSI = 'ONE_WAY_FSI',
  TWO_WAY_FSI = 'TWO_WAY_FSI',
  VORTEX_INDUCED_VIBRATION = 'VORTEX_INDUCED_VIBRATION',
  FLUTTER = 'FLUTTER',
  AEROELASTICITY = 'AEROELASTICITY'
}

export enum FSICouplingScheme {
  EXPLICIT = 'EXPLICIT',
  IMPLICIT = 'IMPLICIT',
  LOOSE = 'LOOSE',
  STRONG = 'STRONG'
}

export enum RelaxationType {
  FIXED = 'FIXED',
  AITKEN = 'AITKEN',
  IQN_ILS = 'IQN_ILS'
}

export enum MappingMethod {
  NEAREST_NEIGHBOR = 'NEAREST_NEIGHBOR',
  RADIAL_BASIS_FUNCTION = 'RADIAL_BASIS_FUNCTION',
  CONSERVATIVE_MORTAR = 'CONSERVATIVE_MORTAR'
}

export interface FSIPhysicsModel {
  phenomenon: FSIPhenomenon;
  couplingScheme: FSICouplingScheme;
  isTransient: boolean;
  isCompressible: boolean;
  enableTurbulenceRANS: boolean;
  enableThermalHT: boolean;
  enableLargeDeformation: boolean;
  enableStructuralContact: boolean;
  fluidDensity: number;
  fluidViscosity: number;
  youngsModulus: number;
  poissonsRatio: number;
  solidDensity: number;
}

export interface FSIEvidencePackage {
  runId: string;
  timestamp: string;
  converged: boolean;
  maxDisplacementMm: number;
  maxPressureDropPa: number;
  provenanceHash: string;
}

// Re-export genuine FSI engines
export * from './DynamicMeshManager';
export * from './FSIRelaxationManager';
export * from './FSIInterfaceMapper';
export * from './FSIInterface';
export * from './FSIConservationAudit';
export * from './FSICouplingManager';
export * from './FSISolver';
export * from './FSIBenchmarkSuite';
export * from './HardAcceptanceGate254';
