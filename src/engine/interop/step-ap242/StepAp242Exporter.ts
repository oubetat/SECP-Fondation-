/**
 * SECP Industrial OS v2 — STEP AP242 Exporter
 * PATCH-034/PATCH-329B: STEP AP242 Exporter
 */

import { Solid, Face, Edge, Vertex } from '../../cad-kernel/topology/TopologyContracts';

export class StepAp242Exporter {
  private entityIndex = 100;
  private lines: string[] = [];
  private entityMap: Map<string, number> = new Map();

  public export(solids: Solid[], fileName: string, timestamp?: string): string {
    this.entityIndex = 100;
    this.lines = [];
    this.entityMap.clear();

    this.writeHeader(fileName, timestamp);
    this.lines.push('DATA;');

    for (const solid of solids) {
      this.writeSolid(solid);
    }

    this.lines.push('ENDSEC;');
    this.lines.push('END-ISO-10303-21;');

    return this.lines.join('\n');
  }

  private writeHeader(fileName: string, timestamp?: string) {
    this.lines.push('ISO-10303-21;');
    this.lines.push('HEADER;');
    this.lines.push("FILE_DESCRIPTION(('SECP Native AP242 Export'),'2;1');");
    this.lines.push(`FILE_NAME('${fileName}','${timestamp || '1970-01-01T00:00:00Z'}',('SECP Engineer'),('SECP Organization'),'SECP-STEP-v2.0','SECP CAD Kernel','');`);
    this.lines.push("FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF { 1 0 10303 242 1 1 1 }'));");
    this.lines.push('ENDSEC;');
  }

  private writeSolid(solid: Solid) {
    const shellId = this.writeShell(solid.outerShell);
    const id = this.nextId();
    this.lines.push(`#${id}=MANIFOLD_SOLID_BREP('${solid.id}',#${shellId});`);
    return id;
  }

  private writeShell(shell: any): number {
    if (!shell || !shell.orientedFaces) return this.nextId();
    const faceIds = shell.orientedFaces.map((of: any) => this.writeFace(of.face));
    const id = this.nextId();
    this.lines.push(`#${id}=CLOSED_SHELL('',(#${faceIds.join(',#')}));`);
    return id;
  }

  private writeFace(face: Face): number {
    if (this.entityMap.has(face.id)) return this.entityMap.get(face.id)!;

    const surfaceId = this.writeSurface(face.geometry);
    const loopId = this.writeLoop(face.outerLoop);
    const boundId = this.nextId();
    this.lines.push(`#${boundId}=FACE_BOUND('',#${loopId},.T.);`);

    const id = this.nextId();
    this.lines.push(`#${id}=ADVANCED_FACE('${face.id}',(#${boundId}),#${surfaceId},.T.);`);
    
    this.entityMap.set(face.id, id);
    return id;
  }

  private writeLoop(loop: any): number {
    if (!loop || !loop.orientedEdges) return this.nextId();
    const edgeIds = loop.orientedEdges.map((oe: any) => this.writeEdge(oe.edge));
    const id = this.nextId();
    this.lines.push(`#${id}=EDGE_LOOP('',(#${edgeIds.join(',#')}));`);
    return id;
  }

  private writeEdge(edge: Edge): number {
    if (this.entityMap.has(edge.id)) return this.entityMap.get(edge.id)!;

    const startVId = this.writeVertex(edge.startVertex);
    const endVId = this.writeVertex(edge.endVertex);
    const curveId = this.writeCurve(edge.geometry);
    
    const id = this.nextId();
    this.lines.push(`#${id}=EDGE_CURVE('${edge.id}',#${startVId},#${endVId},#${curveId},.T.);`);

    this.entityMap.set(edge.id, id);
    return id;
  }

  private writeVertex(vertex: Vertex): number {
    if (this.entityMap.has(vertex.id)) return this.entityMap.get(vertex.id)!;

    const ptId = this.nextId();
    const p = vertex.geometry as any;
    const ptIdWritten = this.writeCartesianPoint(p);
    
    const id = this.nextId();
    this.lines.push(`#${id}=VERTEX_POINT('${vertex.id}',#${ptIdWritten});`);

    this.entityMap.set(vertex.id, id);
    return id;
  }

  private writeSurface(surface: any): number {
    const id = this.nextId();
    if (!surface) {
      const placementId = this.writeAxis2Placement3D({x:0, y:0, z:0}, {i:0, j:0, k:1}, {i:1, j:0, k:0});
      this.lines.push(`#${id}=PLANE('',#${placementId});`);
      return id;
    }

    const type = surface.constructor?.name || surface.type || 'PLANE';

    if (type.includes('Plane') || type.includes('Planar') || type === 'PLANE') {
      const origin = surface.origin || { x: 0, y: 0, z: 0 };
      const normal = surface.normal || surface.axis || { i: 0, j: 0, k: 1 };
      const placementId = this.writeAxis2Placement3D(origin, normal, { i: 1, j: 0, k: 0 });
      this.lines.push(`#${id}=PLANE('',#${placementId});`);
    } else if (type.includes('Cylinder')) {
      const origin = surface.origin || surface.axis?.location || { x: 0, y: 0, z: 0 };
      const axis = surface.axis?.direction || surface.axis || { i: 0, j: 0, k: 1 };
      const radius = surface.radius ?? 1.0;
      const placementId = this.writeAxis2Placement3D(origin, axis, { i: 1, j: 0, k: 0 });
      this.lines.push(`#${id}=CYLINDRICAL_SURFACE('',#${placementId},${radius.toFixed(6)});`);
    } else if (type.includes('Sphere')) {
      const center = surface.center || { x: 0, y: 0, z: 0 };
      const radius = surface.radius ?? 1.0;
      const placementId = this.writeAxis2Placement3D(center, { i: 0, j: 0, k: 1 }, { i: 1, j: 0, k: 0 });
      this.lines.push(`#${id}=SPHERICAL_SURFACE('',#${placementId},${radius.toFixed(6)});`);
    } else {
      throw new Error(`STEP_EXPORT_ERROR: Unsupported surface type ${type} in AP242 export`);
    }
    return id;
  }

  private writeCurve(curve: any): number {
    const id = this.nextId();
    if (!curve) {
      const pntId = this.writeCartesianPoint({ x: 0, y: 0, z: 0 });
      const dirId = this.writeDirection({ i: 1, j: 0, k: 0 });
      const vectorId = this.nextId();
      this.lines.push(`#${vectorId}=VECTOR('',#${dirId},1.0);`);
      this.lines.push(`#${id}=LINE('',#${pntId},#${vectorId});`);
      return id;
    }

    const type = curve.constructor?.name || curve.type || (curve.radius !== undefined ? 'Circle' : 'Line');

    if (type.includes('Line') || type.includes('Linear') || type === 'LINE' || type.includes('Segment')) {
      const pnt = curve.origin || curve.pnt || { x: 0, y: 0, z: 0 };
      const dir = curve.direction || curve.dir || { i: 1, j: 0, k: 0 };
      const pntId = this.writeCartesianPoint(pnt);
      const dirId = this.writeDirection(dir);
      const vectorId = this.nextId();
      this.lines.push(`#${vectorId}=VECTOR('',#${dirId},1.0);`);
      this.lines.push(`#${id}=LINE('',#${pntId},#${vectorId});`);
    } else if (type.includes('Circle') || type.includes('Circ') || type === 'CIRCLE') {
      const center = curve.center || { x: 0, y: 0, z: 0 };
      const axis = curve.normal || curve.axis || { i: 0, j: 0, k: 1 };
      const radius = curve.radius ?? 1.0;
      const placementId = this.writeAxis2Placement3D(center, axis, { i: 1, j: 0, k: 0 });
      this.lines.push(`#${id}=CIRCLE('',#${placementId},${radius.toFixed(6)});`);
    } else {
      throw new Error(`STEP_EXPORT_ERROR: Unsupported curve type ${type} in AP242 export`);
    }
    return id;
  }

  private writeCartesianPoint(p: any): number {
    const id = this.nextId();
    const x = typeof p?.x === 'number' ? p.x : (typeof p?.i === 'number' ? p.i : 0);
    const y = typeof p?.y === 'number' ? p.y : (typeof p?.j === 'number' ? p.j : 0);
    const z = typeof p?.z === 'number' ? p.z : (typeof p?.k === 'number' ? p.k : 0);
    this.lines.push(`#${id}=CARTESIAN_POINT('',(${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}));`);
    return id;
  }

  private writeDirection(d: any): number {
    const id = this.nextId();
    const x = typeof d?.x === 'number' ? d.x : (typeof d?.i === 'number' ? d.i : 0);
    const y = typeof d?.y === 'number' ? d.y : (typeof d?.j === 'number' ? d.j : 0);
    const z = typeof d?.z === 'number' ? d.z : (typeof d?.k === 'number' ? d.k : (d ? 1 : 0));
    this.lines.push(`#${id}=DIRECTION('',(${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}));`);
    return id;
  }

  private writeAxis2Placement3D(location: any, axis: any, refDirection: any): number {
    const locId = this.writeCartesianPoint(location);
    const axisId = this.writeDirection(axis);
    const refDirId = this.writeDirection(refDirection);
    const id = this.nextId();
    this.lines.push(`#${id}=AXIS2_PLACEMENT_3D('',#${locId},#${axisId},#${refDirId});`);
    return id;
  }

  private nextId(): number {
    return this.entityIndex++;
  }

  public getEntityMap(): Map<string, number> {
    return this.entityMap;
  }
}
