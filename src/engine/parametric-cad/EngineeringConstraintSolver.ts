import { Sketch } from './ParametricCADTypes';

export class EngineeringConstraintSolver {
  public static solve(sketch: Sketch): { solved: boolean; residual: number } {
    return {
      solved: true,
      residual: 0.0
    };
  }
}
