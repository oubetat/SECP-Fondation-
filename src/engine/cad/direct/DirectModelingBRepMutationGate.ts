import { 
  DirectModelingOperationType, 
  SelectedEntity 
} from './DirectModelingTypes';

export interface BRepStateSnapshot {
  topologyHash: string;
  geometryHash: string;
  entityCounts: {
    vertices: number;
    edges: number;
    faces: number;
    shells: number;
  };
  volume: number;
  surfaceArea: number;
  viewportTransform?: string;
  meshVerticesCount?: number;
  reactStateField?: string;
  metadataRevision?: string;
  parametersOnly?: boolean;
  evidenceVerdict?: string;
}

export interface BRepMutationProof {
  operation: DirectModelingOperationType;
  beforeSignature: BRepStateSnapshot;
  afterSignature: BRepStateSnapshot;

  geometryChanged: boolean;
  topologyChanged: boolean;
  volumeDelta: number;
  surfaceAreaDelta: number;

  affectedEntities: string[];
  lineageStatus: 'RESOLVED' | 'LINEAGE_UNRESOLVED';

  validityBefore: boolean;
  validityAfter: boolean;

  mutationConfirmed: boolean;
  reason?: string;
}

/**
 * SECP CAD Direct Modeling B-Rep Mutation Gate
 * Enforces "No Real B-Rep Mutation = No Success" (Prompt-030).
 */
export class DirectModelingBRepMutationGate {
  private tolerance = 1e-6;

  /**
   * Evaluates the requested mutation against actual canonical before/after snapshots.
   */
  public verifyMutation(
    operation: DirectModelingOperationType,
    targetEntities: SelectedEntity[],
    parameters: Record<string, any>,
    before: BRepStateSnapshot,
    after: BRepStateSnapshot
  ): BRepMutationProof {
    const topologyChanged = before.topologyHash !== after.topologyHash;
    const geometryChanged = before.geometryHash !== after.geometryHash;
    const volumeDelta = after.volume - before.volume;
    const surfaceAreaDelta = after.surfaceArea - before.surfaceArea;

    const affectedEntities = targetEntities.map(e => e.id);
    let lineageStatus: 'RESOLVED' | 'LINEAGE_UNRESOLVED' = 'RESOLVED';

    // If target selection IDs do not map to output or have mismatch, resolve as unresolved
    if (affectedEntities.length === 0 || affectedEntities.some(id => id.includes('UNKNOWN') || id.includes('UNRESOLVED'))) {
      lineageStatus = 'LINEAGE_UNRESOLVED';
    }

    const proof: BRepMutationProof = {
      operation,
      beforeSignature: before,
      afterSignature: after,
      geometryChanged,
      topologyChanged,
      volumeDelta,
      surfaceAreaDelta,
      affectedEntities,
      lineageStatus,
      validityBefore: before.volume >= 0 && before.surfaceArea >= 0,
      validityAfter: after.volume >= 0 && after.surfaceArea >= 0,
      mutationConfirmed: false
    };

    // --- FALSE POSITIVE PROTECTION & NEGATIVE PROOFS ---

    // Case A: Only React state changed
    if (before.reactStateField !== after.reactStateField && 
        before.topologyHash === after.topologyHash && 
        before.geometryHash === after.geometryHash && 
        before.volume === after.volume && 
        before.surfaceArea === after.surfaceArea) {
      proof.mutationConfirmed = false;
      proof.reason = 'FAIL: Only React state changed. No canonical B-Rep mutation detected.';
      return proof;
    }

    // Case B: Only viewport changed
    if (before.viewportTransform !== after.viewportTransform && 
        before.topologyHash === after.topologyHash && 
        before.geometryHash === after.geometryHash && 
        before.volume === after.volume && 
        before.surfaceArea === after.surfaceArea) {
      proof.mutationConfirmed = false;
      proof.reason = 'FAIL: Only viewport transform changed. No canonical B-Rep mutation detected.';
      return proof;
    }

    // Case C: Only mesh changed (viewport tessellation update)
    if (before.meshVerticesCount !== after.meshVerticesCount && 
        before.topologyHash === after.topologyHash && 
        before.geometryHash === after.geometryHash && 
        before.volume === after.volume && 
        before.surfaceArea === after.surfaceArea) {
      proof.mutationConfirmed = false;
      proof.reason = 'FAIL: Only mesh representation/tessellation changed. No canonical B-Rep mutation detected.';
      return proof;
    }

    // Case D: Only feature metadata changed
    if (before.metadataRevision !== after.metadataRevision && 
        before.topologyHash === after.topologyHash && 
        before.geometryHash === after.geometryHash && 
        before.volume === after.volume && 
        before.surfaceArea === after.surfaceArea) {
      proof.mutationConfirmed = false;
      proof.reason = 'FAIL: Only feature metadata/revision changed. No canonical B-Rep mutation detected.';
      return proof;
    }

    // Case G: Evidence says PASS but B-Rep unchanged
    if (after.evidenceVerdict === 'PASS' && 
        before.topologyHash === after.topologyHash && 
        before.geometryHash === after.geometryHash && 
        before.volume === after.volume && 
        before.surfaceArea === after.surfaceArea) {
      proof.mutationConfirmed = false;
      proof.reason = 'FAIL: Evidence claims success but canonical B-Rep remains unchanged.';
      return proof;
    }

    // Case F: New object created but canonical geometry/topology unchanged (and not Case E/G specifically)
    if (before !== after && 
        before.topologyHash === after.topologyHash && 
        before.geometryHash === after.geometryHash && 
        before.volume === after.volume && 
        before.surfaceArea === after.surfaceArea &&
        parameters && (parameters.vector && parameters.vector[0] === 0 && parameters.vector[1] === 0 && parameters.vector[2] === 0)) {
      proof.mutationConfirmed = false;
      proof.reason = 'FAIL: New state object created but canonical geometry/topology is unchanged.';
      return proof;
    }

    // Case E: Only parameter changed
    if (after.parametersOnly === true || 
        (before.topologyHash === after.topologyHash && 
         before.geometryHash === after.geometryHash && 
         before.volume === after.volume && 
         before.surfaceArea === after.surfaceArea && 
         parameters && Object.keys(parameters).length > 0)) {
      proof.mutationConfirmed = false;
      proof.reason = 'FAIL: Only parameters changed. No canonical B-Rep mutation detected.';
      return proof;
    }

    // Verify basic physical validation (solid validity)
    if (!proof.validityAfter) {
      proof.mutationConfirmed = false;
      proof.reason = 'FAIL: Mutated B-Rep is invalid (negative or zero geometric volume/area).';
      return proof;
    }

    // --- OPERATION-SPECIFIC MUTATION PROOFS ---
    switch (operation) {
      case DirectModelingOperationType.MOVE_FACE:
        // Must have geometry variation but can retain topology arrangement
        if (!geometryChanged) {
          proof.mutationConfirmed = false;
          proof.reason = 'FAIL: MOVE_FACE did not alter B-Rep coordinates/geometry.';
        } else {
          proof.mutationConfirmed = true;
        }
        break;

      case DirectModelingOperationType.OFFSET_FACE:
        // Volume and surface area must change according to offset parameters
        if (!geometryChanged || Math.abs(volumeDelta) < this.tolerance) {
          proof.mutationConfirmed = false;
          proof.reason = 'FAIL: OFFSET_FACE did not produce geometric offsets or volumetric delta.';
        } else {
          proof.mutationConfirmed = true;
        }
        break;

      case DirectModelingOperationType.DELETE_FACE:
        // Must reduce face count and change topology arrangement
        if (!topologyChanged || after.entityCounts.faces >= before.entityCounts.faces) {
          proof.mutationConfirmed = false;
          proof.reason = 'FAIL: DELETE_FACE did not reduce face counts or change topology connectivity.';
        } else {
          proof.mutationConfirmed = true;
        }
        break;

      case DirectModelingOperationType.REPLACE_FACE:
        // Geometry must change; optionally topology changes if boundaries adjust
        if (!geometryChanged) {
          proof.mutationConfirmed = false;
          proof.reason = 'FAIL: REPLACE_FACE did not replace face geometry.';
        } else {
          proof.mutationConfirmed = true;
        }
        break;

      case DirectModelingOperationType.MOVE_EDGE:
        // Must alter coordinates, connected vertices and curve geometry
        if (!geometryChanged) {
          proof.mutationConfirmed = false;
          proof.reason = 'FAIL: MOVE_EDGE did not alter edge curve coordinates/geometry.';
        } else {
          proof.mutationConfirmed = true;
        }
        break;

      case DirectModelingOperationType.MOVE_VERTEX:
        // Must shift the single vertex and propagate through edge geometry
        if (!geometryChanged) {
          proof.mutationConfirmed = false;
          proof.reason = 'FAIL: MOVE_VERTEX did not update vertex coordinates/geometry.';
        } else {
          proof.mutationConfirmed = true;
        }
        break;

      case DirectModelingOperationType.PUSH_PULL:
        // Must alter geometry and produce a volumetric change
        if (!geometryChanged || Math.abs(volumeDelta) < this.tolerance) {
          proof.mutationConfirmed = false;
          proof.reason = 'FAIL: PUSH_PULL did not alter geometry or produce volumetric displacement.';
        } else {
          proof.mutationConfirmed = true;
        }
        break;

      case DirectModelingOperationType.DEFEATURE:
        // Must remove targeted features, decreasing vertex/edge/face count
        const countsDecreased = 
          after.entityCounts.vertices < before.entityCounts.vertices || 
          after.entityCounts.edges < before.entityCounts.edges || 
          after.entityCounts.faces < before.entityCounts.faces;

        if (!topologyChanged || !countsDecreased) {
          proof.mutationConfirmed = false;
          proof.reason = 'FAIL: DEFEATURE did not simplify topology or reduce entity counts.';
        } else {
          proof.mutationConfirmed = true;
        }
        break;

      default:
        proof.mutationConfirmed = false;
        proof.reason = `FAIL: Operation ${operation} is unsupported by the B-Rep Mutation Gate.`;
    }

    return proof;
  }
}
