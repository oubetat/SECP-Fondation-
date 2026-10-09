/**
 * PATCH-224 — Analytical Involute Tooth Profile Engine
 * Exact mathematical generation of involute gear tooth curves, root fillets,
 * tip lands, backlash, circular patterning, and undercut diagnostics.
 */

import { InvolutePoint2D, InvoluteToothProfile2D } from './GearTypes';

export interface InvoluteGenerationParams {
  module: number; // m (mm)
  teethCount: number; // z
  pressureAngleDeg: number; // alpha (deg)
  profileShiftCoefficient?: number; // x (default 0)
  backlashMm?: number; // j (mm)
  rootFilletFactor?: number; // default 0.38
  tipRadiusChamferMm?: number; // default 0
  numInvolutePointsPerFlank?: number; // default 16
}

export class GearInvoluteEngine {
  /**
   * Involute function: inv(alpha) = tan(alpha) - alpha (in radians)
   */
  public static inv(alphaRad: number): number {
    return Math.tan(alphaRad) - alphaRad;
  }

  /**
   * Inverse involute function (Newton-Raphson approximation for alpha given inv(alpha))
   */
  public static invInverse(invVal: number): number {
    let alpha = Math.cbrt(3 * invVal); // Initial guess
    for (let i = 0; i < 6; i++) {
      const f = Math.tan(alpha) - alpha - invVal;
      const df = Math.tan(alpha) * Math.tan(alpha);
      if (Math.abs(df) < 1e-10) break;
      alpha -= f / df;
    }
    return alpha;
  }

  /**
   * Calculate minimum number of teeth to avoid undercut for a given pressure angle and profile shift
   * z_min = 2 * (1 - x) / (sin^2(alpha))
   */
  public static calculateMinTeethAvoidUndercut(pressureAngleDeg: number, profileShift: number = 0): number {
    const alphaRad = (pressureAngleDeg * Math.PI) / 180;
    const sinAlpha = Math.sin(alphaRad);
    if (sinAlpha === 0) return 999;
    return (2 * (1 - profileShift)) / (sinAlpha * sinAlpha);
  }

  /**
   * Check if a gear has severe manufacturing undercut
   */
  public static checkUndercut(teethCount: number, pressureAngleDeg: number, profileShift: number = 0): {
    hasUndercut: boolean;
    minTeethRequired: number;
    severity: 'NONE' | 'SLIGHT' | 'SEVERE';
  } {
    const zMin = this.calculateMinTeethAvoidUndercut(pressureAngleDeg, profileShift);
    const hasUndercut = teethCount < zMin;
    let severity: 'NONE' | 'SLIGHT' | 'SEVERE' = 'NONE';
    if (teethCount < zMin - 4) {
      severity = 'SEVERE';
    } else if (hasUndercut) {
      severity = 'SLIGHT';
    }
    return {
      hasUndercut,
      minTeethRequired: Math.ceil(zMin),
      severity
    };
  }

  /**
   * Generate exact parametric involute tooth profile for all teeth around pitch circle
   */
  public static generateCompleteGearProfile(params: InvoluteGenerationParams): {
    pitchRadiusMm: number;
    baseRadiusMm: number;
    tipRadiusMm: number;
    rootRadiusMm: number;
    circularPitchMm: number;
    toothThicknessMm: number;
    teethProfiles: InvoluteToothProfile2D[];
    continuousContour2D: InvolutePoint2D[];
    hasUndercut: boolean;
    diagnostics: string[];
  } {
    const {
      module: m,
      teethCount: z,
      pressureAngleDeg,
      profileShiftCoefficient: x = 0,
      backlashMm = 0.04 * m,
      rootFilletFactor = 0.38,
      numInvolutePointsPerFlank = 20
    } = params;

    const alphaRad = (pressureAngleDeg * Math.PI) / 180;
    const rPitch = (m * z) / 2;
    const rBase = rPitch * Math.cos(alphaRad);
    const ha = (1.0 + x) * m;
    const hf = (1.25 - x) * m;
    const rTip = rPitch + ha;
    const rRoot = Math.max(rPitch - hf, 0.1);
    const pCircular = Math.PI * m;

    // Nominal tooth thickness at pitch circle minus backlash
    const sPitch = (Math.PI * m) / 2 + 2 * x * m * Math.tan(alphaRad) - backlashMm / 2;
    const toothAnglePitch = sPitch / rPitch; // Angle subtended at center by tooth thickness

    // Involute angle at pitch circle
    const invAlpha = this.inv(alphaRad);

    const diagnostics: string[] = [];
    const undercutInfo = this.checkUndercut(z, pressureAngleDeg, x);
    if (undercutInfo.hasUndercut) {
      diagnostics.push(
        `Gear teeth count (${z}) is below minimum threshold (${undercutInfo.minTeethRequired}) for alpha=${pressureAngleDeg}°. Severity: ${undercutInfo.severity}.`
      );
    }

    const teethProfiles: InvoluteToothProfile2D[] = [];
    const fullContour: InvolutePoint2D[] = [];
    const toothAngularPitch = (2 * Math.PI) / z;

    // Starting radius for involute curve
    const rStartInvolute = Math.max(rBase, rRoot);

    for (let toothIdx = 0; toothIdx < z; toothIdx++) {
      const toothCenterAngle = toothIdx * toothAngularPitch;

      // 1. Generate Left Flank (Involute from rStartInvolute to rTip)
      const leftFlank: InvolutePoint2D[] = [];
      for (let i = 0; i <= numInvolutePointsPerFlank; i++) {
        const u = i / numInvolutePointsPerFlank;
        const r = rStartInvolute + u * (rTip - rStartInvolute);
        const cosAlphaR = Math.min(Math.max(rBase / r, -1), 1);
        const alphaR = Math.acos(cosAlphaR);
        const invAlphaR = this.inv(alphaR);

        // Half tooth thickness angle at radius r
        const halfAngleAtR = sPitch / (2 * rPitch) + invAlpha - invAlphaR;
        const angle = toothCenterAngle - halfAngleAtR;

        leftFlank.push({
          x: r * Math.cos(angle),
          y: r * Math.sin(angle),
          radius: r,
          angleRad: angle
        });
      }

      // 2. Generate Right Flank (Involute from rTip down to rStartInvolute)
      const rightFlank: InvolutePoint2D[] = [];
      for (let i = numInvolutePointsPerFlank; i >= 0; i--) {
        const u = i / numInvolutePointsPerFlank;
        const r = rStartInvolute + u * (rTip - rStartInvolute);
        const cosAlphaR = Math.min(Math.max(rBase / r, -1), 1);
        const alphaR = Math.acos(cosAlphaR);
        const invAlphaR = this.inv(alphaR);

        const halfAngleAtR = sPitch / (2 * rPitch) + invAlpha - invAlphaR;
        const angle = toothCenterAngle + halfAngleAtR;

        rightFlank.push({
          x: r * Math.cos(angle),
          y: r * Math.sin(angle),
          radius: r,
          angleRad: angle
        });
      }

      // 3. Tip Land (Arc connecting top of left flank to top of right flank)
      const tipLand: InvolutePoint2D[] = [];
      const tipAngleLeft = leftFlank[leftFlank.length - 1].angleRad;
      const tipAngleRight = rightFlank[0].angleRad;
      const tipSteps = 4;
      for (let j = 0; j <= tipSteps; j++) {
        const tAngle = tipAngleLeft + (j / tipSteps) * (tipAngleRight - tipAngleLeft);
        tipLand.push({
          x: rTip * Math.cos(tAngle),
          y: rTip * Math.sin(tAngle),
          radius: rTip,
          angleRad: tAngle
        });
      }

      // 4. Root Fillet & Transition Left
      const rootFilletLeft: InvolutePoint2D[] = [];
      const baseAngleLeft = leftFlank[0].angleRad;
      const rootStepAngleLeft = baseAngleLeft - (toothAngularPitch - toothAnglePitch) / 8;
      rootFilletLeft.push({
        x: rRoot * Math.cos(rootStepAngleLeft),
        y: rRoot * Math.sin(rootStepAngleLeft),
        radius: rRoot,
        angleRad: rootStepAngleLeft
      });

      // 5. Root Fillet & Transition Right
      const rootFilletRight: InvolutePoint2D[] = [];
      const baseAngleRight = rightFlank[rightFlank.length - 1].angleRad;
      const rootStepAngleRight = baseAngleRight + (toothAngularPitch - toothAnglePitch) / 8;
      rootFilletRight.push({
        x: rRoot * Math.cos(rootStepAngleRight),
        y: rRoot * Math.sin(rootStepAngleRight),
        radius: rRoot,
        angleRad: rootStepAngleRight
      });

      // 6. Root Land (Arc connecting to next tooth root)
      const rootLand: InvolutePoint2D[] = [];
      const nextToothCenter = (toothIdx + 1) * toothAngularPitch;
      const nextBaseAngleLeft = nextToothCenter - (sPitch / (2 * rPitch) + invAlpha - this.inv(Math.acos(rBase / rStartInvolute)));
      const rootLandSteps = 4;
      for (let k = 0; k <= rootLandSteps; k++) {
        const rAngle = rootStepAngleRight + (k / rootLandSteps) * (nextBaseAngleLeft - rootStepAngleRight);
        rootLand.push({
          x: rRoot * Math.cos(rAngle),
          y: rRoot * Math.sin(rAngle),
          radius: rRoot,
          angleRad: rAngle
        });
      }

      teethProfiles.push({
        toothIndex: toothIdx,
        pitchRadiusMm: rPitch,
        baseRadiusMm: rBase,
        tipRadiusMm: rTip,
        rootRadiusMm: rRoot,
        halfToothAngleRad: toothAnglePitch / 2,
        leftFlankPoints: leftFlank,
        rightFlankPoints: rightFlank,
        tipLandPoints: tipLand,
        rootFilletLeftPoints: rootFilletLeft,
        rootFilletRightPoints: rootFilletRight,
        rootLandPoints: rootLand
      });

      // Assemble into closed continuous outer rim contour
      fullContour.push(...rootFilletLeft);
      fullContour.push(...leftFlank);
      fullContour.push(...tipLand);
      fullContour.push(...rightFlank);
      fullContour.push(...rootFilletRight);
      fullContour.push(...rootLand);
    }

    return {
      pitchRadiusMm: rPitch,
      baseRadiusMm: rBase,
      tipRadiusMm: rTip,
      rootRadiusMm: rRoot,
      circularPitchMm: pCircular,
      toothThicknessMm: sPitch,
      teethProfiles,
      continuousContour2D: fullContour,
      hasUndercut: undercutInfo.hasUndercut,
      diagnostics
    };
  }
}
