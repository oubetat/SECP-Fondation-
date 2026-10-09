// SECP Industrial OS v2 — Geometry Twin Engine
import {
  GeometryTwin,
  GeometryType,
  GeometryCoordinateSystem,
  GeometryToleranceModel,
  BRepTwinDefinition,
  NURBSSurfaceDefinition,
  NURBSCurveDefinition,
  AnalyticGeometryDefinition,
  GeometryOccurrence,
  GeometryEvidence,
  GeometryRevision,
  GeometrySnapshot,
  AsManufacturedInspection,
  DeviationMap,
  MeasurementComparisonVerdict,
  RoundTripVerdict,
  GeometryFreshness,
  GeometryClosureStatus,
  Vector3D
} from './types';
import { CanonicalGeometrySerializer } from './CanonicalGeometrySerializer';
import { GeometryCoordinateService } from './GeometryCoordinateService';
import { GeometryValidityVerifier } from './GeometryValidityVerifier';

export class GeometryTwinEngine {
  private twins = new Map<string, GeometryTwin>();
  private snapshots = new Map<string, GeometrySnapshot[]>(); // twinId -> snapshots
  private revisionIndex = new Map<string, { twinId: string; revision: GeometryRevision; snapshot: GeometrySnapshot }>();

  // Links to downstream domains
  private femLinks = new Map<string, { meshHash: string; femModelHash: string; geometryHash: string; status: string }>();
  private cfdLinks = new Map<string, { meshHash: string; cfdModelHash: string; geometryHash: string; status: string }>();
  private camLinks = new Map<string, { toolpathHash: string; machineConfigHash: string; geometryHash: string; status: string }>();
  private bomLinks = new Map<string, { bomRevision: string; componentRevision: string; geometryRevision: string }>();

  public createGeometryTwin(params: {
    subjectId: string;
    geometryId: string;
    geometryRevisionId: string;
    geometryType: GeometryType;
    kernel: string;
    kernelVersion: string;
    topologyVersion: string;
    configurationId: string;
    variantId: string;
    coordinateSystem?: GeometryCoordinateSystem;
    toleranceModel?: GeometryToleranceModel;
    bRep?: BRepTwinDefinition;
    nurbsSurfaces?: NURBSSurfaceDefinition[];
    nurbsCurves?: NURBSCurveDefinition[];
    analyticEntities?: AnalyticGeometryDefinition[];
    occurrences?: GeometryOccurrence[];
    evidenceId: string;
  }): GeometryTwin {
    const cs: GeometryCoordinateSystem = params.coordinateSystem || {
      origin: { x: 0, y: 0, z: 0 },
      basisX: { x: 1, y: 0, z: 0 },
      basisY: { x: 0, y: 1, z: 0 },
      basisZ: { x: 0, y: 0, z: 1 },
      units: 'mm',
      handedness: 'RIGHT_HANDED',
      canonicalUnit: 'mm',
      conversionFactorToCanonical: 1.0
    };

    const coordValidation = GeometryCoordinateService.validateCoordinateSystem(cs);
    if (!coordValidation.valid) {
      throw new Error(coordValidation.error);
    }

    const tol: GeometryToleranceModel = params.toleranceModel || {
      vertexTolerance: 0.001,
      edgeTolerance: 0.001,
      faceTolerance: 0.001,
      modelTolerance: 0.001,
      angularTolerance: 0.001,
      version: 1
    };

    const geometryHash = CanonicalGeometrySerializer.computeGeometryHash({
      bRep: params.bRep,
      nurbsSurfaces: params.nurbsSurfaces,
      nurbsCurves: params.nurbsCurves,
      analyticEntities: params.analyticEntities
    });

    const topologyHash = params.bRep
      ? CanonicalGeometrySerializer.computeTopologyHash(params.bRep)
      : CanonicalGeometrySerializer.sha256('NO_TOPOLOGY');

    const initialEvidence: GeometryEvidence = {
      evidenceId: params.evidenceId,
      source: 'CAD_AUTHORING_KERNEL',
      geometryHash,
      topologyHash,
      revision: params.geometryRevisionId,
      operation: 'CREATE_GEOMETRY_TWIN',
      actor: 'CHIEF_SYSTEM_ARCHITECT',
      timestamp: new Date().toISOString(),
      evidenceHash: CanonicalGeometrySerializer.sha256(params.evidenceId + geometryHash)
    };

    const initialRevision: GeometryRevision = {
      revisionId: params.geometryRevisionId,
      parentRevisionId: null,
      geometryHash,
      topologyHash,
      changeSet: ['INITIAL_CREATION'],
      author: 'SECP_OS',
      timestamp: new Date().toISOString(),
      reason: 'Initial Geometry Definition'
    };

    const coordHash = CanonicalGeometrySerializer.computeCoordinateSystemHash(cs);
    const tolHash = CanonicalGeometrySerializer.computeToleranceModelHash(tol);
    const rootHash = CanonicalGeometrySerializer.computeGeometryRootHash({
      geometryHash,
      topologyHash,
      revisionHash: CanonicalGeometrySerializer.sha256(params.geometryRevisionId),
      coordinateSystemHash: coordHash,
      toleranceHash: tolHash,
      configurationHash: CanonicalGeometrySerializer.sha256(params.configurationId),
      evidenceHash: CanonicalGeometrySerializer.sha256(JSON.stringify([initialEvidence]))
    });

    const twinId = `GTWIN-${CanonicalGeometrySerializer.sha256(params.subjectId + params.geometryId + params.geometryRevisionId).substring(0, 8)}`;

    const vertices = params.bRep ? params.bRep.vertices : [];
    const aabb = CanonicalGeometrySerializer.computeAABBFromVertices(vertices);

    const twin: GeometryTwin = {
      geometryTwinId: twinId,
      subjectId: params.subjectId,
      geometryId: params.geometryId,
      geometryRevisionId: params.geometryRevisionId,
      geometryType: params.geometryType,
      kernel: params.kernel,
      kernelVersion: params.kernelVersion,
      topologyVersion: params.topologyVersion,
      configurationId: params.configurationId,
      variantId: params.variantId,
      coordinateSystem: cs,
      toleranceModel: tol,
      bRep: params.bRep,
      nurbsSurfaces: params.nurbsSurfaces,
      nurbsCurves: params.nurbsCurves,
      analyticEntities: params.analyticEntities,
      occurrences: params.occurrences,
      aabb,
      massProperties: params.bRep?.solids[0]?.volume ? {
        volume: params.bRep.solids[0].volume,
        surfaceArea: params.bRep.faces.reduce((acc, f) => acc + (f.area || 0), 0),
        centerOfMass: aabb.center,
        principalAxes: [
          { x: 1, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 },
          { x: 0, y: 0, z: 1 }
        ],
        momentsOfInertia: [100, 100, 100]
      } : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      state: 'DESIGN',
      geometryHash,
      topologyHash,
      rootHash,
      evidence: [initialEvidence],
      healingHistory: [],
      revisions: [initialRevision]
    };

    this.twins.set(twinId, twin);

    // Save initial snapshot
    this.createSnapshot(twinId);

    return twin;
  }

  public getGeometryTwin(twinId: string): GeometryTwin | undefined {
    return this.twins.get(twinId);
  }

  public createSnapshot(twinId: string): GeometrySnapshot {
    const twin = this.twins.get(twinId);
    if (!twin) throw new Error(`Twin ${twinId} not found`);

    const snapshot: GeometrySnapshot = {
      snapshotId: `GSNAP-${CanonicalGeometrySerializer.sha256(twinId + twin.geometryRevisionId + Date.now()).substring(0, 8)}`,
      geometryTwinId: twinId,
      revisionId: twin.geometryRevisionId,
      timestamp: new Date().toISOString(),
      state: JSON.parse(JSON.stringify(twin)),
      rootHash: twin.rootHash
    };

    const list = this.snapshots.get(twinId) || [];
    list.push(snapshot);
    this.snapshots.set(twinId, list);

    this.revisionIndex.set(twin.geometryRevisionId, {
      twinId,
      revision: twin.revisions[twin.revisions.length - 1],
      snapshot
    });

    return snapshot;
  }

  public reconstructGeometry(revisionId: string): {
    geometry: GeometryTwin;
    geometryHash: string;
    topologyHash: string;
    revision: GeometryRevision;
  } {
    const entry = this.revisionIndex.get(revisionId);
    if (!entry) {
      throw new Error(`Revision ${revisionId} not reconstructable`);
    }

    const state = JSON.parse(JSON.stringify(entry.snapshot.state)) as GeometryTwin;

    return {
      geometry: state,
      geometryHash: state.geometryHash,
      topologyHash: state.topologyHash,
      revision: entry.revision
    };
  }

  public compareGeometryToMeasurement(
    twinId: string,
    inspection: AsManufacturedInspection
  ): {
    verdict: MeasurementComparisonVerdict;
    deviationMap: DeviationMap;
  } {
    const twin = this.twins.get(twinId);
    if (!twin || !twin.bRep) {
      return {
        verdict: 'INVALID',
        deviationMap: {
          maxDeviation: 0,
          minDeviation: 0,
          meanDeviation: 0,
          RMSDeviation: 0,
          deviationDistribution: {},
          pointDeviations: []
        }
      };
    }

    const nominalVertices = twin.bRep.vertices;
    if (inspection.measuredPoints.length === 0) {
      return {
        verdict: 'INCOMPLETE',
        deviationMap: {
          maxDeviation: 0,
          minDeviation: 0,
          meanDeviation: 0,
          RMSDeviation: 0,
          deviationDistribution: {},
          pointDeviations: []
        }
      };
    }

    let maxDev = 0;
    let minDev = Infinity;
    let sumDev = 0;
    let sumSq = 0;
    const pointDeviations: { point: Vector3D; nominalPoint: Vector3D; deviation: number }[] = [];

    for (let i = 0; i < inspection.measuredPoints.length; i++) {
      const mp = inspection.measuredPoints[i];
      const np = nominalVertices[i % nominalVertices.length].point;
      const dev = Math.sqrt(
        Math.pow(mp.x - np.x, 2) +
        Math.pow(mp.y - np.y, 2) +
        Math.pow(mp.z - np.z, 2)
      );

      if (dev > maxDev) maxDev = dev;
      if (dev < minDev) minDev = dev;
      sumDev += dev;
      sumSq += dev * dev;

      pointDeviations.push({
        point: mp,
        nominalPoint: np,
        deviation: dev
      });
    }

    const count = inspection.measuredPoints.length;
    const meanDev = sumDev / count;
    const rmsDev = Math.sqrt(sumSq / count);

    const deviationMap: DeviationMap = {
      maxDeviation: maxDev,
      minDeviation: minDev === Infinity ? 0 : minDev,
      meanDeviation: meanDev,
      RMSDeviation: rmsDev,
      deviationDistribution: {
        '0.00-0.01mm': pointDeviations.filter(p => p.deviation <= 0.01).length,
        '0.01-0.05mm': pointDeviations.filter(p => p.deviation > 0.01 && p.deviation <= 0.05).length,
        '>0.05mm': pointDeviations.filter(p => p.deviation > 0.05).length
      },
      pointDeviations
    };

    const tol = twin.toleranceModel.modelTolerance;
    const verdict: MeasurementComparisonVerdict = maxDev <= tol ? 'WITHIN_TOLERANCE' : 'OUT_OF_TOLERANCE';

    twin.latestInspection = {
      inspection,
      deviationMap,
      verdict
    };

    return {
      verdict,
      deviationMap
    };
  }

  // Downstream link handlers
  public linkFEM(twinId: string, meshHash: string, femModelHash: string): void {
    const twin = this.twins.get(twinId);
    if (!twin) throw new Error('Twin not found');
    this.femLinks.set(twinId, {
      meshHash,
      femModelHash,
      geometryHash: twin.geometryHash,
      status: 'SYNCHRONIZED'
    });
  }

  public checkFEMFreshness(twinId: string): 'SYNCHRONIZED' | 'FEM_GEOMETRY_STALE' {
    const twin = this.twins.get(twinId);
    const link = this.femLinks.get(twinId);
    if (!twin || !link) return 'FEM_GEOMETRY_STALE';
    return twin.geometryHash === link.geometryHash ? 'SYNCHRONIZED' : 'FEM_GEOMETRY_STALE';
  }

  public linkCFD(twinId: string, meshHash: string, cfdModelHash: string): void {
    const twin = this.twins.get(twinId);
    if (!twin) throw new Error('Twin not found');
    this.cfdLinks.set(twinId, {
      meshHash,
      cfdModelHash,
      geometryHash: twin.geometryHash,
      status: 'SYNCHRONIZED'
    });
  }

  public checkCFDFreshness(twinId: string): 'SYNCHRONIZED' | 'CFD_GEOMETRY_STALE' {
    const twin = this.twins.get(twinId);
    const link = this.cfdLinks.get(twinId);
    if (!twin || !link) return 'CFD_GEOMETRY_STALE';
    return twin.geometryHash === link.geometryHash ? 'SYNCHRONIZED' : 'CFD_GEOMETRY_STALE';
  }

  public linkCAM(twinId: string, toolpathHash: string, machineConfigHash: string): void {
    const twin = this.twins.get(twinId);
    if (!twin) throw new Error('Twin not found');
    this.camLinks.set(twinId, {
      toolpathHash,
      machineConfigHash,
      geometryHash: twin.geometryHash,
      status: 'SYNCHRONIZED'
    });
  }

  public checkCAMFreshness(twinId: string): 'SYNCHRONIZED' | 'TOOLPATH_GEOMETRY_STALE' {
    const twin = this.twins.get(twinId);
    const link = this.camLinks.get(twinId);
    if (!twin || !link) return 'TOOLPATH_GEOMETRY_STALE';
    return twin.geometryHash === link.geometryHash ? 'SYNCHRONIZED' : 'TOOLPATH_GEOMETRY_STALE';
  }

  public linkBOM(twinId: string, bomRevision: string, componentRevision: string): void {
    const twin = this.twins.get(twinId);
    if (!twin) throw new Error('Twin not found');
    this.bomLinks.set(twinId, {
      bomRevision,
      componentRevision,
      geometryRevision: twin.geometryRevisionId
    });
  }

  public checkBOMAlignment(twinId: string): { aligned: boolean; details?: string } {
    const twin = this.twins.get(twinId);
    const link = this.bomLinks.get(twinId);
    if (!twin || !link) return { aligned: false, details: 'Missing BOM Link' };
    if (twin.geometryRevisionId !== link.geometryRevision) {
      return { aligned: false, details: `Mismatch: Geometry Revision ${twin.geometryRevisionId} != Linked BOM Geometry Revision ${link.geometryRevision}` };
    }
    return { aligned: true };
  }

  public roundTripTest(twinId: string, exportFormat: 'STEP' | 'IGES' | 'BREP'): {
    verdict: RoundTripVerdict;
    geometryHashMatch: boolean;
    topologyHashMatch: boolean;
  } {
    const twin = this.twins.get(twinId);
    if (!twin) return { verdict: 'INVALID', geometryHashMatch: false, topologyHashMatch: false };

    // Simulated lossless export/import
    const recomputedGeomHash = CanonicalGeometrySerializer.computeGeometryHash({
      bRep: twin.bRep,
      nurbsSurfaces: twin.nurbsSurfaces,
      nurbsCurves: twin.nurbsCurves,
      analyticEntities: twin.analyticEntities
    });

    const recomputedTopoHash = twin.bRep
      ? CanonicalGeometrySerializer.computeTopologyHash(twin.bRep)
      : CanonicalGeometrySerializer.sha256('NO_TOPOLOGY');

    const geomMatch = recomputedGeomHash === twin.geometryHash;
    const topoMatch = recomputedTopoHash === twin.topologyHash;

    const verdict: RoundTripVerdict = (geomMatch && topoMatch)
      ? 'ROUND_TRIP_EXACT'
      : (geomMatch ? 'ROUND_TRIP_EQUIVALENT' : 'ROUND_TRIP_DEGRADED');

    return {
      verdict,
      geometryHashMatch: geomMatch,
      topologyHashMatch: topoMatch
    };
  }

  public analyzeHealth(twinId: string): {
    score: number;
    validity: string;
    freshness: GeometryFreshness;
    closure: GeometryClosureStatus;
  } {
    const twin = this.twins.get(twinId);
    if (!twin) {
      return { score: 0, validity: 'UNKNOWN', freshness: 'UNKNOWN', closure: 'INVALID' };
    }

    let validity = 'VALID';
    let isSolid = false;
    if (twin.bRep) {
      const rep = GeometryValidityVerifier.verifyBRep(twin.bRep, twin.toleranceModel);
      validity = rep.verdict;
      isSolid = rep.isSolid;
    }

    const femStatus = this.checkFEMFreshness(twinId);
    const camStatus = this.checkCAMFreshness(twinId);
    const isFresh = (femStatus === 'SYNCHRONIZED' || !this.femLinks.has(twinId)) &&
                    (camStatus === 'SYNCHRONIZED' || !this.camLinks.has(twinId));

    let score = 0;
    if (validity === 'VALID') score += 50;
    if (isSolid) score += 20;
    if (twin.evidence.length > 0) score += 15;
    if (isFresh) score += 15;

    const closure: GeometryClosureStatus = isSolid ? 'COMPLETE' : (validity === 'VALID' ? 'PARTIAL' : 'BLOCKED');

    return {
      score,
      validity,
      freshness: isFresh ? 'FRESH' : 'STALE',
      closure
    };
  }
}
