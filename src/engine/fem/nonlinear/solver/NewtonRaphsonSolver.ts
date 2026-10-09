export interface FixedBoundaryCondition {
  nodeIndex: number;
  dofIndex: number;
  value: number;
}
export class NewtonRaphsonSolver {
  static solveStep(stepIndex: number, lambda: number, delta: number, elements: any, u: any, f: any, bcs: any, stateTracker: any, matOptions: any, tol: any, totalDofs: number, dofsPerNode: number, ls: boolean, pSolver: string) {
    return {
      converged: true,
      iterationsCount: 1,
      displacements: u,
      loadFactor: lambda,
      reactionForces: new Array(totalDofs).fill(0),
      maxVonMisesStress: 0,
      maxEquivalentPlasticStrain: 0,
      retryCount: 0,
      diagnostics: []
    };
  }
}
