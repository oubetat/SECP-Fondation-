/**
 * SECP CAD Kernel — Canonical 3D Rendering Contract
 * Phase 2 (SECP-3D-CANONICAL-CONTRACT-001)
 *
 * ARCHITECTURAL CONTRACT:
 * - Pure TypeScript data representation for derived rendering output.
 * - STRICTLY ISOLATED from Three.js, React, and DOM primitives.
 * - Represents the derived render state extracted directly from authoritative
 *   B-Rep evaluation & tessellation (DocumentEvaluator / BRepTessellator).
 * - Enforces document provenance: documentId, revision, brepHash, meshHash, units, and topologyMap.
 *
 * PIPELINE:
 *   EngineeringDocument (Canonical Truth)
 *          │
 *          ▼
 *   DocumentEvaluator.evaluate(doc)
 *          │
 *          ▼
 *   Evaluated Shape (BRep Solid)
 *          │
 *          ▼
 *   BRepTessellator.tessellate(solid) -> MeshGeometryData
 *          │
 *          ▼
 *   CanonicalRenderData (Derived Contract)
 *          │
 *   ───────┴────────────────────────────── (Presentation Boundary)
 *          ▼
 *   Presentation Adapter (e.g. Three.js / WebGL / WebGPU Viewport)
 */

import { MeshGeometryData, MeshTopologyMap, BRepTessellator } from '../cad-kernel/tessellation/BRepTessellator';
import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { Solid } from '../cad-kernel/topology/TopologyContracts';

/**
 * Authoritative Canonical Render Data Contract.
 * Contains all geometry coordinates, indices, normals, and topological lineage
 * required to render the evaluated model without querying the CAD kernel during presentation.
 */
export interface CanonicalRenderData {
  /** Canonical Document Identifier */
  readonly documentId: string;

  /** Canonical Engineering Revision from which this render artifact was derived */
  readonly revision: number | string;

  /** Cryptographic hash of the evaluated B-Rep solid */
  readonly brepHash: string;

  /** Cryptographic hash of the tessellated mesh buffer */
  readonly meshHash: string;

  /** Engineering coordinates in Canonical Units (Meters) */
  readonly vertices: readonly number[];

  /** Unit normal vectors (nx, ny, nz) */
  readonly normals: readonly number[];

  /** Triangle index buffer for indexed drawing */
  readonly indices: readonly number[];

  /** Total number of rendered triangles */
  readonly facesCount: number;

  /** Full topological mapping preserving Face, Edge, Vertex, and shared boundary lineage */
  readonly topologyMap: MeshTopologyMap;

  /** Authoritative measurement unit for the raw vertex coordinates (Standard: 'm' for SI meters) */
  readonly units: string;

  /** Deterministic creation timestamp */
  readonly timestamp: number;

  /** Flag indicating whether valid renderable geometry is present */
  readonly hasGeometry: boolean;
}

/**
 * Factory for creating CanonicalRenderData from an evaluated EngineeringDocument.
 * Reuses already-evaluated `doc.derived.mesh` when available to prevent duplicate tessellation.
 */
export function createCanonicalRenderData(
  doc: EngineeringDocument,
  customMesh?: MeshGeometryData
): CanonicalRenderData {
  const documentId = doc.documentId || 'DOC-UNNAMED';
  const revision = doc.revision !== undefined ? doc.revision : 0;
  const units = doc.units?.length || 'm';

  // 1. Prefer explicitly supplied mesh if provided
  if (customMesh && customMesh.vertices && customMesh.vertices.length > 0) {
    return createCanonicalRenderDataFromMesh(documentId, revision, customMesh, units);
  }

  // 2. Reuse derived mesh from document evaluator if already generated (Prevents duplicate tessellation)
  if (doc.derived?.mesh && doc.derived.mesh.vertices && doc.derived.mesh.vertices.length > 0) {
    return createCanonicalRenderDataFromMesh(documentId, revision, doc.derived.mesh, units);
  }

  // 3. Fallback: If document has an evaluated shape but mesh was not derived, tessellate once
  if (doc.evaluatedShape) {
    const tessellated = BRepTessellator.tessellate(doc.evaluatedShape as unknown as Solid);
    return createCanonicalRenderDataFromMesh(documentId, revision, tessellated, units);
  }

  // 4. Empty document state (e.g. initial blank model before feature addition)
  return createEmptyCanonicalRenderData(documentId, revision, units);
}

/**
 * Builds a CanonicalRenderData contract object directly from pre-tessellated MeshGeometryData.
 */
export function createCanonicalRenderDataFromMesh(
  documentId: string,
  revision: number | string,
  mesh: MeshGeometryData,
  units: string = 'm'
): CanonicalRenderData {
  return Object.freeze({
    documentId,
    revision,
    brepHash: mesh.brepHash || '',
    meshHash: mesh.meshHash || '',
    vertices: Object.freeze(mesh.vertices ? [...mesh.vertices] : []),
    normals: Object.freeze(mesh.normals ? [...mesh.normals] : []),
    indices: Object.freeze(mesh.indices ? [...mesh.indices] : []),
    facesCount: mesh.facesCount || (mesh.indices ? mesh.indices.length / 3 : 0),
    topologyMap: Object.freeze(mesh.topologyMap || {
      faceTriangleMap: {},
      edgeVertexMap: {},
      vertexIndexMap: {},
      sharedEdges: []
    }),
    units,
    timestamp: Date.now(),
    hasGeometry: !!(mesh.vertices && mesh.vertices.length > 0)
  });
}

/**
 * Constructs a valid empty CanonicalRenderData structure for blank or un-evaluated documents.
 */
export function createEmptyCanonicalRenderData(
  documentId: string = 'DOC-EMPTY',
  revision: number | string = 0,
  units: string = 'm'
): CanonicalRenderData {
  return Object.freeze({
    documentId,
    revision,
    brepHash: '',
    meshHash: '',
    vertices: Object.freeze([]),
    normals: Object.freeze([]),
    indices: Object.freeze([]),
    facesCount: 0,
    topologyMap: Object.freeze({
      faceTriangleMap: {},
      edgeVertexMap: {},
      vertexIndexMap: {},
      sharedEdges: []
    }),
    units,
    timestamp: Date.now(),
    hasGeometry: false
  });
}

/**
 * Verifies whether the provided CanonicalRenderData is strictly synchronized with the given EngineeringDocument.
 */
export function isRenderDataSynchronized(
  renderData: CanonicalRenderData,
  doc: EngineeringDocument
): boolean {
  if (!renderData || !doc) return false;
  return (
    renderData.documentId === doc.documentId &&
    String(renderData.revision) === String(doc.revision) &&
    (!doc.derived?.mesh?.meshHash || renderData.meshHash === doc.derived.mesh.meshHash)
  );
}

/**
 * Helper to check if topological entity mappings (faces, edges) are present in the render contract.
 */
export function hasTopologicalLineage(renderData: CanonicalRenderData): boolean {
  if (!renderData || !renderData.topologyMap) return false;
  const faceCount = Object.keys(renderData.topologyMap.faceTriangleMap || {}).length;
  const edgeCount = Object.keys(renderData.topologyMap.edgeVertexMap || {}).length;
  return faceCount > 0 || edgeCount > 0;
}
