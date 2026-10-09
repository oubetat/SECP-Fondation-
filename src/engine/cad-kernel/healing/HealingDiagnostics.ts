/**
 * SECP CAD Kernel — Healing Diagnostics Factory
 * Phase 2 (PATCH-020)
 */

import {
  HealingDefect,
  HealingDefectType,
  HealingSeverity,
  HealingRepairability
} from './HealingTypes';

export class HealingDiagnostics {
  private static defectCounter = 0;

  public static resetCounter(): void {
    this.defectCounter = 0;
  }

  public static createDefect(
    defectType: HealingDefectType,
    severity: HealingSeverity,
    entityIds: string[],
    description: string,
    repairability: HealingRepairability,
    measuredValue?: number,
    allowedTolerance?: number
  ): HealingDefect {
    this.defectCounter++;
    const defectId = `def_${this.defectCounter}_${defectType.toLowerCase()}`;
    return {
      defectId,
      defectType,
      severity,
      entityIds,
      measuredValue,
      allowedTolerance,
      description,
      repairability
    };
  }

  public static duplicateVertex(v1Id: string, v2Id: string, dist: number, tol: number): HealingDefect {
    return this.createDefect(
      dist === 0 ? 'DUPLICATE_VERTEX' : 'NEAR_DUPLICATE_VERTEX',
      'WARNING',
      [v1Id, v2Id],
      `Vertices ${v1Id} and ${v2Id} are within distance ${dist.toFixed(6)} (tolerance ${tol})`,
      'SAFE',
      dist,
      tol
    );
  }

  public static orphanVertex(vId: string): HealingDefect {
    return this.createDefect(
      'ORPHAN_VERTEX',
      'INFO',
      [vId],
      `Vertex ${vId} is not referenced by any edge or loop`,
      'SAFE'
    );
  }

  public static zeroLengthEdge(eId: string, len: number, tol: number): HealingDefect {
    return this.createDefect(
      'ZERO_LENGTH_EDGE',
      'ERROR',
      [eId],
      `Edge ${eId} has near-zero length ${len.toFixed(6)} <= tolerance ${tol}`,
      'SAFE',
      len,
      tol
    );
  }

  public static edgeEndpointMismatch(e1Id: string, e2Id: string, gap: number, tol: number): HealingDefect {
    const isSmall = gap <= tol;
    return this.createDefect(
      'EDGE_ENDPOINT_MISMATCH',
      isSmall ? 'WARNING' : 'ERROR',
      [e1Id, e2Id],
      `Gap between edges ${e1Id} and ${e2Id} is ${gap.toFixed(6)} (allowed ${tol})`,
      isSmall ? 'SAFE' : 'UNSAFE',
      gap,
      tol
    );
  }

  public static openWire(loopId: string, gap: number, tol: number): HealingDefect {
    const isSmall = gap <= tol;
    return this.createDefect(
      isSmall ? 'GAP_IN_WIRE' : 'GAP_EXCEEDS_TOLERANCE',
      isSmall ? 'WARNING' : 'ERROR',
      [loopId],
      `Wire/Loop ${loopId} is open with closure gap ${gap.toFixed(6)} (allowed ${tol})`,
      isSmall ? 'SAFE' : 'UNSAFE',
      gap,
      tol
    );
  }

  public static invalidEdgeOrder(loopId: string): HealingDefect {
    return this.createDefect(
      'INVALID_EDGE_ORDER',
      'WARNING',
      [loopId],
      `Wire/Loop ${loopId} has edges out of consecutive vertex order`,
      'SAFE'
    );
  }

  public static faceOrientationConflict(faceId: string, neighborId: string): HealingDefect {
    return this.createDefect(
      'FACE_ORIENTATION_CONFLICT',
      'ERROR',
      [faceId, neighborId],
      `Face ${faceId} has conflicting orientation with neighbor face ${neighborId}`,
      'SAFE'
    );
  }

  public static openShell(shellId: string, freeEdgeCount: number): HealingDefect {
    return this.createDefect(
      'OPEN_SHELL',
      'ERROR',
      [shellId],
      `Shell ${shellId} contains ${freeEdgeCount} unshared/free boundary edges`,
      'UNSAFE',
      freeEdgeCount
    );
  }

  public static nonManifoldShell(shellId: string, edgeId: string, useCount: number): HealingDefect {
    return this.createDefect(
      'NON_MANIFOLD_SHELL',
      'CRITICAL',
      [shellId, edgeId],
      `Edge ${edgeId} in shell ${shellId} is shared by ${useCount} faces (expected 2 for manifold manifoldness)`,
      'UNSAFE',
      useCount,
      2
    );
  }
}
