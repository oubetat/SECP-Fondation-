/**
 * PATCH-277: Engineering Selection System Types
 * Defines stable identities, selection states, filters, priority levels,
 * and the unified selection reference contract family.
 */

import { SelectionType, PersistentEntityId } from './ViewportTypes276';
import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { FeatureNode } from '../cad-kernel/history/FeatureNode';

export type SelectionMode = 'SINGLE' | 'MULTI' | 'BOX' | 'WINDOW' | 'CROSSING' | 'LASSO';

export interface SelectionFilter {
  allowedTypes: SelectionType[];
  allowMeshEntities: boolean;
  allowSimulationRegions: boolean;
  allowToolpathEntities: boolean;
}

export interface SelectionState277 {
  selectedEntities: PersistentEntityId[];
  activeEntity: PersistentEntityId | null;
  preselectedEntity: PersistentEntityId | null;
  mode: SelectionMode;
  filter: SelectionFilter;
  modelRevision: string;
  timestamp: string;
}

export interface HitResult {
  entityId: string;
  entityType: SelectionType;
  distance: number;
  point: [number, number, number];
  normal?: [number, number, number];
  parentPartId?: string;
  parentBodyId?: string;
  meshNodeId?: string;
  meshElementId?: string;
  isVisualOnly: boolean;
}

export interface SelectionEvent {
  type: 'STARTED' | 'CHANGED' | 'ADDED' | 'REMOVED' | 'CLEARED' | 'COMPLETED';
  entities: PersistentEntityId[];
  mode: SelectionMode;
  revision: string;
  source: 'VIEWPORT' | 'TREE' | 'SEARCH' | 'API' | 'SIMULATION';
}

export const SelectionPriorityMap: Record<SelectionType, number> = {
  'VERTEX': 100,
  'EDGE': 80,
  'FACE': 60,
  'BODY': 40,
  'PART': 20,
  'ASSEMBLY_COMPONENT': 10
};

export interface SelectionRequirement {
  requiredType: SelectionType;
  min: number;
  max: number;
  description: string;
}

export interface SelectionContract {
  contractId: string;
  requirement: SelectionRequirement;
  isValid: boolean;
  currentCount: number;
}

// ============================================================================
// PROMPT-010: CANONICAL SELECTION REFERENCE FAMILY (UNIFIED CONTRACT)
// ============================================================================

export type ReferenceType = 
  | 'SKETCH_ENTITY'
  | 'FACE'
  | 'EDGE'
  | 'VERTEX'
  | 'BODY'
  | 'FEATURE';

export interface BaseSelectionReference {
  readonly referenceType: ReferenceType;
  /** Stable identity across model regenerations (canonical persistentId or tag) */
  readonly persistentId: string;
  /** Source feature or container ID */
  readonly sourceId: string;
  /** Optional human-readable debug name */
  readonly name?: string;
  /** Extra verification metadata */
  readonly metadata?: Record<string, any>;
}

export interface SketchEntityReference extends BaseSelectionReference {
  readonly referenceType: 'SKETCH_ENTITY';
  readonly sketchId: string;
  readonly entityId: string; // ID of the specific line/arc/circle within the sketch
}

export interface FaceReference extends BaseSelectionReference {
  readonly referenceType: 'FACE';
  readonly faceId: string;
  readonly brepHash?: string;
}

export interface EdgeReference extends BaseSelectionReference {
  readonly referenceType: 'EDGE';
  readonly edgeId: string;
  readonly brepHash?: string;
}

export interface VertexReference extends BaseSelectionReference {
  readonly referenceType: 'VERTEX';
  readonly vertexId: string;
  readonly brepHash?: string;
}

export interface BodyReference extends BaseSelectionReference {
  readonly referenceType: 'BODY';
  readonly bodyId: string;
  readonly solidId?: string;
}

export interface FeatureReference extends BaseSelectionReference {
  readonly referenceType: 'FEATURE';
  readonly featureId: string;
}

export type SelectionReference =
  | SketchEntityReference
  | FaceReference
  | EdgeReference
  | VertexReference
  | BodyReference
  | FeatureReference;

/**
 * Evaluates and validates any selection reference against the authoritative EngineeringDocument.
 * Detects invalidations due to parent suppressions, geometric topology disappearances, or model updates.
 */
export class SelectionContractEvaluator {
  public static validate(ref: SelectionReference, doc: EngineeringDocument): { isValid: boolean; message: string } {
    if (!doc) {
      return { isValid: false, message: 'Reference is invalid: Document context is missing.' };
    }

    switch (ref.referenceType) {
      case 'SKETCH_ENTITY':
        return this.validateSketchEntity(ref as SketchEntityReference, doc);
      case 'FACE':
        return this.validateFace(ref as FaceReference, doc);
      case 'EDGE':
        return this.validateEdge(ref as EdgeReference, doc);
      case 'VERTEX':
        return this.validateVertex(ref as VertexReference, doc);
      case 'BODY':
        return this.validateBody(ref as BodyReference, doc);
      case 'FEATURE':
        return this.validateFeature(ref as FeatureReference, doc);
      default:
        return { isValid: false, message: `Reference has unsupported type: ${(ref as any).referenceType}` };
    }
  }

  private static validateSketchEntity(ref: SketchEntityReference, doc: EngineeringDocument): { isValid: boolean; message: string } {
    const sketch = doc.sketches?.find(s => s.id === ref.sketchId);
    if (!sketch) {
      return { isValid: false, message: `Sketch ${ref.sketchId} not found in document.` };
    }

    const entities = sketch.entities;
    let found = false;

    if (Array.isArray(entities)) {
      found = entities.some(e => e.id === ref.entityId);
    } else if (entities && typeof entities === 'object') {
      found = Object.keys(entities).includes(ref.entityId) || (entities as any)[ref.entityId] !== undefined;
    }

    if (!found && sketch.points) {
      found = sketch.points.some(p => p.id === ref.entityId);
    }

    if (!found) {
      return { isValid: false, message: `Sketch entity ${ref.entityId} not found in Sketch ${ref.sketchId}.` };
    }

    return { isValid: true, message: `Sketch entity ${ref.entityId} is active and valid.` };
  }

  private static validateFace(ref: FaceReference, doc: EngineeringDocument): { isValid: boolean; message: string } {
    const realFaceMap = doc.derived?.mesh?.topologyMap?.faceTriangleMap || {};

    if (realFaceMap[ref.persistentId]) {
      return { isValid: true, message: `Face persistent ID ${ref.persistentId} successfully resolved.` };
    }

    const shape = doc.evaluatedShape;
    const solid = shape && 'topology' in shape ? shape.topology : (shape as any);
    
    if (solid?.outerShell?.orientedFaces) {
      const faces = solid.outerShell.orientedFaces;
      const found = faces.some((of: any) => {
        const face = of.face;
        const fid = face.persistentId || face.topologyReference?.persistentId || face.id;
        return fid === ref.persistentId || face.id === ref.faceId;
      });

      if (found) {
        return { isValid: true, message: `Face ${ref.persistentId} found in B-Rep model topology.` };
      }
    }

    return { isValid: false, message: `Face persistent reference ${ref.persistentId} disappeared or became invalid after regeneration.` };
  }

  private static validateEdge(ref: EdgeReference, doc: EngineeringDocument): { isValid: boolean; message: string } {
    const realEdgeMap = doc.derived?.mesh?.topologyMap?.edgeVertexMap || {};

    if (realEdgeMap[ref.persistentId]) {
      return { isValid: true, message: `Edge persistent ID ${ref.persistentId} successfully resolved.` };
    }

    const shape = doc.evaluatedShape;
    const solid = shape && 'topology' in shape ? shape.topology : (shape as any);

    if (solid?.outerShell?.orientedFaces) {
      const faces = solid.outerShell.orientedFaces;
      for (const of of faces) {
        if (of.face.outerLoop?.orientedEdges) {
          const found = of.face.outerLoop.orientedEdges.some((oe: any) => {
            const edge = oe.edge;
            const eid = edge.persistentId || edge.topologyReference?.persistentId || edge.id;
            return eid === ref.persistentId || edge.id === ref.edgeId;
          });
          if (found) {
            return { isValid: true, message: `Edge ${ref.persistentId} found in B-Rep outer loop.` };
          }
        }
      }
    }

    return { isValid: false, message: `Edge persistent reference ${ref.persistentId} was lost after regeneration.` };
  }

  private static validateVertex(ref: VertexReference, doc: EngineeringDocument): { isValid: boolean; message: string } {
    const realVertexMap = doc.derived?.mesh?.topologyMap?.vertexIndexMap || {};

    if (realVertexMap[ref.persistentId]) {
      return { isValid: true, message: `Vertex persistent ID ${ref.persistentId} successfully resolved.` };
    }

    const shape = doc.evaluatedShape;
    const solid = shape && 'topology' in shape ? shape.topology : (shape as any);

    if (solid?.outerShell?.orientedFaces) {
      const faces = solid.outerShell.orientedFaces;
      for (const of of faces) {
        if (of.face.outerLoop?.orientedEdges) {
          for (const oe of of.face.outerLoop.orientedEdges) {
            const startV = oe.edge.startVertex;
            const endV = oe.edge.endVertex;
            if (
              (startV.persistentId === ref.persistentId || startV.id === ref.vertexId) ||
              (endV.persistentId === ref.persistentId || endV.id === ref.vertexId)
            ) {
              return { isValid: true, message: `Vertex ${ref.persistentId} found in B-Rep edge loop.` };
            }
          }
        }
      }
    }

    return { isValid: false, message: `Vertex persistent reference ${ref.persistentId} is missing in regenerated state.` };
  }

  private static validateBody(ref: BodyReference, doc: EngineeringDocument): { isValid: boolean; message: string } {
    if (doc.evaluatedShape) {
      return { isValid: true, message: `Primary solid body is valid.` };
    }
    return { isValid: false, message: `Solid body is invalid or missing in current document state.` };
  }

  private static validateFeature(ref: FeatureReference, doc: EngineeringDocument): { isValid: boolean; message: string } {
    const feature = doc.features?.find(f => {
      if (f instanceof FeatureNode) {
        return f.featureId === ref.featureId;
      }
      return f.featureId === ref.featureId || f.id === ref.featureId;
    });

    if (!feature) {
      return { isValid: false, message: `Feature ${ref.featureId} not found in history tree.` };
    }

    const status = (feature as any).status || (feature as any).suppressionState;
    if (status === 'SUPPRESSED' || status === 'FAILED') {
      return { isValid: false, message: `Feature ${ref.featureId} exists but is currently ${status}.` };
    }

    return { isValid: true, message: `Feature ${ref.featureId} is active and valid.` };
  }
}
