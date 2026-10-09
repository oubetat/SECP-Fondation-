import { SurfaceFacet, SurfaceNode } from "./ContactSurface";
import { ClosestPointResult } from "./types";

export class ClosestPointProjector {
  /**
   * Projects a slave point onto a master surface facet.
   */
  static projectPointToFacet(
    slavePointId: string,
    slaveCoords: number[],
    facet: SurfaceFacet,
    masterNodesMap: Map<string, SurfaceNode>,
    outwardNormalConvention: 'OUTWARD' | 'INWARD' = 'OUTWARD'
  ): ClosestPointResult {
    const facetNodes = facet.nodeIds.map(id => masterNodesMap.get(id));
    
    if (facetNodes.some(n => !n)) {
      return {
        sourcePointId: slavePointId,
        targetFacetId: facet.facetId,
        sourceCoords: [...slaveCoords],
        targetCoords: [...slaveCoords],
        parametricCoords: [0],
        distance: Infinity,
        gap: Infinity,
        normal: [0, 1],
        projectionStatus: 'FAILED',
        residualNorm: Infinity
      };
    }

    const masterCoords = facetNodes.map(n => n!.currentCoords);

    if (masterCoords.length === 2) {
      return this.projectPointToSegment2D(slavePointId, slaveCoords, facet.facetId, masterCoords, outwardNormalConvention);
    } else if (masterCoords.length === 3 || masterCoords.length === 4) {
      return this.projectPointToPolygon3D(slavePointId, slaveCoords, facet.facetId, masterCoords, outwardNormalConvention);
    }

    return {
      sourcePointId: slavePointId,
      targetFacetId: facet.facetId,
      sourceCoords: [...slaveCoords],
      targetCoords: [...slaveCoords],
      parametricCoords: [0],
      distance: Infinity,
      gap: Infinity,
      normal: [0, 1],
      projectionStatus: 'FAILED',
      residualNorm: Infinity
    };
  }

  /**
   * 2D Closest-Point Projection onto a line segment [x1, x2].
   */
  private static projectPointToSegment2D(
    slavePointId: string,
    slaveCoords: number[],
    facetId: string,
    masterCoords: number[][],
    outwardNormalConvention: 'OUTWARD' | 'INWARD'
  ): ClosestPointResult {
    const x1 = masterCoords[0];
    const x2 = masterCoords[1];

    const dx = x2[0] - x1[0];
    const dy = x2[1] - x1[1];
    const lenSq = dx * dx + dy * dy;
    const len = Math.sqrt(lenSq);

    if (len < 1e-12) {
      return {
        sourcePointId: slavePointId,
        targetFacetId: facetId,
        sourceCoords: [...slaveCoords],
        targetCoords: [...x1],
        parametricCoords: [0],
        distance: Math.hypot(slaveCoords[0] - x1[0], slaveCoords[1] - x1[1]),
        gap: Math.hypot(slaveCoords[0] - x1[0], slaveCoords[1] - x1[1]),
        normal: [0, 1],
        projectionStatus: 'DEGENERATE',
        residualNorm: 0
      };
    }

    // Tangent vector t = (x2 - x1) / len
    const tx = dx / len;
    const ty = dy / len;

    // Outward master unit normal convention (master domain below facet, outward facing toward slave domain)
    let nx = -ty;
    let ny = tx;

    if (outwardNormalConvention === 'INWARD') {
      nx = -nx;
      ny = -ny;
    }

    // Vector from x1 to slave point xs
    const vx = slaveCoords[0] - x1[0];
    const vy = slaveCoords[1] - x1[1];

    // Parametric coordinate xi in [0, 1] along segment
    const xiUnclamped = (vx * dx + vy * dy) / lenSq;
    const xiClamped = Math.max(0.0, Math.min(1.0, xiUnclamped));

    const isOutOfBounds = xiUnclamped < -1e-5 || xiUnclamped > 1.00001;

    // Projected target coordinates on segment
    const targetX = x1[0] + xiClamped * dx;
    const targetY = x1[1] + xiClamped * dy;

    // Distance vector d = xs - target
    const rx = slaveCoords[0] - targetX;
    const ry = slaveCoords[1] - targetY;
    const dist = Math.hypot(rx, ry);

    // Signed gap g_n = (xs - target) . n
    const gap = rx * nx + ry * ny;

    return {
      sourcePointId: slavePointId,
      targetFacetId: facetId,
      sourceCoords: [...slaveCoords],
      targetCoords: [targetX, targetY],
      parametricCoords: [xiClamped],
      distance: dist,
      gap,
      normal: [nx, ny],
      projectionStatus: isOutOfBounds ? 'OUT_OF_BOUNDS' : 'SUCCESS',
      residualNorm: Math.abs(xiUnclamped - xiClamped)
    };
  }

  /**
   * 3D Closest-Point Projection onto a planar/quad polygon [x1, x2, x3, (x4)].
   */
  private static projectPointToPolygon3D(
    slavePointId: string,
    slaveCoords: number[],
    facetId: string,
    masterCoords: number[][],
    outwardNormalConvention: 'OUTWARD' | 'INWARD'
  ): ClosestPointResult {
    const p0 = masterCoords[0];
    const p1 = masterCoords[1];
    const p2 = masterCoords[2];

    const e1 = [p1[0] - p0[0], p1[1] - p0[1], (p1[2] || 0) - (p0[2] || 0)];
    const e2 = [p2[0] - p0[0], p2[1] - p0[1], (p2[2] || 0) - (p0[2] || 0)];

    const nx = e1[1] * e2[2] - e1[2] * e2[1];
    const ny = e1[2] * e2[0] - e1[0] * e2[2];
    const nz = e1[0] * e2[1] - e1[1] * e2[0];
    const nLen = Math.hypot(nx, ny, nz);

    if (nLen < 1e-12) {
      return {
        sourcePointId: slavePointId,
        targetFacetId: facetId,
        sourceCoords: [...slaveCoords],
        targetCoords: [...p0],
        parametricCoords: [0, 0],
        distance: Math.hypot(slaveCoords[0] - p0[0], slaveCoords[1] - p0[1], (slaveCoords[2] || 0) - (p0[2] || 0)),
        gap: 0,
        normal: [0, 0, 1],
        projectionStatus: 'DEGENERATE',
        residualNorm: 0
      };
    }

    let n = [nx / nLen, ny / nLen, nz / nLen];
    if (outwardNormalConvention === 'INWARD') {
      n = [-n[0], -n[1], -n[2]];
    }

    // Vector from p0 to slave point
    const v = [
      slaveCoords[0] - p0[0],
      slaveCoords[1] - p0[1],
      (slaveCoords[2] || 0) - (p0[2] || 0)
    ];

    // Signed gap = v . n
    const gap = v[0] * n[0] + v[1] * n[1] + v[2] * n[2];

    // Target point on plane: p_target = slave - gap * n
    const targetX = slaveCoords[0] - gap * n[0];
    const targetY = slaveCoords[1] - gap * n[1];
    const targetZ = (slaveCoords[2] || 0) - gap * n[2];

    // Parametric coordinates on master plane
    const projV = [targetX - p0[0], targetY - p0[1], targetZ - (p0[2] || 0)];
    const dot11 = e1[0] * e1[0] + e1[1] * e1[0] + e1[2] * e1[2];
    const dot12 = e1[0] * e2[0] + e1[1] * e2[1] + e1[2] * e2[2];
    const dot22 = e2[0] * e2[0] + e2[1] * e2[1] + e2[2] * e2[2];
    const dotV1 = projV[0] * e1[0] + projV[1] * e1[1] + projV[2] * e1[2];
    const dotV2 = projV[0] * e2[0] + projV[1] * e2[1] + projV[2] * e2[2];

    const denom = dot11 * dot22 - dot12 * dot12;
    let xi = 0;
    let eta = 0;
    if (Math.abs(denom) > 1e-12) {
      xi = (dot22 * dotV1 - dot12 * dotV2) / denom;
      eta = (dot11 * dotV2 - dot12 * dotV1) / denom;
    }

    const isOutOfBounds = xi < 0 || eta < 0 || (xi + eta) > 1.05;

    return {
      sourcePointId: slavePointId,
      targetFacetId: facetId,
      sourceCoords: [...slaveCoords],
      targetCoords: [targetX, targetY, targetZ],
      parametricCoords: [xi, eta],
      distance: Math.abs(gap),
      gap,
      normal: n,
      projectionStatus: isOutOfBounds ? 'OUT_OF_BOUNDS' : 'SUCCESS',
      residualNorm: 0
    };
  }
}
