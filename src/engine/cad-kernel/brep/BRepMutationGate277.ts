/**
 * SECP CAD Kernel — B-Rep Mutation Gate
 * Phase 3 (PROMPT-015)
 *
 * ARCHITECTURAL CONTRACT:
 * 1. Enforces "UI Success ≠ Engineering Success".
 * 2. Captures Before/After snapshots of canonical B-Rep (Topology + Geometry).
 * 3. Verifies actual mutations via hashes, volumes, and feature lineage.
 * 4. Prevents "Success" claims if no actual B-Rep change occurred for geometric operations.
 */

import { EngineeringDocument, EvidenceRecord } from '../document/CADDocument';
import { Solid } from '../topology/TopologyContracts';
import { BRepHasher, BRepEvidence } from '../topology/BRepHasher';
import { BRepKernel } from './BRepKernel';

export interface BRepSnapshot {
  documentId: string;
  revision: number | string;
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
  featureCount: number;
  timestamp: number;
}

export type MutationVerdictStatus = 'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'NOT_APPLICABLE';

export interface MutationVerdict {
  status: MutationVerdictStatus;
  reason: string;
  delta: {
    topologyChanged: boolean;
    geometryChanged: boolean;
    volumeDelta: number;
    surfaceAreaDelta: number;
    featureCountDelta: number;
    revisionChanged: boolean;
  };
}

export class BRepMutationGate277 {
  /**
   * Captures a canonical snapshot of the current B-Rep state in the document.
   */
  public static captureSnapshot(doc: EngineeringDocument): BRepSnapshot {
    const shape = doc.evaluatedShape as Solid;
    let evidence: BRepEvidence = {
      topologyHash: 'EMPTY',
      geometryHash: 'EMPTY',
      entityCounts: { vertices: 0, edges: 0, faces: 0, shells: 0 }
    };
    
    let volume = 0;
    let surfaceArea = 0;

    if (shape && shape.shapeType === 'SOLID') {
      evidence = BRepHasher.computeEvidence(shape);
      const kernel = BRepKernel.getCanonical();
      volume = kernel.computeVolume(shape as any);
      surfaceArea = kernel.computeSurfaceArea(shape as any);
    }

    return {
      documentId: doc.documentId,
      revision: doc.revision,
      topologyHash: evidence.topologyHash,
      geometryHash: evidence.geometryHash,
      entityCounts: evidence.entityCounts,
      volume,
      surfaceArea,
      featureCount: doc.features.length,
      timestamp: Date.now()
    };
  }

  /**
   * Verifies the mutation between two snapshots based on the operation semantics.
   */
  public static verify(
    before: BRepSnapshot,
    after: BRepSnapshot,
    operationType: 'ADDITIVE' | 'SUBTRACTIVE' | 'TRANSFORM' | 'NON_GEOMETRIC' | string = 'ADDITIVE'
  ): MutationVerdict {
    const topologyChanged = before.topologyHash !== after.topologyHash;
    const geometryChanged = before.geometryHash !== after.geometryHash;
    const volumeDelta = after.volume - before.volume;

    console.log(`[MUTATION GATE] before.geomHash=${before.geometryHash}, after.geomHash=${after.geometryHash}, topologyChanged=${topologyChanged}, geometryChanged=${geometryChanged}, op=${operationType}`);
    const surfaceAreaDelta = after.surfaceArea - before.surfaceArea;
    const featureCountDelta = after.featureCount - before.featureCount;
    const revisionChanged = before.revision !== after.revision;

    const delta = {
      topologyChanged,
      geometryChanged,
      volumeDelta,
      surfaceAreaDelta,
      featureCountDelta,
      revisionChanged
    };

    // 1. Basic Identity Check
    if (before.documentId !== after.documentId) {
      return { status: 'FAIL', reason: 'Document ID mismatch between snapshots.', delta };
    }

    // 2. Non-Geometric Operations
    if (operationType === 'NON_GEOMETRIC') {
      return { status: 'PASS', reason: 'Non-geometric operation verified via metadata.', delta };
    }

    // 3. Mutation Proof
    if (!topologyChanged && !geometryChanged && operationType !== 'TRANSFORM') {
      // If a geometric operation claims success but hashes match, it's a fake mutation
      return { status: 'FAIL', reason: 'No B-Rep mutation detected for geometric operation (UI Bypass detected).', delta };
    }

    // 4. Operation Semantics Verification
    if (operationType === 'ADDITIVE' && volumeDelta < -1e-9) {
      return { status: 'FAIL', reason: `Additive operation resulted in volume reduction (Expected >= 0, Got ${volumeDelta}).`, delta };
    }

    if (operationType === 'SUBTRACTIVE' && volumeDelta > 1e-9) {
      return { status: 'FAIL', reason: `Subtractive operation resulted in volume increase (Expected <= 0, Got ${volumeDelta}).`, delta };
    }

    // 5. Lineage Check (Simplified for now)
    if (featureCountDelta === 0 && !revisionChanged && (topologyChanged || geometryChanged)) {
      return { status: 'INCONCLUSIVE', reason: 'B-Rep changed without feature count or revision change. Possible direct mutation bypass.', delta };
    }

    return { 
      status: 'PASS', 
      reason: 'B-Rep mutation verified successfully against operation semantics.', 
      delta 
    };
  }
}
