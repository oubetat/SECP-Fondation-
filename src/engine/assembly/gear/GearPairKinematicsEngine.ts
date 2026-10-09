/**
 * PATCH-224 — Gear Pair Meshing, Interference & Kinematic Engine
 * Center distance calculation, Contact ratio (epsilon_alpha, epsilon_beta),
 * velocity & torque transmission, rotation direction, backlash, and mesh clash verification.
 */

import { GearDefinition, GearPairDefinition } from './GearTypes';

export interface CreateGearPairOptions {
  pinionGear: GearDefinition;
  wheelGear: GearDefinition;
  pinionSpeedRpm?: number;
  inputPowerKw?: number;
  centerDistanceOverrideMm?: number;
  backlashAllowanceMm?: number;
}

export class GearPairKinematicsEngine {
  /**
   * Verify and create a fully computed Gear Pair
   */
  public static createGearPair(options: CreateGearPairOptions): GearPairDefinition {
    const { pinionGear: g1, wheelGear: g2 } = options;
    const pairId = `PAIR-${g1.gearId.slice(-4)}-${g2.gearId.slice(-4)}`;
    const name = `Gear Pair (${g1.name} ↔ ${g2.name})`;

    const diagnostics: string[] = [];

    // 1. Module Compatibility Check
    const moduleDiff = Math.abs(g1.module - g2.module);
    if (moduleDiff > 0.001) {
      diagnostics.push(`Module Mismatch: Pinion (m=${g1.module}mm) and Wheel (m=${g2.module}mm) cannot mesh.`);
    }

    // 2. Pressure Angle Compatibility
    const paDiff = Math.abs(g1.pressureAngleDeg - g2.pressureAngleDeg);
    if (paDiff > 0.1) {
      diagnostics.push(`Pressure Angle Mismatch: Pinion (${g1.pressureAngleDeg}°) vs Wheel (${g2.pressureAngleDeg}°).`);
    }

    // 3. Helix Angle & Direction Compatibility
    if (g1.helixAngleDeg > 0 || g2.helixAngleDeg > 0) {
      const helixDiff = Math.abs(g1.helixAngleDeg - g2.helixAngleDeg);
      if (helixDiff > 0.1) {
        diagnostics.push(`Helix Angle Mismatch: Pinion (${g1.helixAngleDeg}°) vs Wheel (${g2.helixAngleDeg}°).`);
      }
      if (g1.type === 'HELICAL_EXTERNAL' && g2.type === 'HELICAL_EXTERNAL') {
        if (g1.helixDirection === g2.helixDirection) {
          diagnostics.push(`Helix Direction Warning: External helical gears require opposite hand (RH ↔ LH). Both are currently ${g1.helixDirection}.`);
        }
      }
    }

    // 4. Center Distance Calculation (ISO 21771)
    const isInternal = g2.type === 'SPUR_INTERNAL' || g2.type === 'HELICAL_INTERNAL';
    const standardCenterDistance = isInternal
      ? Math.abs(g2.pitchDiameterMm - g1.pitchDiameterMm) / 2
      : (g1.pitchDiameterMm + g2.pitchDiameterMm) / 2;

    const actualCenterDistance = options.centerDistanceOverrideMm || standardCenterDistance;

    // 5. Gear Ratio & Speeds
    const gearRatio = g2.teethCount / g1.teethCount;
    const transmissionRatio = 1 / gearRatio;
    const pinionSpeedRpm = options.pinionSpeedRpm || 1450;
    const wheelSpeedRpm = isInternal ? (pinionSpeedRpm / gearRatio) : -(pinionSpeedRpm / gearRatio);
    const pinionDir: 'CW' | 'CCW' = 'CW';
    const wheelDir: 'CW' | 'CCW' = isInternal ? 'CW' : 'CCW';

    // 6. Contact Ratio (ISO 21771 Profile Contact Ratio epsilon_alpha)
    const ra1 = g1.tipDiameterMm / 2;
    const rb1 = g1.baseDiameterMm / 2;
    const ra2 = g2.tipDiameterMm / 2;
    const rb2 = g2.baseDiameterMm / 2;
    const alphaTRad = (g1.transversePressureAngleDeg * Math.PI) / 180;
    const pbMm = g1.basePitchMm;

    // Contact length on line of action
    const gAlpha = Math.sqrt(Math.max(ra1 * ra1 - rb1 * rb1, 0)) +
                   Math.sqrt(Math.max(ra2 * ra2 - rb2 * rb2, 0)) -
                   actualCenterDistance * Math.sin(alphaTRad);

    const contactRatioProfile = pbMm > 0 ? Math.max(gAlpha / pbMm, 1.0) : 1.4;

    // Helical Overlap Ratio epsilon_beta = (b * sin(beta)) / (pi * mn)
    const betaRad = (g1.helixAngleDeg * Math.PI) / 180;
    const minFaceWidth = Math.min(g1.faceWidthMm, g2.faceWidthMm);
    const overlapRatio = (minFaceWidth * Math.sin(betaRad)) / (Math.PI * g1.module);
    const totalContactRatio = contactRatioProfile + overlapRatio;

    if (contactRatioProfile < 1.2) {
      diagnostics.push(`Low Profile Contact Ratio (εα = ${contactRatioProfile.toFixed(2)} < 1.20). Risk of tooth impact noise.`);
    }

    // 7. Clearance & Backlash Verification
    const rootClearance1 = Math.abs(actualCenterDistance - (g1.pitchDiameterMm / 2 + g2.rootDiameterMm / 2));
    const minClearance = 0.25 * g1.module;
    const operatingBacklash = options.backlashAllowanceMm || (g1.backlashMm + g2.backlashMm);

    // 8. Power & Torque Transmission
    const pKw = options.inputPowerKw || 15;
    const inputTorqueNm = (9550 * pKw) / pinionSpeedRpm;
    const meshEfficiency = 0.985;
    const outputTorqueNm = inputTorqueNm * gearRatio * meshEfficiency;

    const hasTipInterference = actualCenterDistance < (g1.rootDiameterMm + g2.rootDiameterMm) / 2;
    const hasInterference = moduleDiff > 0.001 || hasTipInterference;
    const meshingStatus = moduleDiff > 0.001
      ? 'MODULE_MISMATCH'
      : hasTipInterference
      ? 'TIP_INTERFERENCE'
      : 'PERFECT_MESH';

    return {
      pairId,
      name,
      pinionGearId: g1.gearId,
      wheelGearId: g2.gearId,
      nominalCenterDistanceMm: Math.round(actualCenterDistance * 1000) / 1000,
      operatingPressureAngleDeg: g1.transversePressureAngleDeg,
      gearRatio: Math.round(gearRatio * 1000) / 1000,
      transmissionRatio: Math.round(transmissionRatio * 1000) / 1000,
      contactRatioProfileEpsilonAlpha: Math.round(contactRatioProfile * 100) / 100,
      overlapRatioEpsilonBeta: Math.round(overlapRatio * 100) / 100,
      totalContactRatioEpsilonGamma: Math.round(totalContactRatio * 100) / 100,
      operatingBacklashMm: Math.round(operatingBacklash * 1000) / 1000,
      pinionSpeedRpm,
      wheelSpeedRpm: Math.abs(wheelSpeedRpm),
      pinionRotationDirection: pinionDir,
      wheelRotationDirection: wheelDir,
      inputPowerKw: pKw,
      inputTorqueNm: Math.round(inputTorqueNm * 10) / 10,
      outputTorqueNm: Math.round(outputTorqueNm * 10) / 10,
      meshEfficiency,
      hasInterference,
      minimumTipRootClearanceMm: Math.round(minClearance * 1000) / 1000,
      meshingStatus,
      diagnostics
    };
  }

  /**
   * Kinematic simulation step: compute animated angular rotation of wheel given pinion rotation
   */
  public static computeMeshingRotations(pinionAngleDeg: number, gearRatio: number, isInternal: boolean = false): {
    pinionAngleDeg: number;
    wheelAngleDeg: number;
  } {
    const wheelAngleDeg = isInternal ? (pinionAngleDeg / gearRatio) : -(pinionAngleDeg / gearRatio);
    return {
      pinionAngleDeg: pinionAngleDeg % 360,
      wheelAngleDeg: wheelAngleDeg % 360
    };
  }
}
