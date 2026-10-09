/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-259 — Continuous Collision Detection (CCD) Swept Motion
 */

import { Vector3D } from '../../cadKernel';
import {
  CollisionTolerance,
  FixtureGeometry,
  HolderGeometry,
  SpindleHeadGeometry,
  ToolGeometry,
  ToolPose,
  Triangle3D
} from './CollisionTypes';
import { CollisionMathUtils } from './CollisionMathUtils';
import { NarrowPhaseDetector, NarrowPhaseResult } from './NarrowPhaseDetector';

export interface SweptMotionResult {
  hasCollision: boolean;
  minClearanceMm: number;
  maxPenetrationMm: number;
  criticalSubStepT: number;
  criticalPose: ToolPose;
  narrowResult: NarrowPhaseResult;
}

export class ContinuousCollisionDetector {
  public static testSweptMotion(
    startPose: ToolPose,
    endPose: ToolPose,
    tool: ToolGeometry,
    holder: HolderGeometry,
    spindle: SpindleHeadGeometry | undefined,
    partTriangles: Triangle3D[],
    fixture?: FixtureGeometry,
    tolerances: CollisionTolerance = {
      geometryToleranceMm: 0.005,
      contactToleranceMm: 0.010,
      numericalToleranceMm: 1e-5,
      clearanceThresholdWarningMm: 2.0,
      clearanceThresholdCriticalMm: 0.5
    }
  ): SweptMotionResult {
    const travelDist = CollisionMathUtils.distance(startPose.tcp, endPose.tcp);
    // Subdivide based on tool radius to avoid tunneling
    const maxStepMm = Math.max(1.0, (tool.cutterDiameterMm || 10) * 0.4);
    const numSubSteps = Math.max(4, Math.min(25, Math.ceil(travelDist / maxStepMm)));

    let minClearance = Infinity;
    let maxPenetration = 0;
    let hasCollision = false;
    let criticalT = 0;
    let criticalPose = startPose;
    let criticalNarrowResult: NarrowPhaseResult = {
      hasContact: false,
      contactPointWCS: startPose.tcp,
      contactNormal: { x: 0, y: 0, z: 1 },
      penetrationDepthMm: 0,
      clearanceMm: 999,
      contactingSegment: 'NONE'
    };

    for (let s = 0; s <= numSubSteps; s++) {
      const t = s / numSubSteps;
      const interpTcp = CollisionMathUtils.lerp(startPose.tcp, endPose.tcp, t);
      const interpOri = CollisionMathUtils.normalize(
        CollisionMathUtils.lerp(startPose.toolOrientation, endPose.toolOrientation, t)
      );

      const poseAtT: ToolPose = {
        tcp: interpTcp,
        toolOrientation: interpOri,
        motionType: endPose.motionType,
        feedRateMmMin: endPose.feedRateMmMin,
        spindleRpm: endPose.spindleRpm
      };

      // 1. Part Triangles Test
      let narrowRes: NarrowPhaseResult = {
        hasContact: false,
        contactPointWCS: interpTcp,
        contactNormal: { x: 0, y: 0, z: 1 },
        penetrationDepthMm: 0,
        clearanceMm: 999,
        contactingSegment: 'NONE'
      };

      if (partTriangles.length > 0) {
        narrowRes = NarrowPhaseDetector.testToolAssemblyAgainstTriangles(
          poseAtT, tool, holder, spindle, partTriangles, tolerances
        );
      }

      // 2. Fixture Test
      if (fixture && fixture.aabb) {
        const fixRes = NarrowPhaseDetector.testToolAssemblyAgainstFixture(
          poseAtT, tool, holder, spindle, fixture, tolerances
        );
        if (fixRes.hasContact || fixRes.clearanceMm < narrowRes.clearanceMm) {
          narrowRes = fixRes;
        }
      }

      if (narrowRes.clearanceMm < minClearance) {
        minClearance = narrowRes.clearanceMm;
      }
      if (narrowRes.penetrationDepthMm > maxPenetration) {
        maxPenetration = narrowRes.penetrationDepthMm;
      }

      if (narrowRes.hasContact) {
        hasCollision = true;
        if (narrowRes.penetrationDepthMm >= maxPenetration) {
          criticalT = t;
          criticalPose = poseAtT;
          criticalNarrowResult = narrowRes;
        }
      }
    }

    if (!hasCollision && minClearance < Infinity) {
      criticalNarrowResult.clearanceMm = minClearance;
    }

    return {
      hasCollision,
      minClearanceMm: minClearance === Infinity ? 999 : minClearance,
      maxPenetrationMm: maxPenetration,
      criticalSubStepT: criticalT,
      criticalPose,
      narrowResult: criticalNarrowResult
    };
  }
}
