export interface HertzCylinderReference {
  equivalentYoungsModulus: number; // E*
  equivalentRadius: number;        // R*
  normalForce: number;             // F
  contactHalfWidth: number;        // a = sqrt(4 F R* / (pi E*))
  peakPressure: number;            // p0 = 2 F / (pi a) = sqrt(F E* / (pi R*))
  meanPressure: number;            // pm = F / (2 a)
}

export interface FlatOnFlatReference {
  totalForce: number;
  contactArea: number;
  uniformPressure: number;
}

export class IndependentContactReference {
  /**
   * Computes analytical Hertzian contact parameters for 2D cylinder-on-flat.
   */
  static computeHertzCylinder(
    E1: number, nu1: number,
    E2: number, nu2: number,
    R1: number, R2: number = Infinity,
    normalForcePerUnitLength: number
  ): HertzCylinderReference {
    const Estar1 = (1.0 - nu1 * nu1) / E1;
    const Estar2 = (1.0 - nu2 * nu2) / E2;
    const Estar = 1.0 / (Estar1 + Estar2);

    const Rstar = R2 === Infinity ? R1 : (R1 * R2) / (R1 + R2);

    const F = normalForcePerUnitLength;
    const a = Math.sqrt((4.0 * F * Rstar) / (Math.PI * Estar));
    const p0 = Math.sqrt((F * Estar) / (Math.PI * Rstar));
    const pm = F / (2.0 * a);

    return {
      equivalentYoungsModulus: Estar,
      equivalentRadius: Rstar,
      normalForce: F,
      contactHalfWidth: a,
      peakPressure: p0,
      meanPressure: pm
    };
  }

  /**
   * Computes analytical Flat-on-Flat reference response.
   */
  static computeFlatOnFlat(totalForce: number, contactLength: number): FlatOnFlatReference {
    const p = totalForce / contactLength;
    return {
      totalForce,
      contactArea: contactLength,
      uniformPressure: p
    };
  }
}
