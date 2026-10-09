/**
 * SECP Industrial OS v3 — PROMPT-054: State Synchronization Positive Proofs
 * Positive proof suite verifying that canonical document mutations, parameter edits,
 * topology updates, undo/redo, and backend reconnects result in consistent, atomic UI projections.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { StateSyncEngine } from './StateSyncEngine';

export interface SyncPositiveProofResult {
  proofId: string;
  name: string;
  passed: boolean;
  expectedBehavior: string;
  actualBehavior: string;
  details: string;
}

export interface SyncPositiveProofReport {
  timestamp: string;
  totalCount: number;
  passCount: number;
  allPassed: boolean;
  results: SyncPositiveProofResult[];
}

export class SyncPositiveProofs {
  public static executeAllPositiveProofs(): SyncPositiveProofReport {
    const timestamp = new Date().toISOString();
    const results: SyncPositiveProofResult[] = [];
    const syncEngine = StateSyncEngine.getInstance();
    syncEngine.reset();

    const canonicalDoc: EngineeringDocument = {
      documentId: 'DOC-POS-054',
      revision: 10,
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [{ id: 'SK-1', name: 'ProfileSketch', plane: 'XY', entities: [] }],
      constraints: [],
      features: [{ id: 'FEAT-1', featureId: 'FEAT-1', name: 'ExtrudeBase', type: 'EXTRUDE', parameters: { depth: 50 } }],
      parameters: [{ id: 'P-1', name: 'WallThickness', value: 5, unit: 'mm' }],
      topologyMap: { version: 10, faceMap: { FACE_BASE: 'TOPOLOGY_FACE_BASE_10' } },
      derived: { mesh: { vertices: new Float32Array(9), normals: new Float32Array(9), indices: new Uint32Array(3) } as any },
      evidence: [{
        evidenceId: 'EV-10',
        stage: 'GEOMETRY',
        sourceSystem: 'CADKernel',
        documentId: 'DOC-POS-054',
        revision: 10,
        canonicalHash: '0xHASH_POS_10',
        verdict: 'VALID'
      }]
    };

    // 1. SYNC-POS-001: Atomic Snapshot Update on Mutation
    (() => {
      syncEngine.registerDocument(canonicalDoc);
      const mutatedDoc: EngineeringDocument = {
        ...canonicalDoc,
        revision: 11,
        features: [
          ...canonicalDoc.features,
          { id: 'FEAT-2', featureId: 'FEAT-2', name: 'FilletEdge', type: 'FILLET' }
        ]
      };
      const res = syncEngine.applyMutation(mutatedDoc);
      const snap = res.snapshot!;

      const passed =
        snap.revision === 11 &&
        snap.featureTree.length === 3 &&
        snap.properties.documentRevision === 11 &&
        snap.viewport.documentRevision === 11 &&
        snap.evidence.documentRevision === 11;

      results.push({
        proofId: 'SYNC-POS-001',
        name: 'Atomic Snapshot Update on Mutation',
        passed,
        expectedBehavior: 'Mutation to revision 11 must update featureTree, properties, viewport, evidence atomically.',
        actualBehavior: `revision=${snap.revision}, ftLen=${snap.featureTree.length}, propRev=${snap.properties.documentRevision}`,
        details: 'All projections updated atomically.'
      });
    })();

    // 2. SYNC-POS-002: Parameter Mutation Projections Consistency
    (() => {
      const paramMutDoc: EngineeringDocument = {
        ...canonicalDoc,
        revision: 12,
        parameters: [{ id: 'P-1', name: 'WallThickness', value: 8, unit: 'mm' }],
        topologyMap: { version: 12, hashes: { geometryHash: '0xGEOM_REGEN_HASH_12' } }
      };
      const res = syncEngine.applyMutation(paramMutDoc);
      const snap = res.snapshot!;

      const param = snap.properties.items.find(p => p.id === 'P-1');
      const passed = param?.value === 8 && snap.viewport.bRepHash === '0xGEOM_REGEN_HASH_12';

      results.push({
        proofId: 'SYNC-POS-002',
        name: 'Parameter Mutation Projections Consistency',
        passed,
        expectedBehavior: 'Parameter mutation must update Properties to 8 mm and regenerate Viewport geometry hash.',
        actualBehavior: `paramVal=${param?.value}, bRepHash=${snap.viewport.bRepHash}`,
        details: 'Parameter change updated properties and viewport geometry hash.'
      });
    })();

    // 3. SYNC-POS-003: Selection Lineage Reconciliation
    (() => {
      syncEngine.setSelectedTopology('DOC-POS-054', {
        topologyId: 'TOPOLOGY_FACE_BASE_10',
        entityType: 'FACE',
        documentRevision: 10
      });

      const topoMutDoc: EngineeringDocument = {
        ...canonicalDoc,
        revision: 13,
        topologyMap: { version: 13, faceMap: { FACE_BASE: 'TOPOLOGY_FACE_BASE_10' } }
      };
      const res = syncEngine.applyMutation(topoMutDoc);
      const snap = res.snapshot!;

      const passed = snap.selection.selectionStatus === 'VALID' && snap.selection.selectedEntity?.topologyId === 'TOPOLOGY_FACE_BASE_10';

      results.push({
        proofId: 'SYNC-POS-003',
        name: 'Selection Lineage Reconciliation',
        passed,
        expectedBehavior: 'Selection pointing to valid topology in revision 13 must reconcile as VALID.',
        actualBehavior: `selectionStatus=${snap.selection.selectionStatus}`,
        details: 'Selection reconciled via topology lineage.'
      });
    })();

    // 4. SYNC-POS-004: Evidence Revision Detection
    (() => {
      const evDoc: EngineeringDocument = {
        ...canonicalDoc,
        revision: 14,
        evidence: [{
          evidenceId: 'EV-14',
          stage: 'GEOMETRY',
          sourceSystem: 'CADKernel',
          documentId: 'DOC-POS-054',
          revision: 14,
          canonicalHash: '0xHASH_POS_14',
          verdict: 'VALID'
        }]
      };
      const res = syncEngine.applyMutation(evDoc);
      const snap = res.snapshot!;

      const passed = !snap.evidence.hasStaleEvidence && snap.evidence.records[0].isStale === false;

      results.push({
        proofId: 'SYNC-POS-004',
        name: 'Matching Evidence Revision Validity',
        passed,
        expectedBehavior: 'Evidence generated for revision 14 must be valid (isStale=false) for revision 14 document.',
        actualBehavior: `hasStaleEvidence=${snap.evidence.hasStaleEvidence}, isStale=${snap.evidence.records[0]?.isStale}`,
        details: 'Matching evidence correctly evaluated as valid.'
      });
    })();

    // 5. SYNC-POS-005: Undo Projections Restoration
    (() => {
      const undoDoc: EngineeringDocument = {
        ...canonicalDoc,
        revision: 10
      };
      const snap = syncEngine.applyUndo(undoDoc);

      const passed = snap.revision === 10 && snap.featureTree.length === 2 && snap.properties.documentRevision === 10;

      results.push({
        proofId: 'SYNC-POS-005',
        name: 'Undo Projections Restoration',
        passed,
        expectedBehavior: 'Undo operation must restore revision 10 document and rebuild all projections consistently.',
        actualBehavior: `revision=${snap.revision}, ftLen=${snap.featureTree.length}`,
        details: 'Undo projections restored.'
      });
    })();

    // 6. SYNC-POS-006: Backend Reconnect Rebuild
    (() => {
      const reconnectedDoc: EngineeringDocument = {
        ...canonicalDoc,
        revision: 20,
        features: [
          { id: 'FEAT-1', featureId: 'FEAT-1', name: 'ExtrudeBase', type: 'EXTRUDE' },
          { id: 'FEAT-20', featureId: 'FEAT-20', name: 'ShellWall', type: 'SHELL' }
        ]
      };
      const snap = syncEngine.reconnectBackend(reconnectedDoc);

      const passed = snap.revision === 20 && snap.featureTree.length === 3 && snap.lastMutationSource === 'RECONNECT';

      results.push({
        proofId: 'SYNC-POS-006',
        name: 'Backend Reconnect Projections Rebuild',
        passed,
        expectedBehavior: 'Backend reconnect must rebuild all projections from revision 20 document.',
        actualBehavior: `revision=${snap.revision}, ftLen=${snap.featureTree.length}, source=${snap.lastMutationSource}`,
        details: 'Backend state restored on reconnect.'
      });
    })();

    // 7. SYNC-POS-007: Out-of-Order Event Protection Verification
    (() => {
      // Highest observed revision is currently 20. Send revision 15 (older event arriving late).
      const lateEventDoc: EngineeringDocument = { ...canonicalDoc, revision: 15 };
      const res = syncEngine.applyMutation(lateEventDoc);

      const passed = !res.success && res.error !== undefined;

      results.push({
        proofId: 'SYNC-POS-007',
        name: 'Out-of-Order Event Rejection',
        passed,
        expectedBehavior: 'StateSyncEngine must reject incoming late event with revision 15 <= highest revision 20.',
        actualBehavior: `success=${res.success}, error=${res.error}`,
        details: 'Out-of-order event rejected.'
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
