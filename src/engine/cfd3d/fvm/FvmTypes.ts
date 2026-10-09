/**
 * SECP Industrial OS v2 — Finite Volume Method Types
 * PATCH-052 & PATCH-242
 */

export enum ConvectionSchemeType {
  UPWIND = "UPWIND",
  CENTRAL = "CENTRAL",
  QUICK = "QUICK"
}

export enum FieldLocation {
  CELL = "CELL",
  FACE = "FACE",
  NODE = "NODE",
  BOUNDARY = "BOUNDARY"
}

export enum FVMVerdict {
  PASS = "PASS",
  FAIL = "FAIL",
  INVALID = "INVALID"
}

export interface FVMField<T = number> {
  fieldId: string;
  quantity: string;
  unit: string;
  location: FieldLocation;
  values: T[];
  meshIdentity: string;
  fieldVersion: string;
}

export interface FVMControlVolume {
  cellId: number;
  volume: number;
  centroid: [number, number, number];
  faceIds: number[];
  neighborCellIds: number[];
  boundaryFaceIds: number[];
}

export interface FVMFace {
  faceId: number;
  area: number;
  normal: [number, number, number];
  centroid: [number, number, number];
  ownerCellId: number;
  neighborCellId: number | null;
  boundaryType: string | null;
}

export interface FVMEquationCoefficients {
  aP: number;
  aN: Map<number, number>;
  b: number;
  transientContribution?: number;
  boundaryContribution?: number;
}

export interface FVMDiscretizationResult {
  caseId: string;
  meshIdentity: string;
  fieldIdentity: string;
  operator: string;
  diagnostics: string[];
  tolerance: number;
  verdict: FVMVerdict;
  timestamp: string;
  inputHash: string;
  resultHash: string;
}
