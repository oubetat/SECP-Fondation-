/**
 * SECP Industrial OS v3 — CFD Truth Framework
 * Core Types for the CFD Truth Ladder and Benchmark Registry.
 */

export enum CFDTruthLevel {
  L0_ANALYTICAL = 'L0_ANALYTICAL',
  L1_FUNDAMENTAL_NUMERICAL = 'L1_FUNDAMENTAL_NUMERICAL',
  L2_BOUNDARY_LAYER = 'L2_BOUNDARY_LAYER',
  L3_SEPARATION = 'L3_SEPARATION',
  L4_EXTERNAL_AERODYNAMICS = 'L4_EXTERNAL_AERODYNAMICS',
  L5_TRANSONIC = 'L5_TRANSONIC',
  L6_3D_TURBULENT = 'L6_3D_TURBULENT',
  L7_COMPRESSIBLE_SHOCK = 'L7_COMPRESSIBLE_SHOCK',
  L8_UNSTEADY_MOVING_MESH = 'L8_UNSTEADY_MOVING_MESH',
  L9_CROSS_PHYSICS = 'L9_CROSS_PHYSICS',
  L10_ENGINEERING_TRUTH = 'L10_ENGINEERING_TRUTH'
}

export interface CFDBenchmarkIdentity {
  id: string;
  name: string;
  level: CFDTruthLevel;
  description: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface CFDBenchmarkContract {
  governingEquations: string;
  geometry: string;
  meshSpecification: string;
  boundaryConditions: string;
  physicalParameters: any;
  numericalScheme: string;
  convergenceContract: {
    residualTolerance: number;
    forceStabilityTolerance?: number;
    iterationLimit: number;
  };
  verificationTargets: {
    variable: string;
    targetValue: any;
    tolerance: number;
  }[];
  referenceData?: {
    source: string;
    url?: string;
    type: 'EXPERIMENTAL' | 'DNS' | 'LES' | 'ANALYTICAL';
    variables: string[];
  };
  validationTargets?: {
    variable: string;
    referenceValue: any;
    tolerance: number;
  }[];
  expectedFailureModes: string[];
  evidenceRequirements: string[];
  reproducibilityRequirements: {
    hashStability: boolean;
    bitExact?: boolean;
  };
}

export interface CFDBenchmarkExecutionResult {
  benchmarkId: string;
  timestamp: string;
  verdict: 'PASS' | 'FAIL' | 'NOT_PROVEN' | 'INCOMPLETE';
  verificationResults: {
    target: string;
    computed: any;
    targetValue: any;
    passed: boolean;
    error?: number;
  }[];
  validationResults?: {
    target: string;
    computed: any;
    referenceValue: any;
    passed: boolean;
    error?: number;
  }[];
  convergenceReached: boolean;
  finalResiduals: any;
  hashes: {
    mesh: string;
    solution: string;
    execution: string;
  };
  evidencePath: string;
}

export interface CFDBenchmarkRegistryEntry {
  identity: CFDBenchmarkIdentity;
  contract: CFDBenchmarkContract;
  runner: () => Promise<CFDBenchmarkExecutionResult>;
}
