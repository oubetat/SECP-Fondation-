import { MaterialModelEngine } from './MaterialModelEngine';
import { ConstitutiveMatrixEngine } from './ConstitutiveMatrixEngine';

export interface StressTensor2D {
  xx: number;
  yy: number;
  xy: number;
}

export class StressRecoveryEngine {
  /**
   * Recovers 1D stress: sigma = E * epsilon
   */
  public static calculate1DStress(strain: number, materialId: string): number {
    const mat = MaterialModelEngine.getMaterial(materialId);
    return mat.youngsModulus * strain;
  }

  /**
   * Recovers 2D stress tensor from strain tensor under plane stress conditions:
   * { sigma } = [D] { epsilon }
   */
  public static calculate2DQuadStress(
    strain: { xx: number; yy: number; xy: number },
    materialId: string
  ): StressTensor2D {
    const mat = MaterialModelEngine.getMaterial(materialId);
    const D = ConstitutiveMatrixEngine.getPlaneStressMatrix(mat);

    const sig_xx = D[0][0] * strain.xx + D[0][1] * strain.yy;
    const sig_yy = D[1][0] * strain.xx + D[1][1] * strain.yy;
    const tau_xy = D[2][2] * strain.xy;

    return {
      xx: sig_xx,
      yy: sig_yy,
      xy: tau_xy
    };
  }
}
