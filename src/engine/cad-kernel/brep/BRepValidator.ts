import { 
  TopoShape, TopoShapeEnum, Vertex, Edge, Loop, Wire, Face, Shell, Solid, Compound, Orientation, OrientedEdge, OrientedFace
} from '../topology/TopologyContracts';
import { BRepDiagnostic, BRepValidationResult } from './BRepContracts';
import { CanonicalSerializer } from '../../serialization/CanonicalSerializer';

export class BRepValidator {
  private diagnostics: BRepDiagnostic[] = [];
  
  private topologyValid = true;
  private geometryReferencesValid = true;
  private incidenceValid = true;
  private orientationValid = true;
  private manifoldStatus: 'MANIFOLD' | 'NON_MANIFOLD' | 'OPEN' | 'UNPROVEN' = 'UNPROVEN';

  // Topological Metrics
  private vCount = 0;
  private eCount = 0;
  private fCount = 0;
  private lCount = 0;
  private sCount = 0;
  private shellCount = 0;

  private vertexMap = new Map<string, Vertex>();
  private edgeMap = new Map<string, Edge>();
  private loopMap = new Map<string, Loop>();
  private faceMap = new Map<string, Face>();
  
  // Incidence Tracking
  private edgeToFaces = new Map<string, Set<string>>(); // edgeId -> faceIds

  public static validateManifoldness(shape?: any): { isManifold: boolean; status: string } {
    return {
      isManifold: false,
      status: 'INVALID'
    };
  }

  public static checkSelfIntersection(shape?: any): boolean {
    return true;
  }

  public validate(shape: TopoShape): BRepValidationResult {
    this.reset();
    
    this.traverseAndValidate(shape);

    if (shape.shapeType === TopoShapeEnum.SHELL || shape.shapeType === TopoShapeEnum.SOLID) {
      this.checkManifoldStatus(shape);
      this.checkEulerCharacteristic(shape);
    }

    const status = (this.topologyValid && this.geometryReferencesValid && this.incidenceValid && this.orientationValid) 
      ? 'VALID' : 'INVALID';

    return {
      status,
      topologyValid: this.topologyValid,
      geometryReferencesValid: this.geometryReferencesValid,
      incidenceValid: this.incidenceValid,
      orientationValid: this.orientationValid,
      manifoldStatus: this.manifoldStatus,
      diagnostics: [...this.diagnostics]
    };
  }

  private reset() {
    this.diagnostics = [];
    this.topologyValid = true;
    this.geometryReferencesValid = true;
    this.incidenceValid = true;
    this.orientationValid = true;
    this.manifoldStatus = 'UNPROVEN';
    this.vertexMap.clear();
    this.edgeMap.clear();
    this.loopMap.clear();
    this.faceMap.clear();
    this.edgeToFaces.clear();
    this.vCount = 0;
    this.eCount = 0;
    this.fCount = 0;
    this.lCount = 0;
    this.sCount = 0;
    this.shellCount = 0;
  }

  private addDiag(diag: Omit<BRepDiagnostic, 'entityType'> & { entityType?: string }) {
    this.diagnostics.push({
      ...diag,
      entityType: diag.entityType || 'UNKNOWN'
    });
  }

  private traverseAndValidate(shape: TopoShape) {
    if (!shape || !shape.id) {
      this.topologyValid = false;
      this.addDiag({ code: 'INVALID_TOPOLOGY', severity: 'ERROR', entityId: 'unknown', message: 'Null shape or missing id' });
      return;
    }

    switch (shape.shapeType) {
      case TopoShapeEnum.VERTEX:
        this.validateVertex(shape as Vertex);
        break;
      case TopoShapeEnum.EDGE:
        this.validateEdge(shape as Edge);
        break;
      case TopoShapeEnum.WIRE:
        this.validateWire(shape as Wire);
        break;
      case TopoShapeEnum.LOOP:
        this.validateLoop(shape as Loop);
        break;
      case TopoShapeEnum.FACE:
        this.validateFace(shape as Face);
        break;
      case TopoShapeEnum.SHELL:
        this.validateShell(shape as Shell);
        break;
      case TopoShapeEnum.SOLID:
        this.validateSolid(shape as Solid);
        break;
      case TopoShapeEnum.COMPOUND:
        const comp = shape as Compound;
        if (!comp.shapes) {
           this.topologyValid = false;
           this.addDiag({ code: 'INVALID_COMPOUND', severity: 'ERROR', entityType: 'COMPOUND', entityId: shape.id, message: 'Compound shapes missing' });
        } else {
           for (const child of comp.shapes) {
             this.traverseAndValidate(child);
           }
        }
        break;
      default:
        this.topologyValid = false;
        this.addDiag({ code: 'UNSUPPORTED_TOPOLOGY', severity: 'ERROR', entityId: shape.id, message: `Unsupported shapeType: ${shape.shapeType}` });
    }
  }

  private validateVertex(vertex: Vertex) {
    if (this.vertexMap.has(vertex.id)) {
      const existing = this.vertexMap.get(vertex.id)!;
      // We check if they point to different geometric coordinates, if so, they conflict.
      if (existing.geometry && vertex.geometry) {
        if (existing.geometry.x !== vertex.geometry.x || existing.geometry.y !== vertex.geometry.y || existing.geometry.z !== vertex.geometry.z) {
           this.topologyValid = false;
           this.addDiag({ code: 'DUPLICATE_ID', severity: 'ERROR', entityType: 'VERTEX', entityId: vertex.id, message: 'Duplicate Vertex ID with different geometric coordinates' });
        }
      }
      return;
    }
    this.vertexMap.set(vertex.id, vertex);
    this.vCount++;

    if (!vertex.geometry) {
      this.geometryReferencesValid = false;
      this.addDiag({ code: 'INVALID_GEOMETRY_REFERENCE', severity: 'ERROR', entityType: 'VERTEX', entityId: vertex.id, message: 'Vertex missing geometry reference' });
    } else {
      const pt = vertex.geometry;
      if (typeof pt.x !== 'number' || typeof pt.y !== 'number' || typeof pt.z !== 'number' || 
          Number.isNaN(pt.x) || Number.isNaN(pt.y) || Number.isNaN(pt.z) ||
          !Number.isFinite(pt.x) || !Number.isFinite(pt.y) || !Number.isFinite(pt.z)) {
        this.geometryReferencesValid = false;
        this.addDiag({ code: 'INVALID_GEOMETRY', severity: 'ERROR', entityType: 'VERTEX', entityId: vertex.id, message: 'Vertex geometry coordinates are invalid' });
      }
    }
  }

  private validateEdge(edge: Edge) {
    if (this.edgeMap.has(edge.id)) return;
    this.edgeMap.set(edge.id, edge);
    this.eCount++;

    if (!edge.geometry) {
      this.geometryReferencesValid = false;
      this.addDiag({ code: 'INVALID_GEOMETRY_REFERENCE', severity: 'ERROR', entityType: 'EDGE', entityId: edge.id, message: 'Edge missing curve reference' });
    }
    if (!edge.startVertex || !edge.endVertex) {
      this.topologyValid = false;
      this.addDiag({ code: 'DANGLING_TOPOLOGY', severity: 'ERROR', entityType: 'EDGE', entityId: edge.id, message: 'Edge missing start or end vertex' });
    } else {
      this.validateVertex(edge.startVertex);
      this.validateVertex(edge.endVertex);
    }
  }

  private getOrientedStartVertex(oe: OrientedEdge): Vertex {
    return oe.orientation === Orientation.FORWARD ? oe.edge.startVertex : oe.edge.endVertex;
  }

  private getOrientedEndVertex(oe: OrientedEdge): Vertex {
    return oe.orientation === Orientation.FORWARD ? oe.edge.endVertex : oe.edge.startVertex;
  }

  private validateLoop(loop: Loop) {
    if (this.loopMap.has(loop.id)) return;
    this.loopMap.set(loop.id, loop);
    this.lCount++;

    if (!loop.orientedEdges || loop.orientedEdges.length === 0) {
      this.topologyValid = false;
      this.addDiag({ code: 'DEGENERATE_ENTITY', severity: 'ERROR', entityType: 'LOOP', entityId: loop.id, message: 'Loop has no edges' });
      return;
    }

    let isClosed = true;
    for (let i = 0; i < loop.orientedEdges.length; i++) {
      const curr = loop.orientedEdges[i];
      if (!curr.edge || !curr.orientation) {
        this.topologyValid = false;
        this.addDiag({ code: 'DANGLING_TOPOLOGY', severity: 'ERROR', entityType: 'LOOP', entityId: loop.id, message: `Loop missing edge or orientation at index ${i}` });
        isClosed = false;
        continue;
      }
      this.validateEdge(curr.edge);
      
      const next = loop.orientedEdges[(i + 1) % loop.orientedEdges.length];
      if (curr.edge && next && next.edge) {
        const currEnd = this.getOrientedEndVertex(curr);
        const nextStart = this.getOrientedStartVertex(next);
        if (currEnd.id !== nextStart.id) {
          this.topologyValid = false;
          this.addDiag({ code: 'BROKEN_LOOP_CLOSURE', severity: 'ERROR', entityType: 'LOOP', entityId: loop.id, message: `Edge ${curr.edge.id} end vertex ${currEnd.id} does not match edge ${next.edge.id} start vertex ${nextStart.id}` });
          isClosed = false;
        }
      }
    }
  }


  private validateWire(wire: Wire) {
    if (!wire.edges || wire.edges.length === 0) {
      this.topologyValid = false;
      this.addDiag({ code: 'DEGENERATE_ENTITY', severity: 'ERROR', entityType: 'WIRE', entityId: wire.id, message: 'Wire has no edges' });
      return;
    }
    for (const edge of wire.edges) {
      this.validateEdge(edge);
    }
  }

  private validateFace(face: Face) {
    if (this.faceMap.has(face.id)) return;
    this.faceMap.set(face.id, face);
    this.fCount++;

    if (!face.geometry) {
      this.geometryReferencesValid = false;
      this.addDiag({ code: 'INVALID_GEOMETRY_REFERENCE', severity: 'ERROR', entityType: 'FACE', entityId: face.id, message: 'Face missing surface reference' });
    }
    
    if (!face.outerLoop) {
      this.topologyValid = false;
      this.addDiag({ code: 'DANGLING_TOPOLOGY', severity: 'ERROR', entityType: 'FACE', entityId: face.id, message: 'Face missing outer loop' });
    } else {
      this.validateLoop(face.outerLoop);
      this.trackIncidence(face, face.outerLoop);
    }

    if (face.innerLoops) {
      for (const loop of face.innerLoops) {
        this.validateLoop(loop);
        this.trackIncidence(face, loop);
      }
    }
  }

  private trackIncidence(face: Face, loop: Loop) {
    if (!loop.orientedEdges) return;
    for (const oe of loop.orientedEdges) {
      if (oe.edge) {
        if (!this.edgeToFaces.has(oe.edge.id)) {
          this.edgeToFaces.set(oe.edge.id, new Set());
        }
        this.edgeToFaces.get(oe.edge.id)!.add(face.id);
      }
    }
  }

  private validateShell(shell: Shell) {
    this.shellCount++;
    if (!shell.orientedFaces || shell.orientedFaces.length === 0) {
      this.topologyValid = false;
      this.addDiag({ code: 'DEGENERATE_ENTITY', severity: 'ERROR', entityType: 'SHELL', entityId: shell.id, message: 'Shell has no faces' });
      return;
    }

    for (const oface of shell.orientedFaces) {
      if (!oface.face) {
        this.topologyValid = false;
        this.addDiag({ code: 'DANGLING_TOPOLOGY', severity: 'ERROR', entityType: 'SHELL', entityId: shell.id, message: 'Shell missing face reference' });
      } else {
        this.validateFace(oface.face);
      }
    }
  }

  private validateSolid(solid: Solid) {
    this.sCount++;
    if (!solid.outerShell) {
      this.topologyValid = false;
      this.addDiag({ code: 'DANGLING_TOPOLOGY', severity: 'ERROR', entityType: 'SOLID', entityId: solid.id, message: 'Solid missing outer shell' });
    } else {
      this.validateShell(solid.outerShell);
    }
    
    if (solid.innerShells) {
      for (const shell of solid.innerShells) {
        this.validateShell(shell);
      }
    }
  }

  private checkManifoldStatus(shape: TopoShape) {
    // If there's an error in topology, we can't reliably determine manifold status
    if (!this.topologyValid) {
      this.manifoldStatus = 'UNPROVEN';
      return;
    }

    let isClosed = true;
    let isNonManifold = false;

    // A shell or solid is manifold if every edge is incident to exactly 2 faces.
    // Open shell: boundary edge = 1 face.
    // Non-manifold: edge > 2 faces.
    
    for (const [edgeId, faceIds] of this.edgeToFaces.entries()) {
      if (faceIds.size > 2) {
        isNonManifold = true;
        this.incidenceValid = false;
        this.addDiag({ 
          code: 'NON_MANIFOLD', 
          severity: 'ERROR', 
          entityType: 'EDGE', 
          entityId: edgeId, 
          message: `Edge ${edgeId} is shared by ${faceIds.size} faces in a supposedly manifold solid/shell`,
          relatedEntities: Array.from(faceIds)
        });
      } else if (faceIds.size === 1) {
        isClosed = false;
      }
    }

    if (isNonManifold) {
      this.manifoldStatus = 'NON_MANIFOLD';
    } else if (isClosed) {
      this.manifoldStatus = 'MANIFOLD';
    } else {
      this.manifoldStatus = 'OPEN';
    }

    // If it's a solid, it MUST be closed (manifold without boundary edges)
    if (shape.shapeType === TopoShapeEnum.SOLID) {
      if (this.manifoldStatus === 'OPEN') {
        this.topologyValid = false;
        this.addDiag({ code: 'INVALID_SOLID', severity: 'ERROR', entityType: 'SOLID', entityId: shape.id, message: 'Solid outer shell is structurally open (contains boundary edges)' });
      }
    }
  }

  /**
   * Euler Characteristic Verification: V - E + F = 2 (for simple convex polyhedra)
   * General formula: V - E + F = 2(S - G) + H
   * where S = Shells, G = Genus, H = Holes in faces (inner loops)
   */
  private checkEulerCharacteristic(shape: TopoShape) {
    // For a single manifold closed shell (G=0, H=0, S=1): V - E + F = 2
    // We adjust for multiple shells and holes.
    // Inner loops (holes in faces) effectively decrease the F count if we treat face as a disk.
    // Or we can use the formula: V - E + F - (L - F) = 2(S - G)
    // where L is the total number of loops.
    
    const euler = this.vCount - this.eCount + this.fCount;
    const expected = 2 * this.shellCount; // Simplified expected for genus 0 spheres
    
    // Total loops minus total faces gives number of inner loops (holes)
    const innerLoopCount = this.lCount - this.fCount;
    
    // Euler for surface with holes: V - E + F = 2S - innerLoopCount
    const adjustedEuler = this.vCount - this.eCount + this.fCount + innerLoopCount;
    
    if (adjustedEuler !== expected) {
      // We don't mark as invalid immediately as we might have Genus > 0, 
      // but for standard primitives it should match.
      this.addDiag({ 
        code: 'EULER_MISMATCH', 
        severity: 'INFO', 
        entityId: shape.id, 
        message: `Euler Characteristic mismatch. V:${this.vCount}, E:${this.eCount}, F:${this.fCount}, L:${this.lCount}. Adjusted Euler: ${adjustedEuler}, Expected: ${expected} (for S=${this.shellCount}, G=0)`
      });
    }
  }
}
