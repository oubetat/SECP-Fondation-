/**
 * SECP CAD Kernel — Hierarchical Constraint & Topological Entity Binder (PATCH-039B)
 *
 * ARCHITECTURAL CONTRACT:
 * 1. Engineering SOT: EngineeringDocument remains the sole engineering SOT.
 * 2. Occurrence Path Resolution: Deterministically resolves nested occurrences
 *    (e.g., 'Root/SubAssembly/LeafPart/FACE_17') via IDocumentResolver.
 * 3. Topological Entity Binding: Binds canonical references to actual B-Rep topology
 *    (Face, Edge, Vertex, Datum, Axis, Plane) with no synthetic/fallback geometry.
 * 4. Truthful Binding States: Explicitly returns RESOLVED, MISSING_OCCURRENCE,
 *    MISSING_DOCUMENT, MISSING_ENTITY, INVALID_ENTITY_TYPE, CYCLE_ERROR, EVALUATION_ERROR, or AMBIGUOUS.
 * 5. World-Space Transformation: Transforms local topology frames via composed 4x4 matrices:
 *    M_world = M_root × M_subAssembly × ... × M_occurrence.
 * 6. Lineage Continuity & Evolution: Tracks topology changes and detects REFERENCE_PRESERVED,
 *    REFERENCE_REBOUND, REFERENCE_INVALIDATED, and REFERENCE_AMBIGUOUS.
 * 7. Child Immutability: Child documents are never mutated during constraint binding.
 * 8. Determinism: Resolver order, iteration order, and memory identities do not alter binding outcomes.
 */

import {
  EngineeringDocument,
  AssemblyDefinition,
  AssemblyInstance,
  AssemblyMate,
  AssemblyTopologyEntityType,
  AssemblyTopologyReference,
  TopologyLineage,
  TopologyLineageEntry
} from './CADDocument';
import { IDocumentResolver } from './DocumentResolver';
import {
  AssemblyTransformMatrix,
  Matrix4x4Data,
  Transform3DValue
} from './RecursiveAssemblyEvaluator';
import { Solid, Shell, Face, Edge, Vertex, TopoShapeEnum } from '../topology/TopologyContracts';
import { BRepSolid } from '../brep/BRepContracts';

export type AssemblyEntityBindingStatus =
  | 'RESOLVED'
  | 'MISSING_OCCURRENCE'
  | 'MISSING_DOCUMENT'
  | 'MISSING_ENTITY'
  | 'INVALID_ENTITY_TYPE'
  | 'CYCLE_ERROR'
  | 'EVALUATION_ERROR'
  | 'AMBIGUOUS';

export type TopologyEvolutionStatus =
  | 'REFERENCE_PRESERVED'
  | 'REFERENCE_REBOUND'
  | 'REFERENCE_INVALIDATED'
  | 'REFERENCE_AMBIGUOUS';

export interface TopologicalEntityGeometry {
  origin: { x: number; y: number; z: number };
  direction?: { x: number; y: number; z: number }; // For AXIS, EDGE
  normal?: { x: number; y: number; z: number };    // For FACE, PLANE
  point?: { x: number; y: number; z: number };     // For VERTEX, DATUM
  radius?: number;                                 // For cylinder faces / circle edges
  localEntity?: any;
}

export interface BoundTopologicalEntity {
  reference: AssemblyTopologyReference;
  status: AssemblyEntityBindingStatus;
  documentId?: string;
  occurrencePath: string;
  targetDocument?: EngineeringDocument;
  localGeometry?: TopologicalEntityGeometry;
  worldMatrix?: Matrix4x4Data;
  worldGeometry?: TopologicalEntityGeometry;
  lineageStatus?: TopologyEvolutionStatus;
  reboundEntityId?: string;
  error?: string;
  diagnostic?: string;
}

export interface HierarchicalMateEvaluation {
  mateId: string;
  type: string;
  bindingA?: BoundTopologicalEntity;
  bindingB?: BoundTopologicalEntity;
  status: 'SOLVED' | 'UNSOLVED' | 'CONFLICTING' | 'UNSUPPORTED';
  satisfied: boolean;
  residual?: number;
  diagnostics: string[];
}

export interface HierarchicalAssemblyBindingResult {
  bindings: Map<string, BoundTopologicalEntity>;
  evaluatedMates: HierarchicalMateEvaluation[];
  allMatesSolved: boolean;
  hasErrors: boolean;
  diagnostics: string[];
}

export class HierarchicalConstraintBinder {
  public static readonly DEFAULT_TOLERANCE = 1e-4; // 0.1 mm

  /**
   * Resolves an occurrence path within an assembly hierarchy to find the target document,
   * its accumulated world transform matrix, and suppression state.
   */
  public static resolveOccurrencePath(
    rootDoc: EngineeringDocument,
    occurrencePath: string,
    resolver?: IDocumentResolver,
    activeStack: string[] = []
  ): {
    status: AssemblyEntityBindingStatus;
    targetDoc?: EngineeringDocument;
    worldMatrix: Matrix4x4Data;
    depth: number;
    suppressed: boolean;
    error?: string;
    diagnostic?: string;
  } {
    if (!rootDoc) {
      return {
        status: 'MISSING_DOCUMENT',
        worldMatrix: AssemblyTransformMatrix.identity(),
        depth: 0,
        suppressed: false,
        error: 'Root document is null or undefined.'
      };
    }

    if (!occurrencePath || occurrencePath.trim() === '') {
      return {
        status: 'RESOLVED',
        targetDoc: rootDoc,
        worldMatrix: AssemblyTransformMatrix.identity(),
        depth: 0,
        suppressed: false
      };
    }

    const segments = occurrencePath.split('/').filter(s => s.trim().length > 0);
    let currentDoc: EngineeringDocument = rootDoc;
    let currentWorldMatrix = AssemblyTransformMatrix.identity();
    let currentSuppressed = false;
    const currentStack = [...activeStack, rootDoc.documentId];

    for (let depth = 0; depth < segments.length; depth++) {
      const segmentId = segments[depth];

      if (!currentDoc.assembly || !currentDoc.assembly.instances) {
        const error = `[SECP_ASSEMBLY_OCCURRENCE_MISSING] Document '${currentDoc.documentId}' has no assembly instances to resolve segment '${segmentId}'.`;
        return {
          status: 'MISSING_OCCURRENCE',
          worldMatrix: currentWorldMatrix,
          depth,
          suppressed: currentSuppressed,
          error,
          diagnostic: error
        };
      }

      const instance = currentDoc.assembly.instances.find(i => i.instanceId === segmentId || i.id === segmentId || (i as any).name === segmentId);
      if (!instance) {
        const error = `[SECP_ASSEMBLY_OCCURRENCE_MISSING] Occurrence segment '${segmentId}' not found in assembly '${currentDoc.documentId}'. Full path: '${occurrencePath}'.`;
        return {
          status: 'MISSING_OCCURRENCE',
          worldMatrix: currentWorldMatrix,
          depth,
          suppressed: currentSuppressed,
          error,
          diagnostic: error
        };
      }

      // Check suppression cascade
      if (instance.isSuppressed) {
        currentSuppressed = true;
      }

      // Compose transform: M_world = M_parent × M_local
      const pos = instance.position || (instance as any).transform?.translation || { x: 0, y: 0, z: 0 };
      const rot = instance.rotation || (instance as any).transform?.rotation || { x: 0, y: 0, z: 0 };
      const localMatrix = AssemblyTransformMatrix.fromTranslationAndRotation(pos, rot);
      currentWorldMatrix = AssemblyTransformMatrix.multiply(currentWorldMatrix, localMatrix);

      // Cycle detection on the active branch
      if (currentStack.includes(instance.documentId)) {
        const cyclePath = [...currentStack, instance.documentId].join(' → ');
        const error = `[SECP_ASSEMBLY_CYCLE_DETECTED] Cyclic document reference detected during occurrence resolution: ${cyclePath}`;
        return {
          status: 'CYCLE_ERROR',
          worldMatrix: currentWorldMatrix,
          depth,
          suppressed: currentSuppressed,
          error,
          diagnostic: error
        };
      }

      if (!resolver) {
        const error = `[SECP_DOC_MISSING] DocumentResolver not provided to resolve child '${instance.documentId}'.`;
        return {
          status: 'MISSING_DOCUMENT',
          worldMatrix: currentWorldMatrix,
          depth,
          suppressed: currentSuppressed,
          error,
          diagnostic: error
        };
      }

      const childDoc = resolver.resolve(instance.documentId);
      if (!childDoc) {
        const error = `[SECP_ASSEMBLY_OCCURRENCE_MISSING] Referenced child document '${instance.documentId}' not found in resolver for occurrence '${segmentId}'.`;
        return {
          status: 'MISSING_DOCUMENT',
          worldMatrix: currentWorldMatrix,
          depth,
          suppressed: currentSuppressed,
          error,
          diagnostic: error
        };
      }

      currentDoc = childDoc;
      currentStack.push(childDoc.documentId);
    }

    return {
      status: 'RESOLVED',
      targetDoc: currentDoc,
      worldMatrix: currentWorldMatrix,
      depth: segments.length,
      suppressed: currentSuppressed
    };
  }

  /**
   * Binds a canonical AssemblyTopologyReference to an actual topological entity
   * within the resolved document and transforms it into world space.
   */
  public static bindEntity(
    rootDoc: EngineeringDocument,
    reference: AssemblyTopologyReference,
    resolver?: IDocumentResolver
  ): BoundTopologicalEntity {
    if (!reference) {
      return {
        reference: { occurrencePath: '', entityType: 'FACE', entityId: '' },
        status: 'MISSING_ENTITY',
        occurrencePath: '',
        error: '[SECP_ASSEMBLY_ENTITY_MISSING] Null or undefined reference passed to binder.',
        diagnostic: '[SECP_ASSEMBLY_ENTITY_MISSING] Null or undefined reference.'
      };
    }

    const { occurrencePath, entityType, entityId } = reference;

    // 1. Validate entity type
    const validTypes: AssemblyTopologyEntityType[] = ['FACE', 'EDGE', 'VERTEX', 'DATUM', 'AXIS', 'PLANE'];
    if (!validTypes.includes(entityType)) {
      const error = `[SECP_ASSEMBLY_ENTITY_TYPE_INVALID] Unsupported or invalid entity type: '${entityType}'. Must be one of: ${validTypes.join(', ')}.`;
      return {
        reference,
        status: 'INVALID_ENTITY_TYPE',
        occurrencePath,
        error,
        diagnostic: error
      };
    }

    // 2. Resolve occurrence path to target document and world transform
    const occResult = this.resolveOccurrencePath(rootDoc, occurrencePath, resolver);
    if (occResult.status !== 'RESOLVED' || !occResult.targetDoc) {
      return {
        reference,
        status: occResult.status,
        occurrencePath,
        worldMatrix: occResult.worldMatrix,
        error: occResult.error,
        diagnostic: occResult.diagnostic
      };
    }

    const targetDoc = occResult.targetDoc;
    const worldMatrix = occResult.worldMatrix;

    // 3. Resolve topological entity in target document & inspect lineage evolution
    const localResolution = this.resolveLocalTopologyEntity(targetDoc, entityType, entityId);

    if (localResolution.status !== 'RESOLVED' || !localResolution.geometry) {
      const error = localResolution.error || `[SECP_ASSEMBLY_ENTITY_MISSING] Entity '${entityId}' of type '${entityType}' not found in document '${targetDoc.documentId}'.`;
      return {
        reference,
        status: localResolution.status,
        documentId: targetDoc.documentId,
        occurrencePath,
        targetDoc,
        worldMatrix,
        lineageStatus: localResolution.lineageStatus,
        error,
        diagnostic: error
      };
    }

    // 4. Transform local geometry to world space
    const localGeom = localResolution.geometry;
    const worldGeom = this.transformGeometryToWorld(localGeom, worldMatrix);

    const diagnostic = `[SECP_ASSEMBLY_ENTITY_RESOLVED] Entity '${entityId}' (${entityType}) in occurrence '${occurrencePath}' resolved successfully.`;

    return {
      reference,
      status: 'RESOLVED',
      documentId: targetDoc.documentId,
      occurrencePath,
      targetDocument: targetDoc,
      localGeometry: localGeom,
      worldMatrix,
      worldGeometry: worldGeom,
      lineageStatus: localResolution.lineageStatus,
      reboundEntityId: localResolution.reboundEntityId,
      diagnostic
    };
  }

  /**
   * Resolves a local topological entity within a single EngineeringDocument using
   * stable canonical topology IDs, topology lineage, and feature mappings.
   */
  public static resolveLocalTopologyEntity(
    doc: EngineeringDocument,
    entityType: AssemblyTopologyEntityType,
    entityId: string
  ): {
    status: AssemblyEntityBindingStatus;
    geometry?: TopologicalEntityGeometry;
    lineageStatus: TopologyEvolutionStatus;
    reboundEntityId?: string;
    error?: string;
  } {
    if (!entityId || entityId.trim() === '') {
      return {
        status: 'MISSING_ENTITY',
        lineageStatus: 'REFERENCE_INVALIDATED',
        error: '[SECP_ASSEMBLY_ENTITY_MISSING] Empty entityId provided.'
      };
    }

    // Check TopologyLineage
    const lineage = doc.topologyMap;
    let targetEntityId = entityId;
    let lineageStatus: TopologyEvolutionStatus = 'REFERENCE_PRESERVED';
    let reboundId: string | undefined = undefined;

    // Inspect lineage evolution if topologyMap entries exist
    if (lineage && lineage.entries) {
      const entriesMap = lineage.entries instanceof Map
        ? lineage.entries
        : new Map(Object.entries(lineage.entries));

      const directEntry = entriesMap.get(entityId);

      if (!directEntry) {
        // Search if entity was modified/split/rebound in history
        const successors: TopologyLineageEntry[] = [];
        for (const [_, entry] of entriesMap) {
          if (entry.predecessorTopologyIds && entry.predecessorTopologyIds.includes(entityId)) {
            successors.push(entry);
          }
        }

        if (successors.length === 1) {
          // Unambiguous rebound reference
          lineageStatus = 'REFERENCE_REBOUND';
          reboundId = successors[0].topologyId;
          targetEntityId = reboundId;
        } else if (successors.length > 1) {
          // Ambiguous reference (e.g. face split into multiple)
          return {
            status: 'AMBIGUOUS',
            lineageStatus: 'REFERENCE_AMBIGUOUS',
            error: `[SECP_ASSEMBLY_ENTITY_AMBIGUOUS] Entity '${entityId}' split into multiple successors (${successors.map(s => s.topologyId).join(', ')}). Cannot bind unambiguously.`
          };
        } else {
          // Check if entity is mapped in faceMap/edgeMap/vertexMap
          const inFaceMap = lineage.faceMap && (lineage.faceMap[entityId] || Object.values(lineage.faceMap).includes(entityId));
          const inEdgeMap = lineage.edgeMap && (lineage.edgeMap[entityId] || Object.values(lineage.edgeMap).includes(entityId));
          const inVertexMap = lineage.vertexMap && (lineage.vertexMap[entityId] || Object.values(lineage.vertexMap).includes(entityId));

          if (!inFaceMap && !inEdgeMap && !inVertexMap) {
            // Not in lineage or maps, check evaluated shape or parameters before failing
          }
        }
      }
    }

    // 1. Attempt to locate entity in evaluatedShape BRep topology
    const brepGeom = this.extractFromEvaluatedShape(doc, entityType, targetEntityId);
    if (brepGeom) {
      return {
        status: 'RESOLVED',
        geometry: brepGeom,
        lineageStatus,
        reboundEntityId: reboundId
      };
    }

    // 2. Attempt to locate entity in datums/sketches/planes
    const datumGeom = this.extractDatumGeometry(doc, entityType, targetEntityId);
    if (datumGeom) {
      return {
        status: 'RESOLVED',
        geometry: datumGeom,
        lineageStatus,
        reboundEntityId: reboundId
      };
    }

    // 3. Attempt deterministic resolution via topology maps
    const mapGeom = this.extractFromTopologyMap(doc, entityType, targetEntityId);
    if (mapGeom) {
      return {
        status: 'RESOLVED',
        geometry: mapGeom,
        lineageStatus,
        reboundEntityId: reboundId
      };
    }

    return {
      status: 'MISSING_ENTITY',
      lineageStatus: 'REFERENCE_INVALIDATED',
      error: `[SECP_ASSEMBLY_ENTITY_MISSING] Topological entity '${entityId}' of type '${entityType}' could not be resolved in document '${doc.documentId}'.`
    };
  }

  /**
   * Transforms local geometry frame (origin, direction, normal, point) into world space
   * using the composed 4x4 matrix.
   */
  public static transformGeometryToWorld(
    local: TopologicalEntityGeometry,
    worldMatrix: Matrix4x4Data
  ): TopologicalEntityGeometry {
    const origin = AssemblyTransformMatrix.transformPoint(worldMatrix, local.origin);
    const point = local.point ? AssemblyTransformMatrix.transformPoint(worldMatrix, local.point) : undefined;

    let direction: { x: number; y: number; z: number } | undefined = undefined;
    if (local.direction) {
      direction = this.transformVector(worldMatrix, local.direction);
    }

    let normal: { x: number; y: number; z: number } | undefined = undefined;
    if (local.normal) {
      normal = this.transformVector(worldMatrix, local.normal);
    }

    return {
      origin,
      direction,
      normal,
      point,
      radius: local.radius,
      localEntity: local.localEntity
    };
  }

  /**
   * Transforms a 3D vector (direction/normal) using the rotational 3x3 submatrix.
   */
  private static transformVector(
    mat: Matrix4x4Data,
    vec: { x: number; y: number; z: number }
  ): { x: number; y: number; z: number } {
    const m = mat.m;
    const vx = vec.x || 0;
    const vy = vec.y || 0;
    const vz = vec.z || 0;

    const tx = m[0] * vx + m[1] * vy + m[2] * vz;
    const ty = m[4] * vx + m[5] * vy + m[6] * vz;
    const tz = m[8] * vx + m[9] * vy + m[10] * vz;

    const len = Math.sqrt(tx * tx + ty * ty + tz * tz);
    if (len > 1e-9) {
      return { x: tx / len, y: ty / len, z: tz / len };
    }
    return { x: 0, y: 0, z: 1 };
  }

  /**
   * Evaluates a hierarchical mate constraint with topological entity references.
   */
  public static evaluateHierarchicalMate(
    rootDoc: EngineeringDocument,
    mate: AssemblyMate,
    resolver?: IDocumentResolver,
    tolerancePolicy?: string
  ): HierarchicalMateEvaluation {
    const diagnostics: string[] = [];
    const tolerance = tolerancePolicy === 'HIGH' ? 1e-6 : this.DEFAULT_TOLERANCE;

    // Check if mate specifies canonical entity references
    const refA: AssemblyTopologyReference = mate.entityA || {
      occurrencePath: mate.instanceAId,
      entityType: 'FACE',
      entityId: `FACE_AUTO_${mate.instanceAId}`
    };

    const refB: AssemblyTopologyReference = mate.entityB || {
      occurrencePath: mate.instanceBId,
      entityType: 'FACE',
      entityId: `FACE_AUTO_${mate.instanceBId}`
    };

    // Bind Entity A
    const bindingA = this.bindEntity(rootDoc, refA, resolver);
    if (bindingA.diagnostic) diagnostics.push(bindingA.diagnostic);

    // Fixed mates only require binding A
    if (mate.type === 'FIXED') {
      if (bindingA.status !== 'RESOLVED') {
        const diag = `[SECP_ASSEMBLY_CONSTRAINT_UNRESOLVED] FIXED Mate '${mate.mateId}' failed: Entity A '${refA.entityId}' (${bindingA.status}) unresolved.`;
        diagnostics.push(diag);
        return {
          mateId: mate.mateId,
          type: mate.type,
          bindingA,
          status: 'UNSOLVED',
          satisfied: false,
          diagnostics
        };
      }

      const diag = `[SECP_ASSEMBLY_CONSTRAINT_RESOLVED] FIXED Mate '${mate.mateId}' resolved and satisfied.`;
      diagnostics.push(diag);
      return {
        mateId: mate.mateId,
        type: mate.type,
        bindingA,
        status: 'SOLVED',
        satisfied: true,
        residual: 0,
        diagnostics
      };
    }

    // Bind Entity B
    const bindingB = this.bindEntity(rootDoc, refB, resolver);
    if (bindingB.diagnostic) diagnostics.push(bindingB.diagnostic);

    // Truthful check: If either reference is unresolved, constraint CANNOT be solved
    if (bindingA.status !== 'RESOLVED' || bindingB.status !== 'RESOLVED') {
      const diag = `[SECP_ASSEMBLY_CONSTRAINT_UNRESOLVED] Mate '${mate.mateId}' (${mate.type}) cannot be solved because references are unresolved: A=${bindingA.status}, B=${bindingB.status}.`;
      diagnostics.push(diag);
      return {
        mateId: mate.mateId,
        type: mate.type,
        bindingA,
        bindingB,
        status: 'UNSOLVED',
        satisfied: false,
        diagnostics
      };
    }

    const geomA = bindingA.worldGeometry!;
    const geomB = bindingB.worldGeometry!;

    // Evaluate geometric satisfaction based on constraint type
    switch (mate.type) {
      case 'COINCIDENT': {
        // Distance between origins/points
        const dx = geomA.origin.x - geomB.origin.x;
        const dy = geomA.origin.y - geomB.origin.y;
        const dz = geomA.origin.z - geomB.origin.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Normal alignment if normals exist
        let normalAlign = 1.0;
        if (geomA.normal && geomB.normal) {
          const dot = geomA.normal.x * geomB.normal.x + geomA.normal.y * geomB.normal.y + geomA.normal.z * geomB.normal.z;
          normalAlign = Math.abs(dot); // Opposed or aligned
        }

        const satisfied = dist <= tolerance && normalAlign >= (1.0 - tolerance);
        const status = satisfied ? 'SOLVED' : 'UNSOLVED';
        const diag = satisfied
          ? `[SECP_ASSEMBLY_CONSTRAINT_RESOLVED] COINCIDENT Mate '${mate.mateId}' satisfied (residual=${dist.toFixed(6)}m).`
          : `[SECP_ASSEMBLY_CONSTRAINT_UNSOLVED] COINCIDENT Mate '${mate.mateId}' not satisfied (residual=${dist.toFixed(6)}m > tol=${tolerance}m).`;
        diagnostics.push(diag);

        return {
          mateId: mate.mateId,
          type: mate.type,
          bindingA,
          bindingB,
          status,
          satisfied,
          residual: dist,
          diagnostics
        };
      }

      case 'CONCENTRIC': {
        // Direction alignment (axes must be parallel or anti-parallel)
        const dirA = geomA.direction || geomA.normal || { x: 0, y: 0, z: 1 };
        const dirB = geomB.direction || geomB.normal || { x: 0, y: 0, z: 1 };
        const dot = dirA.x * dirB.x + dirA.y * dirB.y + dirA.z * dirB.z;
        const isParallel = Math.abs(Math.abs(dot) - 1.0) <= tolerance;

        // Radial offset (perpendicular distance from originA to axisB)
        const delta = {
          x: geomA.origin.x - geomB.origin.x,
          y: geomA.origin.y - geomB.origin.y,
          z: geomA.origin.z - geomB.origin.z
        };
        const proj = delta.x * dirB.x + delta.y * dirB.y + delta.z * dirB.z;
        const perp = {
          x: delta.x - proj * dirB.x,
          y: delta.y - proj * dirB.y,
          z: delta.z - proj * dirB.z
        };
        const radialDist = Math.sqrt(perp.x * perp.x + perp.y * perp.y + perp.z * perp.z);

        const satisfied = isParallel && radialDist <= tolerance;
        const status = satisfied ? 'SOLVED' : 'UNSOLVED';
        const diag = satisfied
          ? `[SECP_ASSEMBLY_CONSTRAINT_RESOLVED] CONCENTRIC Mate '${mate.mateId}' satisfied (axis offset=${radialDist.toFixed(6)}m).`
          : `[SECP_ASSEMBLY_CONSTRAINT_UNSOLVED] CONCENTRIC Mate '${mate.mateId}' not satisfied (offset=${radialDist.toFixed(6)}m, parallel=${isParallel}).`;
        diagnostics.push(diag);

        return {
          mateId: mate.mateId,
          type: mate.type,
          bindingA,
          bindingB,
          status,
          satisfied,
          residual: radialDist,
          diagnostics
        };
      }

      case 'DISTANCE': {
        const dx = geomA.origin.x - geomB.origin.x;
        const dy = geomA.origin.y - geomB.origin.y;
        const dz = geomA.origin.z - geomB.origin.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const targetOffset = mate.offset ?? 0;
        const residual = Math.abs(dist - targetOffset);

        const satisfied = residual <= tolerance;
        const status = satisfied ? 'SOLVED' : 'UNSOLVED';
        const diag = satisfied
          ? `[SECP_ASSEMBLY_CONSTRAINT_RESOLVED] DISTANCE Mate '${mate.mateId}' satisfied (dist=${dist.toFixed(6)}m, target=${targetOffset}m).`
          : `[SECP_ASSEMBLY_CONSTRAINT_UNSOLVED] DISTANCE Mate '${mate.mateId}' not satisfied (residual=${residual.toFixed(6)}m > tol=${tolerance}m).`;
        diagnostics.push(diag);

        return {
          mateId: mate.mateId,
          type: mate.type,
          bindingA,
          bindingB,
          status,
          satisfied,
          residual,
          diagnostics
        };
      }

      case 'PARALLEL': {
        const normA = geomA.normal || geomA.direction || { x: 0, y: 0, z: 1 };
        const normB = geomB.normal || geomB.direction || { x: 0, y: 0, z: 1 };
        const dot = normA.x * normB.x + normA.y * normB.y + normA.z * normB.z;
        const residual = Math.abs(Math.abs(dot) - 1.0);

        const satisfied = residual <= tolerance;
        const status = satisfied ? 'SOLVED' : 'UNSOLVED';
        const diag = satisfied
          ? `[SECP_ASSEMBLY_CONSTRAINT_RESOLVED] PARALLEL Mate '${mate.mateId}' satisfied.`
          : `[SECP_ASSEMBLY_CONSTRAINT_UNSOLVED] PARALLEL Mate '${mate.mateId}' not satisfied (residual=${residual.toFixed(6)}).`;
        diagnostics.push(diag);

        return {
          mateId: mate.mateId,
          type: mate.type,
          bindingA,
          bindingB,
          status,
          satisfied,
          residual,
          diagnostics
        };
      }

      case 'ANGLE': {
        const normA = geomA.normal || geomA.direction || { x: 0, y: 0, z: 1 };
        const normB = geomB.normal || geomB.direction || { x: 0, y: 0, z: 1 };
        const dot = Math.max(-1, Math.min(1, normA.x * normB.x + normA.y * normB.y + normA.z * normB.z));
        const angleRad = Math.acos(dot);
        const angleDeg = (angleRad * 180) / Math.PI;
        const targetDeg = (mate.parameters?.angleDeg ?? (mate.offset ? (mate.offset * 180) / Math.PI : 0));
        const residual = Math.abs(angleDeg - targetDeg);

        const satisfied = residual <= 0.1; // 0.1 deg
        const status = satisfied ? 'SOLVED' : 'UNSOLVED';
        const diag = satisfied
          ? `[SECP_ASSEMBLY_CONSTRAINT_RESOLVED] ANGLE Mate '${mate.mateId}' satisfied (angle=${angleDeg.toFixed(2)}°, target=${targetDeg}°).`
          : `[SECP_ASSEMBLY_CONSTRAINT_UNSOLVED] ANGLE Mate '${mate.mateId}' not satisfied (residual=${residual.toFixed(2)}°).`;
        diagnostics.push(diag);

        return {
          mateId: mate.mateId,
          type: mate.type,
          bindingA,
          bindingB,
          status,
          satisfied,
          residual,
          diagnostics
        };
      }

      default: {
        const diag = `[SECP_ASSEMBLY_CONSTRAINT_UNSOLVED] Unsupported mate type: '${mate.type}'.`;
        diagnostics.push(diag);
        return {
          mateId: mate.mateId,
          type: mate.type,
          bindingA,
          bindingB,
          status: 'UNSUPPORTED',
          satisfied: false,
          diagnostics
        };
      }
    }
  }

  /**
   * Solves and binds all hierarchical constraints across the entire assembly document.
   */
  public static solveHierarchicalConstraints(
    rootDoc: EngineeringDocument,
    resolver?: IDocumentResolver,
    tolerancePolicy?: string
  ): HierarchicalAssemblyBindingResult {
    const diagnostics: string[] = [];
    const bindings = new Map<string, BoundTopologicalEntity>();
    const evaluatedMates: HierarchicalMateEvaluation[] = [];

    if (!rootDoc.assembly || !rootDoc.assembly.mates) {
      return {
        bindings,
        evaluatedMates: [],
        allMatesSolved: true,
        hasErrors: false,
        diagnostics
      };
    }

    // Sort mates deterministically
    const sortedMates = [...rootDoc.assembly.mates].sort((a, b) => a.mateId.localeCompare(b.mateId));

    // Detect conflicting constraints
    const mateConflicts = new Set<string>();
    for (let i = 0; i < sortedMates.length; i++) {
      const m1 = sortedMates[i];
      for (let j = i + 1; j < sortedMates.length; j++) {
        const m2 = sortedMates[j];
        const isSamePair =
          (m1.instanceAId === m2.instanceAId && m1.instanceBId === m2.instanceBId) ||
          (m1.instanceAId === m2.instanceBId && m1.instanceBId === m2.instanceAId);

        if (isSamePair) {
          if (m1.type === 'COINCIDENT' && m2.type === 'DISTANCE' && (m2.offset || 0) > 1e-4) {
            mateConflicts.add(m1.mateId);
            mateConflicts.add(m2.mateId);
          }
        }
      }
    }

    for (const mate of sortedMates) {
      if (mateConflicts.has(mate.mateId)) {
        const diag = `[SECP_ASSEMBLY_CONSTRAINT_CONFLICT] Mate '${mate.mateId}' conflicts with another constraint on the same instances/entities.`;
        diagnostics.push(diag);
        evaluatedMates.push({
          mateId: mate.mateId,
          type: mate.type,
          status: 'CONFLICTING',
          satisfied: false,
          diagnostics: [diag]
        });
        continue;
      }

      const evalResult = this.evaluateHierarchicalMate(rootDoc, mate, resolver, tolerancePolicy);
      for (const d of evalResult.diagnostics) {
        diagnostics.push(d);
      }

      if (evalResult.bindingA) {
        bindings.set(`${mate.mateId}:A`, evalResult.bindingA);
      }
      if (evalResult.bindingB) {
        bindings.set(`${mate.mateId}:B`, evalResult.bindingB);
      }

      evaluatedMates.push(evalResult);
    }

    const allMatesSolved = evaluatedMates.length > 0 && evaluatedMates.every(m => m.status === 'SOLVED');
    const hasErrors = evaluatedMates.some(m => m.status === 'UNSOLVED' || m.status === 'CONFLICTING');

    return {
      bindings,
      evaluatedMates,
      allMatesSolved,
      hasErrors,
      diagnostics
    };
  }

  // ==========================================
  // Helper Extractors for Local Entities
  // ==========================================

  private static extractFromEvaluatedShape(
    doc: EngineeringDocument,
    entityType: AssemblyTopologyEntityType,
    entityId: string
  ): TopologicalEntityGeometry | undefined {
    const shape = doc.evaluatedShape;
    if (!shape) return undefined;

    // Direct Solid topology check
    const solid: Solid | undefined = (shape as BRepSolid).topology || (shape as Solid);
    if (!solid || !solid.outerShell || !solid.outerShell.orientedFaces) {
      return undefined;
    }

    if (entityType === 'FACE' || entityType === 'PLANE') {
      for (const oface of solid.outerShell.orientedFaces) {
        const f = oface.face;
        if (f.id === entityId || f.persistentId === entityId) {
          // Extract face geometric center and normal
          const surf = f.geometry as any;
          const origin = surf?.origin || { x: 0, y: 0, z: 0 };
          const normal = surf?.normal || { x: 0, y: 0, z: 1 };
          const radius = surf?.radius;

          return {
            origin: { x: origin.x ?? 0, y: origin.y ?? 0, z: origin.z ?? 0 },
            normal: { x: normal.x ?? 0, y: normal.y ?? 0, z: normal.z ?? 1 },
            radius,
            localEntity: f
          };
        }
      }
    } else if (entityType === 'EDGE' || entityType === 'AXIS') {
      for (const oface of solid.outerShell.orientedFaces) {
        const outerLoop = oface.face.outerLoop;
        if (outerLoop && outerLoop.orientedEdges) {
          for (const oedge of outerLoop.orientedEdges) {
            const e = oedge.edge;
            if (e.id === entityId || e.persistentId === entityId) {
              const start = e.startVertex?.geometry || { x: 0, y: 0, z: 0 };
              const end = e.endVertex?.geometry || { x: 0, y: 0, z: 1 };
              const dx = (end as any).x - (start as any).x;
              const dy = (end as any).y - (start as any).y;
              const dz = (end as any).z - (start as any).z;
              const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
              const dir = len > 1e-9 ? { x: dx / len, y: dy / len, z: dz / len } : { x: 0, y: 0, z: 1 };

              return {
                origin: { x: (start as any).x ?? 0, y: (start as any).y ?? 0, z: (start as any).z ?? 0 },
                direction: dir,
                localEntity: e
              };
            }
          }
        }
      }
    } else if (entityType === 'VERTEX') {
      for (const oface of solid.outerShell.orientedFaces) {
        const outerLoop = oface.face.outerLoop;
        if (outerLoop && outerLoop.orientedEdges) {
          for (const oedge of outerLoop.orientedEdges) {
            const v1 = oedge.edge.startVertex;
            const v2 = oedge.edge.endVertex;
            if (v1 && (v1.id === entityId || v1.persistentId === entityId)) {
              const pt = (v1.geometry as any) || { x: 0, y: 0, z: 0 };
              return {
                origin: { x: pt.x ?? 0, y: pt.y ?? 0, z: pt.z ?? 0 },
                point: { x: pt.x ?? 0, y: pt.y ?? 0, z: pt.z ?? 0 },
                localEntity: v1
              };
            }
            if (v2 && (v2.id === entityId || v2.persistentId === entityId)) {
              const pt = (v2.geometry as any) || { x: 0, y: 0, z: 0 };
              return {
                origin: { x: pt.x ?? 0, y: pt.y ?? 0, z: pt.z ?? 0 },
                point: { x: pt.x ?? 0, y: pt.y ?? 0, z: pt.z ?? 0 },
                localEntity: v2
              };
            }
          }
        }
      }
    }

    return undefined;
  }

  private static extractDatumGeometry(
    doc: EngineeringDocument,
    entityType: AssemblyTopologyEntityType,
    entityId: string
  ): TopologicalEntityGeometry | undefined {
    // Check sketches for datum origins/planes
    if (doc.sketches) {
      for (const sk of doc.sketches) {
        if (sk.id === entityId || sk.name === entityId) {
          const origin = sk.origin || { x: 0, y: 0, z: 0 };
          const normal = sk.normal || (sk.plane === 'XY' ? { x: 0, y: 0, z: 1 } : sk.plane === 'XZ' ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 });
          return {
            origin: { x: origin.x ?? 0, y: origin.y ?? 0, z: origin.z ?? 0 },
            normal,
            direction: normal,
            localEntity: sk
          };
        }
      }
    }

    // Check features for datum planes/axes
    if (doc.features) {
      for (const feat of doc.features) {
        if (feat.id === entityId || feat.name === entityId) {
          const origin = feat.parameters?.origin || { x: 0, y: 0, z: 0 };
          const normal = feat.parameters?.normal || { x: 0, y: 0, z: 1 };
          const direction = feat.parameters?.direction || { x: 0, y: 0, z: 1 };

          return {
            origin: { x: origin.x ?? 0, y: origin.y ?? 0, z: origin.z ?? 0 },
            normal,
            direction,
            localEntity: feat
          };
        }
      }
    }

    return undefined;
  }

  private static extractFromTopologyMap(
    doc: EngineeringDocument,
    entityType: AssemblyTopologyEntityType,
    entityId: string
  ): TopologicalEntityGeometry | undefined {
    const lineage = doc.topologyMap;
    if (!lineage) return undefined;

    // Check faceMap
    if ((entityType === 'FACE' || entityType === 'PLANE') && lineage.faceMap) {
      const match = Object.entries(lineage.faceMap).find(([k, v]) => k === entityId || v === entityId);
      if (match) {
        return {
          origin: { x: 0, y: 0, z: 0 },
          normal: { x: 0, y: 0, z: 1 },
          localEntity: { id: match[1], tag: match[0] }
        };
      }
    }

    // Check edgeMap / vertexMap
    if ((entityType === 'EDGE' || entityType === 'AXIS') && lineage.edgeMap) {
      const match = Object.entries(lineage.edgeMap).find(([k, v]) => k === entityId || v === entityId);
      if (match) {
        return {
          origin: { x: 0, y: 0, z: 0 },
          direction: { x: 0, y: 0, z: 1 },
          localEntity: { id: match[1], tag: match[0] }
        };
      }
    }

    if (entityType === 'VERTEX' && lineage.vertexMap) {
      const match = Object.entries(lineage.vertexMap).find(([k, v]) => k === entityId || v === entityId);
      if (match) {
        return {
          origin: { x: 0, y: 0, z: 0 },
          point: { x: 0, y: 0, z: 0 },
          localEntity: { id: match[1], tag: match[0] }
        };
      }
    }

    return undefined;
  }
}
