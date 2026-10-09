/**
 * Consistent Tangent Operator for J2 Plasticity with Isotropic Hardening.
 * 6x6 matrix in Voigt notation.
 */
export class ConsistentTangentOperator {
  public static calculate(
    E: number,
    nu: number,
    H: number,
    q_trial: number,
    d_lambda: number,
    S_trial: number[],
    isPlastic: boolean
  ): number[][] {
    const G = E / (2 * (1 + nu));
    const K = E / (3 * (1 - 2 * nu));
    
    // Initializing 6x6 matrix with 0
    const D = Array.from({ length: 6 }, () => Array(6).fill(0));

    if (!isPlastic) {
      // Elastic Tangent (Standard Hooke's Matrix)
      const lambda = (E * nu) / ((1 + nu) * (1 - 2 * nu));
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          D[i][j] = i === j ? lambda + 2 * G : lambda;
        }
        D[i + 3][i + 3] = G;
      }
      return D;
    }

    // Plastic Tangent
    // D_ep = K * (1 o 1) + 2G * beta * (I_dev - n o n) + 2G * gamma * (n o n)
    // where n = sqrt(3/2) * S_trial / q_trial
    
    const beta = 1 - (3 * G * d_lambda) / q_trial;
    const gamma = (H / (3 * G + H)); // Simplified for linear hardening
    
    const n = S_trial.map(s => (Math.sqrt(1.5) * s) / q_trial);
    
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        // Hydrostatic part
        if (i < 3 && j < 3) {
          D[i][j] += K;
        }
        
        // Deviatoric parts
        // Identity mapping and projection logic in Voigt
        // This is a simplified 3D implementation
        let dev_term = 0;
        if (i === j) {
          if (i < 3) dev_term += 2 * G * beta * (2/3);
          else dev_term += G * beta;
        } else if (i < 3 && j < 3) {
          dev_term += 2 * G * beta * (-1/3);
        }
        
        // n o n term
        const non = n[i] * n[j];
        D[i][j] += dev_term - 2 * G * (beta - gamma) * non;
      }
    }

    return D;
  }
}
