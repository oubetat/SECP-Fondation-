/**
 * SECP CAD Kernel — Assembly Kinematic State (PATCH-040)
 */

import { Matrix4x4Data } from './RecursiveAssemblyEvaluator';

export interface KinematicOccurrenceState {
  instanceId: string;
  occurrencePath: string[];
  worldTransform: Matrix4x4Data;
  isGrounded: boolean;
}

export interface KinematicDriverState {
  mateId: string;
  parameterName: string;
  value: number;
  status: 'ACTIVE' | 'CONFLICT' | 'OUT_OF_LIMITS' | 'INVALID_MATE';
  message?: string;
}

export interface AssemblyKinematicState {
  assemblyDocumentId: string;
  revision: number | string;
  solved: boolean;

  degreesOfFreedom: number;
  constrainedDegreesOfFreedom: number;

  occurrences: KinematicOccurrenceState[];
  drivers: KinematicDriverState[];

  diagnostics: string[];
}
