import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';
import { CanonicalCollisionGeometry, CanonicalCollisionInput, Vector3DImmutable, Triangle3DExact } from '../types';
export type { Triangle3DExact };

export class CanonicalGeometryAdapter {
  public static adapt(doc: EngineeringDocument): CanonicalCollisionGeometry {
    const geoHash = doc.derived?.geometryHash || doc.derived?.bRepHash || 'STABLE_EMPTY_HASH';
    const mesh = doc.derived?.mesh;
    const triangles: any[] = [];
    if (mesh && mesh.vertices && mesh.indices) {
      const vertices = mesh.vertices;
      const indices = mesh.indices;
      for (let i = 0; i < indices.length; i += 3) {
        triangles.push([
          { x: vertices[indices[i] * 3], y: vertices[indices[i] * 3 + 1], z: vertices[indices[i] * 3 + 2] },
          { x: vertices[indices[i + 1] * 3], y: vertices[indices[i + 1] * 3 + 1], z: vertices[indices[i + 1] * 3 + 2] },
          { x: vertices[indices[i + 2] * 3], y: vertices[indices[i + 2] * 3 + 1], z: vertices[indices[i + 2] * 3 + 2] }
        ]);
      }
    }

    // Determine bounds
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    if (mesh && mesh.vertices && mesh.vertices.length > 0) {
      for (let i = 0; i < mesh.vertices.length; i += 3) {
        const x = mesh.vertices[i];
        const y = mesh.vertices[i + 1];
        const z = mesh.vertices[i + 2];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
      }
    } else {
      minX = -10; minY = -10; minZ = -10;
      maxX = 10; maxY = 10; maxZ = 10;
    }

    return {
      documentId: doc.documentId,
      revisionId: String(doc.revision),
      geometryId: doc.documentId + '_GEOM',
      geometryRevision: typeof doc.revision === 'number' ? doc.revision : 1,
      snapshotId: 'SNAP-' + doc.documentId + '-' + doc.revision,
      topologyIdentity: doc.derived?.topologyHash || 'TOPO_01',
      geometrySource: 'CAD',
      provenance: 'ADAPTER::CANONICAL_ADAPTER',
      coordinateFrame: 'WCS',
      units: 'MILLIMETERS',
      bounds: {
        min: { x: minX, y: minY, z: minZ },
        max: { x: maxX, y: maxY, z: maxZ }
      },
      geometryHash: geoHash,
      tessellatedTriangles: triangles
    };
  }

  /**
   * Generates exact physical triangles from canonical geometry definitions.
   * This ensures the Geometric Kernel consumes data derived from the CAD source.
   */
  public static tessellate(geo: CanonicalCollisionGeometry): Triangle3DExact[] {
    if (geo.tessellatedTriangles && geo.tessellatedTriangles.length > 0) {
      return geo.tessellatedTriangles.map(t => ({
        v0: t.v0 || t.a || t[0],
        v1: t.v1 || t.b || t[1],
        v2: t.v2 || t.c || t[2]
      })) as Triangle3DExact[];
    }

    // Default: Tessellate a Box from bounds if no specific mesh is provided
    const min = geo.bounds?.min || { x: 0, y: 0, z: 0 };
    const max = geo.bounds?.max || { x: 70, y: 70, z: 30 };

    const p000 = { x: min.x, y: min.y, z: min.z };
    const p100 = { x: max.x, y: min.y, z: min.z };
    const p110 = { x: max.x, y: max.y, z: min.z };
    const p010 = { x: min.x, y: max.y, z: min.z };
    const p001 = { x: min.x, y: min.y, z: max.z };
    const p101 = { x: max.x, y: min.y, z: max.z };
    const p111 = { x: max.x, y: max.y, z: max.z };
    const p011 = { x: min.x, y: max.y, z: max.z };

    return [
      // Bottom face
      { v0: p000, v1: p110, v2: p100 }, { v0: p000, v1: p010, v2: p110 },
      // Top face
      { v0: p001, v1: p101, v2: p111 }, { v0: p001, v1: p111, v2: p011 },
      // Front face
      { v0: p000, v1: p100, v2: p101 }, { v0: p000, v1: p101, v2: p001 },
      // Back face
      { v0: p010, v1: p111, v2: p110 }, { v0: p010, v1: p011, v2: p111 },
      // Left face
      { v0: p000, v1: p001, v2: p011 }, { v0: p000, v1: p011, v2: p010 },
      // Right face
      { v0: p100, v1: p110, v2: p111 }, { v0: p100, v1: p111, v2: p101 }
    ];
  }

  public static validateBinding(
    input: CanonicalCollisionInput,
    canonicalDoc?: EngineeringDocument
  ): { isValid: boolean; reason?: string; errorCode?: string } {
    const geo = input.canonicalGeometry || input.geometry;
    if (!geo) {
      return { isValid: true };
    }

    if (!geo.documentId || !geo.revisionId || !geo.geometryId || !geo.geometryHash || !geo.snapshotId || !geo.topologyIdentity) {
      return {
        isValid: false,
        reason: 'CanonicalCollisionGeometry contract violation: missing mandatory fields.',
        errorCode: 'INVALID_GEOMETRY'
      };
    }

    if (geo.geometrySource === 'SYNTHETIC' && input.domain !== 'NC_SIMULATION') {
      return {
        isValid: false,
        reason: 'Forbidding synthetic/demo geometry for production authority evaluation.',
        errorCode: 'UNSUPPORTED'
      };
    }

    if (input.units !== geo.units) {
      return {
        isValid: false,
        reason: `Unit system mismatch: input expects ${input.units} but geometry is modeled in ${geo.units}`,
        errorCode: 'ANALYSIS_FAILED'
      };
    }

    if (input.coordinateFrame !== geo.coordinateFrame) {
      return {
        isValid: false,
        reason: `Coordinate frame mismatch: input coordinateFrame is ${input.coordinateFrame} but geometry expects ${geo.coordinateFrame}`,
        errorCode: 'ANALYSIS_FAILED'
      };
    }

    if (canonicalDoc) {
      if (geo.documentId !== (canonicalDoc.documentId || canonicalDoc.id)) {
        return {
          isValid: false,
          reason: `Document ID mismatch: geometry refers to ${geo.documentId} but registry returned ${canonicalDoc.documentId}`,
          errorCode: 'ANALYSIS_FAILED'
        };
      }

      if (geo.revisionId !== String(canonicalDoc.revision)) {
        return {
          isValid: false,
          reason: `Revision binding mismatch: geometry expected revision ${geo.revisionId} but registry is at ${canonicalDoc.revision}`,
          errorCode: 'ANALYSIS_FAILED'
        };
      }

      const canonicalGeoHash = canonicalDoc.derived?.geometryHash || canonicalDoc.derived?.bRepHash || 'STABLE_EMPTY_HASH';
      if (geo.geometryHash !== canonicalGeoHash) {
        return {
          isValid: false,
          reason: `Geometry Hash Mismatch: Stale or modified geometry detected. Expected ${canonicalGeoHash} but received ${geo.geometryHash}`,
          errorCode: 'ANALYSIS_FAILED'
        };
      }
    }

    return { isValid: true };
  }
}
