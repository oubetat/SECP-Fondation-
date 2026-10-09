import { Matrix } from "../core/MathUtils";
import { FiniteStrainMeasure, StressMeasure } from "./types";

export class StrainMeasures {
  static computeRightCauchyGreen(F_data: number[][]): Matrix {
    const F = new Matrix(F_data.length, F_data[0].length, F_data);
    return F.transpose().multiply(F);
  }

  static computeLeftCauchyGreen(F_data: number[][]): Matrix {
    const F = new Matrix(F_data.length, F_data[0].length, F_data);
    return F.multiply(F.transpose());
  }

  static computeGreenLagrange(C: Matrix): Matrix {
    const dim = C.rows;
    const E = Matrix.zeros(dim, dim);
    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        const val = 0.5 * (C.get(i, j) - (i === j ? 1.0 : 0.0));
        E.set(i, j, val);
      }
    }
    return E;
  }

  static computeAlmansi(B: Matrix): Matrix {
    const dim = B.rows;
    const Binv = B.inverse();
    const e = Matrix.zeros(dim, dim);
    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        const val = 0.5 * ((i === j ? 1.0 : 0.0) - Binv.get(i, j));
        e.set(i, j, val);
      }
    }
    return e;
  }
}

export class StressMeasures {
  /**
   * Converts Cauchy stress (sigma) to PK2 stress (S).
   * S = J * F^-1 * sigma * F^-T
   */
  static cauchyToPK2(sigma_data: number[][], F_data: number[][], J: number): Matrix {
    const dim = sigma_data.length;
    const sigma = new Matrix(dim, dim, sigma_data);
    const F = new Matrix(dim, dim, F_data);
    const Finv = F.inverse();
    
    return Finv.multiply(sigma).multiply(Finv.transpose()).scale(J);
  }

  /**
   * Converts PK2 stress (S) to Cauchy stress (sigma).
   * sigma = (1/J) * F * S * F^T
   */
  static pk2ToCauchy(S: Matrix, F_data: number[][], J: number): Matrix {
    const F = new Matrix(F_data.length, F_data[0].length, F_data);
    return F.multiply(S).multiply(F.transpose()).scale(1 / J);
  }

  /**
   * Converts PK2 stress (S) to PK1 stress (P).
   * P = F * S
   */
  static pk2ToPK1(S: Matrix, F_data: number[][]): Matrix {
    const F = new Matrix(F_data.length, F_data[0].length, F_data);
    return F.multiply(S);
  }
}
