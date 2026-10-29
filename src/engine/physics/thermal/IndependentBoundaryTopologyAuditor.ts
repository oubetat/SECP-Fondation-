/**
 * SECP Industrial OS — Engineering Truth OS
 * IndependentBoundaryTopologyAuditor.ts
 *
 * SECP-PHYSICS-EXPANSION-004B: Work Package B — Boundary Topology & Flux Integrity Auditor.
 *
 * Independent boundary topology verification oracle implemented WITHOUT reusing
 * production boundary-face extraction code.
 */

export interface StandaloneNode3D {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface StandaloneTetElement3D {
  id: string;
  nodeIds: [string, string, string, string];
}

export interface ExteriorFaceAuditResult {
  faceKey: string;
  nodeIds: [string, string, string];
  parentElementId: string;
  apexNodeId: string;
  areaM2: number;
  outwardUnitNormal: [number, number, number];
  centroid: [number, number, number];
}

export interface TopologyAuditReport {
  totalNodes: number;
  totalElements: number;
  totalInteriorFaceOccurrences: number;
  totalExteriorFaces: number;
  totalSurfaceAreaM2: number;
  analyticalSurfaceAreaM2: number;
  surfaceAreaDiscrepancyM2: number;
  degenerateFaceCount: number;
  duplicateFaceCount: number;
  invertedElementCount: number;
  topologyValid: boolean;
  notes: string[];
}

export class IndependentBoundaryTopologyAuditor {
  /**
   * Independently audits mesh boundary topology and verifies exact surface representation.
   */
  public static auditMeshTopology(
    nodes: StandaloneNode3D[],
    elements: StandaloneTetElement3D[],
    expectedAnalyticalAreaM2: number = 0.0042
  ): { report: TopologyAuditReport; exteriorFaces: ExteriorFaceAuditResult[] } {
    const nodeMap = new Map<string, StandaloneNode3D>();
    nodes.forEach(n => nodeMap.set(n.id, n));

    const notes: string[] = [];
    let degenerateCount = 0;
    let duplicateCount = 0;
    let invertedCount = 0;

    // 1. Verify element volumes (check for inverted node ordering)
    for (const elem of elements) {
      const n0 = nodeMap.get(elem.nodeIds[0])!;
      const n1 = nodeMap.get(elem.nodeIds[1])!;
      const n2 = nodeMap.get(elem.nodeIds[2])!;
      const n3 = nodeMap.get(elem.nodeIds[3])!;

      const v10 = [n1.x - n0.x, n1.y - n0.y, n1.z - n0.z];
      const v20 = [n2.x - n0.x, n2.y - n0.y, n2.z - n0.z];
      const v30 = [n3.x - n0.x, n3.y - n0.y, n3.z - n0.z];

      const det =
        v10[0] * (v20[1] * v30[2] - v20[2] * v30[1]) -
        v10[1] * (v20[0] * v30[2] - v20[2] * v30[0]) +
        v10[2] * (v20[0] * v30[1] - v20[1] * v30[0]);

      const volume = det / 6.0;
      if (volume <= 0) {
        invertedCount++;
      }
    }

    if (invertedCount > 0) {
      notes.push(`[TOPOLOGY_FAIL] Detected ${invertedCount} inverted or zero-volume tetrahedra.`);
    }

    // 2. Extract face occurrences
    interface FaceOccurrence {
      sortedKey: string;
      nodeIds: [string, string, string];
      elementId: string;
      apexNodeId: string;
    }

    const faceRegistry = new Map<string, FaceOccurrence[]>();

    for (const elem of elements) {
      const [n0, n1, n2, n3] = elem.nodeIds;
      const tets: Array<{ ids: [string, string, string]; apex: string }> = [
        { ids: [n0, n2, n1], apex: n3 },
        { ids: [n0, n1, n3], apex: n2 },
        { ids: [n1, n2, n3], apex: n0 },
        { ids: [n0, n3, n2], apex: n1 }
      ];

      for (const t of tets) {
        const sortedKey = [...t.ids].sort().join('::');
        const list = faceRegistry.get(sortedKey) ?? [];
        list.push({
          sortedKey,
          nodeIds: t.ids,
          elementId: elem.id,
          apexNodeId: t.apex
        });
        faceRegistry.set(sortedKey, list);
      }
    }

    let interiorCount = 0;
    const exteriorFaces: ExteriorFaceAuditResult[] = [];
    let totalSurfaceArea = 0.0;

    for (const [key, occurrences] of faceRegistry.entries()) {
      if (occurrences.length === 2) {
        interiorCount++;
      } else if (occurrences.length === 1) {
        const rec = occurrences[0];
        const nA = nodeMap.get(rec.nodeIds[0])!;
        const nB = nodeMap.get(rec.nodeIds[1])!;
        const nC = nodeMap.get(rec.nodeIds[2])!;
        const nApex = nodeMap.get(rec.apexNodeId)!;

        const vAB = [nB.x - nA.x, nB.y - nA.y, nB.z - nA.z];
        const vAC = [nC.x - nA.x, nC.y - nA.y, nC.z - nA.z];

        let cp = [
          vAB[1] * vAC[2] - vAB[2] * vAC[1],
          vAB[2] * vAC[0] - vAB[0] * vAC[2],
          vAB[0] * vAC[1] - vAB[1] * vAC[0]
        ];

        const len = Math.sqrt(cp[0] * cp[0] + cp[1] * cp[1] + cp[2] * cp[2]);
        if (len < 1e-12) {
          degenerateCount++;
          continue;
        }

        const areaM2 = 0.5 * len;
        const centroid: [number, number, number] = [
          (nA.x + nB.x + nC.x) / 3.0,
          (nA.y + nB.y + nC.y) / 3.0,
          (nA.z + nB.z + nC.z) / 3.0
        ];

        const toApex = [nApex.x - centroid[0], nApex.y - centroid[1], nApex.z - centroid[2]];
        const dotApex = cp[0] * toApex[0] + cp[1] * toApex[1] + cp[2] * toApex[2];

        if (dotApex > 0) {
          cp = [-cp[0], -cp[1], -cp[2]];
        }

        const outwardUnitNormal: [number, number, number] = [
          cp[0] / len,
          cp[1] / len,
          cp[2] / len
        ];

        totalSurfaceArea += areaM2;

        exteriorFaces.push({
          faceKey: key,
          nodeIds: rec.nodeIds,
          parentElementId: rec.elementId,
          apexNodeId: rec.apexNodeId,
          areaM2,
          outwardUnitNormal,
          centroid
        });
      } else {
        duplicateCount += occurrences.length - 1;
        notes.push(`[TOPOLOGY_FAIL] Face ${key} shared by ${occurrences.length} elements (non-manifold topology).`);
      }
    }

    const surfaceAreaDiscrepancy = Math.abs(totalSurfaceArea - expectedAnalyticalAreaM2);
    const topologyValid =
      invertedCount === 0 &&
      degenerateCount === 0 &&
      duplicateCount === 0 &&
      surfaceAreaDiscrepancy < 1e-6;

    if (topologyValid) {
      notes.push(`[TOPOLOGY_PASS] Verified ${exteriorFaces.length} exterior boundary faces, area = ${totalSurfaceArea.toFixed(6)} m^2.`);
    }

    const report: TopologyAuditReport = {
      totalNodes: nodes.length,
      totalElements: elements.length,
      totalInteriorFaceOccurrences: interiorCount,
      totalExteriorFaces: exteriorFaces.length,
      totalSurfaceAreaM2: totalSurfaceArea,
      analyticalSurfaceAreaM2: expectedAnalyticalAreaM2,
      surfaceAreaDiscrepancyM2: surfaceAreaDiscrepancy,
      degenerateFaceCount: degenerateCount,
      duplicateFaceCount: duplicateCount,
      invertedElementCount: invertedCount,
      topologyValid,
      notes
    };

    return { report, exteriorFaces };
  }
}
