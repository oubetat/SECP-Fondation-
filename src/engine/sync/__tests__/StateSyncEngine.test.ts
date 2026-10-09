/**
 * SECP Industrial OS v3 — PROMPT-054: State Synchronization Unit & Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StateSyncEngine } from '../StateSyncEngine';
import { CanonicalProjections } from '../CanonicalProjections';
import { SyncNegativeProofs } from '../SyncNegativeProofs';
import { SyncPositiveProofs } from '../SyncPositiveProofs';
import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';

describe('PROMPT-054 — Backend-to-UI State Synchronization', () => {
  let syncEngine: StateSyncEngine;

  const mockDoc: EngineeringDocument = {
    documentId: 'DOC-TEST-054',
    revision: 1,
    units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
    sketches: [{ id: 'SK-1', name: 'MainSketch', plane: 'XY', entities: [] }],
    constraints: [],
    features: [{ id: 'F-1', featureId: 'F-1', name: 'Extrude1', type: 'EXTRUDE', parameters: { depth: 100 } }],
    parameters: [{ id: 'P-1', name: 'Width', value: 50, unit: 'mm' }],
    topologyMap: { version: 1, faceMap: { F1: 'TOPOLOGY_FACE_1' } },
    derived: { mesh: { vertices: new Float32Array(9), normals: new Float32Array(9), indices: new Uint32Array(3) } as any },
    evidence: [{
      evidenceId: 'EV-1',
      stage: 'GEOMETRY',
      sourceSystem: 'CADKernel',
      documentId: 'DOC-TEST-054',
      revision: 1,
      canonicalHash: '0xTEST_HASH_1',
      verdict: 'VALID'
    }]
  };

  beforeEach(() => {
    syncEngine = StateSyncEngine.getInstance();
    syncEngine.reset();
  });

  describe('StateSyncEngine Core Operations', () => {
    it('registers an EngineeringDocument and builds initial atomic snapshot', () => {
      const snap = syncEngine.registerDocument(mockDoc);

      expect(snap.documentId).toBe('DOC-TEST-054');
      expect(snap.revision).toBe(1);
      expect(snap.featureTree).toHaveLength(2); // 1 sketch + 1 feature
      expect(snap.properties.items).toHaveLength(1);
      expect(snap.viewport.documentRevision).toBe(1);
      expect(snap.evidence.records).toHaveLength(1);
      expect(snap.status.status).toBe('VALIDATED');
    });

    it('applies document mutation and updates all 6 projections atomically', () => {
      syncEngine.registerDocument(mockDoc);

      const updatedDoc: EngineeringDocument = {
        ...mockDoc,
        revision: 2,
        features: [
          ...mockDoc.features,
          { id: 'F-2', featureId: 'F-2', name: 'Chamfer1', type: 'CHAMFER' }
        ],
        parameters: [
          { id: 'P-1', name: 'Width', value: 75, unit: 'mm' }
        ]
      };

      const res = syncEngine.applyMutation(updatedDoc);
      expect(res.success).toBe(true);
      const snap = res.snapshot!;

      expect(snap.revision).toBe(2);
      expect(snap.featureTree).toHaveLength(3);
      expect(snap.properties.items.find(p => p.id === 'P-1')?.value).toBe(75);
      expect(snap.viewport.documentRevision).toBe(2);
      expect(snap.status.status).toBe('MUTATED');
    });

    it('rejects out-of-order events with older revisions', () => {
      syncEngine.registerDocument(mockDoc); // Rev 1

      const updatedDocRev5: EngineeringDocument = { ...mockDoc, revision: 5 };
      syncEngine.applyMutation(updatedDocRev5); // Rev 5

      const staleEventDocRev3: EngineeringDocument = { ...mockDoc, revision: 3 };
      const res = syncEngine.applyMutation(staleEventDocRev3);

      expect(res.success).toBe(false);
      expect(res.error).toContain('Out-of-Order event rejected');

      // Verify active snapshot remains at revision 5
      const currentSnap = syncEngine.getSnapshot('DOC-TEST-054');
      expect(currentSnap?.revision).toBe(5);
    });

    it('reconciles selection when topology is deleted', () => {
      syncEngine.registerDocument(mockDoc);
      syncEngine.setSelectedTopology('DOC-TEST-054', {
        topologyId: 'TOPOLOGY_FACE_1',
        entityType: 'FACE',
        documentRevision: 1
      });

      const deletedTopoDoc: EngineeringDocument = {
        ...mockDoc,
        revision: 2,
        topologyMap: { version: 2, faceMap: {} } // FACE_1 removed
      };

      const res = syncEngine.applyMutation(deletedTopoDoc);
      expect(res.snapshot?.selection.selectionStatus).toBe('INVALIDATED');
    });

    it('flags stale evidence when document revision increments', () => {
      syncEngine.registerDocument(mockDoc);

      const rev3DocNoNewEv: EngineeringDocument = {
        ...mockDoc,
        revision: 3
      };

      const res = syncEngine.applyMutation(rev3DocNoNewEv);
      expect(res.snapshot?.evidence.hasStaleEvidence).toBe(true);
      expect(res.snapshot?.evidence.records[0].isStale).toBe(true);
    });
  });

  describe('Proof Suites', () => {
    it('passes all 16 negative proof cases', () => {
      const negReport = SyncNegativeProofs.executeAllNegativeProofs();
      expect(negReport.allPassed).toBe(true);
      expect(negReport.passCount).toBe(16);
    });

    it('passes all 7 positive proof cases', () => {
      const posReport = SyncPositiveProofs.executeAllPositiveProofs();
      expect(posReport.allPassed).toBe(true);
      expect(posReport.passCount).toBe(7);
    });
  });
});
