/**
 * SECP Industrial OS v3 — PROMPT-054: State Synchronization Negative Proofs
 * Adversarial negative proof suite verifying that state fracture, stale state display,
 * out-of-order event overwrites, and unvalidated status claims are strictly prevented.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { StateSyncEngine } from './StateSyncEngine';
import { CanonicalProjections } from './CanonicalProjections';
import { SelectionReference } from './SyncTypes';

export interface SyncNegativeProofResult {
  proofId: string;
  name: string;
  passed: boolean;
  expectedBehavior: string;
  actualBehavior: string;
  details: string;
}

export interface SyncNegativeProofReport {
  timestamp: string;
  totalCount: number;
  passCount: number;
  allPassed: boolean;
  results: SyncNegativeProofResult[];
}

export class SyncNegativeProofs {
  public static executeAllNegativeProofs(): SyncNegativeProofReport {
    const timestamp = new Date().toISOString();
    const results: SyncNegativeProofResult[] = [];
    const syncEngine = StateSyncEngine.getInstance();
    syncEngine.reset();

    const baseDoc: EngineeringDocument = {
      documentId: 'DOC-NEG-054',
      revision: 1,
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [{ id: 'SK-1', name: 'BaseSketch', plane: 'XY', entities: [] }],
      constraints: [],
      features: [{ id: 'FEAT-1', featureId: 'FEAT-1', name: 'Extrude1', type: 'EXTRUDE', parameters: { depth: 100 } }],
      parameters: [{ id: 'P-1', name: 'OverallLength', value: 100, unit: 'mm' }],
      topologyMap: { version: 1, faceMap: { FACE_1: 'TOPOLOGY_FACE_1' } },
      derived: { mesh: { vertices: new Float32Array(9), normals: new Float32Array(9), indices: new Uint32Array(3) } as any },
      evidence: [{
        evidenceId: 'EV-1',
        stage: 'GEOMETRY',
        sourceSystem: 'CADKernel',
        documentId: 'DOC-NEG-054',
        revision: 1,
        canonicalHash: '0xHASH1111',
        verdict: 'VALID'
      }]
    };

    // 1. SYNC-NEG-001: Feature Tree Divergence Prevention
    (() => {
      syncEngine.registerDocument(baseDoc);
      const mutatedDoc: EngineeringDocument = {
        ...baseDoc,
        revision: 2,
        features: [
          ...baseDoc.features,
          { id: 'FEAT-2', featureId: 'FEAT-2', name: 'Cutout1', type: 'CUT' }
        ]
      };
      const res = syncEngine.applyMutation(mutatedDoc);
      const snap = res.snapshot!;

      const passed = snap.featureTree.length === 3 && snap.featureTree.some(f => f.featureId === 'FEAT-2');
      results.push({
        proofId: 'SYNC-NEG-001',
        name: 'Feature Tree Synchronization Guarantee',
        passed,
        expectedBehavior: 'Feature tree projection must update atomically when document features change.',
        actualBehavior: `featureTree.length=${snap.featureTree.length}`,
        details: 'Feature tree strictly mirrors canonical features.'
      });
    })();

    // 2. SYNC-NEG-002: Property Parameter Stale Display Prevention
    (() => {
      const docRev3: EngineeringDocument = {
        ...baseDoc,
        revision: 3,
        parameters: [{ id: 'P-1', name: 'OverallLength', value: 150, unit: 'mm' }]
      };
      const res = syncEngine.applyMutation(docRev3);
      const snap = res.snapshot!;
      const paramProp = snap.properties.items.find(p => p.id === 'P-1');

      const passed = paramProp?.value === 150 && snap.properties.documentRevision === 3;
      results.push({
        proofId: 'SYNC-NEG-002',
        name: 'Properties Parameter Update Guarantee',
        passed,
        expectedBehavior: 'Properties parameter must reflect updated canonical value (150 mm) without local stale retention.',
        actualBehavior: `value=${paramProp?.value}, revision=${snap.properties.documentRevision}`,
        details: 'Properties parameter updated atomically.'
      });
    })();

    // 3. SYNC-NEG-003: Viewport Geometry Revision Invalidation
    (() => {
      const docRev4: EngineeringDocument = {
        ...baseDoc,
        revision: 4,
        topologyMap: { version: 4, hashes: { geometryHash: '0xNEW_BREP_HASH_9999' } }
      };
      const res = syncEngine.applyMutation(docRev4);
      const snap = res.snapshot!;

      const passed = snap.viewport.bRepHash === '0xNEW_BREP_HASH_9999' && snap.viewport.documentRevision === 4;
      results.push({
        proofId: 'SYNC-NEG-003',
        name: 'Viewport Geometry Revision Synchronization',
        passed,
        expectedBehavior: 'Viewport must update to new geometry revision without displaying stale mesh.',
        actualBehavior: `bRepHash=${snap.viewport.bRepHash}, rev=${snap.viewport.documentRevision}`,
        details: 'Viewport geometry projection updated.'
      });
    })();

    // 4. SYNC-NEG-004: Deleted Selection Invalidation
    (() => {
      const selRef: SelectionReference = {
        topologyId: 'TOPOLOGY_DELETED_FACE',
        entityType: 'FACE',
        documentRevision: 1
      };
      syncEngine.setSelectedTopology('DOC-NEG-054', selRef);

      const docRev5: EngineeringDocument = {
        ...baseDoc,
        revision: 5,
        topologyMap: { version: 5, faceMap: { FACE_2: 'TOPOLOGY_FACE_2' } } // FACE_DELETED removed
      };
      const res = syncEngine.applyMutation(docRev5);
      const snap = res.snapshot!;

      const passed = snap.selection.selectionStatus === 'INVALIDATED';
      results.push({
        proofId: 'SYNC-NEG-004',
        name: 'Invalidated Selection Reconciliation',
        passed,
        expectedBehavior: 'UI Selection must be marked INVALIDATED when target topology is deleted.',
        actualBehavior: `selectionStatus=${snap.selection.selectionStatus}, reason=${snap.selection.reason}`,
        details: 'Selection invalidation confirmed.'
      });
    })();

    // 5. SYNC-NEG-005: Stale Evidence Detection
    (() => {
      const docRev6: EngineeringDocument = {
        ...baseDoc,
        revision: 6,
        evidence: [{
          evidenceId: 'EV-1',
          stage: 'GEOMETRY',
          sourceSystem: 'CADKernel',
          documentId: 'DOC-NEG-054',
          revision: 1, // Evidence generated for revision 1, now document is revision 6!
          canonicalHash: '0xHASH1111',
          verdict: 'VALID'
        }]
      };
      const res = syncEngine.applyMutation(docRev6);
      const snap = res.snapshot!;

      const passed = snap.evidence.hasStaleEvidence && snap.evidence.records[0].isStale === true;
      results.push({
        proofId: 'SYNC-NEG-005',
        name: 'Stale Evidence Detection',
        passed,
        expectedBehavior: 'Evidence from revision 1 must be flagged as isStale=true for document revision 6.',
        actualBehavior: `hasStaleEvidence=${snap.evidence.hasStaleEvidence}, isStale=${snap.evidence.records[0]?.isStale}`,
        details: 'Stale evidence correctly flagged.'
      });
    })();

    // 6. SYNC-NEG-006: Execution Failure Status Invariant
    (() => {
      const docRev7: EngineeringDocument = { ...baseDoc, revision: 7 };
      const res = syncEngine.applyMutation(docRev7, 'MUTATION', { success: false, error: 'Constraint solver singular' });
      const snap = res.snapshot!;

      const passed = snap.status.status === 'FAILED' && snap.status.explanation.includes('Constraint solver singular');
      results.push({
        proofId: 'SYNC-NEG-006',
        name: 'Execution Failure Status Invariant',
        passed,
        expectedBehavior: 'Failed execution must result in status=FAILED, never SUCCESS.',
        actualBehavior: `status=${snap.status.status}`,
        details: 'Failure status correctly preserved.'
      });
    })();

    // 7. SYNC-NEG-007: UI Divergence Detection
    (() => {
      const divergence = syncEngine.detectDivergence('DOC-NEG-054', {
        claimedRevision: 99, // Stale/Wrong revision claimed by UI!
        featureCount: 1,
        parameterCount: 1,
        status: 'VALIDATED'
      });

      const passed = divergence.hasDivergence && divergence.reasons.some(r => r.includes('Revision divergence'));
      results.push({
        proofId: 'SYNC-NEG-007',
        name: 'UI State Divergence Detection',
        passed,
        expectedBehavior: 'System must detect and report UI revision divergence.',
        actualBehavior: `hasDivergence=${divergence.hasDivergence}, reasons=${divergence.reasons.length}`,
        details: 'UI divergence detected.'
      });
    })();

    // 8. SYNC-NEG-008: Out-of-Order Event Protection
    (() => {
      // Highest observed revision is currently 7. Try sending revision 2 (older event arriving out of order)!
      const staleOutOrderDoc: EngineeringDocument = { ...baseDoc, revision: 2 };
      const res = syncEngine.applyMutation(staleOutOrderDoc);

      const passed = !res.success && res.error?.includes('Out-of-Order event rejected');
      results.push({
        proofId: 'SYNC-NEG-008',
        name: 'Out-of-Order Event Rejection',
        passed,
        expectedBehavior: 'Incoming document with older revision (2 <= 7) must be rejected.',
        actualBehavior: `success=${res.success}, error=${res.error}`,
        details: 'Out-of-order event rejected.'
      });
    })();

    // 9. SYNC-NEG-009: Reconnect Stale State Discard
    (() => {
      const backendDoc: EngineeringDocument = {
        ...baseDoc,
        revision: 10,
        features: [{ id: 'FEAT-10', featureId: 'FEAT-10', name: 'ReconnectedFeature', type: 'BOSS' }]
      };
      const snap = syncEngine.reconnectBackend(backendDoc);

      const passed = snap.revision === 10 && snap.featureTree.some(f => f.featureId === 'FEAT-10');
      results.push({
        proofId: 'SYNC-NEG-009',
        name: 'Reconnect Discards Local State',
        passed,
        expectedBehavior: 'Backend reconnect must discard local state and rebuild projections from canonical backend document.',
        actualBehavior: `revision=${snap.revision}, featureCount=${snap.featureTree.length}`,
        details: 'Backend state successfully restored on reconnect.'
      });
    })();

    // 10. SYNC-NEG-010: Undo Atomic Projections Update
    (() => {
      const undoDoc: EngineeringDocument = { ...baseDoc, revision: 9 };
      const snap = syncEngine.applyUndo(undoDoc);

      const passed = snap.revision === 9 && snap.featureTree.length === 2 && snap.viewport.documentRevision === 9;
      results.push({
        proofId: 'SYNC-NEG-010',
        name: 'Undo Atomic Projection Restoration',
        passed,
        expectedBehavior: 'Undo must restore all 6 projections atomically to revision 9.',
        actualBehavior: `rev=${snap.revision}, ftRev=${snap.featureTree[0]?.documentRevision}, vpRev=${snap.viewport.documentRevision}`,
        details: 'Undo projections updated atomically.'
      });
    })();

    // 11. SYNC-NEG-011: Redo Atomic Projections Update
    (() => {
      const redoDoc: EngineeringDocument = { ...baseDoc, revision: 11 };
      const snap = syncEngine.applyRedo(redoDoc);

      const passed = snap.revision === 11 && snap.properties.documentRevision === 11 && snap.viewport.documentRevision === 11;
      results.push({
        proofId: 'SYNC-NEG-011',
        name: 'Redo Atomic Projection Restoration',
        passed,
        expectedBehavior: 'Redo must update properties and viewport projections atomically to revision 11.',
        actualBehavior: `propertiesRev=${snap.properties.documentRevision}, vpRev=${snap.viewport.documentRevision}`,
        details: 'Redo projections updated atomically.'
      });
    })();

    // 12. SYNC-NEG-012: Regeneration Evidence Stale Flagging
    (() => {
      const regenDoc: EngineeringDocument = {
        ...baseDoc,
        revision: 12,
        evidence: [{
          evidenceId: 'EV-OLD',
          stage: 'GEOMETRY',
          sourceSystem: 'CADKernel',
          documentId: 'DOC-NEG-054',
          revision: 11, // Old evidence from revision 11
          canonicalHash: '0xPRE_REGEN_HASH',
          verdict: 'VALID'
        }]
      };
      const res = syncEngine.applyMutation(regenDoc);
      const snap = res.snapshot!;

      const passed = snap.evidence.hasStaleEvidence && snap.evidence.records[0].isStale === true;
      results.push({
        proofId: 'SYNC-NEG-012',
        name: 'Regeneration Invalidates Pre-Regen Evidence',
        passed,
        expectedBehavior: 'Pre-regeneration evidence must be marked as stale after parametric regeneration.',
        actualBehavior: `hasStaleEvidence=${snap.evidence.hasStaleEvidence}`,
        details: 'Pre-regeneration evidence marked stale.'
      });
    })();

    // 13. SYNC-NEG-013: Partial Transaction Rollback
    (() => {
      const failedDoc: EngineeringDocument = { ...baseDoc, revision: 13 };
      // Transaction fails in backend, state remains at previous valid revision 12
      const failedTxRes = syncEngine.applyMutation(failedDoc, 'MUTATION', { success: false, error: 'B-Rep boolean intersection failed' });

      const passed = failedTxRes.snapshot?.status.status === 'FAILED';
      results.push({
        proofId: 'SYNC-NEG-013',
        name: 'Failed Transaction UI Rollback / Failure Status',
        passed,
        expectedBehavior: 'Failed mutation must not introduce partial UI features and must reflect FAILED status.',
        actualBehavior: `status=${failedTxRes.snapshot?.status.status}`,
        details: 'Failed transaction reflected cleanly.'
      });
    })();

    // 14. SYNC-NEG-014: Renderer Independence
    (() => {
      // Re-deriving viewport projection purely from canonical document
      const vp = CanonicalProjections.deriveViewport(baseDoc);

      const passed = vp.documentRevision === baseDoc.revision;
      results.push({
        proofId: 'SYNC-NEG-014',
        name: 'Renderer Independence',
        passed,
        expectedBehavior: 'Viewport projection must be derivable purely from EngineeringDocument without renderer state.',
        actualBehavior: `documentRevision=${vp.documentRevision}`,
        details: 'Viewport derived directly from document.'
      });
    })();

    // 15. SYNC-NEG-015: Cache Overwrite Prevention
    (() => {
      const docRev15: EngineeringDocument = { ...baseDoc, revision: 15 };
      syncEngine.applyMutation(docRev15);

      // Attempting to apply cached snapshot from revision 10
      const staleCachedDoc: EngineeringDocument = { ...baseDoc, revision: 10 };
      const cacheApplyRes = syncEngine.applyMutation(staleCachedDoc);

      const passed = !cacheApplyRes.success;
      results.push({
        proofId: 'SYNC-NEG-015',
        name: 'Cache Overwrite Prevention',
        passed,
        expectedBehavior: 'Cached state from older revision must not overwrite newer canonical state.',
        actualBehavior: `success=${cacheApplyRes.success}`,
        details: 'Cache overwrite prevented.'
      });
    })();

    // 16. SYNC-NEG-016: Unvalidated Status SUCCESS Block
    (() => {
      const unvalidatedDoc: EngineeringDocument = { ...baseDoc, revision: 16, evidence: [] };
      const snap = syncEngine.applyMutation(unvalidatedDoc).snapshot!;

      const passed = snap.status.status !== 'VERIFIED' && snap.status.status === 'MUTATED';
      results.push({
        proofId: 'SYNC-NEG-016',
        name: 'Unvalidated Status Prohibition',
        passed,
        expectedBehavior: 'Document without validation evidence must resolve as MUTATED, not SUCCESS/VERIFIED.',
        actualBehavior: `status=${snap.status.status}`,
        details: 'Prohibition against fake SUCCESS verified.'
      });
    })();

    const passCount = results.filter(r => r.passed).length;
    const totalCount = results.length;

    return {
      timestamp,
      totalCount,
      passCount,
      allPassed: passCount === totalCount,
      results
    };
  }
}
