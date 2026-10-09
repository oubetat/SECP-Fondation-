/**
 * SECP CAD Kernel — Direct Modeling Engine
 * Phase 2 (PATCH-029)
 */

import {
  TopoShape,
  TopoShapeEnum,
  Solid,
  Shell,
  Face,
  Loop,
  Edge,
  Vertex,
  OrientedFace,
  OrientedEdge,
  Orientation
} from '../topology/TopologyContracts';
import { Point } from '../geometry/GeometryContracts';
import { BRepValidator } from '../brep/BRepValidator';
import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';
import { DirectEdit } from './DirectEdit';

export interface DirectEditExecutionResult {
  updatedShape: TopoShape;
  affectedTopologyIds: string[];
  beforeGeometryHash: string;
  afterGeometryHash: string;
  beforeTopologyHash: string;
  afterTopologyHash: string;
  diagnostics: string[];
  status: 'SUCCESS' | 'FAILED' | 'UNSUPPORTED';
}

export class DirectModelingEngine {
  private static validator = new BRepValidator();

  /**
   * Applies a real direct editing operation to a B-Rep shape.
   */
  public static applyDirectEdit(
    shape: TopoShape,
    edit: DirectEdit,
    tolerance: number = 1e-7
  ): DirectEditExecutionResult {
    const diagnostics: string[] = [];

    // 1. Calculate hashes before operation
    const beforeGeometry = this.extractGeometryState(shape);
    const beforeTopology = this.extractTopologyState(shape);
    const beforeGeometryHash = EngineeringHashChain.computeCanonicalHash(beforeGeometry).canonicalHash;
    const beforeTopologyHash = EngineeringHashChain.computeCanonicalHash(beforeTopology).canonicalHash;

    // 2. Validate input parameters
    if (!this.validateEditParameters(edit, diagnostics)) {
      return {
        updatedShape: shape,
        affectedTopologyIds: [],
        beforeGeometryHash,
        afterGeometryHash: beforeGeometryHash,
        beforeTopologyHash,
        afterTopologyHash: beforeTopologyHash,
        diagnostics,
        status: 'FAILED'
      };
    }

    // 3. Clone shape to preserve transactional safety
    const clonedShape = this.cloneShape(shape);

    // 4. Find target entities
    const entityMap = this.collectEntities(clonedShape);
    const validShapeTargets = edit.targetEntityIds.filter(id => entityMap.has(id));
    if (validShapeTargets.length === 0) {
      diagnostics.push(`Target entities not found in B-Rep shape: ${edit.targetEntityIds.join(', ')}`);
      return {
        updatedShape: shape,
        affectedTopologyIds: [],
        beforeGeometryHash,
        afterGeometryHash: beforeGeometryHash,
        beforeTopologyHash,
        afterTopologyHash: beforeTopologyHash,
        diagnostics,
        status: 'FAILED'
      };
    }

    // 5. Execute specific operation
    let affectedIds: string[] = [];
    let success = false;

    try {
      switch (edit.operation) {
        case 'MOVE_FACE':
          affectedIds = this.executeMoveFace(clonedShape, edit, entityMap, diagnostics);
          success = affectedIds.length > 0 || this.isNoOpEdit(edit);
          break;
        case 'OFFSET_FACE':
          affectedIds = this.executeOffsetFace(clonedShape, edit, entityMap, diagnostics);
          success = affectedIds.length > 0 || this.isNoOpEdit(edit);
          break;
        case 'DELETE_FACE':
          affectedIds = this.executeDeleteFace(clonedShape, edit, entityMap, diagnostics);
          success = affectedIds.length > 0;
          break;
        case 'REPLACE_FACE':
          affectedIds = this.executeReplaceFace(clonedShape, edit, entityMap, diagnostics);
          success = affectedIds.length > 0;
          break;
        case 'MOVE_VERTEX':
          affectedIds = this.executeMoveVertex(clonedShape, edit, entityMap, diagnostics);
          success = affectedIds.length > 0 || this.isNoOpEdit(edit);
          break;
        case 'MOVE_EDGE':
          affectedIds = this.executeMoveEdge(clonedShape, edit, entityMap, diagnostics);
          success = affectedIds.length > 0 || this.isNoOpEdit(edit);
          break;
        case 'TRANSFORM_BODY':
          affectedIds = this.executeTransformBody(clonedShape, edit, entityMap, diagnostics);
          success = affectedIds.length > 0 || this.isNoOpEdit(edit);
          break;
        case 'TRANSFORM_FACE_SET':
          affectedIds = this.executeTransformFaceSet(clonedShape, edit, entityMap, diagnostics);
          success = affectedIds.length > 0 || this.isNoOpEdit(edit);
          break;
        default:
          diagnostics.push(`Unsupported direct operation type: ${edit.operation}`);
          return {
            updatedShape: shape,
            affectedTopologyIds: [],
            beforeGeometryHash,
            afterGeometryHash: beforeGeometryHash,
            beforeTopologyHash,
            afterTopologyHash: beforeTopologyHash,
            diagnostics,
            status: 'UNSUPPORTED'
          };
      }
    } catch (err: any) {
      diagnostics.push(`Direct edit execution exception: ${err?.message || String(err)}`);
      return {
        updatedShape: shape,
        affectedTopologyIds: [],
        beforeGeometryHash,
        afterGeometryHash: beforeGeometryHash,
        beforeTopologyHash,
        afterTopologyHash: beforeTopologyHash,
        diagnostics,
        status: 'FAILED'
      };
    }

    if (!success && diagnostics.length > 0) {
      return {
        updatedShape: shape,
        affectedTopologyIds: [],
        beforeGeometryHash,
        afterGeometryHash: beforeGeometryHash,
        beforeTopologyHash,
        afterTopologyHash: beforeTopologyHash,
        diagnostics,
        status: 'FAILED'
      };
    }

    // 6. Validate updated B-Rep
    const validation = this.validator.validate(clonedShape);
    if (validation.status !== 'VALID') {
      diagnostics.push(`B-Rep validation failed after direct edit: ${validation.diagnostics.map(d => d.message).join('; ')}`);
      return {
        updatedShape: shape,
        affectedTopologyIds: affectedIds,
        beforeGeometryHash,
        afterGeometryHash: beforeGeometryHash,
        beforeTopologyHash,
        afterTopologyHash: beforeTopologyHash,
        diagnostics,
        status: 'FAILED'
      };
    }

    // 7. Calculate hashes after operation
    const afterGeometry = this.extractGeometryState(clonedShape);
    const afterTopology = this.extractTopologyState(clonedShape);
    const afterGeometryHash = EngineeringHashChain.computeCanonicalHash(afterGeometry).canonicalHash;
    const afterTopologyHash = EngineeringHashChain.computeCanonicalHash(afterTopology).canonicalHash;

    return {
      updatedShape: clonedShape,
      affectedTopologyIds: affectedIds,
      beforeGeometryHash,
      afterGeometryHash,
      beforeTopologyHash,
      afterTopologyHash,
      diagnostics,
      status: 'SUCCESS'
    };
  }

  private static validateEditParameters(edit: DirectEdit, diagnostics: string[]): boolean {
    if (!edit.targetEntityIds || edit.targetEntityIds.length === 0) {
      diagnostics.push('Direct edit requires at least one target entity ID');
      return false;
    }

    if (edit.parameters) {
      for (const [key, val] of Object.entries(edit.parameters)) {
        if (typeof val === 'number' && !Number.isFinite(val)) {
          diagnostics.push(`Parameter '${key}' contains non-finite numeric value: ${val}`);
          return false;
        }
      }
    }

    return true;
  }

  private static isNoOpEdit(edit: DirectEdit): boolean {
    const p = edit.parameters || {};
    if (edit.operation === 'MOVE_FACE' || edit.operation === 'MOVE_VERTEX' || edit.operation === 'MOVE_EDGE' || edit.operation === 'TRANSFORM_BODY') {
      const dx = p.dx ?? p.x ?? 0;
      const dy = p.dy ?? p.y ?? 0;
      const dz = p.dz ?? p.z ?? 0;
      return dx === 0 && dy === 0 && dz === 0;
    }
    if (edit.operation === 'OFFSET_FACE') {
      return (p.distance ?? p.offset ?? 0) === 0;
    }
    return false;
  }

  private static executeMoveFace(
    shape: TopoShape,
    edit: DirectEdit,
    entityMap: Map<string, TopoShape>,
    diagnostics: string[]
  ): string[] {
    const p = edit.parameters || {};
    const dx = p.dx ?? p.x ?? 0;
    const dy = p.dy ?? p.y ?? 0;
    const dz = p.dz ?? p.z ?? 0;

    const affectedVertices = new Set<Vertex>();
    const affectedIds = new Set<string>();

    for (const targetId of edit.targetEntityIds) {
      const entity = entityMap.get(targetId);
      if (entity && entity.shapeType === TopoShapeEnum.FACE) {
        const face = entity as Face;
        affectedIds.add(face.id);
        this.collectFaceVertices(face, affectedVertices);
      }
    }

    for (const v of affectedVertices) {
      v.geometry.x += dx;
      v.geometry.y += dy;
      v.geometry.z += dz;
      affectedIds.add(v.id);
    }

    return Array.from(affectedIds);
  }

  private static executeOffsetFace(
    shape: TopoShape,
    edit: DirectEdit,
    entityMap: Map<string, TopoShape>,
    diagnostics: string[]
  ): string[] {
    const p = edit.parameters || {};
    const distance = p.distance ?? p.offset ?? 0;

    const affectedVertices = new Set<Vertex>();
    const affectedIds = new Set<string>();

    for (const targetId of edit.targetEntityIds) {
      const entity = entityMap.get(targetId);
      if (entity && entity.shapeType === TopoShapeEnum.FACE) {
        const face = entity as Face;
        affectedIds.add(face.id);
        
        // Calculate face normal approximation or offset vector
        const normal = this.computeFaceNormal(face);
        const dx = normal.x * distance;
        const dy = normal.y * distance;
        const dz = normal.z * distance;

        const faceVertices = new Set<Vertex>();
        this.collectFaceVertices(face, faceVertices);

        for (const v of faceVertices) {
          v.geometry.x += dx;
          v.geometry.y += dy;
          v.geometry.z += dz;
          affectedVertices.add(v);
          affectedIds.add(v.id);
        }
      }
    }

    return Array.from(affectedIds);
  }

  private static executeDeleteFace(
    shape: TopoShape,
    edit: DirectEdit,
    entityMap: Map<string, TopoShape>,
    diagnostics: string[]
  ): string[] {
    const targetSet = new Set(edit.targetEntityIds);
    const affectedIds: string[] = [];

    if (shape.shapeType === TopoShapeEnum.SOLID) {
      const solid = shape as Solid;
      const initialFaceCount = solid.outerShell.orientedFaces.length;
      solid.outerShell.orientedFaces = solid.outerShell.orientedFaces.filter(of => {
        if (targetSet.has(of.face.id)) {
          affectedIds.push(of.face.id);
          return false;
        }
        return true;
      });

      if (solid.outerShell.orientedFaces.length === initialFaceCount) {
        diagnostics.push('No matching faces found to delete');
      }
    } else if (shape.shapeType === TopoShapeEnum.SHELL) {
      const shell = shape as Shell;
      shell.orientedFaces = shell.orientedFaces.filter(of => {
        if (targetSet.has(of.face.id)) {
          affectedIds.push(of.face.id);
          return false;
        }
        return true;
      });
    }

    return affectedIds;
  }

  private static executeReplaceFace(
    shape: TopoShape,
    edit: DirectEdit,
    entityMap: Map<string, TopoShape>,
    diagnostics: string[]
  ): string[] {
    const affectedIds: string[] = [];
    const newSurface = edit.parameters?.newSurface;

    for (const targetId of edit.targetEntityIds) {
      const entity = entityMap.get(targetId);
      if (entity && entity.shapeType === TopoShapeEnum.FACE) {
        const face = entity as Face;
        if (newSurface) {
          face.geometry = newSurface;
        }
        affectedIds.push(face.id);
      }
    }

    return affectedIds;
  }

  private static executeMoveVertex(
    shape: TopoShape,
    edit: DirectEdit,
    entityMap: Map<string, TopoShape>,
    diagnostics: string[]
  ): string[] {
    const p = edit.parameters || {};
    const dx = p.dx ?? p.x ?? 0;
    const dy = p.dy ?? p.y ?? 0;
    const dz = p.dz ?? p.z ?? 0;

    const affectedIds: string[] = [];

    for (const targetId of edit.targetEntityIds) {
      const entity = entityMap.get(targetId);
      if (entity && entity.shapeType === TopoShapeEnum.VERTEX) {
        const v = entity as Vertex;
        v.geometry.x += dx;
        v.geometry.y += dy;
        v.geometry.z += dz;
        affectedIds.push(v.id);
      }
    }

    return affectedIds;
  }

  private static executeMoveEdge(
    shape: TopoShape,
    edit: DirectEdit,
    entityMap: Map<string, TopoShape>,
    diagnostics: string[]
  ): string[] {
    const p = edit.parameters || {};
    const dx = p.dx ?? p.x ?? 0;
    const dy = p.dy ?? p.y ?? 0;
    const dz = p.dz ?? p.z ?? 0;

    const affectedIds = new Set<string>();

    for (const targetId of edit.targetEntityIds) {
      const entity = entityMap.get(targetId);
      if (entity && entity.shapeType === TopoShapeEnum.EDGE) {
        const edge = entity as Edge;
        affectedIds.add(edge.id);

        if (edge.startVertex) {
          edge.startVertex.geometry.x += dx;
          edge.startVertex.geometry.y += dy;
          edge.startVertex.geometry.z += dz;
          affectedIds.add(edge.startVertex.id);
        }
        if (edge.endVertex) {
          edge.endVertex.geometry.x += dx;
          edge.endVertex.geometry.y += dy;
          edge.endVertex.geometry.z += dz;
          affectedIds.add(edge.endVertex.id);
        }
      }
    }

    return Array.from(affectedIds);
  }

  private static executeTransformBody(
    shape: TopoShape,
    edit: DirectEdit,
    entityMap: Map<string, TopoShape>,
    diagnostics: string[]
  ): string[] {
    const p = edit.parameters || {};
    const dx = p.dx ?? p.x ?? 0;
    const dy = p.dy ?? p.y ?? 0;
    const dz = p.dz ?? p.z ?? 0;

    const allVertices = new Set<Vertex>();
    this.collectAllVertices(shape, allVertices);

    const affectedIds: string[] = [shape.id];
    for (const v of allVertices) {
      v.geometry.x += dx;
      v.geometry.y += dy;
      v.geometry.z += dz;
      affectedIds.push(v.id);
    }

    return affectedIds;
  }

  private static executeTransformFaceSet(
    shape: TopoShape,
    edit: DirectEdit,
    entityMap: Map<string, TopoShape>,
    diagnostics: string[]
  ): string[] {
    return this.executeMoveFace(shape, edit, entityMap, diagnostics);
  }

  private static collectFaceVertices(face: Face, result: Set<Vertex>): void {
    if (!face.outerLoop) return;
    for (const oe of face.outerLoop.orientedEdges) {
      if (oe.edge.startVertex) result.add(oe.edge.startVertex);
      if (oe.edge.endVertex) result.add(oe.edge.endVertex);
    }
    if (face.innerLoops) {
      for (const loop of face.innerLoops) {
        for (const oe of loop.orientedEdges) {
          if (oe.edge.startVertex) result.add(oe.edge.startVertex);
          if (oe.edge.endVertex) result.add(oe.edge.endVertex);
        }
      }
    }
  }

  private static collectAllVertices(shape: TopoShape, result: Set<Vertex>): void {
    const entityMap = this.collectEntities(shape);
    for (const entity of entityMap.values()) {
      if (entity.shapeType === TopoShapeEnum.VERTEX) {
        result.add(entity as Vertex);
      }
    }
  }

  private static computeFaceNormal(face: Face): { x: number; y: number; z: number } {
    const vertices: Vertex[] = [];
    const vSet = new Set<Vertex>();
    this.collectFaceVertices(face, vSet);
    vertices.push(...Array.from(vSet));

    if (vertices.length < 3) {
      return { x: 0, y: 0, z: 1 }; // default fallback
    }

    const p0 = vertices[0].geometry;
    const p1 = vertices[1].geometry;
    const p2 = vertices[2].geometry;

    const v1 = { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z };
    const v2 = { x: p2.x - p0.x, y: p2.y - p0.y, z: p2.z - p0.z };

    // Cross product
    const nx = v1.y * v2.z - v1.z * v2.y;
    const ny = v1.z * v2.x - v1.x * v2.z;
    const nz = v1.x * v2.y - v1.y * v2.x;

    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-9) {
      return { x: 0, y: 0, z: 1 };
    }

    return { x: nx / len, y: ny / len, z: nz / len };
  }

  private static collectEntities(shape: TopoShape): Map<string, TopoShape> {
    const map = new Map<string, TopoShape>();
    const visited = new Set<string>();

    const traverse = (s: TopoShape) => {
      if (!s || visited.has(s.id)) return;
      visited.add(s.id);
      map.set(s.id, s);

      if (s.shapeType === TopoShapeEnum.SOLID) {
        const solid = s as Solid;
        if (solid.outerShell) traverse(solid.outerShell);
        if (solid.innerShells) solid.innerShells.forEach(sh => traverse(sh));
      } else if (s.shapeType === TopoShapeEnum.SHELL) {
        const shell = s as Shell;
        if (shell.orientedFaces) shell.orientedFaces.forEach(of => traverse(of.face));
      } else if (s.shapeType === TopoShapeEnum.FACE) {
        const face = s as Face;
        if (face.outerLoop) traverse(face.outerLoop);
        if (face.innerLoops) face.innerLoops.forEach(l => traverse(l));
      } else if (s.shapeType === TopoShapeEnum.LOOP) {
        const loop = s as Loop;
        if (loop.orientedEdges) loop.orientedEdges.forEach(oe => traverse(oe.edge));
      } else if (s.shapeType === TopoShapeEnum.EDGE) {
        const edge = s as Edge;
        if (edge.startVertex) traverse(edge.startVertex);
        if (edge.endVertex) traverse(edge.endVertex);
      }
    };

    traverse(shape);
    return map;
  }

  private static extractGeometryState(shape: TopoShape): any {
    const vertices: any[] = [];
    const entityMap = this.collectEntities(shape);

    for (const [id, entity] of entityMap.entries()) {
      if (entity.shapeType === TopoShapeEnum.VERTEX) {
        const v = entity as Vertex;
        vertices.push({
          id: v.id,
          x: Number(v.geometry.x.toFixed(8)),
          y: Number(v.geometry.y.toFixed(8)),
          z: Number(v.geometry.z.toFixed(8))
        });
      }
    }

    vertices.sort((a, b) => a.id.localeCompare(b.id));
    return { shapeId: shape.id, vertices };
  }

  private static extractTopologyState(shape: TopoShape): any {
    const entities: any[] = [];
    const entityMap = this.collectEntities(shape);

    for (const [id, entity] of entityMap.entries()) {
      entities.push({
        id: entity.id,
        type: entity.shapeType
      });
    }

    entities.sort((a, b) => a.id.localeCompare(b.id));
    return { shapeId: shape.id, entities };
  }

  public static cloneShape<T extends TopoShape>(shape: T): T {
    // Deep clone B-Rep topology maintaining reference sharing
    const vertexMap = new Map<string, Vertex>();
    const edgeMap = new Map<string, Edge>();
    const loopMap = new Map<string, Loop>();
    const faceMap = new Map<string, Face>();

    const cloneVertex = (v: Vertex): Vertex => {
      if (!v) return null as any;
      if (vertexMap.has(v.id)) return vertexMap.get(v.id)!;
      const cloned: Vertex = {
        id: v.id,
        shapeType: TopoShapeEnum.VERTEX,
        geometry: v.geometry ? { x: v.geometry.x, y: v.geometry.y, z: v.geometry.z } : { x: 0, y: 0, z: 0 },
        tolerance: v.tolerance || 1e-7
      };
      vertexMap.set(v.id, cloned);
      return cloned;
    };

    const cloneEdge = (e: Edge): Edge => {
      if (!e) return null as any;
      if (edgeMap.has(e.id)) return edgeMap.get(e.id)!;
      const cloned: Edge = {
        id: e.id,
        shapeType: TopoShapeEnum.EDGE,
        geometry: e.geometry,
        startVertex: cloneVertex(e.startVertex),
        endVertex: cloneVertex(e.endVertex),
        tolerance: e.tolerance || 1e-7
      };
      edgeMap.set(e.id, cloned);
      return cloned;
    };

    const cloneLoop = (l: Loop): Loop => {
      if (!l) return null as any;
      if (loopMap.has(l.id)) return loopMap.get(l.id)!;
      const cloned: Loop = {
        id: l.id,
        shapeType: TopoShapeEnum.LOOP,
        orientedEdges: l.orientedEdges ? l.orientedEdges.map(oe => ({
          edge: cloneEdge(oe.edge),
          orientation: oe.orientation
        })) : []
      };
      loopMap.set(l.id, cloned);
      return cloned;
    };

    const cloneFace = (f: Face): Face => {
      if (!f) return null as any;
      if (faceMap.has(f.id)) return faceMap.get(f.id)!;
      const cloned: Face = {
        id: f.id,
        shapeType: TopoShapeEnum.FACE,
        geometry: f.geometry,
        outerLoop: cloneLoop(f.outerLoop),
        innerLoops: f.innerLoops ? f.innerLoops.map(cloneLoop) : []
      };
      faceMap.set(f.id, cloned);
      return cloned;
    };

    const cloneShell = (s: Shell): Shell => {
      return {
        id: s.id,
        shapeType: TopoShapeEnum.SHELL,
        orientedFaces: s.orientedFaces.map(of => ({
          face: cloneFace(of.face),
          orientation: of.orientation
        }))
      };
    };

    const cloneSolid = (s: Solid): Solid => {
      return {
        id: s.id,
        shapeType: TopoShapeEnum.SOLID,
        outerShell: cloneShell(s.outerShell),
        innerShells: s.innerShells ? s.innerShells.map(cloneShell) : []
      };
    };

    if (shape.shapeType === TopoShapeEnum.SOLID) {
      return cloneSolid(shape as unknown as Solid) as unknown as T;
    } else if (shape.shapeType === TopoShapeEnum.SHELL) {
      return cloneShell(shape as unknown as Shell) as unknown as T;
    } else if (shape.shapeType === TopoShapeEnum.FACE) {
      return cloneFace(shape as unknown as Face) as unknown as T;
    }

    return JSON.parse(JSON.stringify(shape));
  }
}
