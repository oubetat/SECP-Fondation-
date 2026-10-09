/**
 * Voigt notation for 3D tensors: [11, 22, 33, 12, 23, 13]
 */

export class ConstitutiveUtils {
  /**
   * Calculates von Mises equivalent stress from a stress tensor in Voigt notation.
   */
  public static calculateVonMises(s: number[]): number {
    const [s11, s22, s33, s12, s23, s13] = s;
    const term1 = (s11 - s22) ** 2;
    const term2 = (s22 - s33) ** 2;
    const term3 = (s33 - s11) ** 2;
    const term4 = 6 * (s12 ** 2 + s23 ** 2 + s13 ** 2);
    return Math.sqrt(0.5 * (term1 + term2 + term3 + term4));
  }

  /**
   * Decomposes stress into hydrostatic and deviatoric parts.
   */
  public static getDeviatoric(s: number[]): { deviatoric: number[], hydrostatic: number } {
    const mean = (s[0] + s[1] + s[2]) / 3;
    const dev = [
      s[0] - mean,
      s[1] - mean,
      s[2] - mean,
      s[3],
      s[4],
      s[5]
    ];
    return { deviatoric: dev, hydrostatic: mean };
  }

  /**
   * Norm of a tensor in Voigt notation (with correct shear scaling for strain if needed, 
   * but here we use it for stress or raw increments).
   */
  public static norm(v: number[]): number {
    return Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2 + 2*(v[3]**2 + v[4]**2 + v[5]**2));
  }
  
  public static dot(a: number[], b: number[]): number {
    return a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + 2*(a[3]*b[3] + a[4]*b[4] + a[5]*b[5]);
  }
}
