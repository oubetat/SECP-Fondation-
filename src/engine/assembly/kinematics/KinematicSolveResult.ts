import { JointCoordinateValue } from './KinematicJointModel';
import { Vector3D } from '../../cadKernel';

export type KinematicSolveStatus =
  | 'CONVERGED'
  | 'CONVERGED_WITH_REMAINING_DOF'
  | 'NOT_CONVERGED'
  | 'LIMIT_VIOLATION'
  | 'CONFLICT'
  | 'INVALID'
  | 'SINGULAR'
  | 'UNPROVEN';

export interface KinematicJointResidualInfo {
  jointId: string;
  residual: number;
  tolerance: number;
  satisfied: boolean;
  diagnostic?: string;
}

export interface KinematicJointState {
  position: JointCoordinateValue;
  velocity?: number | number[] | Vector3D | { [key: string]: number };
  acceleration?: number | number[] | Vector3D | { [key: string]: number };
  residual: number;
  satisfied: boolean;
  tolerance: number;
}

export interface KinematicSolveResult {
  status: KinematicSolveStatus;
  configurationId: string;

  bodyTransforms: Record<string, number[][]>;
  jointStates: Record<string, KinematicJointState>;

  totalDOF: number;
  constrainedDOF: number;
  remainingDOF: number;

  maximumResidual: number;
  residuals: KinematicJointResidualInfo[];

  iterations?: number;
  diagnostics: string[];

  configurationHash: string;
  evidenceId: string;
}
