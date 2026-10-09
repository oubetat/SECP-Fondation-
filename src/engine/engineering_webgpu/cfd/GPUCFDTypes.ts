/**
 * GPUCFDTypes.ts
 * Core types, data structures, and verification metrics for GPU CFD Kernels (PATCH-299)
 */

export type CFDKernelId =
  | 'CFD_GRADIENT_GAUSS'
  | 'CFD_DIVERGENCE_GAUSS'
  | 'CFD_CONVECTIVE_FLUX'
  | 'CFD_DIFFUSIVE_FLUX'
  | 'GREEN_GAUSS_GRADIENT'
  | 'CONVECTIVE_FLUX'
  | 'LAPLACIAN_DIFFUSION'
  | 'SIMPLE_PRESSURE_CORRECTION'
  | 'RANS_TURBULENCE';

export interface CFDMeshData {
  meshId: string;
  name: string;
  numCells: number;
  numFaces: number;
  numNodes: number;
  cellVolumes: Float32Array;
  cellCenters: Float32Array;
  faceAreas: Float32Array;
  faceNormals: Float32Array;
  faceOwners: Int32Array;
  faceNeighbors: Int32Array;
  // Compatibility fields
  cellCount?: number;
  faceCount?: number;
  nodeCount?: number;
}

export interface CFDFluidProperties {
  density: number;
  dynamicViscosity: number;
  kinematicViscosity: number;
  thermalConductivity?: number;
  viscosity?: number;
  specificHeat?: number;
}

export interface CFDOperatorComparisonResult {
  operatorId?: string;
  meshId?: string;
  numCells?: number;
  numFaces?: number;
  maxDifference?: number;
  rmsError?: number;
  l2Error?: number;
  maxGradientError?: number;
  maxDivergenceError?: number;
  passedEquivalence: boolean;
  cpuTimeMs?: number;
  gpuTimeMs?: number;
  speedup?: number;
}

export interface CFDBenchmarkMetrics {
  meshId?: string;
  meshName?: string;
  cellCount: number;
  faceCount?: number;
  operatorName?: string;
  cpuTimeMs: number;
  gpuTimeMs?: number;
  speedup?: number;
  throughputCellsPerSec?: number;
  memoryMB?: number;
  workloadType?: 'GENERIC_WEBGPU_COMPUTE' | 'GENERIC_VECTOR_ADD' | 'CFD_FLUX';
  domainExecutionStatus?: 'UNPROVEN' | 'UNIMPLEMENTED' | 'EXECUTED';
  backend?: 'CPU' | 'WEBGPU' | 'UNAVAILABLE';
  status?: 'EXECUTED' | 'UNAVAILABLE' | 'FAILED';
  numericallyEquivalent?: boolean;
}
