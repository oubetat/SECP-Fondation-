// SECP Industrial OS v2 — Geometry Healing Engine (Provenance-Preserving)
import { GeometryHealingEvent, GeometryTwin } from './types';
import { CanonicalGeometrySerializer } from './CanonicalGeometrySerializer';

export class GeometryHealingEngine {
  public static healGeometry(
    twin: GeometryTwin,
    operations: string[],
    kernel: string,
    kernelVersion: string,
    tolerance: number
  ): {
    healedTwin: GeometryTwin;
    healingEvent: GeometryHealingEvent;
  } {
    const inputGeometryHash = twin.geometryHash;

    // Clone geometry twin deeply
    const healedTwin: GeometryTwin = JSON.parse(JSON.stringify(twin));

    // Simulate healing operations (e.g. snapping micro-gaps, fixing vertex tolerance)
    if (healedTwin.bRep) {
      for (const vertex of healedTwin.bRep.vertices) {
        vertex.tolerance = Math.max(vertex.tolerance, tolerance);
        vertex.canonicalHash = CanonicalGeometrySerializer.computeVertexHash(vertex);
      }
      healedTwin.bRep.topologyHash = CanonicalGeometrySerializer.computeTopologyHash(healedTwin.bRep);
      healedTwin.bRep.bRepHash = CanonicalGeometrySerializer.computeGeometryHash({ bRep: healedTwin.bRep });
    }

    healedTwin.geometryHash = CanonicalGeometrySerializer.computeGeometryHash({
      bRep: healedTwin.bRep,
      nurbsSurfaces: healedTwin.nurbsSurfaces,
      nurbsCurves: healedTwin.nurbsCurves,
      analyticEntities: healedTwin.analyticEntities
    });

    healedTwin.topologyHash = healedTwin.bRep ? healedTwin.bRep.topologyHash : CanonicalGeometrySerializer.sha256('NO_TOPOLOGY');
    
    healedTwin.rootHash = CanonicalGeometrySerializer.computeGeometryRootHash({
      geometryHash: healedTwin.geometryHash,
      topologyHash: healedTwin.topologyHash,
      revisionHash: CanonicalGeometrySerializer.sha256(healedTwin.geometryRevisionId),
      coordinateSystemHash: CanonicalGeometrySerializer.computeCoordinateSystemHash(healedTwin.coordinateSystem),
      toleranceHash: CanonicalGeometrySerializer.computeToleranceModelHash(healedTwin.toleranceModel),
      configurationHash: CanonicalGeometrySerializer.sha256(healedTwin.configurationId),
      evidenceHash: CanonicalGeometrySerializer.sha256(JSON.stringify(healedTwin.evidence))
    });

    const healingEvent: GeometryHealingEvent = {
      healingId: `HEAL-${CanonicalGeometrySerializer.sha256(inputGeometryHash + Date.now()).substring(0, 8)}`,
      inputGeometryHash,
      outputGeometryHash: healedTwin.geometryHash,
      operations,
      kernel,
      kernelVersion,
      tolerance,
      timestamp: new Date().toISOString(),
      result: 'SUCCESS'
    };

    healedTwin.healingHistory.push(healingEvent);

    return {
      healedTwin,
      healingEvent
    };
  }
}
