/**
 * SECP Engineering Calculation Core — Mechanics Engine
 * Force, Torque, Power, Stress, Strain, Mass, Center of Gravity, Moment of Inertia.
 */

export class MechanicsEngine {
  /** Force F = m * a (N) */
  public static calculateForceFromAcceleration(massKg: number, accelM2S: number): number {
    return massKg * accelM2S;
  }

  /** Force from Pressure F = P * A (N) */
  public static calculateForceFromPressure(pressurePa: number, areaM2: number): number {
    return pressurePa * areaM2;
  }

  /** Torque tau = F * r (N·m) */
  public static calculateTorque(forceN: number, radiusM: number): number {
    return forceN * radiusM;
  }

  /** Power P = tau * omega = tau * (2 * pi * RPM / 60) (Watts) */
  public static calculatePowerFromTorque(torqueNm: number, rpm: number): number {
    const omega = (2 * Math.PI * rpm) / 60;
    return torqueNm * omega;
  }

  /** Tensile Stress sigma = F / A (MPa) */
  public static calculateStressMPa(forceN: number, areaM2: number): number {
    if (areaM2 <= 0) return 0;
    return (forceN / areaM2) / 1e6;
  }

  /** Bending Stress sigma = M * y / I (MPa) */
  public static calculateBendingStressMPa(momentNm: number, yDistanceM: number, inertiaM4: number): number {
    if (inertiaM4 <= 0) return 0;
    return (momentNm * yDistanceM / inertiaM4) / 1e6;
  }

  /** Torsional Shear Stress tau = T * r / J (MPa) */
  public static calculateTorsionalShearMPa(torqueNm: number, outerRadiusM: number, polarInertiaM4: number): number {
    if (polarInertiaM4 <= 0) return 0;
    return (torqueNm * outerRadiusM / polarInertiaM4) / 1e6;
  }

  /** Strain epsilon = sigma / E (dimensionless) */
  public static calculateStrain(stressMPa: number, youngModulusGPa: number): number {
    if (youngModulusGPa <= 0) return 0;
    return (stressMPa * 1e6) / (youngModulusGPa * 1e9);
  }

  /** Mass m = rho * V (kg) */
  public static calculateMass(densityKgM3: number, volumeM3: number): number {
    return densityKgM3 * volumeM3;
  }

  /** Mass Center of Gravity (m) */
  public static calculateCenterOfGravity(
    elements: { massKg: number; x: number; y: number; z: number }[]
  ): { x: number; y: number; z: number; totalMassKg: number } {
    let totalMass = 0;
    let sumX = 0, sumY = 0, sumZ = 0;
    for (const el of elements) {
      totalMass += el.massKg;
      sumX += el.massKg * el.x;
      sumY += el.massKg * el.y;
      sumZ += el.massKg * el.z;
    }
    if (totalMass === 0) return { x: 0, y: 0, z: 0, totalMassKg: 0 };
    return {
      x: sumX / totalMass,
      y: sumY / totalMass,
      z: sumZ / totalMass,
      totalMassKg: totalMass
    };
  }

  /** Box Mass Moment of Inertia I_zz = 1/12 * m * (width^2 + height^2) (kg·m²) */
  public static calculateBoxInertia(massKg: number, widthM: number, heightM: number): number {
    return (1 / 12) * massKg * (Math.pow(widthM, 2) + Math.pow(heightM, 2));
  }

  /** Solid Cylinder Mass Moment of Inertia I_zz = 1/2 * m * r^2 (kg·m²) */
  public static calculateCylinderInertia(massKg: number, radiusM: number): number {
    return 0.5 * massKg * Math.pow(radiusM, 2);
  }

  /** Cylinder Area Polar Moment of Inertia J = pi * d^4 / 32 (m⁴) */
  public static calculatePolarAreaInertiaJ(diameterM: number): number {
    return (Math.PI * Math.pow(diameterM, 4)) / 32;
  }
}
