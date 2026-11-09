/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 003
 * Human Joint Constraint Solver & Anatomical ROM Projector
 * 
 * Enforces hard joint-limit ROM constraints and reports saturation diagnostics.
 */

import { AnatomicalJointEngine } from '../joints/AnatomicalJointEngine';
import { AnatomicalJoint } from '../types/JointModelTypes';
import { HumanJointAngles, JointConstraintValidationResult, JointLimitSaturation } from './types';

export class HumanJointConstraintSolver {
  private static jointsMap: Map<string, AnatomicalJoint> = AnatomicalJointEngine.buildAnatomicalJoints();

  /**
   * Refreshes internal joint definitions if needed
   */
  public static refreshJointDefinitions(): void {
    this.jointsMap = AnatomicalJointEngine.buildAnatomicalJoints();
  }

  /**
   * Retrieves definition for a joint
   */
  public static getJoint(jointId: string): AnatomicalJoint | undefined {
    return this.jointsMap.get(jointId);
  }

  /**
   * Projects proposed joint angles into valid anatomical ROM boundaries.
   * Clamps angles to hard limits and flags saturation.
   */
  public static projectAndValidateJoint(
    jointId: string,
    proposedAngles: HumanJointAngles
  ): JointConstraintValidationResult {
    const joint = this.jointsMap.get(jointId);
    if (!joint) {
      return {
        isValid: true, // If unconstrained or unknown joint, pass through
        clampedAngles: { ...proposedAngles },
        isSaturated: false,
        violations: [`Unknown joint identifier '${jointId}'. Passed through without clamping.`]
      };
    }

    const rom = joint.rangeOfMotion;
    const clamped: HumanJointAngles = { ...proposedAngles };
    const violations: string[] = [];
    let saturated = false;

    // Helper clamp function
    const clampDOF = (val: number | undefined, minDeg?: number, maxDeg?: number, name?: string) => {
      if (val === undefined || minDeg === undefined || maxDeg === undefined) return { val, sat: false };
      let cVal = val;
      let sat = false;

      if (val < minDeg) {
        cVal = minDeg;
        sat = true;
        violations.push(`${jointId} ${name} (${val.toFixed(1)}°) below min limit (${minDeg}°). Clamped to ${minDeg}°.`);
      } else if (val > maxDeg) {
        cVal = maxDeg;
        sat = true;
        violations.push(`${jointId} ${name} (${val.toFixed(1)}°) exceeds max limit (${maxDeg}°). Clamped to ${maxDeg}°.`);
      }

      return { val: cVal, sat };
    };

    // 1. Flexion / Extension
    if (rom.flexionExtension) {
      const res = clampDOF(
        proposedAngles.flexionExtension,
        rom.flexionExtension.minDeg,
        rom.flexionExtension.maxDeg,
        'Flexion/Extension'
      );
      if (res.val !== undefined) clamped.flexionExtension = res.val;
      if (res.sat) saturated = true;
    }

    // 2. Abduction / Adduction
    if (rom.abductionAdduction && proposedAngles.abductionAdduction !== undefined) {
      const res = clampDOF(
        proposedAngles.abductionAdduction,
        rom.abductionAdduction.minDeg,
        rom.abductionAdduction.maxDeg,
        'Abduction/Adduction'
      );
      clamped.abductionAdduction = res.val;
      if (res.sat) saturated = true;
    }

    // 3. Internal / External Rotation
    if (rom.internalExternalRotation && proposedAngles.internalExternalRotation !== undefined) {
      const res = clampDOF(
        proposedAngles.internalExternalRotation,
        rom.internalExternalRotation.minDeg,
        rom.internalExternalRotation.maxDeg,
        'Internal/External Rotation'
      );
      clamped.internalExternalRotation = res.val;
      if (res.sat) saturated = true;
    }

    // 4. Lateral Bending
    if (rom.lateralBending && proposedAngles.lateralBending !== undefined) {
      const res = clampDOF(
        proposedAngles.lateralBending,
        rom.lateralBending.minDeg,
        rom.lateralBending.maxDeg,
        'Lateral Bending'
      );
      clamped.lateralBending = res.val;
      if (res.sat) saturated = true;
    }

    // 5. Axial Rotation
    if (rom.axialRotation && proposedAngles.axialRotation !== undefined) {
      const res = clampDOF(
        proposedAngles.axialRotation,
        rom.axialRotation.minDeg,
        rom.axialRotation.maxDeg,
        'Axial Rotation'
      );
      clamped.axialRotation = res.val;
      if (res.sat) saturated = true;
    }

    return {
      isValid: violations.length === 0,
      clampedAngles: clamped,
      isSaturated: saturated,
      violations
    };
  }

  /**
   * Inspects a full posture state and returns joint limit saturation breakdown
   */
  public static inspectPoseSaturations(jointAngles: Record<string, HumanJointAngles>): Record<string, JointLimitSaturation> {
    const result: Record<string, JointLimitSaturation> = {};

    for (const [jointId, angles] of Object.entries(jointAngles)) {
      const joint = this.jointsMap.get(jointId);
      if (!joint) continue;

      const rom = joint.rangeOfMotion;
      const flexSat = rom.flexionExtension
        ? angles.flexionExtension <= rom.flexionExtension.minDeg || angles.flexionExtension >= rom.flexionExtension.maxDeg
        : false;

      const abdSat = rom.abductionAdduction && angles.abductionAdduction !== undefined
        ? angles.abductionAdduction <= rom.abductionAdduction.minDeg || angles.abductionAdduction >= rom.abductionAdduction.maxDeg
        : undefined;

      const intSat = rom.internalExternalRotation && angles.internalExternalRotation !== undefined
        ? angles.internalExternalRotation <= rom.internalExternalRotation.minDeg || angles.internalExternalRotation >= rom.internalExternalRotation.maxDeg
        : undefined;

      result[jointId] = {
        jointId,
        flexExtSaturated: flexSat,
        abdAddSaturated: abdSat,
        intExtSaturated: intSat
      };
    }

    return result;
  }
}
