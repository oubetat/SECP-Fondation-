import { SNMaterialModel, ExtrapolationPolicy } from "./types";

export class SNMaterialModelEngine {
  /**
   * Validates integrity of SNMaterialModel. Throws descriptive error if invalid.
   */
  public static validateModel(model: SNMaterialModel): void {
    if (!model) {
      throw new Error("MISSING_FATIGUE_CURVE: SNMaterialModel is null or undefined");
    }
    if (!model.uts || model.uts <= 0 || !isFinite(model.uts)) {
      throw new Error("INVALID_MATERIAL_DATA: Ultimate tensile strength (UTS) must be positive");
    }

    if (model.curveType === 'BASQUIN') {
      if (!model.basquinParams) {
        throw new Error("MISSING_FATIGUE_CURVE: Basquin parameters missing");
      }
      const { sf_prime, b } = model.basquinParams;
      if (!sf_prime || sf_prime <= 0 || !isFinite(sf_prime)) {
        throw new Error("INVALID_MATERIAL_DATA: Fatigue strength coefficient sf_prime must be positive");
      }
      if (b >= 0 || !isFinite(b)) {
        throw new Error("INVALID_MATERIAL_DATA: Fatigue strength exponent b must be negative");
      }
    } else if (model.curveType === 'TABULATED') {
      if (!model.curveData || model.curveData.length === 0) {
        throw new Error("MISSING_FATIGUE_CURVE: Tabulated S-N curve data is empty");
      }
      for (const pt of model.curveData) {
        if (!pt.stressAmplitude || pt.stressAmplitude <= 0 || !isFinite(pt.stressAmplitude)) {
          throw new Error("INVALID_MATERIAL_DATA: Non-positive or invalid stress amplitude in S-N curve data");
        }
        if (!pt.cyclesToFailure || pt.cyclesToFailure <= 0 || !isFinite(pt.cyclesToFailure)) {
          throw new Error("INVALID_MATERIAL_DATA: Non-positive or invalid cycles to failure in S-N curve data");
        }
      }
    } else {
      throw new Error("INVALID_MATERIAL_DATA: Unknown S-N curveType");
    }
  }

  /**
   * Evaluates cycles to failure N_f for a given corrected stress amplitude.
   * Returns Infinity if below fatigue/endurance limit.
   */
  public static calculateCyclesToFailure(
    model: SNMaterialModel,
    correctedAmplitude: number,
    extrapolationPolicy: ExtrapolationPolicy = ExtrapolationPolicy.OUTSIDE_MATERIAL_DATA_RANGE
  ): number {
    this.validateModel(model);

    if (correctedAmplitude <= 0) {
      return Infinity; // Infinite fatigue life
    }

    if (model.enduranceLimit && correctedAmplitude <= model.enduranceLimit) {
      return Infinity; // Below fatigue limit
    }

    if (model.curveType === 'BASQUIN') {
      const { sf_prime, b } = model.basquinParams!;
      // sigma_a = sf_prime * (2 * N_f)^b  =>  (2 * N_f) = (sigma_a / sf_prime)^(1/b)
      const ratio = correctedAmplitude / sf_prime;
      const reversals = Math.pow(ratio, 1.0 / b);
      const cycles = reversals / 2.0;

      if (!isFinite(cycles) || isNaN(cycles) || cycles <= 0) {
        return Infinity;
      }
      return cycles;
    }

    // TABULATED S-N curve log-log linear interpolation
    const data = [...model.curveData!].sort((a, b) => b.stressAmplitude - a.stressAmplitude);
    const maxStress = data[0].stressAmplitude;
    const minStress = data[data.length - 1].stressAmplitude;

    if (correctedAmplitude > maxStress) {
      if (extrapolationPolicy === ExtrapolationPolicy.REJECT) {
        throw new Error("OUTSIDE_MATERIAL_DATA_RANGE: Stress amplitude exceeds maximum S-N material data point");
      }
      // Extrapolate log-log from top segment
      const p1 = data[0];
      const p2 = data[1] || data[0];
      if (p1.stressAmplitude === p2.stressAmplitude) {
        return p1.cyclesToFailure;
      }
      const slope = (Math.log10(p2.cyclesToFailure) - Math.log10(p1.cyclesToFailure)) /
                    (Math.log10(p2.stressAmplitude) - Math.log10(p1.stressAmplitude));
      const logN = Math.log10(p1.cyclesToFailure) + slope * (Math.log10(correctedAmplitude) - Math.log10(p1.stressAmplitude));
      return Math.max(1.0, Math.pow(10, logN));
    }

    if (correctedAmplitude < minStress) {
      if (extrapolationPolicy === ExtrapolationPolicy.REJECT) {
        throw new Error("OUTSIDE_MATERIAL_DATA_RANGE: Stress amplitude is below minimum S-N material data point");
      }
      // Below lowest stress point -> infinite life / fatigue endurance limit
      return Infinity;
    }

    // Bracket search
    for (let i = 0; i < data.length - 1; i++) {
      const p1 = data[i];     // Higher stress, lower cycles
      const p2 = data[i + 1]; // Lower stress, higher cycles

      if (correctedAmplitude <= p1.stressAmplitude && correctedAmplitude >= p2.stressAmplitude) {
        if (p1.stressAmplitude === p2.stressAmplitude) {
          return p1.cyclesToFailure;
        }
        const logS1 = Math.log10(p1.stressAmplitude);
        const logS2 = Math.log10(p2.stressAmplitude);
        const logN1 = Math.log10(p1.cyclesToFailure);
        const logN2 = Math.log10(p2.cyclesToFailure);

        const slope = (logN2 - logN1) / (logS2 - logS1);
        const logN = logN1 + slope * (Math.log10(correctedAmplitude) - logS1);
        return Math.pow(10, logN);
      }
    }

    return data[data.length - 1].cyclesToFailure;
  }
}
