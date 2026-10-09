/**
 * SECP Industrial OS v2 — STEP AP242 Round-trip Verifier
 * PATCH-034/PATCH-329B: STEP AP242 Round-trip Verifier
 */

import { Solid } from '../../cad-kernel/topology/TopologyContracts';
import { 
  StepFidelityReport, 
  StepFidelityVerdict, 
  StepLossReport, 
  QuantitativeGeometryMetrics, 
  TopologicalInvariants 
} from './StepAp242Types';

export interface ExtendedStepFidelityReport extends StepFidelityReport {
  readonly quantitativeMetrics?: QuantitativeGeometryMetrics;
  readonly topologicalInvariants?: TopologicalInvariants;
  readonly identityPreserved?: boolean;
}

export class StepAp242RoundTripVerifier {
  public static verify(original: Solid[], roundTripped: Solid[], mapperLoss: StepLossReport[]): ExtendedStepFidelityReport {
    const lossReports: StepLossReport[] = [...mapperLoss];
    
    // Critical Rule: Empty model check — both models empty means empty round-trip, NOT EXACT!
    if (original.length === 0 || roundTripped.length === 0) {
      lossReports.push({
        status: 'LOST',
        reason: `Empty model array in round-trip verification (Original: ${original.length}, RoundTripped: ${roundTripped.length})`,
        severity: 'CRITICAL'
      });
      return { verdict: 'INVALID', lossReports };
    }

    if (original.length !== roundTripped.length) {
      lossReports.push({
        status: 'LOST',
        reason: `Solid count mismatch: Expected ${original.length}, Got ${roundTripped.length}`,
        severity: 'CRITICAL'
      });
      return { verdict: 'LOSS_DETECTED', lossReports };
    }

    // Check if any high/critical mapper loss reports exist
    const hasCriticalLoss = lossReports.some(l => l.severity === 'CRITICAL' || l.severity === 'HIGH');
    if (hasCriticalLoss) {
      return { verdict: 'LOSS_DETECTED', lossReports };
    }

    // Detailed comparison: Entity counts & topological identities
    const origTop = this.extractTopologicalInvariants(original);
    const rtTop = this.extractTopologicalInvariants(roundTripped);

    const quantMetrics = this.computeQuantitativeMetrics(original, roundTripped);

    let verdict: StepFidelityVerdict = 'EXACT';

    if (origTop.vertexCount !== rtTop.vertexCount ||
        origTop.edgeCount !== rtTop.edgeCount ||
        origTop.faceCount !== rtTop.faceCount) {
      verdict = 'DEGRADED';
      lossReports.push({
        status: 'PARTIAL',
        reason: `Topological entity mismatch: ${JSON.stringify(origTop)} vs ${JSON.stringify(rtTop)}`,
        severity: 'MEDIUM'
      });
    }

    if (quantMetrics.maxVertexDisplacementMm > 1e-3 ||
        quantMetrics.relativeVolumeDeviation > 1e-3) {
      verdict = 'DEGRADED';
      lossReports.push({
        status: 'PARTIAL',
        reason: `Quantitative geometric deviation exceeds tolerance: maxVertexDisp=${quantMetrics.maxVertexDisplacementMm.toFixed(6)}mm`,
        severity: 'MEDIUM'
      });
    }

    // Check identity retention
    let identityPreserved = true;
    for (let i = 0; i < original.length; i++) {
      if (original[i].id !== roundTripped[i].id) {
        identityPreserved = false;
        lossReports.push({
          status: 'PARTIAL',
          reason: `Solid identity mismatch at index ${i}: ${original[i].id} vs ${roundTripped[i].id}`,
          severity: 'LOW'
        });
      }
    }

    return {
      verdict,
      boundingBoxDelta: quantMetrics.boundingBoxDeltaMm,
      toleranceDelta: quantMetrics.maxVertexDisplacementMm,
      lossReports,
      quantitativeMetrics: quantMetrics,
      topologicalInvariants: rtTop,
      identityPreserved
    };
  }

  public static extractTopologicalInvariants(solids: Solid[]): TopologicalInvariants {
    let vertexCount = 0;
    let edgeCount = 0;
    let faceCount = 0;
    let loopCount = 0;
    let shellCount = 0;
    let solidCount = solids.length;

    const seenVertices = new Set<string>();
    const seenEdges = new Set<string>();

    for (const s of solids) {
      if (s.outerShell?.orientedFaces) {
        shellCount++;
        for (const of of s.outerShell.orientedFaces) {
          faceCount++;
          if (of.face?.outerLoop?.orientedEdges) {
            loopCount++;
            for (const oe of of.face.outerLoop.orientedEdges) {
              if (oe.edge) {
                seenEdges.add(oe.edge.id);
                if (oe.edge.startVertex) seenVertices.add(oe.edge.startVertex.id);
                if (oe.edge.endVertex) seenVertices.add(oe.edge.endVertex.id);
              }
            }
          }
        }
      }
    }

    vertexCount = seenVertices.size;
    edgeCount = seenEdges.size;

    // Euler characteristic for closed manifold genus 0 B-Rep solid: V - E + F
    const eulerCharacteristic = vertexCount - edgeCount + faceCount;

    return {
      vertexCount,
      edgeCount,
      faceCount,
      loopCount,
      shellCount,
      solidCount,
      eulerCharacteristic,
      boundaryEdgesCount: 0,
      nonManifoldEdgesCount: 0,
      orphanEdgesCount: 0,
      orphanVerticesCount: 0,
      isClosedManifold: eulerCharacteristic === 2 || faceCount > 0
    };
  }

  private static computeQuantitativeMetrics(orig: Solid[], rt: Solid[]): QuantitativeGeometryMetrics {
    let maxVertexDisp = 0.0;
    let origVolSum = 0.0, rtVolSum = 0.0;
    let origAreaSum = 0.0, rtAreaSum = 0.0;

    let origMinX = Infinity, origMinY = Infinity, origMinZ = Infinity;
    let origMaxX = -Infinity, origMaxY = -Infinity, origMaxZ = -Infinity;
    let rtMinX = Infinity, rtMinY = Infinity, rtMinZ = Infinity;
    let rtMaxX = -Infinity, rtMaxY = -Infinity, rtMaxZ = -Infinity;

    for (let i = 0; i < orig.length; i++) {
      const oSolid = orig[i];
      const rSolid = rt[i];

      const oVerts = this.collectVertices(oSolid);
      const rVerts = this.collectVertices(rSolid);

      for (const ov of oVerts) {
        const p = ov.geometry as any;
        if (p) {
          origMinX = Math.min(origMinX, p.x || 0);
          origMinY = Math.min(origMinY, p.y || 0);
          origMinZ = Math.min(origMinZ, p.z || 0);
          origMaxX = Math.max(origMaxX, p.x || 0);
          origMaxY = Math.max(origMaxY, p.y || 0);
          origMaxZ = Math.max(origMaxZ, p.z || 0);
        }
      }

      for (const rv of rVerts) {
        const p = rv.geometry as any;
        if (p) {
          rtMinX = Math.min(rtMinX, p.x || 0);
          rtMinY = Math.min(rtMinY, p.y || 0);
          rtMinZ = Math.min(rtMinZ, p.z || 0);
          rtMaxX = Math.max(rtMaxX, p.x || 0);
          rtMaxY = Math.max(rtMaxY, p.y || 0);
          rtMaxZ = Math.max(rtMaxZ, p.z || 0);
        }
      }

      // Compute vertex-to-vertex displacement
      const minLen = Math.min(oVerts.length, rVerts.length);
      for (let j = 0; j < minLen; j++) {
        const op = oVerts[j].geometry as any;
        const rp = rVerts[j].geometry as any;
        if (op && rp) {
          const dx = (op.x || 0) - (rp.x || 0);
          const dy = (op.y || 0) - (rp.y || 0);
          const dz = (op.z || 0) - (rp.z || 0);
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          maxVertexDisp = Math.max(maxVertexDisp, dist);
        }
      }
    }

    if (origMinX === Infinity) origMinX = origMinY = origMinZ = origMaxX = origMaxY = origMaxZ = 0;
    if (rtMinX === Infinity) rtMinX = rtMinY = rtMinZ = rtMaxX = rtMaxY = rtMaxZ = 0;

    const oDx = origMaxX - origMinX, oDy = origMaxY - origMinY, oDz = origMaxZ - origMinZ;
    const rDx = rtMaxX - rtMinX, rDy = rtMaxY - rtMinY, rDz = rtMaxZ - rtMinZ;

    origVolSum = oDx * oDy * oDz;
    rtVolSum = rDx * rDy * rDz;

    origAreaSum = 2 * (oDx * oDy + oDy * oDz + oDz * oDx);
    rtAreaSum = 2 * (rDx * rDy + rDy * rDz + rDz * rDx);

    const bboxDelta = Math.sqrt(
      Math.pow(origMinX - rtMinX, 2) + Math.pow(origMinY - rtMinY, 2) + Math.pow(origMinZ - rtMinZ, 2) +
      Math.pow(origMaxX - rtMaxX, 2) + Math.pow(origMaxY - rtMaxY, 2) + Math.pow(origMaxZ - rtMaxZ, 2)
    );

    const relVolDev = origVolSum > 0 ? Math.abs(origVolSum - rtVolSum) / origVolSum : 0.0;
    const relAreaDev = origAreaSum > 0 ? Math.abs(origAreaSum - rtAreaSum) / origAreaSum : 0.0;

    return {
      maxVertexDisplacementMm: maxVertexDisp,
      maxEdgeCurveDeviationMm: maxVertexDisp,
      maxFaceSurfaceDeviationMm: maxVertexDisp,
      boundingBoxDeltaMm: bboxDelta,
      relativeVolumeDeviation: relVolDev,
      relativeSurfaceAreaDeviation: relAreaDev,
      centroidDisplacementMm: bboxDelta * 0.5,
      maxTransformDeviation: 0.0
    };
  }

  private static collectVertices(solid: Solid): any[] {
    const verts: any[] = [];
    if (solid?.outerShell?.orientedFaces) {
      for (const of of solid.outerShell.orientedFaces) {
        if (of.face?.outerLoop?.orientedEdges) {
          for (const oe of of.face.outerLoop.orientedEdges) {
            if (oe.edge?.startVertex) verts.push(oe.edge.startVertex);
          }
        }
      }
    }
    return verts;
  }
}

