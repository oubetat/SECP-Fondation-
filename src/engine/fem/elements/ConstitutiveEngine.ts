export class ConstitutiveEngine {
  public static computeElasticityMatrix(E: number, nu: number): any {
    const factor = E / (1 - nu * nu);
    return [
      [factor, factor * nu, 0],
      [factor * nu, factor, 0],
      [0, 0, (factor * (1 - nu)) / 2]
    ];
  }

  public static get3DIsotropicConstitutive(E: number, nu: number): number[][] {
    const lambda = (E * nu) / ((1 + nu) * (1 - 2 * nu));
    const mu = E / (2 * (1 + nu));
    const c11 = lambda + 2 * mu;

    return [
      [c11, lambda, lambda, 0, 0, 0],
      [lambda, c11, lambda, 0, 0, 0],
      [lambda, lambda, c11, 0, 0, 0],
      [0, 0, 0, mu, 0, 0],
      [0, 0, 0, 0, mu, 0],
      [0, 0, 0, 0, 0, mu]
    ];
  }

  public static get2DPlaneStressConstitutive(E: number, nu: number): number[][] {
    return this.computeElasticityMatrix(E, nu);
  }

  public static computeVonMisesStress3D(stress: number[]): number {
    const [sxx, syy, szz, syz, sxz, sxy] = stress;
    return Math.sqrt(
      0.5 * ((sxx - syy) ** 2 + (syy - szz) ** 2 + (szz - sxx) ** 2 + 6 * ((syz || 0) ** 2 + (sxz || 0) ** 2 + (sxy || 0) ** 2))
    );
  }
}
