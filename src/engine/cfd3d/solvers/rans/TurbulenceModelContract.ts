/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-063: Turbulence Model Abstractions and Contracts
 */

import { Vector3D } from '../laminar/LaminarSolverTypes';
import { RansFieldState, RansClosureCapability, RansSolverVerdict } from './RansSolverTypes';
import { CFDMesh3D } from '../../mesh/CFDMeshTypes';
import { MaterialProperties } from '../laminar/LaminarSolverTypes';

export enum TurbulenceModelFamily {
  Algebraic = 'Algebraic',
  OneEquation = 'OneEquation',
  TwoEquation = 'TwoEquation',
  ReynoldsStress = 'ReynoldsStress',
  Hybrid = 'Hybrid',
  LES = 'LES',
  DES = 'DES',
  Other = 'Other'
}

export enum TurbulenceModelStatus {
  PLANNED = 'PLANNED',
  REGISTERED = 'REGISTERED',
  IMPLEMENTED = 'IMPLEMENTED',
  VERIFIED = 'VERIFIED',
  VALIDATED = 'VALIDATED',
  UNPROVEN = 'UNPROVEN',
  FAILED = 'FAILED'
}

export interface TurbulenceModelIdentity {
  readonly modelId: string;
  readonly family: TurbulenceModelFamily;
  readonly version: string;
  readonly implementationHash: string;
  readonly equationSetHash: string;
  readonly configurationHash: string;
}

export interface TurbulenceModelCapabilities {
  readonly steady: boolean;
  readonly transient: boolean;
  readonly incompressible: boolean;
  readonly compressible: boolean;
  readonly heatTransfer: boolean;
  readonly buoyancy: boolean;
  readonly wallFunctions: boolean;
  readonly wallResolved: boolean;
  readonly rotatingFrames: boolean;
  readonly multiphase: boolean;
  readonly reactingFlow: boolean;
}

export interface TurbulenceModelRequirements {
  readonly requiredFields: readonly string[];
  readonly requiredGradients: readonly string[];
  readonly requiredMaterialProperties: readonly string[];
  readonly requiredBoundaryConditions: readonly string[];
  readonly requiredWallInformation: readonly string[];
  readonly requiredNumericalFeatures: readonly string[];
}

export interface TurbulenceFieldIdentity {
  readonly fieldId: string;
  readonly dimensions: string;
  readonly location: 'cell' | 'face' | 'node';
  readonly discretization: string;
  readonly stateHash: string;
  readonly source: string;
  readonly modelId: string;
}

export interface TurbulenceModelState {
  readonly modelIdentity: TurbulenceModelIdentity;
  readonly fields: Record<string, readonly number[]>;
  readonly gradients: Record<string, readonly Vector3D[]>;
  readonly turbulentViscosity: readonly number[];
  readonly reynoldsStress?: {
    readonly Rxx: readonly number[];
    readonly Ryy: readonly number[];
    readonly Rzz: readonly number[];
    readonly Rxy: readonly number[];
    readonly Rxz: readonly number[];
    readonly Ryz: readonly number[];
  };
  readonly production: readonly number[];
  readonly dissipation: readonly number[];
  readonly wallDistance?: readonly number[];
  readonly diagnostics: Record<string, number>;
  readonly validity: boolean;
  readonly stateHash: string;
}

export interface TurbulenceModelApplicability {
  readonly reynoldsNumberRange: { min: number; max: number };
  readonly machRange: { min: number; max: number };
  readonly temperatureRange: { min: number; max: number };
  readonly wallTreatmentConstraints: readonly string[];
  readonly geometryConstraints: readonly string[];
  readonly flowRegime: string;
  readonly numericalRestrictions: readonly string[];
}

export interface TurbulenceModelEvidence {
  readonly modelId: string;
  readonly modelVersion: string;
  readonly implementationHash: string;
  readonly equationSetHash: string;
  readonly configurationHash: string;
  readonly meshHash: string;
  readonly meanStateHash: string;
  readonly turbulenceStateHash: string;
  readonly closureHash: string;
  readonly wallTreatmentHash: string;
  readonly diagnosticsHash: string;
  readonly verificationHash: string;
  readonly replayHash: string;
  readonly applicability: string;
  readonly capabilityStatus: string;
  readonly verdict: string;
  readonly failureCodes: readonly string[];
}

export interface TurbulenceModel {
  readonly modelId: string;
  readonly version: string;
  readonly family: TurbulenceModelFamily;
  readonly capabilities: TurbulenceModelCapabilities;
  readonly requirements: TurbulenceModelRequirements;
  readonly applicability: TurbulenceModelApplicability;
  readonly status: TurbulenceModelStatus;

  getIdentity(): TurbulenceModelIdentity;
  initialize(
    mesh: CFDMesh3D,
    meanFlow: RansFieldState,
    material: MaterialProperties,
    config: any
  ): TurbulenceModelState;
  validate(state: TurbulenceModelState): { valid: boolean; errors: string[] };
  evaluate(state: TurbulenceModelState, meanFlow?: RansFieldState, material?: MaterialProperties): TurbulenceModelState;
  assembleTransportEquations(mesh: CFDMesh3D, state: TurbulenceModelState, meanFlow?: RansFieldState, material?: MaterialProperties): any[];
  computeTurbulentViscosity(state: TurbulenceModelState): readonly number[];
  computeReynoldsStress(state: TurbulenceModelState): any;
  diagnostics(state: TurbulenceModelState): Record<string, any>;
  verify(state: TurbulenceModelState): boolean;
  evidence(state: TurbulenceModelState): TurbulenceModelEvidence;
}
