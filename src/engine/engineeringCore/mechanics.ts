/**
 * SECP Engineering Calculation Core — Mechanics Engine
 */
export class MechanicsEngine {
  public static calculateForceFromAcceleration(massKg: number, accelerationMS2: number): number {
    return massKg * accelerationMS2;
  }

  public static calculateTorque(forceN: number, radiusM: number): number {
    return forceN * radiusM;
  }

  public static calculatePowerFromTorque(torqueNm: number, rpm: number): number {
    const omega = (rpm * 2 * Math.PI) / 60;
    return torqueNm * omega;
  }

  public static calculateStressMPa(forceN: number, areaM2: number): number {
    if (areaM2 <= 0) return 0;
    return forceN / areaM2 / 1e6;
  }

  public static calculateStrain(stressMPa: number, youngModulusGPa: number): number {
    if (youngModulusGPa <= 0) return 0;
    return (stressMPa * 1e6) / (youngModulusGPa * 1e9);
  }

  public static calculateBoxInertia(massKg: number, widthM: number, heightM: number): number {
    return (1 / 12) * massKg * (Math.pow(widthM, 2) + Math.pow(heightM, 2));
  }

  public static calculateStress(force: number, area: number): number {
    return area > 0 ? force / area : 0;
  }
}

export const Mechanics = {
  calculateStress: (force: number, area: number) => (area > 0 ? force / area : 0),
  calculateStrain: (deltaL: number, L: number) => (L > 0 ? deltaL / L : 0)
};
