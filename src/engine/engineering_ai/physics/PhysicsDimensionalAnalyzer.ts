import { DimensionalFormula, QuantityType } from './types';

export class PhysicsDimensionalAnalyzer {
  public static QUANTITY_DIMENSIONS: Record<QuantityType, DimensionalFormula> = {
    FORCE: { M: 1, L: 1, T: -2, Theta: 0 },
    MASS: { M: 1, L: 0, T: 0, Theta: 0 },
    LENGTH: { M: 0, L: 1, T: 0, Theta: 0 },
    TIME: { M: 0, L: 0, T: 1, Theta: 0 },
    TEMPERATURE: { M: 0, L: 0, T: 0, Theta: 1 },
    PRESSURE: { M: 1, L: -1, T: -2, Theta: 0 },
    ENERGY: { M: 1, L: 2, T: -2, Theta: 0 },
    POWER: { M: 1, L: 2, T: -3, Theta: 0 },
    VELOCITY: { M: 0, L: 1, T: -1, Theta: 0 },
    ACCELERATION: { M: 0, L: 1, T: -2, Theta: 0 },
    DENSITY: { M: 1, L: -3, T: 0, Theta: 0 },
    VISCOSITY: { M: 1, L: -1, T: -1, Theta: 0 },
    CONDUCTIVITY: { M: 1, L: 1, T: -3, Theta: -1 },
    STRESS: { M: 1, L: -1, T: -2, Theta: 0 },
    STRAIN: { M: 0, L: 0, T: 0, Theta: 0 },
    HEAT_FLUX: { M: 1, L: 0, T: -3, Theta: 0 },
    DIMENSIONLESS: { M: 0, L: 0, T: 0, Theta: 0 }
  };

  public static areDimensionsEqual(a: DimensionalFormula, b: DimensionalFormula): boolean {
    return (
      a.M === b.M &&
      a.L === b.L &&
      a.T === b.T &&
      a.Theta === b.Theta &&
      (a.I || 0) === (b.I || 0) &&
      (a.N || 0) === (b.N || 0) &&
      (a.J || 0) === (b.J || 0)
    );
  }

  public static multiplyDimensions(a: DimensionalFormula, b: DimensionalFormula): DimensionalFormula {
    return {
      M: a.M + b.M,
      L: a.L + b.L,
      T: a.T + b.T,
      Theta: a.Theta + b.Theta,
      I: (a.I || 0) + (b.I || 0),
      N: (a.N || 0) + (b.N || 0),
      J: (a.J || 0) + (b.J || 0)
    };
  }

  public static divideDimensions(a: DimensionalFormula, b: DimensionalFormula): DimensionalFormula {
    return {
      M: a.M - b.M,
      L: a.L - b.L,
      T: a.T - b.T,
      Theta: a.Theta - b.Theta,
      I: (a.I || 0) - (b.I || 0),
      N: (a.N || 0) - (b.N || 0),
      J: (a.J || 0) - (b.J || 0)
    };
  }

  public static powerDimensions(a: DimensionalFormula, power: number): DimensionalFormula {
    return {
      M: a.M * power,
      L: a.L * power,
      T: a.T * power,
      Theta: a.Theta * power,
      I: (a.I || 0) * power,
      N: (a.N || 0) * power,
      J: (a.J || 0) * power
    };
  }

  /**
   * Verifies an equation expression e.g., "F = m * a" or "F = m + a"
   */
  public static verifyEquationExpression(expression: string, varQuantities: Record<string, QuantityType>): {
    valid: boolean;
    reason: string;
    lhsDimension?: DimensionalFormula;
    rhsDimension?: DimensionalFormula;
  } {
    const parts = expression.split('=').map((p) => p.trim());
    if (parts.length !== 2) {
      return { valid: false, reason: 'INVALID_EQUATION_FORMAT: Equation must contain exactly one "=" sign.' };
    }

    const [lhsStr, rhsStr] = parts;

    // Helper to evaluate simple expression dimensional formula
    const evalSimpleExpr = (expr: string): { dim: DimensionalFormula; valid: boolean; err?: string } => {
      // Check for addition/subtraction vs multiplication/division
      if (expr.includes('+')) {
        const terms = expr.split('+').map((t) => t.trim());
        const termDims = terms.map((t) => evalSimpleExpr(t));
        if (termDims.some((td) => !td.valid)) return { dim: { M: 0, L: 0, T: 0, Theta: 0 }, valid: false, err: 'Invalid term' };

        const firstDim = termDims[0].dim;
        for (let i = 1; i < termDims.length; i++) {
          if (!this.areDimensionsEqual(firstDim, termDims[i].dim)) {
            return {
              dim: { M: 0, L: 0, T: 0, Theta: 0 },
              valid: false,
              err: `DIMENSIONALLY_INVALID: Attempted to add incompatible terms '${terms[0]}' and '${terms[i]}'`
            };
          }
        }
        return { dim: firstDim, valid: true };
      }

      if (expr.includes('*')) {
        const factors = expr.split('*').map((f) => f.trim());
        let currentDim: DimensionalFormula = { M: 0, L: 0, T: 0, Theta: 0 };
        for (const f of factors) {
          const qty = varQuantities[f] || (f.match(/^\d+(\.\d+)?$/) ? 'DIMENSIONLESS' : undefined);
          if (!qty) {
            return { dim: currentDim, valid: false, err: `Unknown variable in equation: '${f}'` };
          }
          currentDim = this.multiplyDimensions(currentDim, this.QUANTITY_DIMENSIONS[qty]);
        }
        return { dim: currentDim, valid: true };
      }

      if (expr.includes('/')) {
        const partsDiv = expr.split('/').map((p) => p.trim());
        const numRes = evalSimpleExpr(partsDiv[0]);
        const denRes = evalSimpleExpr(partsDiv[1]);
        if (!numRes.valid || !denRes.valid) return { dim: { M: 0, L: 0, T: 0, Theta: 0 }, valid: false, err: 'Invalid div' };
        return { dim: this.divideDimensions(numRes.dim, denRes.dim), valid: true };
      }

      const trimmed = expr.trim();
      const qty = varQuantities[trimmed] || (trimmed.match(/^\d+(\.\d+)?$/) ? 'DIMENSIONLESS' : undefined);
      if (!qty) {
        return { dim: { M: 0, L: 0, T: 0, Theta: 0 }, valid: false, err: `Unknown variable: '${trimmed}'` };
      }
      return { dim: this.QUANTITY_DIMENSIONS[qty], valid: true };
    };

    const lhsRes = evalSimpleExpr(lhsStr);
    const rhsRes = evalSimpleExpr(rhsStr);

    if (!lhsRes.valid) return { valid: false, reason: lhsRes.err || 'LHS evaluation error' };
    if (!rhsRes.valid) return { valid: false, reason: rhsRes.err || 'RHS evaluation error' };

    const isEqual = this.areDimensionsEqual(lhsRes.dim, rhsRes.dim);

    return {
      valid: isEqual,
      reason: isEqual
        ? 'DIMENSIONALLY_VALID: Dimensions on LHS match RHS.'
        : `DIMENSIONALLY_INVALID: LHS dimension [${this.formatDim(lhsRes.dim)}] does not match RHS dimension [${this.formatDim(rhsRes.dim)}].`,
      lhsDimension: lhsRes.dim,
      rhsDimension: rhsRes.dim
    };
  }

  public static formatDim(d: DimensionalFormula): string {
    return `M^${d.M} L^${d.L} T^${d.T} Theta^${d.Theta}`;
  }
}
