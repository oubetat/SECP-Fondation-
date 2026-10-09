/**
 * SECP Core Physics Engine — Propulsion Unit Converter
 * Domain-neutral physics unit conversion helper.
 */

export class PropulsionUnitConverter {
  /**
   * Converts rotational speed in RPM to angular velocity in rad/s.
   * omega = 2 * PI * RPM / 60
   */
  public static rpmToRadPerSec(rpm: number): number {
    return (2 * Math.PI * rpm) / 60;
  }

  /**
   * Converts angular velocity in rad/s to RPM.
   */
  public static radPerSecToRpm(omega: number): number {
    return (omega * 60) / (2 * Math.PI);
  }

  /**
   * Converts RPM to Rotations Per Second (RPS = n).
   */
  public static rpmToRps(rpm: number): number {
    return rpm / 60;
  }

  /**
   * Converts Force in Newtons (N) to Kilogram-force (kgf).
   */
  public static newtonToKgf(forceN: number): number {
    return forceN / 9.80665;
  }

  /**
   * Converts Kilogram-force (kgf) to Newtons (N).
   */
  public static kgfToNewton(kgf: number): number {
    return kgf * 9.80665;
  }

  /**
   * Calculates propeller tip speed in m/s.
   * V_tip = omega * (diameter / 2)
   */
  public static computeTipSpeedMps(rpm: number, diameterM: number): number {
    const omega = this.rpmToRadPerSec(rpm);
    return omega * (diameterM / 2);
  }

  /**
   * Converts Torque from N·m to N·cm.
   */
  public static nmToNcm(torqueNm: number): number {
    return torqueNm * 100;
  }
}
