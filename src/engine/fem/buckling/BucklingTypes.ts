/**
 * SECP Industrial OS — Engineering Truth OS
 * BucklingTypes.ts
 * 
 * SECP-FEM-UPGRADE-006: Linear Buckling Analysis Data Types.
 */

import { DOFComponent, FEMSolveResult } from "../core/FEMTypes";

export interface LinearBucklingModeResult {
  modeIndex: number;
  eigenvalue: number; // Load factor lambda_i
  loadFactor: number; // lambda_i
  referenceLoad: number; // P_ref
  criticalLoad: number; // P_cr = lambda_i * P_ref
  modeShape: Map<string, { [key in DOFComponent]?: number }>;
  modeShapeVector: number[]; // Global mode vector
  relativeResidual: number;
  normalization: "L2" | "MAX_COMPONENT";
  convergenceStatus: "CONVERGED" | "NOT_CONVERGED";
  verificationStatus: "VERIFIED" | "FAILED" | "NOT_VERIFIED";
  rejectionReasons: string[];
}

export interface LinearBucklingOptions {
  numModes?: number; // Number of buckling modes requested (default: 3)
  tolerance?: number; // Residual tolerance (default: 1e-4)
  maxEigenIterations?: number; // Max iterations for Jacobi eigensolver (default: 200)
  normalization?: "L2" | "MAX_COMPONENT";
}

export interface LinearBucklingResult {
  modelId?: string;
  referenceLoadCaseId?: string;
  solverStatus: "QUALIFIED_WITHIN_DECLARED_SCOPE" | "FAILED" | "PARTIAL" | "IMPLEMENTED_NOT_QUALIFIED";
  modes: LinearBucklingModeResult[];
  referenceSol: FEMSolveResult;
  matrixMetrics: {
    totalDOFs: number;
    freeDOFs: number;
    constrainedDOFs: number;
    K_ff_nnz: number;
    K_G_nnz: number;
  };
  rejectionReasons: string[];
}
