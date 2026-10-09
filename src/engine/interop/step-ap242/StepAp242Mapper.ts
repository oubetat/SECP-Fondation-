import { EngineeringObjectType } from "../../identity/CanonicalEngineeringIdentity";
/**
 * SECP Industrial OS v2 — STEP AP242 Mapper
 * PATCH-034/PATCH-329B: STEP AP242 Geometry & B-Rep Topology Mapper
 */

import { StepParsedFile, StepEntity, StepLossReport } from './StepAp242Types';
import { isStepRef, getRefId } from './StepAp242Parser';
import { 
  TopoShape, TopoShapeEnum, Vertex, Edge, Loop, Face, Shell, Solid, Orientation 
} from '../../cad-kernel/topology/TopologyContracts';
import { BRepVertex, BRepEdge, BRepLoop, BRepFace, BRepShell, BRepSolid } from '../../cad-kernel/topology/BRepTopology';
import { Point, Curve, Surface } from '../../cad-kernel/geometry/GeometryContracts';
import { BRepPoint, BRepVector, BRepLine, BRepCircle, BRepPlane, BRepCylinder, BRepSphere } from '../../cad-kernel/geometry/BRepGeometry';
import { EngineeringIdentityFactory } from '../../identity/EngineeringIdentityFactory';

import { TopologyLineage, TopologyLineageEntry } from '../../cad-kernel/document/CADDocument';

export class StepAp242Mapper {
  private lossReports: StepLossReport[] = [];
  private entityCache: Map<number, any> = new Map();
  private topologyMap: Record<string, string> = {};

  public map(parsed: StepParsedFile): { model: Solid[]; lossReports: StepLossReport[]; topologyMap: TopologyLineage } {
    const solids: Solid[] = [];
    this.lossReports = [];
    this.entityCache.clear();
    this.topologyMap = {};

    // Find all MANIFOLD_SOLID_BREP
    for (const [id, entity] of Array.from(parsed.data.entities.entries())) {
      if (entity.type === 'MANIFOLD_SOLID_BREP') {
        try {
          const solid = this.mapSolid(entity, parsed);
          if (solid) solids.push(solid);
        } catch (e: any) {
          this.reportLoss('HIGH', `Failed to map Solid #${id}`, 'MANIFOLD_SOLID_BREP', 'Solid', String(e?.message || e));
        }
      }
    }

    const tMap: TopologyLineage = {
      version: 1,
      faceMap: {},
      edgeMap: {},
      vertexMap: {}
    };

    // Populate topologyMap from our internal collection
    for (const [stepId, topoId] of Object.entries(this.topologyMap)) {
      if (stepId.startsWith('face_')) {
        const key = `geom_${stepId.split('_')[1]}`;
        (tMap.faceMap as any)[key] = topoId;
      }
      else if (stepId.startsWith('edge_')) (tMap.edgeMap as any)[`geom_${stepId.split('_')[1]}`] = topoId;
      else if (stepId.startsWith('vertex_')) (tMap.vertexMap as any)[`geom_${stepId.split('_')[1]}`] = topoId;
      else (tMap as any)[stepId] = topoId;
    }

    return { model: solids, lossReports: this.lossReports, topologyMap: tMap };
  }

  private mapSolid(entity: StepEntity, parsed: StepParsedFile): Solid | null {
    const name = entity.parameters[0] || `solid_${entity.id}`;
    const shellRef = entity.parameters[1];
    const shellId = getRefId(shellRef);

    if (shellId === undefined) {
      throw new Error(`Invalid or missing Shell reference in Solid #${entity.id}`);
    }

    const shellEntity = parsed.data.entities.get(shellId);
    if (!shellEntity) {
      throw new Error(`Missing Shell reference #${shellId}`);
    }

    const outerShell = this.mapShell(shellEntity, parsed);
    if (!outerShell) return null;

    const solid = new BRepSolid(
      EngineeringIdentityFactory.createIdentity({
        objectType: EngineeringObjectType.BREP,
        projectId: typeof name === 'string' ? name : `solid_${entity.id}`,
        revisionId: "rev-01",
        createdBy: "system",
        seed: `solid_${entity.id}`,
        timestamp: "2026-01-01T00:00:00Z"
      }, {}).identityId,
      outerShell
    );

    return solid;
  }

  private mapShell(entity: StepEntity, parsed: StepParsedFile): Shell | null {
    if (this.entityCache.has(entity.id)) return this.entityCache.get(entity.id);

    const faceRefs = entity.parameters[1];
    const faceIds: number[] = Array.isArray(faceRefs)
      ? faceRefs.map(getRefId).filter((id): id is number => id !== undefined)
      : [];

    if (faceIds.length === 0) {
      throw new Error(`Shell #${entity.id} contains no valid face references`);
    }

    const orientedFaces = faceIds.map(fid => {
      const fe = parsed.data.entities.get(fid);
      if (!fe) throw new Error(`Missing Face reference #${fid}`);
      
      const face = this.mapFace(fe, parsed);
      if (!face) throw new Error(`Failed to map Face #${fid}`);

      // Check face orientation / sameSense from ADVANCED_FACE entity
      const sameSense = fe.parameters[3] !== false; // .T. is true, .F. is false
      const orientation = sameSense ? Orientation.FORWARD : Orientation.REVERSED;

      return { face, orientation };
    });

    const shell = new BRepShell(
      EngineeringIdentityFactory.createIdentity({
        objectType: EngineeringObjectType.BREP,
        projectId: `shell_${entity.id}`,
        revisionId: "rev-01",
        createdBy: "system",
        seed: `shell_${entity.id}`,
        timestamp: "2026-01-01T00:00:00Z"
      }, {}).identityId,
      orientedFaces
    );

    this.entityCache.set(entity.id, shell);
    return shell;
  }

  private mapFace(entity: StepEntity, parsed: StepParsedFile): Face | null {
    if (this.entityCache.has(entity.id)) return this.entityCache.get(entity.id);

    const name = entity.parameters[0];
    const boundRefs = entity.parameters[1];
    const surfaceRef = entity.parameters[2];

    const boundIds: number[] = Array.isArray(boundRefs)
      ? boundRefs.map(getRefId).filter((id): id is number => id !== undefined)
      : [];

    const surfaceId = getRefId(surfaceRef);
    if (surfaceId === undefined) {
      throw new Error(`Missing surface reference in Face #${entity.id}`);
    }

    const surfaceEntity = parsed.data.entities.get(surfaceId);
    if (!surfaceEntity) {
      throw new Error(`Missing surface entity #${surfaceId} for Face #${entity.id}`);
    }

    const surface = this.mapSurface(surfaceEntity, parsed);

    if (boundIds.length === 0) {
      throw new Error(`Face #${entity.id} has no boundary bounds`);
    }

    // Outer loop and inner loops
    const outerBoundEntity = parsed.data.entities.get(boundIds[0]);
    if (!outerBoundEntity) {
      throw new Error(`Missing outer bound entity #${boundIds[0]} for Face #${entity.id}`);
    }

    const outerLoop = this.mapLoop(outerBoundEntity, parsed);
    if (!outerLoop) {
      throw new Error(`Failed to map outer loop for Face #${entity.id}`);
    }

    const innerLoops: Loop[] = [];
    for (let i = 1; i < boundIds.length; i++) {
      const innerBoundEntity = parsed.data.entities.get(boundIds[i]);
      if (innerBoundEntity) {
        const innerLoop = this.mapLoop(innerBoundEntity, parsed);
        if (innerLoop) innerLoops.push(innerLoop);
      }
    }

    const isSha256 = (str: any) => typeof str === 'string' && /^[0-9a-f]{64}$/i.test(str);
    const faceId = isSha256(name) ? name : EngineeringIdentityFactory.createIdentity({
      objectType: EngineeringObjectType.BREP,
      projectId: typeof name === 'string' && name ? name : `face_${entity.id}`,
      revisionId: "rev-01",
      createdBy: "system",
      seed: `face_${entity.id}`,
      timestamp: "2026-01-01T00:00:00Z"
    }, {}).identityId;

    const face = new BRepFace(
      faceId,
      surface,
      outerLoop,
      innerLoops
    );

    this.topologyMap[`face_${entity.id}`] = face.id;
    this.entityCache.set(entity.id, face);
    return face;
  }

  private mapLoop(entity: StepEntity, parsed: StepParsedFile): Loop | null {
    if (entity.type === 'FACE_BOUND' || entity.type === 'FACE_OUTER_BOUND') {
      const loopRef = entity.parameters[1];
      const loopId = getRefId(loopRef);
      if (loopId === undefined) throw new Error(`Missing loop reference in bound #${entity.id}`);

      const loopEntity = parsed.data.entities.get(loopId);
      if (!loopEntity) throw new Error(`Missing loop entity #${loopId} for bound #${entity.id}`);
      return this.mapLoop(loopEntity, parsed);
    }

    const edgeRefs = entity.parameters[1];
    const edgeIds: number[] = Array.isArray(edgeRefs)
      ? edgeRefs.map(getRefId).filter((id): id is number => id !== undefined)
      : [];

    const orientedEdges = edgeIds.map(eid => {
      const ee = parsed.data.entities.get(eid);
      if (!ee) throw new Error(`Missing Edge reference #${eid}`);

      const edge = this.mapEdge(ee, parsed);
      if (!edge) throw new Error(`Failed to map Edge #${eid}`);

      // Check ORIENTED_EDGE orientation (.T. is FORWARD, .F. is REVERSED)
      let isForward = true;
      if (ee.type === 'ORIENTED_EDGE') {
        const orientParam = ee.parameters[4];
        if (orientParam === false) isForward = false;
      }

      return {
        edge,
        orientation: isForward ? Orientation.FORWARD : Orientation.REVERSED
      };
    });

    const loop = new BRepLoop(
      EngineeringIdentityFactory.createIdentity({
        objectType: EngineeringObjectType.BREP,
        projectId: `loop_${entity.id}`,
        revisionId: "rev-01",
        createdBy: "system",
        seed: `loop_${entity.id}`,
        timestamp: "2026-01-01T00:00:00Z"
      }, {}).identityId,
      orientedEdges
    );

    return loop;
  }

  private mapEdge(entity: StepEntity, parsed: StepParsedFile): Edge | null {
    if (entity.type === 'ORIENTED_EDGE') {
      const edgeRef = entity.parameters[3];
      const edgeId = getRefId(edgeRef);
      if (edgeId === undefined) throw new Error(`Missing edge_element reference in ORIENTED_EDGE #${entity.id}`);

      const edgeEntity = parsed.data.entities.get(edgeId);
      if (!edgeEntity) throw new Error(`Missing EDGE_CURVE entity #${edgeId}`);
      return this.mapEdge(edgeEntity, parsed);
    }

    const name = entity.parameters[0];
    const startVRef = entity.parameters[1];
    const endVRef = entity.parameters[2];
    const curveRef = entity.parameters[3];

    const startVId = getRefId(startVRef);
    const endVId = getRefId(endVRef);
    const curveId = getRefId(curveRef);

    if (startVId === undefined || endVId === undefined || curveId === undefined) {
      throw new Error(`Incomplete references in Edge #${entity.id}`);
    }

    const startVEntity = parsed.data.entities.get(startVId);
    const endVEntity = parsed.data.entities.get(endVId);
    const curveEntity = parsed.data.entities.get(curveId);

    if (!startVEntity || !endVEntity || !curveEntity) {
      throw new Error(`Missing vertex or curve entity for Edge #${entity.id}`);
    }

    const startVertex = this.mapVertex(startVEntity, parsed);
    const endVertex = this.mapVertex(endVEntity, parsed);
    const curve = this.mapCurve(curveEntity, parsed);

    if (!startVertex || !endVertex) throw new Error(`Failed vertex mapping for Edge #${entity.id}`);

    const isSha256 = (str: any) => typeof str === 'string' && /^[0-9a-f]{64}$/i.test(str);
    const edgeId = isSha256(name) ? name : EngineeringIdentityFactory.createIdentity({
      objectType: EngineeringObjectType.BREP,
      projectId: typeof name === 'string' && name ? name : `edge_${entity.id}`,
      revisionId: "rev-01",
      createdBy: "system",
      seed: `edge_${entity.id}`,
      timestamp: "2026-01-01T00:00:00Z"
    }, {}).identityId;

    const edge = new BRepEdge(
      edgeId,
      curve,
      startVertex,
      endVertex,
      1e-6
    );

    this.topologyMap[`edge_${entity.id}`] = edge.id;
    return edge;
  }

  private mapVertex(entity: StepEntity, parsed: StepParsedFile): Vertex | null {
    const name = entity.parameters[0];
    const pointRef = entity.parameters[1];
    const pointId = getRefId(pointRef);

    if (pointId === undefined) throw new Error(`Missing point reference in Vertex #${entity.id}`);

    const pointEntity = parsed.data.entities.get(pointId);
    if (!pointEntity) throw new Error(`Missing CARTESIAN_POINT entity #${pointId}`);

    const point: Point = this.mapPoint(pointEntity);

    const isSha256 = (str: any) => typeof str === 'string' && /^[0-9a-f]{64}$/i.test(str);
    const vertexId = isSha256(name) ? name : EngineeringIdentityFactory.createIdentity({
      objectType: EngineeringObjectType.BREP,
      projectId: typeof name === 'string' && name ? name : `vertex_${entity.id}`,
      revisionId: "rev-01",
      createdBy: "system",
      seed: `vertex_${entity.id}`,
      timestamp: "2026-01-01T00:00:00Z"
    }, {}).identityId;

    const vertex = new BRepVertex(
      vertexId,
      point,
      1e-6
    );

    this.topologyMap[`vertex_${entity.id}`] = vertex.id;
    return vertex;
  }

  private mapSurface(entity: StepEntity, parsed: StepParsedFile): Surface {
    if (this.entityCache.has(entity.id)) return this.entityCache.get(entity.id);

    let surface: Surface;
    switch (entity.type) {
      case 'PLANE': {
        const placementRef = entity.parameters[1];
        const placement = this.resolvePlacement(placementRef, parsed);
        surface = new BRepPlane(placement.location, placement.axis);
        break;
      }
      case 'CYLINDRICAL_SURFACE': {
        const placementRef = entity.parameters[1];
        const radius = parseFloat(entity.parameters[2]) || 1.0;
        const placement = this.resolvePlacement(placementRef, parsed);
        surface = new BRepCylinder({ location: placement.location, direction: placement.axis }, radius);
        break;
      }
      case 'SPHERICAL_SURFACE': {
        const placementRef = entity.parameters[1];
        const radius = parseFloat(entity.parameters[2]) || 1.0;
        const placement = this.resolvePlacement(placementRef, parsed);
        surface = new BRepSphere(placement.location, radius);
        break;
      }
      default:
        this.reportLoss('HIGH', `Unsupported surface type: ${entity.type}`, entity.type, 'Surface');
        throw new Error(`UNSUPPORTED_SURFACE: Surface type ${entity.type} is not supported in AP242 B-Rep mapping`);
    }

    this.entityCache.set(entity.id, surface);
    return surface;
  }

  private mapCurve(entity: StepEntity, parsed: StepParsedFile): Curve {
    if (this.entityCache.has(entity.id)) return this.entityCache.get(entity.id);

    let curve: Curve;
    switch (entity.type) {
      case 'LINE': {
        const pntRef = entity.parameters[1];
        const dirRef = entity.parameters[2];

        const pntId = getRefId(pntRef);
        const dirId = getRefId(dirRef);

        const pntEntity = pntId !== undefined ? parsed.data.entities.get(pntId) : null;
        const dirEntity = dirId !== undefined ? parsed.data.entities.get(dirId) : null;

        const pnt = pntEntity ? this.mapPoint(pntEntity) : { x: 0, y: 0, z: 0 };
        const dir = dirEntity ? this.mapVector(dirEntity, parsed) : { x: 1, y: 0, z: 0 };

        curve = new BRepLine(pnt, dir);
        break;
      }
      case 'CIRCLE': {
        const placementRef = entity.parameters[1];
        const radius = parseFloat(entity.parameters[2]) || 1.0;
        const placement = this.resolvePlacement(placementRef, parsed);
        curve = new BRepCircle(placement.location, placement.axis, radius);
        break;
      }
      default:
        this.reportLoss('HIGH', `Unsupported curve type: ${entity.type}`, entity.type, 'Curve');
        throw new Error(`UNSUPPORTED_CURVE: Curve type ${entity.type} is not supported in AP242 B-Rep mapping`);
    }

    this.entityCache.set(entity.id, curve);
    return curve;
  }

  /**
   * Helper to resolve placement parameters into location Point and axis Vector.
   * Handles AXIS2_PLACEMENT_3D, CARTESIAN_POINT, or direct point/axis references.
   */
  private resolvePlacement(placementRef: any, parsed: StepParsedFile): { location: Point; axis: BRepVector } {
    const placementId = getRefId(placementRef);
    if (placementId === undefined) {
      return { location: new BRepPoint(0, 0, 0), axis: new BRepVector(0, 0, 1) };
    }

    const entity = parsed.data.entities.get(placementId);
    if (!entity) {
      return { location: new BRepPoint(0, 0, 0), axis: new BRepVector(0, 0, 1) };
    }

    if (entity.type === 'AXIS2_PLACEMENT_3D' || entity.type === 'AXIS2_PLACEMENT_2D') {
      const locRef = entity.parameters[1];
      const axisRef = entity.parameters[2];

      const locId = getRefId(locRef);
      const axisId = getRefId(axisRef);

      const locEntity = locId !== undefined ? parsed.data.entities.get(locId) : null;
      const axisEntity = axisId !== undefined ? parsed.data.entities.get(axisId) : null;

      const location = locEntity ? this.mapPoint(locEntity) : new BRepPoint(0, 0, 0);
      const axis = axisEntity ? this.mapVector(axisEntity, parsed) : new BRepVector(0, 0, 1);

      return { location, axis };
    } else if (entity.type === 'CARTESIAN_POINT') {
      const location = this.mapPoint(entity);
      return { location, axis: new BRepVector(0, 0, 1) };
    }

    return { location: new BRepPoint(0, 0, 0), axis: new BRepVector(0, 0, 1) };
  }

  private mapPoint(entity: StepEntity): Point {
    if (!entity || entity.type !== 'CARTESIAN_POINT') {
      return new BRepPoint(0, 0, 0);
    }
    const coords = entity.parameters[1];
    if (Array.isArray(coords) && coords.length >= 3) {
      return new BRepPoint(parseFloat(coords[0]) || 0, parseFloat(coords[1]) || 0, parseFloat(coords[2]) || 0);
    }
    return new BRepPoint(0, 0, 0);
  }

  private mapVector(entity: StepEntity, parsed: StepParsedFile): BRepVector {
    if (!entity) return new BRepVector(0, 0, 1);

    if (entity.type === 'DIRECTION') {
      const coords = entity.parameters[1];
      if (Array.isArray(coords) && coords.length >= 3) {
        return new BRepVector(parseFloat(coords[0]) || 0, parseFloat(coords[1]) || 0, parseFloat(coords[2]) || 0);
      }
    } else if (entity.type === 'VECTOR') {
      const dirRef = entity.parameters[1];
      const mag = parseFloat(entity.parameters[2]) || 1.0;
      const dirId = getRefId(dirRef);

      if (dirId !== undefined) {
        const dirEntity = parsed.data.entities.get(dirId);
        if (dirEntity) {
          const baseVec = this.mapVector(dirEntity, parsed);
          return new BRepVector(baseVec.i * mag, baseVec.j * mag, baseVec.k * mag);
        }
      }
    }

    return new BRepVector(0, 0, 1);
  }

  private reportLoss(severity: any, reason: string, source: string, target: string, details?: string) {
    this.lossReports.push({
      status: 'LOST',
      reason: `${reason}${details ? `: ${details}` : ''}`,
      sourceEntity: source,
      targetEntity: target,
      severity
    });
  }
}
