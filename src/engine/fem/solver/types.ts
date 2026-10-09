import { DOFType, MaterialProperties } from '../elements/types';
import { SparseMatrix } from '../sparse/SparseMatrix';

export type SolverType = 'SPARSE_CHOLESKY' | 'SPARSE_LDLT' | 'SPARSE_LU';

export type OrderingStrategy = 'NATURAL' | 'AMD';

export type SolverFailureType =
  | 'NONE'
  | 'INVALID_MODEL'
  | 'INVALID_MATERIAL'
  | 'INVALID_LOAD'
  | 'INVALID_CONSTRAINT'
  | 'CONSTRAINT_CONFLICT'
  | 'SINGULAR_SYSTEM'
  | 'MECHANISM_DETECTED'
  | 'ILL_CONDITIONED_SYSTEM'
  | 'NUMERICAL_FACTORISATION_FAILURE'
  | 'RESIDUAL_FAILURE'
  | 'EQUILIBRIUM_FAILURE'
  | 'ENERGY_FAILURE'
  | 'REFERENCE_MISMATCH'
  | 'RESOURCE_LIMIT_EXCEEDED';

export type SolverStatus =
  | 'NOT_STARTED'
  | 'VALIDATING'
  | 'ASSEMBLING'
  | 'READY'
  | 'SOLVING'
  | 'SOLVED'
  | 'VERIFICATION_PENDING'
  | 'VERIFIED'
  | 'FAILED';

export type StructuralSolverVerdict =
  | 'CONVERGED'
  | 'NOT_CONVERGED'
  | 'SINGULAR_SYSTEM'
  | 'INVALID_MODEL'
  | 'NUMERICAL_FAILURE'
  | 'EQUILIBRIUM_FAILURE'
  | 'ENERGY_FAILURE'
  | 'REFERENCE_MISMATCH'
  | 'VERIFIED';

export interface NodeInput {
  id: string;
  index: number;
  coordinates: number[]; // [x], [x,y], or [x,y,z]
}

export interface ElementInput {
  id: string;
  type: 'BAR2' | 'TRI3' | 'QUAD4' | 'TET4' | 'HEX8';
  nodeIds: string[];
  material: MaterialProperties;
}

export interface NodalLoadInput {
  nodeId: string;
  dof: DOFType;
  magnitude: number;
}

export interface PrescribedDisplacementInput {
  nodeId: string;
  dof: DOFType;
  value: number;
}

export interface GlobalDOF {
  globalIndex: number;
  nodeId: string;
  nodeIndex: number;
  dof: DOFType;
  isConstrained: boolean;
  constrainedValue?: number;
}

export interface PartitionedSparseSystem {
  totalDOFs: number;
  freeDOFCount: number;
  constrainedDOFCount: number;
  freeDOFIndices: number[];
  constrainedDOFIndices: number[];
  Kff: SparseMatrix;
  Kfc?: SparseMatrix;
  Kcf?: SparseMatrix;
  Kcc?: SparseMatrix;
  Ff: number[];
  Fc: number[];
  uc: number[];
  reducedFf: number[];
}

export interface ResidualMetrics {
  absoluteNormL2: number;
  absoluteNormInf: number;
  relativeResidual: number;
  maxResidualEntry: { index: number; value: number };
  passed: boolean;
}

export interface ReactionResult {
  nodeId: string;
  dof: DOFType;
  globalDOFIndex: number;
  reactionForce: number;
}

export interface EquilibriumMetrics {
  sumExternalForces: { fx: number; fy: number; fz: number };
  sumReactions: { rx: number; ry: number; rz: number };
  netResidualForces: { x: number; y: number; z: number };
  residualForceNorm: number;
  forceBalancePassed: boolean;
}

export interface StrainStressPointResult {
  location: { x: number; y: number; z?: number };
  gaussPoint?: { xi: number; eta?: number; zeta?: number; weight: number };
  strain: number[];
  stress: number[];
  vonMisesStress: number;
}

export interface ElementRecoveryResult {
  elementId: string;
  elementTypeId: string;
  nodalDisplacements: number[];
  gaussPoints: StrainStressPointResult[];
  elementCenterStrain: number[];
  elementCenterStress: number[];
  elementCenterVonMises: number;
  elementStrainEnergy: number;
}

export interface EnergyMetrics {
  globalStrainEnergy: number;
  sumElementStrainEnergy: number;
  externalWork: number;
  energyErrorAbsolute: number;
  energyErrorRelative: number;
  workEnergyErrorRelative: number;
  passed: boolean;
}

export interface PerformanceStats {
  assemblyTimeMs: number;
  factorizationTimeMs: number;
  solveTimeMs: number;
  recoveryTimeMs: number;
  verificationTimeMs: number;
  totalTimeMs: number;
  matrixMemoryBytes: number;
  factorizationMemoryBytes: number;
  solutionMemoryBytes: number;
  peakMemoryBytes: number;
  originalNNZ: number;
  factorNNZ: number;
  fillInRatio: number;
}

export interface SolverVerdictResult {
  status: SolverStatus;
  verdict: StructuralSolverVerdict;
  converged: boolean;
  verified: boolean;
  failureType: SolverFailureType;
  failureReason?: string;
  evidenceHash: string;
}
