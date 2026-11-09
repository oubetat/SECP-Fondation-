/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 002
 * Skeletal Topology Engine & Branched Hierarchy Builder
 * 
 * Constructs a fully validated, 19-segment branched human skeleton from an AnthropometricProfile.
 * Enforces tree integrity, detects cycles and orphaned segments, and computes 4x4 kinematic frames.
 */

import { Matrix4x4, Vector3D } from '../../assembly/graph/types';
import { TransformMatrix } from '../../assembly/graph/TransformMatrix';
import { AnthropometricProfile } from '../types/AnthropometricTypes';
import {
  AnatomicalRegion,
  SkeletalSegment,
  SkeletalTopology,
  SkeletalValidationResult
} from '../types/SkeletalTopologyTypes';

export class SkeletalTopologyEngine {
  public static readonly VERSION = '1.0.0-PROD';

  /**
   * Constructs a branched human skeleton based on an AnthropometricProfile
   */
  public static buildSkeleton(
    profile: AnthropometricProfile,
    skeletonName: string = 'DHM_SKELETON'
  ): SkeletalTopology {
    if (!profile || !profile.isValid) {
      return {
        skeletonId: `SKEL_INVALID_${Date.now()}`,
        name: skeletonName,
        rootSegmentId: AnatomicalRegion.PELVIS,
        segments: {} as Record<AnatomicalRegion, SkeletalSegment>,
        isValid: false,
        validationErrors: ['Cannot build skeleton from invalid or null anthropometric profile.'],
        serializationHash: 'INVALID'
      };
    }

    const m = profile.measurements;
    const bodyMass = m.bodyMassKg ?? 75.0;

    // Default proportion ratios (Dempster 1955 / Hanavan 1964 biomechanical model)
    const upperArmLength = m.upperArmLengthMm ?? 350;
    const forearmLength = m.forearmLengthMm ?? 260;
    const handLength = m.handLengthMm ?? 190;
    const thighLength = m.thighLengthMm ?? 430;
    const lowerLegLength = m.lowerLegLengthMm ?? 420;
    const footLength = m.footLengthMm ?? 260;
    const shoulderBreadth = m.shoulderBreadthMm ?? 410;
    const hipBreadth = m.hipBreadthMm ?? 340;
    const sittingHeight = m.sittingHeightMm ?? 900;
    const lumbarLength = sittingHeight * 0.28;
    const thoracicLength = sittingHeight * 0.38;
    const neckLength = sittingHeight * 0.12;
    const headLength = sittingHeight * 0.22;

    const segmentsMap = new Map<AnatomicalRegion, SkeletalSegment>();

    // Helper to create segment
    const createSegment = (
      region: AnatomicalRegion,
      name: string,
      parent: AnatomicalRegion | null,
      children: AnatomicalRegion[],
      offset: Vector3D,
      length: number,
      massFrac: number
    ): SkeletalSegment => {
      const massKg = Number((bodyMass * massFrac).toFixed(3));
      const localT = TransformMatrix.translation(offset.x, offset.y, offset.z);

      return {
        segmentId: region,
        name,
        parentSegmentId: parent,
        childSegmentIds: children,
        anatomicalRegion: region,
        localOffsetMm: offset,
        lengthMm: length,
        massKg,
        centerOfMassMm: { x: offset.x * 0.5, y: offset.y * 0.5, z: offset.z * 0.5 },
        localTransform: localT,
        globalTransform: TransformMatrix.identity()
      };
    };

    // 1. Root: PELVIS
    segmentsMap.set(
      AnatomicalRegion.PELVIS,
      createSegment(
        AnatomicalRegion.PELVIS,
        'Pelvis Root',
        null,
        [AnatomicalRegion.LUMBAR_SPINE, AnatomicalRegion.LEFT_THIGH, AnatomicalRegion.RIGHT_THIGH],
        { x: 0, y: 0, z: 0 },
        hipBreadth,
        0.142
      )
    );

    // 2. Spine Chain
    segmentsMap.set(
      AnatomicalRegion.LUMBAR_SPINE,
      createSegment(
        AnatomicalRegion.LUMBAR_SPINE,
        'Lumbar Spine (L1-L5)',
        AnatomicalRegion.PELVIS,
        [AnatomicalRegion.THORACIC_SPINE],
        { x: 0, y: 0, z: lumbarLength },
        lumbarLength,
        0.139
      )
    );

    segmentsMap.set(
      AnatomicalRegion.THORACIC_SPINE,
      createSegment(
        AnatomicalRegion.THORACIC_SPINE,
        'Thoracic Spine (T1-T12)',
        AnatomicalRegion.LUMBAR_SPINE,
        [AnatomicalRegion.NECK, AnatomicalRegion.LEFT_CLAVICLE, AnatomicalRegion.RIGHT_CLAVICLE],
        { x: 0, y: 0, z: thoracicLength },
        thoracicLength,
        0.216
      )
    );

    segmentsMap.set(
      AnatomicalRegion.NECK,
      createSegment(
        AnatomicalRegion.NECK,
        'Cervical Spine / Neck',
        AnatomicalRegion.THORACIC_SPINE,
        [AnatomicalRegion.HEAD],
        { x: 0, y: 0, z: neckLength },
        neckLength,
        0.027
      )
    );

    segmentsMap.set(
      AnatomicalRegion.HEAD,
      createSegment(
        AnatomicalRegion.HEAD,
        'Head',
        AnatomicalRegion.NECK,
        [],
        { x: 0, y: 0, z: headLength },
        headLength,
        0.054
      )
    );

    // 3. Upper Extremities (Left & Right)
    const halfClavicle = shoulderBreadth * 0.5;

    // Left Arm
    segmentsMap.set(
      AnatomicalRegion.LEFT_CLAVICLE,
      createSegment(
        AnatomicalRegion.LEFT_CLAVICLE,
        'Left Clavicle',
        AnatomicalRegion.THORACIC_SPINE,
        [AnatomicalRegion.LEFT_UPPER_ARM],
        { x: 0, y: halfClavicle, z: 0 },
        halfClavicle,
        0.015
      )
    );

    segmentsMap.set(
      AnatomicalRegion.LEFT_UPPER_ARM,
      createSegment(
        AnatomicalRegion.LEFT_UPPER_ARM,
        'Left Upper Arm (Humerus)',
        AnatomicalRegion.LEFT_CLAVICLE,
        [AnatomicalRegion.LEFT_FOREARM],
        { x: 0, y: 0, z: -upperArmLength },
        upperArmLength,
        0.028
      )
    );

    segmentsMap.set(
      AnatomicalRegion.LEFT_FOREARM,
      createSegment(
        AnatomicalRegion.LEFT_FOREARM,
        'Left Forearm (Radius/Ulna)',
        AnatomicalRegion.LEFT_UPPER_ARM,
        [AnatomicalRegion.LEFT_HAND],
        { x: 0, y: 0, z: -forearmLength },
        forearmLength,
        0.016
      )
    );

    segmentsMap.set(
      AnatomicalRegion.LEFT_HAND,
      createSegment(
        AnatomicalRegion.LEFT_HAND,
        'Left Hand',
        AnatomicalRegion.LEFT_FOREARM,
        [],
        { x: 0, y: 0, z: -handLength },
        handLength,
        0.006
      )
    );

    // Right Arm
    segmentsMap.set(
      AnatomicalRegion.RIGHT_CLAVICLE,
      createSegment(
        AnatomicalRegion.RIGHT_CLAVICLE,
        'Right Clavicle',
        AnatomicalRegion.THORACIC_SPINE,
        [AnatomicalRegion.RIGHT_UPPER_ARM],
        { x: 0, y: -halfClavicle, z: 0 },
        halfClavicle,
        0.015
      )
    );

    segmentsMap.set(
      AnatomicalRegion.RIGHT_UPPER_ARM,
      createSegment(
        AnatomicalRegion.RIGHT_UPPER_ARM,
        'Right Upper Arm (Humerus)',
        AnatomicalRegion.RIGHT_CLAVICLE,
        [AnatomicalRegion.RIGHT_FOREARM],
        { x: 0, y: 0, z: -upperArmLength },
        upperArmLength,
        0.028
      )
    );

    segmentsMap.set(
      AnatomicalRegion.RIGHT_FOREARM,
      createSegment(
        AnatomicalRegion.RIGHT_FOREARM,
        'Right Forearm (Radius/Ulna)',
        AnatomicalRegion.RIGHT_UPPER_ARM,
        [AnatomicalRegion.RIGHT_HAND],
        { x: 0, y: 0, z: -forearmLength },
        forearmLength,
        0.016
      )
    );

    segmentsMap.set(
      AnatomicalRegion.RIGHT_HAND,
      createSegment(
        AnatomicalRegion.RIGHT_HAND,
        'Right Hand',
        AnatomicalRegion.RIGHT_FOREARM,
        [],
        { x: 0, y: 0, z: -handLength },
        handLength,
        0.006
      )
    );

    // 4. Lower Extremities (Left & Right)
    const halfHip = hipBreadth * 0.45;

    // Left Leg
    segmentsMap.set(
      AnatomicalRegion.LEFT_THIGH,
      createSegment(
        AnatomicalRegion.LEFT_THIGH,
        'Left Thigh (Femur)',
        AnatomicalRegion.PELVIS,
        [AnatomicalRegion.LEFT_LOWER_LEG],
        { x: 0, y: halfHip, z: -thighLength },
        thighLength,
        0.100
      )
    );

    segmentsMap.set(
      AnatomicalRegion.LEFT_LOWER_LEG,
      createSegment(
        AnatomicalRegion.LEFT_LOWER_LEG,
        'Left Lower Leg (Tibia/Fibula)',
        AnatomicalRegion.LEFT_THIGH,
        [AnatomicalRegion.LEFT_FOOT],
        { x: 0, y: 0, z: -lowerLegLength },
        lowerLegLength,
        0.0465
      )
    );

    segmentsMap.set(
      AnatomicalRegion.LEFT_FOOT,
      createSegment(
        AnatomicalRegion.LEFT_FOOT,
        'Left Foot',
        AnatomicalRegion.LEFT_LOWER_LEG,
        [],
        { x: footLength * 0.7, y: 0, z: 0 },
        footLength,
        0.0145
      )
    );

    // Right Leg
    segmentsMap.set(
      AnatomicalRegion.RIGHT_THIGH,
      createSegment(
        AnatomicalRegion.RIGHT_THIGH,
        'Right Thigh (Femur)',
        AnatomicalRegion.PELVIS,
        [AnatomicalRegion.RIGHT_LOWER_LEG],
        { x: 0, y: -halfHip, z: -thighLength },
        thighLength,
        0.100
      )
    );

    segmentsMap.set(
      AnatomicalRegion.RIGHT_LOWER_LEG,
      createSegment(
        AnatomicalRegion.RIGHT_LOWER_LEG,
        'Right Lower Leg (Tibia/Fibula)',
        AnatomicalRegion.RIGHT_THIGH,
        [AnatomicalRegion.RIGHT_FOOT],
        { x: 0, y: 0, z: -lowerLegLength },
        lowerLegLength,
        0.0465
      )
    );

    segmentsMap.set(
      AnatomicalRegion.RIGHT_FOOT,
      createSegment(
        AnatomicalRegion.RIGHT_FOOT,
        'Right Foot',
        AnatomicalRegion.RIGHT_LOWER_LEG,
        [],
        { x: footLength * 0.7, y: 0, z: 0 },
        footLength,
        0.0145
      )
    );

    // Convert Map to Record
    const segmentsRecord = {} as Record<AnatomicalRegion, SkeletalSegment>;
    for (const [key, seg] of segmentsMap.entries()) {
      segmentsRecord[key] = seg;
    }

    // Compute Global Transforms
    this.computeGlobalTransforms(segmentsRecord, AnatomicalRegion.PELVIS, TransformMatrix.identity());

    // Validate Topology
    const validation = this.validateSkeletalTopology(segmentsRecord);

    const skeletonId = `SKEL_${profile.profileId}_${profile.gender}`;
    const hashStr = `${skeletonId}:${Object.keys(segmentsRecord).length}:${profile.measurements.statureMm}`;
    const serializationHash = this.hashString(hashStr);

    return {
      skeletonId,
      name: skeletonName,
      rootSegmentId: AnatomicalRegion.PELVIS,
      segments: segmentsRecord,
      isValid: validation.isValid,
      validationErrors: validation.errors,
      serializationHash
    };
  }

  /**
   * Validates skeletal hierarchy for cyclic dependencies, missing parents, and disconnected nodes.
   */
  public static validateSkeletalTopology(
    segments: Record<AnatomicalRegion, SkeletalSegment>
  ): SkeletalValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!segments || Object.keys(segments).length === 0) {
      return { isValid: false, errors: ['Skeletal topology contains zero segments.'], warnings: [] };
    }

    const allRegions = Object.values(AnatomicalRegion);

    // 1. Verify Root Node exists
    const root = segments[AnatomicalRegion.PELVIS];
    if (!root) {
      errors.push('Skeletal topology missing root node (PELVIS).');
    } else if (root.parentSegmentId !== null) {
      errors.push(`Root node PELVIS must have null parent, but has parent '${root.parentSegmentId}'.`);
    }

    // 2. Check for missing or disconnected segments
    for (const region of allRegions) {
      const seg = segments[region];
      if (!seg) {
        errors.push(`Missing required anatomical region segment: '${region}'.`);
        continue;
      }

      // Check Parent Reference
      if (seg.parentSegmentId !== null) {
        const parent = segments[seg.parentSegmentId];
        if (!parent) {
          errors.push(`Segment '${region}' references non-existent parent segment '${seg.parentSegmentId}'.`);
        } else if (!parent.childSegmentIds.includes(region)) {
          errors.push(`Parent '${parent.segmentId}' does not list '${region}' in its childSegmentIds.`);
        }
      }
    }

    // 3. Cycle Detection via Depth-First Traversal
    const visited = new Set<AnatomicalRegion>();
    const stack = new Set<AnatomicalRegion>();

    const checkCycle = (currId: AnatomicalRegion): boolean => {
      visited.add(currId);
      stack.add(currId);

      const seg = segments[currId];
      if (seg && seg.childSegmentIds) {
        for (const childId of seg.childSegmentIds) {
          if (!visited.has(childId)) {
            if (checkCycle(childId)) return true;
          } else if (stack.has(childId)) {
            errors.push(`Cyclic parent-child relationship detected at segment '${childId}'.`);
            return true;
          }
        }
      }

      stack.delete(currId);
      return false;
    };

    if (root) {
      checkCycle(AnatomicalRegion.PELVIS);
    }

    // Check for orphaned/disconnected sub-trees
    for (const region of allRegions) {
      if (segments[region] && !visited.has(region)) {
        errors.push(`Disconnected / orphaned segment detected: '${region}' is unreachable from PELVIS root.`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Recursively computes global 4x4 transform for every segment in the tree
   */
  public static computeGlobalTransforms(
    segments: Record<AnatomicalRegion, SkeletalSegment>,
    currId: AnatomicalRegion,
    parentGlobalTransform: Matrix4x4
  ): void {
    const seg = segments[currId];
    if (!seg) return;

    // Global = ParentGlobal * LocalTransform
    seg.globalTransform = TransformMatrix.multiply(parentGlobalTransform, seg.localTransform);

    for (const childId of seg.childSegmentIds) {
      this.computeGlobalTransforms(segments, childId, seg.globalTransform);
    }
  }

  private static hashString(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
