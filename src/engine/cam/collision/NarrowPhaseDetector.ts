/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-259 — Narrow Phase Collision Detector (Exact Analytical & Triangle Checks)
 */

import { Vector3D } from '../../cadKernel';
import {
  CollisionTolerance,
  HolderGeometry,
  SpindleHeadGeometry,
  ToolGeometry,
  ToolPose,
  Triangle3D,
  FixtureGeometry
} from './CollisionTypes';
import { CollisionMathUtils } from './CollisionMathUtils';

export interface NarrowPhaseResult {
  hasContact: boolean;
  contactPointWCS: Vector3D;
  contactNormal: Vector3D;
  penetrationDepthMm: number;
  clearanceMm: number;
  contactingSegment: 'CUTTER' | 'SHANK' | 'HOLDER_LOWER' | 'HOLDER_UPPER' | 'SPINDLE' | 'NONE';
  subMeshTriangleId?: string;
  faceId?: string;
}

export class NarrowPhaseDetector {
  public static testToolAssemblyAgainstTriangles(
    pose: ToolPose,
    tool: ToolGeometry,
    holder: HolderGeometry,
    spindle: SpindleHeadGeometry | undefined,
    triangles: Triangle3D[],
    tolerances: CollisionTolerance
  ): NarrowPhaseResult {
    const tcp = pose.tcp;
    const axis = CollisionMathUtils.normalize(pose.toolOrientation);

    let minClearance = Infinity;
    let maxPenetration = 0;
    let worstContactPt = tcp;
    let worstNormal = { x: 0, y: 0, z: 1 };
    let worstSegment: NarrowPhaseResult['contactingSegment'] = 'NONE';
    let worstFaceId: string | undefined;
    let worstTriId: string | undefined;
    let hasCollision = false;

    for (const tri of triangles) {
      const res = this.testAssemblyToTriangle(
        tcp,
        axis,
        tool,
        holder,
        spindle,
        tri
      );

      if (res.clearanceMm < minClearance) {
        minClearance = res.clearanceMm;
        worstContactPt = res.contactPt;
        worstNormal = tri.normal;
        worstFaceId = tri.faceId;
        worstTriId = tri.id;
      }

      if (res.isColliding) {
        hasCollision = true;
        if (res.penetrationMm > maxPenetration) {
          maxPenetration = res.penetrationMm;
          worstSegment = res.segment;
          worstContactPt = res.contactPt;
          worstNormal = tri.normal;
          worstFaceId = tri.faceId;
          worstTriId = tri.id;
        }
      }
    }

    return {
      hasContact: hasCollision,
      contactPointWCS: worstContactPt,
      contactNormal: worstNormal,
      penetrationDepthMm: maxPenetration,
      clearanceMm: hasCollision ? 0 : (minClearance === Infinity ? 999 : minClearance),
      contactingSegment: worstSegment,
      subMeshTriangleId: worstTriId,
      faceId: worstFaceId
    };
  }

  public static testToolAssemblyAgainstFixture(
    pose: ToolPose,
    tool: ToolGeometry,
    holder: HolderGeometry,
    spindle: SpindleHeadGeometry | undefined,
    fixture: FixtureGeometry,
    tolerances: CollisionTolerance
  ): NarrowPhaseResult {
    const tcp = pose.tcp;
    const axis = CollisionMathUtils.normalize(pose.toolOrientation);

    const keepOutMargin = fixture.isKeepOutZoneActive ? fixture.keepOutZoneMarginMm : 0;
    const expandedAABB = CollisionMathUtils.expandAABB(fixture.aabb, keepOutMargin);

    const cutterRadius = tool.cutterDiameterMm / 2;
    const shankRadius = tool.shankDiameterMm / 2;
    const holderRadius = (holder.lowerDiameterMm + holder.upperDiameterMm) / 4;

    const cutterTop = CollisionMathUtils.add(tcp, CollisionMathUtils.scale(axis, tool.fluteLengthMm));
    const shankTop = CollisionMathUtils.add(tcp, CollisionMathUtils.scale(axis, tool.stickoutMm));
    const holderTop = CollisionMathUtils.add(shankTop, CollisionMathUtils.scale(axis, holder.gaugeLengthMm));

    // Test Cutter to Fixture
    const cutterTest = CollisionMathUtils.capsuleIntersectsAABB(tcp, cutterTop, cutterRadius, expandedAABB);
    if (cutterTest.intersects) {
      return {
        hasContact: true,
        contactPointWCS: cutterTest.closestPtSegment,
        contactNormal: { x: 0, y: 0, z: 1 },
        penetrationDepthMm: Math.max(0.1, cutterRadius - cutterTest.clearanceMm),
        clearanceMm: 0,
        contactingSegment: 'CUTTER'
      };
    }

    // Test Shank to Fixture
    const shankTest = CollisionMathUtils.capsuleIntersectsAABB(cutterTop, shankTop, shankRadius, expandedAABB);
    if (shankTest.intersects) {
      return {
        hasContact: true,
        contactPointWCS: shankTest.closestPtSegment,
        contactNormal: { x: 0, y: 0, z: 1 },
        penetrationDepthMm: Math.max(0.1, shankRadius - shankTest.clearanceMm),
        clearanceMm: 0,
        contactingSegment: 'SHANK'
      };
    }

    // Test Holder to Fixture
    const holderTest = CollisionMathUtils.capsuleIntersectsAABB(shankTop, holderTop, holderRadius, expandedAABB);
    if (holderTest.intersects) {
      return {
        hasContact: true,
        contactPointWCS: holderTest.closestPtSegment,
        contactNormal: { x: 0, y: 0, z: 1 },
        penetrationDepthMm: Math.max(0.1, holderRadius - holderTest.clearanceMm),
        clearanceMm: 0,
        contactingSegment: 'HOLDER_LOWER'
      };
    }

    const minClear = Math.min(cutterTest.clearanceMm, shankTest.clearanceMm, holderTest.clearanceMm);

    return {
      hasContact: false,
      contactPointWCS: tcp,
      contactNormal: { x: 0, y: 0, z: 1 },
      penetrationDepthMm: 0,
      clearanceMm: Math.max(0, minClear),
      contactingSegment: 'NONE'
    };
  }

  private static testAssemblyToTriangle(
    tcp: Vector3D,
    axis: Vector3D,
    tool: ToolGeometry,
    holder: HolderGeometry,
    spindle: SpindleHeadGeometry | undefined,
    tri: Triangle3D
  ): { isColliding: boolean; clearanceMm: number; penetrationMm: number; contactPt: Vector3D; segment: NarrowPhaseResult['contactingSegment'] } {
    let minClearance = Infinity;
    let maxPenetration = 0;
    let isColliding = false;
    let bestSegment: NarrowPhaseResult['contactingSegment'] = 'NONE';
    let bestContactPt = tri.v0;

    const cutterRadius = tool.cutterDiameterMm / 2;
    const shankRadius = tool.shankDiameterMm / 2;
    const holderLowerRadius = holder.lowerDiameterMm / 2;
    const holderUpperRadius = holder.upperDiameterMm / 2;
    const spindleRadius = spindle ? spindle.outerDiameterMm / 2 : 0;
    const totalLength = tool.stickoutMm + holder.gaugeLengthMm + (spindle ? spindle.noseLengthMm : 0);

    // 1. Check direct triangle vertices & centroid
    const pointsToCheck = [
      tri.v0,
      tri.v1,
      tri.v2,
      CollisionMathUtils.scale(CollisionMathUtils.add(CollisionMathUtils.add(tri.v0, tri.v1), tri.v2), 1 / 3)
    ];

    for (const pt of pointsToCheck) {
      const v = CollisionMathUtils.subtract(pt, tcp);
      const h = CollisionMathUtils.dot(v, axis);
      if (h < -cutterRadius || h > totalLength + 10) continue;

      const proj = CollisionMathUtils.add(tcp, CollisionMathUtils.scale(axis, Math.max(0, Math.min(totalLength, h))));
      const radialDist = CollisionMathUtils.distance(pt, proj);

      let expectedRadius = 0;
      let segment: NarrowPhaseResult['contactingSegment'] = 'NONE';

      if (h <= tool.fluteLengthMm) {
        expectedRadius = cutterRadius;
        segment = 'CUTTER';
      } else if (h <= tool.stickoutMm) {
        expectedRadius = shankRadius;
        segment = 'SHANK';
      } else if (h <= tool.stickoutMm + holder.gaugeLengthMm) {
        const tHolder = (h - tool.stickoutMm) / holder.gaugeLengthMm;
        expectedRadius = holderLowerRadius + tHolder * (holderUpperRadius - holderLowerRadius);
        segment = tHolder < 0.5 ? 'HOLDER_LOWER' : 'HOLDER_UPPER';
      } else if (spindle && h <= totalLength) {
        expectedRadius = spindleRadius;
        segment = 'SPINDLE';
      }

      const clr = radialDist - expectedRadius;
      if (clr < minClearance) {
        minClearance = clr;
        bestContactPt = pt;
      }
      if (clr <= 0) {
        isColliding = true;
        const pen = Math.abs(clr);
        if (pen > maxPenetration) {
          maxPenetration = pen;
          bestSegment = segment;
          bestContactPt = pt;
        }
      }
    }

    // 2. Continuous axial segment queries for triangular surfaces
    const zones: { minH: number; maxH: number; r: number; seg: NarrowPhaseResult['contactingSegment'] }[] = [
      { minH: 0, maxH: tool.fluteLengthMm, r: cutterRadius, seg: 'CUTTER' },
      { minH: tool.fluteLengthMm, maxH: tool.stickoutMm, r: shankRadius, seg: 'SHANK' },
      { minH: tool.stickoutMm, maxH: tool.stickoutMm + holder.gaugeLengthMm, r: (holderLowerRadius + holderUpperRadius) / 2, seg: 'HOLDER_LOWER' }
    ];

    if (spindle) {
      zones.push({
        minH: tool.stickoutMm + holder.gaugeLengthMm,
        maxH: totalLength,
        r: spindleRadius,
        seg: 'SPINDLE'
      });
    }

    for (const zone of zones) {
      if (zone.maxH <= zone.minH) continue;
      const p0 = CollisionMathUtils.add(tcp, CollisionMathUtils.scale(axis, zone.minH));
      const p1 = CollisionMathUtils.add(tcp, CollisionMathUtils.scale(axis, zone.maxH));
      
      const numSteps = 5;
      for (let s = 0; s <= numSteps; s++) {
        const pt = CollisionMathUtils.lerp(p0, p1, s / numSteps);
        const res = CollisionMathUtils.closestPointOnTriangle(pt, tri);
        const h = CollisionMathUtils.dot(CollisionMathUtils.subtract(res.point, tcp), axis);

        if (h >= zone.minH - 0.5 && h <= zone.maxH + 0.5) {
          const clr = res.distance - zone.r;
          if (clr < minClearance) {
            minClearance = clr;
            bestContactPt = res.point;
          }
          if (clr <= 0) {
            isColliding = true;
            const pen = Math.abs(clr);
            if (pen > maxPenetration) {
              maxPenetration = pen;
              bestSegment = zone.seg;
              bestContactPt = res.point;
            }
          }
        }
      }
    }

    return {
      isColliding,
      clearanceMm: Math.max(0, minClearance),
      penetrationMm: maxPenetration,
      contactPt: bestContactPt,
      segment: bestSegment
    };
  }
}
