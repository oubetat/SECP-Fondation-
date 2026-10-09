export interface PrescribedBoundaryCondition {
  globalDofIndex: number;
  prescribedValue: number;
}
export class SparseBCIntegration {
  static applyDirichletBC(k: any, f: any, bcs: any) {
    return { constrainedMatrix: k, constrainedRHS: f, fixedDofs: new Map() };
  }
}
