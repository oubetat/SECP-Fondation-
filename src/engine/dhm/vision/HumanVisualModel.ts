/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 005
 * Human Visual Model & Eye/Gaze Kinematic Frame Calculator
 * 
 * Computes 3D eye origins, gaze vectors, and visual field (FOV) inclusion
 * for Left Eye, Right Eye, and Binocular vision based on NASA-STD-3001 Vol 2
 * and MIL-STD-1472H human factors norms.
 */

import { Vector3D, Matrix4x4 } from '../../assembly/graph/types';
import { TransformMatrix } from '../../assembly/graph/TransformMatrix';
import { SkeletalTopologyEngine } from '../topology/SkeletalTopologyEngine';
import { AnthropometricDatasetRegistry } from '../anthropometry/AnthropometricDatasetRegistry';
import { HumanForwardKinematicsEngine } from '../kinematics/HumanForwardKinematicsEngine';
import { HumanPoseState } from '../kinematics/types';
import { AnatomicalRegion } from '../types/SkeletalTopologyTypes';
import { HumanEyeConfiguration, HumanGazeConfiguration, HumanVisualFieldLimits } from './types';

export class HumanVisualModel {
  public static readonly VERSION = '1.0.0-PROD';

  public static readonly DEFAULT_VISUAL_LIMITS: HumanVisualFieldLimits = Object.freeze({
    monocularHorizontalDeg: { nasal: 60, temporal: 95 },
    monocularVerticalDeg: { superior: 60, inferior: 75 },
    binocularOverlapDeg: 120,
    fovealConeHalfAngleDeg: 2.5 // 5° total central foveal cone
  });

  public static readonly VISUAL_MODEL_PROVENANCE = [
    'Eye IPD and head geometry derived from ANSUR II 2012 Male P50 reference.',
    'Visual field limits derived from NASA-STD-3001 Vol 2 Rev C (Sec 4.10.4) and MIL-STD-1472H.',
    'Geometric line-of-sight raycasting does not measure cognitive visual acuity or luminance.'
  ];

  /**
   * Computes WCS eye origins for Left, Right, and Cyclopean Eye given a DHM pose and optional overrides
   */
  public static computeEyeConfiguration(
    dhmProfileId: string = 'ANSUR2_MALE_P50',
    pose?: HumanPoseState,
    overrides?: Partial<HumanEyeConfiguration>
  ): HumanEyeConfiguration {
    const registry = AnthropometricDatasetRegistry.getInstance();
    const profile = registry.getProfile(dhmProfileId) || registry.getProfile('ANSUR2_MALE_P50')!;
    const skeleton = SkeletalTopologyEngine.buildSkeleton(profile);

    const poseState = pose || HumanForwardKinematicsEngine.createDefaultNeutralPose();
    const fk = HumanForwardKinematicsEngine.computeFK(skeleton, poseState);

    const headState = fk.segmentStates[AnatomicalRegion.HEAD];
    const headGlobalT = headState ? headState.globalTransform : TransformMatrix.identity();

    const ipd = overrides?.interpupillaryDistanceMm ?? 64.0;
    const eyeHeight = overrides?.eyeHeightOffsetMm ?? 110.0;
    const eyeForward = overrides?.forwardEyeOffsetMm ?? 90.0;
    const halfIpd = ipd * 0.5;

    // Head-local eye offset vectors: +X = anterior (forward), +Y = lateral (left), +Z = superior (upward)
    const leftEyeLocal: Vector3D = { x: eyeForward, y: halfIpd, z: eyeHeight };
    const rightEyeLocal: Vector3D = { x: eyeForward, y: -halfIpd, z: eyeHeight };
    const cyclopeanLocal: Vector3D = { x: eyeForward, y: 0, z: eyeHeight };

    const leftEyeWCS = TransformMatrix.transformPoint(headGlobalT, leftEyeLocal);
    const rightEyeWCS = TransformMatrix.transformPoint(headGlobalT, rightEyeLocal);
    const cyclopeanWCS = TransformMatrix.transformPoint(headGlobalT, cyclopeanLocal);

    return {
      interpupillaryDistanceMm: ipd,
      eyeHeightOffsetMm: eyeHeight,
      forwardEyeOffsetMm: eyeForward,
      leftEyeOriginWCS: leftEyeWCS,
      rightEyeOriginWCS: rightEyeWCS,
      cyclopeanEyeOriginWCS: cyclopeanWCS
    };
  }

  /**
   * Computes primary normalized 3D gaze direction vector in WCS
   */
  public static computeGazeDirection(
    dhmProfileId: string = 'ANSUR2_MALE_P50',
    pose?: HumanPoseState,
    gazeConfig?: HumanGazeConfiguration
  ): Vector3D {
    const registry = AnthropometricDatasetRegistry.getInstance();
    const profile = registry.getProfile(dhmProfileId) || registry.getProfile('ANSUR2_MALE_P50')!;
    const skeleton = SkeletalTopologyEngine.buildSkeleton(profile);

    const poseState = pose || HumanForwardKinematicsEngine.createDefaultNeutralPose();
    const fk = HumanForwardKinematicsEngine.computeFK(skeleton, poseState);

    const headState = fk.segmentStates[AnatomicalRegion.HEAD];
    const headGlobalT = headState ? headState.globalTransform : TransformMatrix.identity();

    const yaw = gazeConfig?.eyeGazeYawDeg || 0;
    const pitch = gazeConfig?.eyeGazePitchDeg || 0;

    // Local forward vector (+X) rotated by eye yaw and pitch
    const deg2rad = Math.PI / 180;
    const yawRad = yaw * deg2rad;
    const pitchRad = pitch * deg2rad;

    const localGazeX = Math.cos(pitchRad) * Math.cos(yawRad);
    const localGazeY = Math.cos(pitchRad) * Math.sin(yawRad);
    const localGazeZ = Math.sin(pitchRad);

    // Transform local gaze direction vector through head global matrix (rotation part only)
    const gx = headGlobalT[0][0] * localGazeX + headGlobalT[0][1] * localGazeY + headGlobalT[0][2] * localGazeZ;
    const gy = headGlobalT[1][0] * localGazeX + headGlobalT[1][1] * localGazeY + headGlobalT[1][2] * localGazeZ;
    const gz = headGlobalT[2][0] * localGazeX + headGlobalT[2][1] * localGazeY + headGlobalT[2][2] * localGazeZ;

    const len = Math.sqrt(gx * gx + gy * gy + gz * gz);
    if (len < 1e-9) return { x: 1, y: 0, z: 0 };

    return {
      x: Number((gx / len).toFixed(6)),
      y: Number((gy / len).toFixed(6)),
      z: Number((gz / len).toFixed(6))
    };
  }

  /**
   * Tests whether a 3D target point lies inside the visual Field-of-View (FOV) boundaries
   */
  public static testVisualFieldInclusion(
    eyeOriginWCS: Vector3D,
    gazeVectorWCS: Vector3D,
    targetPosWCS: Vector3D,
    isLeftEye: boolean = false,
    customLimits: HumanVisualFieldLimits = HumanVisualModel.DEFAULT_VISUAL_LIMITS
  ): { isInsideFOV: boolean; isInsideFovealCone: boolean; angleDeg: number } {
    const dx = targetPosWCS.x - eyeOriginWCS.x;
    const dy = targetPosWCS.y - eyeOriginWCS.y;
    const dz = targetPosWCS.z - eyeOriginWCS.z;

    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 1e-6) {
      return { isInsideFOV: true, isInsideFovealCone: true, angleDeg: 0 };
    }

    const targetDir = { x: dx / dist, y: dy / dist, z: dz / dist };

    // Dot product to get total 3D angle relative to gaze vector
    const dot = targetDir.x * gazeVectorWCS.x + targetDir.y * gazeVectorWCS.y + targetDir.z * gazeVectorWCS.z;
    const clampedDot = Math.max(-1.0, Math.min(1.0, dot));
    const angleRad = Math.acos(clampedDot);
    const angleDeg = Number((angleRad * (180 / Math.PI)).toFixed(2));

    // If target is behind the eye plane (angle >= 90 deg), it is outside visual field
    if (clampedDot <= 0) {
      return { isInsideFOV: false, isInsideFovealCone: false, angleDeg };
    }

    const isInsideFovealCone = angleDeg <= customLimits.fovealConeHalfAngleDeg;

    // Compute gaze-local coordinate frame
    const upVector: Vector3D = { x: 0, y: 0, z: 1 };
    let rightX = gazeVectorWCS.y * upVector.z - gazeVectorWCS.z * upVector.y;
    let rightY = gazeVectorWCS.z * upVector.x - gazeVectorWCS.x * upVector.z;
    let rightZ = gazeVectorWCS.x * upVector.y - gazeVectorWCS.y * upVector.x;
    let rightLen = Math.sqrt(rightX * rightX + rightY * rightY + rightZ * rightZ);

    if (rightLen < 1e-6) {
      rightX = 0; rightY = 1; rightZ = 0;
      rightLen = 1;
    }
    const rightDir = { x: rightX / rightLen, y: rightY / rightLen, z: rightZ / rightLen };

    const upDir = {
      x: rightDir.y * gazeVectorWCS.z - rightDir.z * gazeVectorWCS.y,
      y: rightDir.z * gazeVectorWCS.x - rightDir.x * gazeVectorWCS.z,
      z: rightDir.x * gazeVectorWCS.y - rightDir.y * gazeVectorWCS.x
    };

    const fComp = dot;
    const rComp = targetDir.x * rightDir.x + targetDir.y * rightDir.y + targetDir.z * rightDir.z;
    const uComp = targetDir.x * upDir.x + targetDir.y * upDir.y + targetDir.z * upDir.z;

    const horizAngleDeg = Math.abs(Math.atan2(rComp, fComp) * (180 / Math.PI));
    const vertAngleDeg = Math.atan2(uComp, fComp) * (180 / Math.PI);

    const horizLimit = isLeftEye
      ? (rComp <= 0 ? customLimits.monocularHorizontalDeg.temporal : customLimits.monocularHorizontalDeg.nasal)
      : (rComp >= 0 ? customLimits.monocularHorizontalDeg.temporal : customLimits.monocularHorizontalDeg.nasal);

    const vertLimit = vertAngleDeg >= 0
      ? customLimits.monocularVerticalDeg.superior
      : customLimits.monocularVerticalDeg.inferior;

    const isInsideFOV = horizAngleDeg <= horizLimit && Math.abs(vertAngleDeg) <= vertLimit;

    return {
      isInsideFOV,
      isInsideFovealCone,
      angleDeg
    };
  }
}
