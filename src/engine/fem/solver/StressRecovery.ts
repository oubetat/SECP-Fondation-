export class StressRecovery {
  /**
   * Calculates von Mises stress for 1D, 2D, or 3D stress tensors.
   * 1D: [sigma_x] -> |sigma_x|
   * 2D: [sigma_xx, sigma_yy, tau_xy] -> sqrt(s_xx^2 - s_xx*s_yy + s_yy^2 + 3*t_xy^2)
   * 3D: [s_xx, s_yy, s_zz, t_yz, t_xz, t_xy]
   */
  static computeVonMises(stressVector: number[]): number {
    if (stressVector.length === 1) {
      return Math.abs(stressVector[0]);
    }

    if (stressVector.length === 3) {
      const sxx = stressVector[0];
      const syy = stressVector[1];
      const txy = stressVector[2];
      const vmSq = sxx * sxx - sxx * syy + syy * syy + 3 * txy * txy;
      return Math.sqrt(Math.max(0, vmSq));
    }

    if (stressVector.length === 6) {
      const sxx = stressVector[0];
      const syy = stressVector[1];
      const szz = stressVector[2];
      const tyz = stressVector[3];
      const txz = stressVector[4];
      const txy = stressVector[5];

      const term1 = (sxx - syy) ** 2 + (syy - szz) ** 2 + (szz - sxx) ** 2;
      const term2 = 6 * (txy ** 2 + tyz ** 2 + txz ** 2);
      return Math.sqrt(Math.max(0, 0.5 * (term1 + term2)));
    }

    return 0;
  }
}
