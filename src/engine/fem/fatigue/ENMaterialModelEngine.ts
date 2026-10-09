import { ENMaterialModel } from "./types";

export class ENMaterialModelEngine {
  /**
   * Validates ENMaterialModel parameters.
   */
  public static validateModel(model: ENMaterialModel): void {
    if (!model) {
      throw new Error("MISSING_FATIGUE_CURVE: ENMaterialModel is null or undefined");
    }
    if (!model.sf_prime || model.sf_prime <= 0 || !isFinite(model.sf_prime)) {
      throw new Error("INVALID_MATERIAL_DATA: sf_prime must be positive");
    }
    if (!model.E || model.E <= 0 || !isFinite(model.E)) {
      throw new Error("INVALID_MATERIAL_DATA: Young's Modulus E must be positive");
    }
    if (model.b >= 0 || !isFinite(model.b)) {
      throw new Error("INVALID_MATERIAL_DATA: Elastic exponent b must be negative");
    }
    if (!model.ef_prime || model.ef_prime <= 0 || !isFinite(model.ef_prime)) {
      throw new Error("INVALID_MATERIAL_DATA: ef_prime must be positive");
    }
    if (model.c >= 0 || !isFinite(model.c)) {
      throw new Error("INVALID_MATERIAL_DATA: Plastic exponent c must be negative");
    }
  }

  /**
   * Solves Coffin-Manson strain-life relation for cycles to failure N_f.
   * epsilon_a = (sf_prime / E) * (2*N_f)^b + ef_prime * (2*N_f)^c
   */
  public static calculateCyclesToFailure(
    model: ENMaterialModel,
    strainAmplitude: number
  ): { cyclesToFailure: number; elasticStrainAmplitude: number; plasticStrainAmplitude: number } {
    this.validateModel(model);

    if (strainAmplitude <= 0) {
      return { cyclesToFailure: Infinity, elasticStrainAmplitude: 0, plasticStrainAmplitude: 0 };
    }

    const { sf_prime, b, ef_prime, c, E } = model;

    // Use Newton-Raphson iteration to solve for 2N_f
    let x = 1000.0; // Initial guess for reversals 2N_f
    const maxIter = 100;
    const tol = 1e-10;

    for (let iter = 0; iter < maxIter; iter++) {
      const ee = (sf_prime / E) * Math.pow(x, b);
      const ep = ef_prime * Math.pow(x, c);
      const f = ee + ep - strainAmplitude;

      if (Math.abs(f) < tol) break;

      const df = (sf_prime / E) * b * Math.pow(x, b - 1.0) + ef_prime * c * Math.pow(x, c - 1.0);
      const dx = f / df;
      x = Math.max(1.0, x - dx);
    }

    const reversals = x;
    const cyclesToFailure = reversals / 2.0;
    const elasticStrainAmplitude = (sf_prime / E) * Math.pow(reversals, b);
    const plasticStrainAmplitude = ef_prime * Math.pow(reversals, c);

    return {
      cyclesToFailure,
      elasticStrainAmplitude,
      plasticStrainAmplitude
    };
  }
}
