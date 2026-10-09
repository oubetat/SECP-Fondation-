/**
 * PATCH-SECP-229 — Gear Kinematics & Transmission Coupling
 * 
 * Computes exact physical kinematics for gear pairs, gear trains, rack & pinion, and screw drives:
 *  omega_2 = - omega_1 * (N_1 / N_2)
 *  v_rack = omega_pinion * r_pitch
 */

export interface GearPairKinematicsResult {
  driverTeethN1: number;
  followerTeethN2: number;
  gearRatio: number; // N1 / N2
  directionInverted: boolean;
  
  driverAngularVelocityRadSec: number;
  followerAngularVelocityRadSec: number;
  
  driverDisplacementRad: number;
  followerDisplacementRad: number;
  
  phaseAngleRad: number;
  mechanicalAdvantage: number;
}

export interface RackPinionKinematicsResult {
  pinionPitchRadiusMm: number;
  pinionTeethCount: number;
  pinionAngularVelocityRadSec: number;
  rackLinearVelocityMmSec: number;
  rackDisplacementMm: number;
}

export class KinematicGearKinematics {

  /**
   * Calculates gear pair velocity and displacement transfer
   */
  public static solveGearPair(
    teethN1: number,
    teethN2: number,
    driverSpeedRadSec: number,
    driverAngleRad: number,
    invertDirection: boolean = true
  ): GearPairKinematicsResult {
    const ratio = teethN1 / teethN2;
    const directionSign = invertDirection ? -1.0 : 1.0;

    const followerSpeed = directionSign * driverSpeedRadSec * ratio;
    const followerAngle = directionSign * driverAngleRad * ratio;

    return {
      driverTeethN1: teethN1,
      followerTeethN2: teethN2,
      gearRatio: ratio,
      directionInverted: invertDirection,
      driverAngularVelocityRadSec: driverSpeedRadSec,
      followerAngularVelocityRadSec: followerSpeed,
      driverDisplacementRad: driverAngleRad,
      followerDisplacementRad: followerAngle,
      phaseAngleRad: 0.0,
      mechanicalAdvantage: 1.0 / ratio
    };
  }

  /**
   * Calculates Rack & Pinion rotary-to-linear kinematic transfer
   */
  public static solveRackAndPinion(
    pinionTeeth: number,
    moduleMm: number,
    pinionSpeedRadSec: number,
    pinionAngleRad: number
  ): RackPinionKinematicsResult {
    const pitchRadius = (pinionTeeth * moduleMm) / 2.0;
    const rackVelocity = pinionSpeedRadSec * pitchRadius;
    const rackDisplacement = pinionAngleRad * pitchRadius;

    return {
      pinionPitchRadiusMm: pitchRadius,
      pinionTeethCount: pinionTeeth,
      pinionAngularVelocityRadSec: pinionSpeedRadSec,
      rackLinearVelocityMmSec: rackVelocity,
      rackDisplacementMm: rackDisplacement
    };
  }
}
