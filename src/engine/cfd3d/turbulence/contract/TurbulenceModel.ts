import { Fvm3DMesh } from '../../Fvm3DTypes';
import { FluidProperties3D, CaseBoundaryCondition3D } from '../../adaptive/AdaptiveCFDTypes';

export interface TurbulenceModel {
  capabilities: {
    supportsLES?: boolean;
    supportsTransient?: boolean;
    supportsCompressible?: boolean;
  };
  initialize(mesh: Fvm3DMesh, fluid: FluidProperties3D, refVel: number, charLen: number): number[][];
  updateTurbulenceState(
    states: number[][],
    velocity: { x: number; y: number; z: number }[],
    velGradients: number[][][],
    pressure: number[],
    density: number,
    viscosity: number,
    mesh: Fvm3DMesh,
    dt: number
  ): number[][];
  applyBoundaryConditions(
    states: number[][],
    bcs: CaseBoundaryCondition3D[],
    velocity: { x: number; y: number; z: number }[],
    density: number,
    viscosity: number,
    mesh: Fvm3DMesh
  ): void;
  getDiagnostics(states?: number[][], velocity?: any, mesh?: any): Record<string, number | string>;
  validateState(states: number[][], viscosity: number, mesh: Fvm3DMesh): { isValid: boolean; errors?: string[] };
  getStabilityConstraints(
    states: number[][],
    velocity: { x: number; y: number; z: number }[],
    mesh: Fvm3DMesh,
    cflMultiplier: number
  ): { recommendedCFL: number; relaxationDampingFactor: number; divergenceRiskLevel: 'NONE' | 'LOW' | 'ELEVATED' | 'CRITICAL' };
}
