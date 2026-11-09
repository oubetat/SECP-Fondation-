/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 003
 * Human Skeletal Forward Kinematics (FK) Engine
 * 
 * Traverses the 19-segment branched skeletal topology to calculate deterministic
 * local and global 4x4 matrix transform chains and end-effector positions.
 */

import { Matrix4x4, Vector3D } from '../../assembly/graph/types';
import { TransformMatrix } from '../../assembly/graph/TransformMatrix';
import { SkeletalTopology, AnatomicalRegion, SkeletalSegment } from '../types/SkeletalTopologyTypes';
import { HumanPoseState, HumanFKResult, SegmentKinematicState, HumanJointAngles } from './types';
import { HumanJointConstraintSolver } from './HumanJointConstraintSolver';

export class HumanForwardKinematicsEngine {
  public static readonly VERSION = '1.0.0-PROD';

  /**
   * Computes complete Forward Kinematics for a branched DHM skeleton given a HumanPoseState
   */
  public static computeFK(
    skeleton: SkeletalTopology,
    pose: HumanPoseState,
    enforceROM: boolean = true
  ): HumanFKResult {
    const diagnostics: string[] = [];

    if (!skeleton || !skeleton.isValid || !skeleton.segments) {
      return {
        success: false,
        segmentStates: {} as Record<AnatomicalRegion, SegmentKinematicState>,
        endEffectors: {},
        diagnostics: ['Cannot compute FK: Invalid or null SkeletalTopology provided.']
      };
    }

    if (!pose) {
      return {
        success: false,
        segmentStates: {} as Record<AnatomicalRegion, SegmentKinematicState>,
        endEffectors: {},
        diagnostics: ['Cannot compute FK: Null or undefined HumanPoseState provided.']
      };
    }

    const segments = skeleton.segments as Record<AnatomicalRegion, SkeletalSegment>;
    const root = segments[AnatomicalRegion.PELVIS];
    if (!root) {
      return {
        success: false,
        segmentStates: {} as Record<AnatomicalRegion, SegmentKinematicState>,
        endEffectors: {},
        diagnostics: ['Cannot compute FK: Root segment PELVIS missing from topology.']
      };
    }

    // 1. Root Pelvis Base Transform in WCS
    const pPos = pose.pelvisPositionMm || { x: 0, y: 0, z: 0 };
    const pRot = pose.pelvisRotationEulerDeg || { x: 0, y: 0, z: 0 };

    if (
      !isFinite(pPos.x) || !isFinite(pPos.y) || !isFinite(pPos.z) ||
      !isFinite(pRot.x) || !isFinite(pRot.y) || !isFinite(pRot.z)
    ) {
      return {
        success: false,
        segmentStates: {} as Record<AnatomicalRegion, SegmentKinematicState>,
        endEffectors: {},
        diagnostics: ['Cannot compute FK: Pelvis position/orientation contains non-finite values.']
      };
    }

    const pelvisBaseTransform = TransformMatrix.create(
      pPos.x, pPos.y, pPos.z,
      pRot.x, pRot.y, pRot.z
    ).matrix;

    const segmentStates: Record<AnatomicalRegion, SegmentKinematicState> = {} as any;

    // Helper to extract rotation Euler angles for a joint connecting parent -> segment
    const getJointRotationEuler = (segmentId: AnatomicalRegion): { rx: number; ry: number; rz: number } => {
      let jointId = '';
      switch (segmentId) {
        case AnatomicalRegion.NECK: jointId = 'J_NECK'; break;
        case AnatomicalRegion.LUMBAR_SPINE: jointId = 'J_LUMBAR'; break;
        case AnatomicalRegion.LEFT_UPPER_ARM: jointId = 'J_LEFT_SHOULDER'; break;
        case AnatomicalRegion.RIGHT_UPPER_ARM: jointId = 'J_RIGHT_SHOULDER'; break;
        case AnatomicalRegion.LEFT_FOREARM: jointId = 'J_LEFT_ELBOW'; break;
        case AnatomicalRegion.RIGHT_FOREARM: jointId = 'J_RIGHT_ELBOW'; break;
        case AnatomicalRegion.LEFT_HAND: jointId = 'J_LEFT_WRIST'; break;
        case AnatomicalRegion.RIGHT_HAND: jointId = 'J_RIGHT_WRIST'; break;
        case AnatomicalRegion.LEFT_THIGH: jointId = 'J_LEFT_HIP'; break;
        case AnatomicalRegion.RIGHT_THIGH: jointId = 'J_RIGHT_HIP'; break;
        case AnatomicalRegion.LEFT_LOWER_LEG: jointId = 'J_LEFT_KNEE'; break;
        case AnatomicalRegion.RIGHT_LOWER_LEG: jointId = 'J_RIGHT_KNEE'; break;
        case AnatomicalRegion.LEFT_FOOT: jointId = 'J_LEFT_ANKLE'; break;
        case AnatomicalRegion.RIGHT_FOOT: jointId = 'J_RIGHT_ANKLE'; break;
        default: return { rx: 0, ry: 0, rz: 0 };
      }

      let angles: HumanJointAngles = pose.jointAngles?.[jointId] || { flexionExtension: 0 };

      if (enforceROM) {
        const constraintRes = HumanJointConstraintSolver.projectAndValidateJoint(jointId, angles);
        angles = constraintRes.clampedAngles;
        if (!constraintRes.isValid) {
          diagnostics.push(...constraintRes.violations);
        }
      }

      const rx = angles.flexionExtension || 0;
      const ry = angles.abductionAdduction || angles.lateralBending || 0;
      const rz = angles.internalExternalRotation || angles.axialRotation || 0;

      return { rx, ry, rz };
    };

    // Recursive traversal to build global transform tree
    const traverseBranch = (region: AnatomicalRegion, parentGlobalT: Matrix4x4) => {
      const seg = segments[region];
      if (!seg) return;

      const offset = seg.localOffsetMm;
      const rot = getJointRotationEuler(region);

      // Local T = Rotation(jointRot) * Translation(offset)
      const transMat = TransformMatrix.translation(offset.x, offset.y, offset.z);
      const rotMat = TransformMatrix.fromEulerDegrees(rot.rx, rot.ry, rot.rz);
      const localT = TransformMatrix.multiply(rotMat, transMat);

      // Global T = ParentGlobalT * LocalT
      const globalT = TransformMatrix.multiply(parentGlobalT, localT);

      const jointOrigin = TransformMatrix.extractTranslation(globalT);
      
      // Calculate end origin (tip) by projecting along the segment's length 
      // in the direction of its local offset (bone axis).
      const len = Math.sqrt(offset.x ** 2 + offset.y ** 2 + offset.z ** 2);
      const boneDir = len > 1e-6 ? { x: offset.x / len, y: offset.y / len, z: offset.z / len } : { x: 0, y: 0, z: 1 };
      const tipOffset = { x: boneDir.x * seg.lengthMm, y: boneDir.y * seg.lengthMm, z: boneDir.z * seg.lengthMm };
      
      const endOrigin = TransformMatrix.transformPoint(globalT, tipOffset);

      segmentStates[region] = {
        segmentId: region,
        localTransform: localT,
        globalTransform: globalT,
        jointOriginMm: jointOrigin,
        endOriginMm: endOrigin
      };

      for (const childId of seg.childSegmentIds) {
        traverseBranch(childId, globalT);
      }
    };

    // 2. Traverse from Pelvis
    // Pelvis local transform is identity relative to base pelvis WCS transform
    const pelvisGlobalT = pelvisBaseTransform;
    segmentStates[AnatomicalRegion.PELVIS] = {
      segmentId: AnatomicalRegion.PELVIS,
      localTransform: TransformMatrix.identity(),
      globalTransform: pelvisGlobalT,
      jointOriginMm: TransformMatrix.extractTranslation(pelvisGlobalT),
      endOriginMm: TransformMatrix.extractTranslation(pelvisGlobalT)
    };

    for (const childId of root.childSegmentIds) {
      traverseBranch(childId, pelvisGlobalT);
    }

    // 3. Extract End-Effector positions
    const endEffectors: Record<string, { positionMm: Vector3D; globalTransform: Matrix4x4 }> = {};

    const registerEffector = (name: string, region: AnatomicalRegion) => {
      const state = segmentStates[region];
      if (state) {
        endEffectors[name] = {
          positionMm: state.jointOriginMm,
          globalTransform: state.globalTransform
        };
        // For leaves (Hands, Feet, Head), use tip/end origin position
        if (
          region === AnatomicalRegion.LEFT_HAND ||
          region === AnatomicalRegion.RIGHT_HAND ||
          region === AnatomicalRegion.LEFT_FOOT ||
          region === AnatomicalRegion.RIGHT_FOOT ||
          region === AnatomicalRegion.HEAD
        ) {
          endEffectors[name].positionMm = state.endOriginMm;
        }
      }
    };

    registerEffector('HEAD', AnatomicalRegion.HEAD);
    registerEffector('LEFT_HAND', AnatomicalRegion.LEFT_HAND);
    registerEffector('RIGHT_HAND', AnatomicalRegion.RIGHT_HAND);
    registerEffector('LEFT_FOOT', AnatomicalRegion.LEFT_FOOT);
    registerEffector('RIGHT_FOOT', AnatomicalRegion.RIGHT_FOOT);

    return {
      success: true,
      segmentStates,
      endEffectors,
      diagnostics
    };
  }

  /**
   * Generates default neutral posture
   */
  public static createDefaultNeutralPose(): HumanPoseState {
    return {
      pelvisPositionMm: { x: 0, y: 0, z: 0 },
      pelvisRotationEulerDeg: { x: 0, y: 0, z: 0 },
      jointAngles: {
        J_NECK: { flexionExtension: 0, lateralBending: 0, axialRotation: 0 },
        J_LUMBAR: { flexionExtension: 0, lateralBending: 0, axialRotation: 0 },
        J_LEFT_SHOULDER: { flexionExtension: 0, abductionAdduction: 0, internalExternalRotation: 0 },
        J_RIGHT_SHOULDER: { flexionExtension: 0, abductionAdduction: 0, internalExternalRotation: 0 },
        J_LEFT_ELBOW: { flexionExtension: 0 },
        J_RIGHT_ELBOW: { flexionExtension: 0 },
        J_LEFT_WRIST: { flexionExtension: 0, abductionAdduction: 0 },
        J_RIGHT_WRIST: { flexionExtension: 0, abductionAdduction: 0 },
        J_LEFT_HIP: { flexionExtension: 0, abductionAdduction: 0, internalExternalRotation: 0 },
        J_RIGHT_HIP: { flexionExtension: 0, abductionAdduction: 0, internalExternalRotation: 0 },
        J_LEFT_KNEE: { flexionExtension: 0 },
        J_RIGHT_KNEE: { flexionExtension: 0 },
        J_LEFT_ANKLE: { flexionExtension: 0, abductionAdduction: 0 },
        J_RIGHT_ANKLE: { flexionExtension: 0, abductionAdduction: 0 }
      }
    };
  }
}
