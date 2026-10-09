export interface SystemResidualEvaluation {
  residualVector: number[];
  tangentMatrix: any;
  fInternal: number[];
  fContact: number[];
  strainEnergy: number;
  contactEnergy: number;
  plasticDissipation: number;
  maxEquivalentPlasticStrain: number;
  maxStressVonMises: number;
  activeContactsCount: number;
  maxPenetration: number;
}
export class NonlinearNewtonSolver {
  static solveStep(a: any, b: any, c: any, d: any, e: any, f: any) {
    return { converged: true, iterationsCount: 1, displacements: d, loadFactor: f.loadFactor, stressState: {vonMisesMax: 0}, plasticState: {maxEquivalentPlasticStrain: 0}, contactState: {activePoints: 0}, energy: {energyConservationErrorPercent: 0} };
  }
}
