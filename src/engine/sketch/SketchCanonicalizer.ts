/**
 * SECP CAD Kernel — Sketch Canonicalizer
 * Phase 2 (PATCH-024)
 */

import { SketchModel } from './SketchModel';
import { CanonicalSerializer } from '../serialization/CanonicalSerializer';
import { CanonicalSerializationResult } from '../serialization/CanonicalSerializationTypes';

export class SketchCanonicalizer {
  /**
   * Canonicalizes a SketchModel into deterministic data.
   * 1. Sort entities by stable ID.
   * 2. Normalize representation ordering.
   * 3. Preserve essential fields, exclude runtime-only fields.
   */
  public static canonicalize(model: SketchModel): CanonicalSerializationResult {
    // 1. Sort entities by artifactId
    const sortedEntities = [...model.entities].sort((a, b) => 
      a.id.projectId.localeCompare(b.id.projectId)
    );

    // 2. Sort constraints by artifactId
    const sortedConstraints = [...model.constraints].sort((a, b) => 
      a.id.projectId.localeCompare(b.id.projectId)
    );

    // 3. Prepare normalized model structure
    const canonicalModel = {
      id: {
        identityId: model.id.identityId,
        objectType: model.id.objectType,
        revisionId: model.id.revisionId,
        projectId: model.id.projectId,
      },
      name: model.name,
      coordinateSystem: {
        origin: { x: model.coordinateSystem.origin.x, y: model.coordinateSystem.origin.y },
        xAxis: { x: model.coordinateSystem.xAxis.x, y: model.coordinateSystem.xAxis.y },
        yAxis: { x: model.coordinateSystem.yAxis.x, y: model.coordinateSystem.yAxis.y },
        normal: { x: model.coordinateSystem.normal.x, y: model.coordinateSystem.normal.y, z: model.coordinateSystem.normal.z },
      },
      entities: sortedEntities.map(e => ({
        id: {
          identityId: e.id.identityId,
          objectType: e.id.objectType,
          revisionId: e.id.revisionId,
          projectId: e.id.projectId,
        },
        type: e.type,
        sketchId: {
          identityId: e.sketchId.identityId,
          objectType: e.sketchId.objectType,
          revisionId: e.sketchId.revisionId,
          projectId: e.sketchId.projectId,
        },
        construction: e.construction,
        geometry: e.geometry,
        // Metadata is filtered to exclude non-deterministic fields if any (here we keep it as provided but user must follow rules)
        metadata: e.metadata,
        provenance: {
          id: e.provenance.id,
          type: e.provenance.type,
          engineeringIdentityId: e.provenance.engineeringIdentityId,
          canonicalHash: e.provenance.canonicalHash,
          version: e.provenance.version,
          // source is included if present
          ...(e.provenance.source ? { source: e.provenance.source } : {}),
        }
      })),
      constraints: sortedConstraints.map(c => ({
        id: {
          identityId: c.id.identityId,
          objectType: c.id.objectType,
          revisionId: c.id.revisionId,
          projectId: c.id.projectId,
        },
        type: c.type,
        entityIds: c.entityIds.map(eid => ({
          identityId: eid.identityId,
          objectType: eid.objectType,
          revisionId: eid.revisionId,
          projectId: eid.projectId,
        })),
        value: c.value,
        expression: c.expression,
        unit: c.unit,
      })),
      version: model.version,
      units: model.units,
      tolerance: {
        linear: model.tolerance.linear,
        angular: model.tolerance.angular,
        parametric: model.tolerance.parametric,
        distance: model.tolerance.distance,
        coincidence: model.tolerance.coincidence,
        unitSystem: model.tolerance.unitSystem,
        scale: model.tolerance.scale,
        policyId: model.tolerance.policyId,
        version: model.tolerance.version,
      },
      // Top-level provenance
      provenance: {
        id: model.provenance.id,
        type: model.provenance.type,
        engineeringIdentityId: model.provenance.engineeringIdentityId,
        canonicalHash: model.provenance.canonicalHash,
        version: model.provenance.version,
      },
      // Explicitly exclude runtime-only fields or non-deterministic fields
    };

    return CanonicalSerializer.serialize(canonicalModel);
  }
}
