/**
 * SECP CAD Kernel — Topology Healing Engine
 * PATCH-205: Phase 18 — Professional Modeling
 *
 * Open wire repair, edge merging, and duplicate geometry detection/elimination.
 */

import { Point, Vector } from '../../../cad-kernel/geometry/GeometryContracts';

export interface EdgeRepresentation {
  edgeId: string;
  startPoint: Point;
  endPoint: Point;
  controlPoints: Point[];
}

export class TopologyHealingEngine {
  /**
   * Detect duplicate edges in a wireframe collection within tolerance
   */
  public static detectDuplicateEdges(
    edges: EdgeRepresentation[],
    tolerance: number = 1e-4
  ): {
    uniqueEdges: EdgeRepresentation[];
    duplicatesRemovedCount: number;
  } {
    const unique: EdgeRepresentation[] = [];
    let duplicates = 0;

    for (const e of edges) {
      let isDup = false;
      for (const u of unique) {
        if (this.areEdgesEqual(e, u, tolerance)) {
          isDup = true;
          duplicates++;
          break;
        }
      }
      if (!isDup) {
        unique.push(e);
      }
    }

    return {
      uniqueEdges: unique,
      duplicatesRemovedCount: duplicates
    };
  }

  /**
   * Merge two collinear or tangentially compatible adjacent edges into a single edge
   */
  public static mergeCompatibleEdges(
    edgeA: EdgeRepresentation,
    edgeB: EdgeRepresentation,
    tolerance: number = 1e-4
  ): {
    mergedEdge?: EdgeRepresentation;
    canMerge: boolean;
  } {
    // Check endpoint connectivity
    const distEndStart = this.distance(edgeA.endPoint, edgeB.startPoint);
    if (distEndStart > tolerance) {
      return { canMerge: false };
    }

    // Check tangency compatibility
    const dirA = this.getDirection(edgeA.startPoint, edgeA.endPoint);
    const dirB = this.getDirection(edgeB.startPoint, edgeB.endPoint);
    const dot = dirA.x * dirB.x + dirA.y * dirB.y + dirA.z * dirB.z;

    if (dot < 0.9) {
      // Tangency mismatch > ~25 degrees -> do not merge
      return { canMerge: false };
    }

    const mergedControlPoints = [...edgeA.controlPoints, ...edgeB.controlPoints.slice(1)];

    return {
      canMerge: true,
      mergedEdge: {
        edgeId: `MERGED_${edgeA.edgeId}_${edgeB.edgeId}`,
        startPoint: edgeA.startPoint,
        endPoint: edgeB.endPoint,
        controlPoints: mergedControlPoints
      }
    };
  }

  /**
   * Heal open wire by snapping open endpoints or inserting a bridge edge
   */
  public static healOpenWire(
    edges: EdgeRepresentation[],
    tolerance: number = 1e-4
  ): {
    healedEdges: EdgeRepresentation[];
    wireClosed: boolean;
    bridgeInserted: boolean;
  } {
    if (edges.length < 2) {
      return { healedEdges: edges, wireClosed: false, bridgeInserted: false };
    }

    const result = [...edges];
    const first = result[0];
    const last = result[result.length - 1];

    const gap = this.distance(last.endPoint, first.startPoint);

    if (gap <= tolerance) {
      // Snap endpoint
      last.endPoint = { ...first.startPoint };
      return { healedEdges: result, wireClosed: true, bridgeInserted: false };
    } else {
      // Insert bridge edge
      const bridgeEdge: EdgeRepresentation = {
        edgeId: `BRIDGE_${Math.random().toString(36).substring(2, 8)}`,
        startPoint: { ...last.endPoint },
        endPoint: { ...first.startPoint },
        controlPoints: [{ ...last.endPoint }, { ...first.startPoint }]
      };
      result.push(bridgeEdge);
      return { healedEdges: result, wireClosed: true, bridgeInserted: true };
    }
  }

  private static areEdgesEqual(e1: EdgeRepresentation, e2: EdgeRepresentation, tol: number): boolean {
    const fwdMatch =
      this.distance(e1.startPoint, e2.startPoint) <= tol &&
      this.distance(e1.endPoint, e2.endPoint) <= tol;

    const revMatch =
      this.distance(e1.startPoint, e2.endPoint) <= tol &&
      this.distance(e1.endPoint, e2.startPoint) <= tol;

    return fwdMatch || revMatch;
  }

  private static distance(p1: Point, p2: Point): number {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2);
  }

  private static getDirection(p1: Point, p2: Point): Vector {
    const d = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
    const len = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
    if (len < 1e-12) return { x: 0, y: 0, z: 1 };
    return { x: d.x / len, y: d.y / len, z: d.z / len };
  }
}
