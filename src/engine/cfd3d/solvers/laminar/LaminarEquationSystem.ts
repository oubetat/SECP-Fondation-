/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-061: Laminar Equation System
 */

import { FVMEquationCoefficients } from '../../fvm/FVMTypes';

export interface LinearSystem {
  readonly A_diag: Float64Array;
  readonly A_offDiag: Map<number, Map<number, number>>; // cellId -> neighborId -> coeff
  readonly B: Float64Array;
  readonly size: number;
}

export class LaminarEquationSystem {
  public readonly momentumX: FVMEquationCoefficients[];
  public readonly momentumY: FVMEquationCoefficients[];
  public readonly momentumZ: FVMEquationCoefficients[];
  public readonly pressure: FVMEquationCoefficients[];
  public readonly energy?: FVMEquationCoefficients[];
  public readonly cellCount: number;

  constructor(cellCount: number, energyEnabled: boolean = false) {
    this.cellCount = cellCount;
    this.momentumX = this.initializeCoefficients(cellCount);
    this.momentumY = this.initializeCoefficients(cellCount);
    this.momentumZ = this.initializeCoefficients(cellCount);
    this.pressure = this.initializeCoefficients(cellCount);
    if (energyEnabled) {
      this.energy = this.initializeCoefficients(cellCount);
    }
  }

  private initializeCoefficients(count: number): FVMEquationCoefficients[] {
    const coeffs: FVMEquationCoefficients[] = [];
    for (let i = 0; i < count; i++) {
      coeffs.push({
        aP: 0,
        aN: new Map<number, number>(),
        b: 0,
        transientContribution: 0,
        boundaryContribution: 0
      });
    }
    return coeffs;
  }

  public reset(): void {
    this.resetCoeffs(this.momentumX);
    this.resetCoeffs(this.momentumY);
    this.resetCoeffs(this.momentumZ);
    this.resetCoeffs(this.pressure);
    if (this.energy) {
      this.resetCoeffs(this.energy);
    }
  }

  private resetCoeffs(coeffs: FVMEquationCoefficients[]): void {
    for (const c of coeffs) {
      c.aP = 0;
      c.aN.clear();
      c.b = 0;
      c.transientContribution = 0;
      c.boundaryContribution = 0;
    }
  }

  public convertToLinearSystem(coeffs: FVMEquationCoefficients[]): LinearSystem {
    const size = coeffs.length;
    const A_diag = new Float64Array(size);
    const B = new Float64Array(size);
    const A_offDiag = new Map<number, Map<number, number>>();

    for (let i = 0; i < size; i++) {
      const c = coeffs[i];
      A_diag[i] = c.aP;
      B[i] = c.b;
      if (c.aN.size > 0) {
        A_offDiag.set(i, new Map(c.aN));
      }
    }

    return { A_diag, A_offDiag, B, size };
  }
}
