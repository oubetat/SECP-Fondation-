// SECP Industrial OS v2 — Canonical Geometry Serializer & Hash Engine
import * as crypto from 'crypto';
import {
  Vector3D,
  GeometryCoordinateSystem,
  GeometryToleranceModel,
  VertexEntity,
  EdgeEntity,
  LoopEntity,
  FaceEntity,
  ShellEntity,
  SolidEntity,
  BRepTwinDefinition,
  NURBSCurveDefinition,
  NURBSSurfaceDefinition,
  AnalyticGeometryDefinition,
  AABB,
  MassProperties,
  GeometryType,
  GeometryEvidence
} from './types';

export class CanonicalGeometrySerializer {
  public static sha256(input: string): string {
    return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
  }

  public static canonicalizeNumber(n: number | undefined | null, precision: number = 8): string {
    if (n === undefined || n === null || isNaN(n)) return '0.00000000';
    if (Math.abs(n) < 1e-12) return '0.00000000';
    return Number(n.toFixed(precision)).toFixed(precision);
  }

  public static canonicalizeVector(v: Vector3D, precision: number = 8): string {
    return `[${this.canonicalizeNumber(v.x, precision)},${this.canonicalizeNumber(v.y, precision)},${this.canonicalizeNumber(v.z, precision)}]`;
  }

  public static computeCoordinateSystemHash(cs: GeometryCoordinateSystem): string {
    const raw = [
      'ORIGIN:' + this.canonicalizeVector(cs.origin),
      'BASIS_X:' + this.canonicalizeVector(cs.basisX),
      'BASIS_Y:' + this.canonicalizeVector(cs.basisY),
      'BASIS_Z:' + this.canonicalizeVector(cs.basisZ),
      'UNITS:' + cs.units,
      'HANDEDNESS:' + cs.handedness,
      'CONVERSION:' + this.canonicalizeNumber(cs.conversionFactorToCanonical ?? 1.0)
    ].join('|');
    return this.sha256(raw);
  }

  public static computeToleranceModelHash(tol: GeometryToleranceModel): string {
    const raw = [
      'VERTEX_TOL:' + this.canonicalizeNumber(tol.vertexTolerance),
      'EDGE_TOL:' + this.canonicalizeNumber(tol.edgeTolerance),
      'FACE_TOL:' + this.canonicalizeNumber(tol.faceTolerance),
      'MODEL_TOL:' + this.canonicalizeNumber(tol.modelTolerance),
      'ANGULAR_TOL:' + this.canonicalizeNumber(tol.angularTolerance),
      'VERSION:' + tol.version
    ].join('|');
    return this.sha256(raw);
  }

  public static computeVertexHash(vertex: VertexEntity): string {
    const raw = [
      'ID:' + vertex.vertexId,
      'PT:' + this.canonicalizeVector(vertex.point),
      'TOL:' + this.canonicalizeNumber(vertex.tolerance)
    ].join('|');
    return this.sha256(raw);
  }

  public static computeEdgeHash(edge: EdgeEntity): string {
    const raw = [
      'ID:' + edge.edgeId,
      'CURVE_TYPE:' + edge.curveType,
      'CURVE_DEF:' + edge.curveDefinitionHash,
      'START:' + edge.startVertexId,
      'END:' + edge.endVertexId,
      'ORIENTATION:' + edge.orientation,
      'LEN:' + (edge.length ? this.canonicalizeNumber(edge.length) : 'NONE')
    ].join('|');
    return this.sha256(raw);
  }

  public static computeLoopHash(loop: LoopEntity): string {
    const raw = [
      'ID:' + loop.loopId,
      'EDGES:' + loop.edgeIds.join(','),
      'IS_OUTER:' + loop.isOuter,
      'IS_CLOSED:' + loop.isClosed
    ].join('|');
    return this.sha256(raw);
  }

  public static computeFaceHash(face: FaceEntity): string {
    const sortedInner = [...face.innerLoopIds].sort();
    const raw = [
      'ID:' + face.faceId,
      'SURFACE_TYPE:' + face.surfaceType,
      'SURFACE_DEF:' + face.surfaceDefinitionHash,
      'OUTER_LOOP:' + face.outerLoopId,
      'INNER_LOOPS:' + sortedInner.join(','),
      'ORIENTATION:' + face.orientation,
      'BOUNDARY:' + face.boundaryHash,
      'AREA:' + (face.area ? this.canonicalizeNumber(face.area) : 'NONE')
    ].join('|');
    return this.sha256(raw);
  }

  public static computeNURBSCurveHash(curve: NURBSCurveDefinition): string {
    const cpStr = curve.controlPoints.map(p => this.canonicalizeVector(p)).join(';');
    const knotsStr = curve.knots.map(k => this.canonicalizeNumber(k)).join(',');
    const weightsStr = curve.weights.map(w => this.canonicalizeNumber(w)).join(',');
    const multStr = curve.multiplicities.join(',');
    const domainStr = `[${this.canonicalizeNumber(curve.parameterDomain[0])},${this.canonicalizeNumber(curve.parameterDomain[1])}]`;

    const raw = [
      'NURBS_CURVE',
      'DEGREE:' + curve.degree,
      'KNOTS:' + knotsStr,
      'WEIGHTS:' + weightsStr,
      'CONTROL_POINTS:' + cpStr,
      'MULTIPLICITIES:' + multStr,
      'RATIONAL:' + curve.isRational,
      'DOMAIN:' + domainStr
    ].join('|');

    return this.sha256(raw);
  }

  public static computeNURBSSurfaceHash(surf: NURBSSurfaceDefinition): string {
    const cpRows = surf.controlPoints.map(row => row.map(p => this.canonicalizeVector(p)).join(',')).join(';');
    const weightRows = surf.weights.map(row => row.map(w => this.canonicalizeNumber(w)).join(',')).join(';');
    const knotsUStr = surf.knotsU.map(k => this.canonicalizeNumber(k)).join(',');
    const knotsVStr = surf.knotsV.map(k => this.canonicalizeNumber(k)).join(',');
    const multUStr = surf.multiplicitiesU.join(',');
    const multVStr = surf.multiplicitiesV.join(',');
    const domU = `[${this.canonicalizeNumber(surf.parameterDomainU[0])},${this.canonicalizeNumber(surf.parameterDomainU[1])}]`;
    const domV = `[${this.canonicalizeNumber(surf.parameterDomainV[0])},${this.canonicalizeNumber(surf.parameterDomainV[1])}]`;

    const raw = [
      'NURBS_SURFACE',
      'DEGREE_U:' + surf.degreeU,
      'DEGREE_V:' + surf.degreeV,
      'KNOTS_U:' + knotsUStr,
      'KNOTS_V:' + knotsVStr,
      'WEIGHTS:' + weightRows,
      'CONTROL_POINTS:' + cpRows,
      'MULT_U:' + multUStr,
      'MULT_V:' + multVStr,
      'RATIONAL:' + surf.isRational,
      'DOMAIN_U:' + domU,
      'DOMAIN_V:' + domV
    ].join('|');

    return this.sha256(raw);
  }

  public static computeAnalyticHash(geom: AnalyticGeometryDefinition): string {
    const raw = [
      'ANALYTIC_TYPE:' + geom.type,
      'ORIGIN:' + this.canonicalizeVector(geom.origin),
      'AXIS:' + this.canonicalizeVector(geom.axis),
      'REF_DIR:' + (geom.refDirection ? this.canonicalizeVector(geom.refDirection) : 'NONE'),
      'RADIUS:' + (geom.radius !== undefined ? this.canonicalizeNumber(geom.radius) : 'NONE'),
      'MAJOR_RADIUS:' + (geom.majorRadius !== undefined ? this.canonicalizeNumber(geom.majorRadius) : 'NONE'),
      'MINOR_RADIUS:' + (geom.minorRadius !== undefined ? this.canonicalizeNumber(geom.minorRadius) : 'NONE'),
      'SEMI_ANGLE:' + (geom.semiAngle !== undefined ? this.canonicalizeNumber(geom.semiAngle) : 'NONE'),
      'ORIENTATION:' + geom.orientation,
      'DOMAIN:' + (geom.parameterDomain ? `[${this.canonicalizeNumber(geom.parameterDomain[0])},${this.canonicalizeNumber(geom.parameterDomain[1])}]` : 'NONE')
    ].join('|');
    return this.sha256(raw);
  }

  private static cmpStr(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  public static computeTopologyHash(brep: BRepTwinDefinition): string {
    // Topological connectivity: Vertex IDs in Edges, Edge IDs in Loops, Loop IDs in Faces, Face IDs in Shells, Shell IDs in Solids
    const sortedEdges = [...brep.edges].sort((a, b) => this.cmpStr(a.edgeId, b.edgeId)).map(e => `${e.edgeId}:${e.startVertexId}->${e.endVertexId}(${e.orientation})`);
    const sortedLoops = [...brep.loops].sort((a, b) => this.cmpStr(a.loopId, b.loopId)).map(l => `${l.loopId}:[${l.edgeIds.join(',')}]`);
    const sortedFaces = [...brep.faces].sort((a, b) => this.cmpStr(a.faceId, b.faceId)).map(f => `${f.faceId}:OUT(${f.outerLoopId}),INN([${[...f.innerLoopIds].sort((x, y) => this.cmpStr(x, y)).join(',')}])`);
    const sortedShells = [...brep.shells].sort((a, b) => this.cmpStr(a.shellId, b.shellId)).map(s => `${s.shellId}:[${[...s.faceIds].sort((x, y) => this.cmpStr(x, y)).join(',')}]`);
    const sortedSolids = [...brep.solids].sort((a, b) => this.cmpStr(a.solidId, b.solidId)).map(sol => `${sol.solidId}:OUT(${sol.outerShellId}),VOID([${[...sol.voidShellIds].sort((x, y) => this.cmpStr(x, y)).join(',')}]`);

    const raw = [
      'TOPOLOGY_STRUCTURE',
      'EDGES:' + sortedEdges.join('|'),
      'LOOPS:' + sortedLoops.join('|'),
      'FACES:' + sortedFaces.join('|'),
      'SHELLS:' + sortedShells.join('|'),
      'SOLIDS:' + sortedSolids.join('|')
    ].join('===');

    return this.sha256(raw);
  }

  public static computeGeometryHash(params: {
    bRep?: BRepTwinDefinition;
    nurbsSurfaces?: NURBSSurfaceDefinition[];
    nurbsCurves?: NURBSCurveDefinition[];
    analyticEntities?: AnalyticGeometryDefinition[];
  }): string {
    const parts: string[] = [];

    if (params.bRep) {
      // Sort vertices canonicalized by ID
      const sortedVertices = [...params.bRep.vertices]
        .sort((a, b) => this.cmpStr(a.vertexId, b.vertexId))
        .map(v => this.computeVertexHash(v));
      parts.push('BREP_VERTICES:' + sortedVertices.join(';'));

      const sortedFaces = [...params.bRep.faces]
        .sort((a, b) => this.cmpStr(a.faceId, b.faceId))
        .map(f => this.computeFaceHash(f));
      parts.push('BREP_FACES:' + sortedFaces.join(';'));
    }

    if (params.nurbsSurfaces && params.nurbsSurfaces.length > 0) {
      const sortedNurbsSurfaces = [...params.nurbsSurfaces]
        .sort((a, b) => this.cmpStr(a.surfaceId, b.surfaceId))
        .map(s => this.computeNURBSSurfaceHash(s));
      parts.push('NURBS_SURFACES:' + sortedNurbsSurfaces.join(';'));
    }

    if (params.nurbsCurves && params.nurbsCurves.length > 0) {
      const sortedNurbsCurves = [...params.nurbsCurves]
        .sort((a, b) => this.cmpStr(a.curveId, b.curveId))
        .map(c => this.computeNURBSCurveHash(c));
      parts.push('NURBS_CURVES:' + sortedNurbsCurves.join(';'));
    }

    if (params.analyticEntities && params.analyticEntities.length > 0) {
      const sortedAnalytic = [...params.analyticEntities]
        .sort((a, b) => this.cmpStr(a.entityId, b.entityId))
        .map(ae => this.computeAnalyticHash(ae));
      parts.push('ANALYTIC:' + sortedAnalytic.join(';'));
    }

    return this.sha256(parts.join('###'));
  }

  public static computeAABBFromVertices(vertices: VertexEntity[]): AABB {
    if (vertices.length === 0) {
      return {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
        center: { x: 0, y: 0, z: 0 },
        extents: { x: 0, y: 0, z: 0 }
      };
    }

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const v of vertices) {
      if (v.point.x < minX) minX = v.point.x;
      if (v.point.y < minY) minY = v.point.y;
      if (v.point.z < minZ) minZ = v.point.z;

      if (v.point.x > maxX) maxX = v.point.x;
      if (v.point.y > maxY) maxY = v.point.y;
      if (v.point.z > maxZ) maxZ = v.point.z;
    }

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
      center: {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        z: (minZ + maxZ) / 2
      },
      extents: {
        x: maxX - minX,
        y: maxY - minY,
        z: maxZ - minZ
      }
    };
  }

  public static computeGeometryRootHash(params: {
    geometryHash: string;
    topologyHash: string;
    revisionHash: string;
    coordinateSystemHash: string;
    toleranceHash: string;
    configurationHash: string;
    evidenceHash: string;
  }): string {
    const raw = [
      'GEOMETRY_HASH:' + params.geometryHash,
      'TOPOLOGY_HASH:' + params.topologyHash,
      'REVISION_HASH:' + params.revisionHash,
      'COORDINATE_HASH:' + params.coordinateSystemHash,
      'TOLERANCE_HASH:' + params.toleranceHash,
      'CONFIGURATION_HASH:' + params.configurationHash,
      'EVIDENCE_HASH:' + params.evidenceHash
    ].join('||');

    return this.sha256(raw);
  }
}
