/**
 * PATCH-SECP-072: Gear Train Engine
 * Manages mechanical speed and torque propagation throughout nested gear systems.
 */

export class GearTrainEngine {
  public static calculateOutputVelocity(
    inputVelocity: number,
    gearRatio: number,
    direction: number // 1 (same) or -1 (reversed)
  ): number {
    return inputVelocity * gearRatio * direction;
  }

  public static calculateTorqueTransfer(
    inputTorque: number,
    gearRatio: number,
    efficiency: number = 0.98
  ): number {
    // Torque is inversely proportional to angular velocity, accounting for friction loss
    return (inputTorque / gearRatio) * efficiency;
  }
}
