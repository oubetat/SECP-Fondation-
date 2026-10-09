import { ClosestPointProjector } from "./ClosestPointProjector";
import { ContactPair } from "./ContactPair";
import { ClosestPointResult } from "./types";

export interface CandidatePair {
  slaveNodeId: string;
  masterFacetId: string;
}

export class ContactSearchEngine {
  /**
   * Executes Broad-Phase search to find potential candidate pairs using AABB overlap.
   */
  static broadPhaseSearch(pair: ContactPair): CandidatePair[] {
    const candidatePairs: CandidatePair[] = [];
    const searchTol = pair.parameters.searchTolerance;

    const slaveNodes = pair.slaveSurface.getNodes();
    const masterFacets = pair.masterSurface.getFacets();

    const masterAABB = pair.masterSurface.computeAABB(searchTol);

    for (const sNode of slaveNodes) {
      // Fast check: is slave node inside master surface AABB?
      const sCoords = sNode.currentCoords;
      let inMasterAABB = true;
      for (let d = 0; d < sCoords.length; d++) {
        if (sCoords[d] < masterAABB.min[d] || sCoords[d] > masterAABB.max[d]) {
          inMasterAABB = false;
          break;
        }
      }

      if (!inMasterAABB) continue;

      // Check against individual master facet bounding boxes
      for (const mFacet of masterFacets) {
        const mNodes = mFacet.nodeIds.map(nid => pair.masterSurface.getNode(nid));
        if (mNodes.some(n => !n)) continue;

        let facetMinX = Infinity, facetMaxX = -Infinity;
        let facetMinY = Infinity, facetMaxY = -Infinity;

        for (const mn of mNodes) {
          const c = mn!.currentCoords;
          if (c[0] < facetMinX) facetMinX = c[0];
          if (c[0] > facetMaxX) facetMaxX = c[0];
          if (c[1] < facetMinY) facetMinY = c[1];
          if (c[1] > facetMaxY) facetMaxY = c[1];
        }

        facetMinX -= searchTol; facetMaxX += searchTol;
        facetMinY -= searchTol; facetMaxY += searchTol;

        if (sCoords[0] >= facetMinX && sCoords[0] <= facetMaxX &&
            sCoords[1] >= facetMinY && sCoords[1] <= facetMaxY) {
          candidatePairs.push({
            slaveNodeId: sNode.id,
            masterFacetId: mFacet.facetId
          });
        }
      }
    }

    return candidatePairs;
  }

  /**
   * Executes Narrow-Phase geometric search to compute exact closest points, gap, and normal.
   */
  static narrowPhaseSearch(
    pair: ContactPair,
    candidates: CandidatePair[]
  ): Map<string, ClosestPointResult> {
    const results = new Map<string, ClosestPointResult>();
    const masterNodesMap = new Map(pair.masterSurface.getNodes().map(n => [n.id, n]));
    const masterFacetsMap = new Map(pair.masterSurface.getFacets().map(f => [f.facetId, f]));

    // Group candidate facets by slave node ID
    const slaveCandidatesMap = new Map<string, string[]>();
    for (const cand of candidates) {
      if (!slaveCandidatesMap.has(cand.slaveNodeId)) {
        slaveCandidatesMap.set(cand.slaveNodeId, []);
      }
      slaveCandidatesMap.get(cand.slaveNodeId)!.push(cand.masterFacetId);
    }

    for (const [sNodeId, facetIds] of slaveCandidatesMap.entries()) {
      const sNode = pair.slaveSurface.getNode(sNodeId);
      if (!sNode) continue;

      let bestResult: ClosestPointResult | null = null;
      let minDistance = Infinity;

      for (const fId of facetIds) {
        const facet = masterFacetsMap.get(fId);
        if (!facet) continue;

        const proj = ClosestPointProjector.projectPointToFacet(
          sNodeId,
          sNode.currentCoords,
          facet,
          masterNodesMap,
          pair.masterSurface.normalConvention
        );

        if (proj.projectionStatus === 'FAILED') continue;

        // Prefer in-bounds projections or smallest distance
        const effectiveDist = proj.projectionStatus === 'SUCCESS' ? proj.distance : proj.distance + 1e3;
        if (effectiveDist < minDistance) {
          minDistance = effectiveDist;
          bestResult = proj;
        }
      }

      if (bestResult) {
        results.set(sNodeId, bestResult);
      }
    }

    return results;
  }
}
