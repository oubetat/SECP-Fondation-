export interface MaterialTolerances {
  yieldTolerance: number;           // Relative yield surface tolerance (e.g. 1e-7)
  returnMappingTolerance: number;   // Relative consistency residual tolerance (e.g. 1e-6)
  tangentTolerance: number;         // Tangent finite-difference relative error tolerance (e.g. 1e-4)
  stateTolerance: number;           // State vector comparison tolerance (e.g. 1e-12)
  energyTolerance: number;          // Energy balance / non-negative dissipation tolerance (e.g. 1e-9)
  traceTolerance: number;           // Relative deviatoric trace zero tolerance (e.g. 1e-6)
  verificationTolerance: number;   // Benchmark acceptance tolerance (e.g. 1e-6)
  maxIterations: number;            // Maximum material Newton iterations (e.g. 50)
}

export class MaterialTolerancePolicy {
  private static defaultPolicy: MaterialTolerances = {
    yieldTolerance: 1e-7,
    returnMappingTolerance: 1e-6,
    tangentTolerance: 1e-4,
    stateTolerance: 1e-12,
    energyTolerance: 1e-9,
    traceTolerance: 1e-6,
    verificationTolerance: 1e-6,
    maxIterations: 50,
  };

  private currentPolicy: MaterialTolerances;

  constructor(custom?: Partial<MaterialTolerances>) {
    this.currentPolicy = {
      ...MaterialTolerancePolicy.defaultPolicy,
      ...custom,
    };
  }

  static getDefault(): MaterialTolerancePolicy {
    return new MaterialTolerancePolicy();
  }

  get tolerances(): Readonly<MaterialTolerances> {
    return this.currentPolicy;
  }

  get yieldTolerance(): number {
    return this.currentPolicy.yieldTolerance;
  }

  get returnMappingTolerance(): number {
    return this.currentPolicy.returnMappingTolerance;
  }

  get tangentTolerance(): number {
    return this.currentPolicy.tangentTolerance;
  }

  get stateTolerance(): number {
    return this.currentPolicy.stateTolerance;
  }

  get energyTolerance(): number {
    return this.currentPolicy.energyTolerance;
  }

  get traceTolerance(): number {
    return this.currentPolicy.traceTolerance;
  }

  get verificationTolerance(): number {
    return this.currentPolicy.verificationTolerance;
  }

  get maxIterations(): number {
    return this.currentPolicy.maxIterations;
  }
}
