import { describe, it, expect, beforeEach } from 'vitest';
import { InvalidationPipelineEngine } from '../InvalidationPipelineEngine';
import { EngineeringDocument, DEFAULT_UNIT_SYSTEM_MM } from '../../cad-kernel/document/CADDocument';
import { createCanonicalRenderData, CanonicalRenderData } from '../../viewport/CanonicalRenderContract';
import { resolveCanonicalFaceFromTriangle, CanonicalPickResult } from '../../viewport/CanonicalPickingContract';
import { RevisionLifecycleState, classifyDerivedState } from '../../viewport/RevisionLifecycle';

function createMockDoc(docId = 'DOC-INV-100', revision = 1): EngineeringDocument {
  return {
    documentId: docId,
    revision: revision,
    type: 'PART',
    units: DEFAULT_UNIT_SYSTEM_MM,
    sketches: [],
    constraints: [],
    features: [
      {
        id: 'EXTRUDE-1',
        name: 'Main Block Extrude',
        type: 'EXTRUDE',
        parameters: { depth: 50, width: 100 },
        suppressed: false,
      },
    ],
    parameters: [
      { id: 'PARAM_DEPTH', name: 'depth', expression: '50', value: 50, isDriving: true },
    ],
    topologyMap: {
      version: 1,
      faceMap: { 'FACE_1': 'FACE_1', 'FACE_2': 'FACE_2' },
      edgeMap: { 'E1': 'E1' },
      vertexMap: { 'V1': 'V1' },
    },
    derived: {
      mesh: {
        brepHash: `BREP-REV-${revision}`,
        meshHash: `MESH-REV-${revision}`,
        vertices: [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0],
        indices: [0, 1, 2, 0, 2, 3],
        normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
        facesCount: 2,
        topologyMap: {
          faceTriangleMap: {
            'FACE_1': {
              triangleIndices: [0, 3],
              faceId: 'FACE_1',
              persistentId: 'FACE_1',
            },
            'FACE_2': {
              triangleIndices: [6, 9],
              faceId: 'FACE_2',
              persistentId: 'FACE_2',
            },
          },
          edgeVertexMap: {
            'E1': { vertexIndices: [0, 1], edgeId: 'E1', persistentId: 'E1' },
          },
          vertexIndexMap: {
            'V1': { vertexIndex: 0, vertexId: 'V1', persistentId: 'V1' },
          },
          sharedEdges: [],
        },
      },
    },
    evidence: [],
  };
}

describe('Invalidation Contract & Complex Lifecycle Scenarios Test Suite', () => {
  let pipelineEngine: InvalidationPipelineEngine;

  beforeEach(() => {
    pipelineEngine = InvalidationPipelineEngine.getInstance();
  });

  describe('1. Full Invalidation Pipeline Execution', () => {
    it('should execute canonical mutation pipeline and progress from mutation to CURRENT', () => {
      const doc = createMockDoc('DOC-PIPE-001', 1);

      const result = pipelineEngine.executePipeline(
        doc,
        (d) => {
          d.parameters[0].value = 75;
          d.parameters[0].expression = '75';
        },
        'Update Parameter depth = 75'
      );

      expect(result.updatedDoc.revision).toBe(2);
      expect(result.renderData.revision).toBe(2);
      expect(result.report.initialRevision).toBe(1);
      expect(result.report.finalRevision).toBe(2);
      expect(result.report.lifecycleState).toBe(RevisionLifecycleState.CURRENT);

      // Verify all pipeline steps
      const steps = result.report.steps.map((s) => s.step);
      expect(steps).toEqual([
        'CANONICAL_MUTATION',
        'REVISION_INCREMENT',
        'BREP_REGENERATION',
        'MESH_REGENERATION',
        'DERIVED_STATE_INVALIDATION',
        'SELECTION_STALE',
        'RENDER_STALE',
        'RE_EVALUATION',
        'CURRENT',
      ]);
    });
  });

  describe('2. Case A — Parameter Modification', () => {
    it('should mark old selection STALE on Parameter edit (Rev N+1) and successfully REVALIDATE in new topology', () => {
      // 1. Initial State at Revision 1
      const docRev1 = createMockDoc('DOC-PARAM-001', 1);
      const renderDataRev1 = createCanonicalRenderData(docRev1);

      // Pick FACE_1 at Revision 1
      const selectionRev1 = resolveCanonicalFaceFromTriangle(0, renderDataRev1, { distance: 5 });
      expect(selectionRev1).not.toBeNull();
      expect(selectionRev1?.revision).toBe(1);
      expect(selectionRev1?.canonicalEntityId).toBe('FACE_1');

      // Check classification against Rev 1 -> CURRENT
      const initialClass = classifyDerivedState(selectionRev1!, renderDataRev1);
      expect(initialClass.status).toBe(RevisionLifecycleState.CURRENT);

      // 2. Execute Parameter Mutation (Parameter depth = 75)
      const pipelineRes = pipelineEngine.executePipeline(
        docRev1,
        (d) => {
          d.parameters[0].value = 75;
        },
        'Modify PARAM_DEPTH to 75'
      );

      const docRev2 = pipelineRes.updatedDoc;
      const renderDataRev2 = pipelineRes.renderData;

      // 3. Old selection checked against Revision 2 MUST be STALE
      const staleCheck = classifyDerivedState(selectionRev1!, renderDataRev2);
      expect(staleCheck.status).toBe(RevisionLifecycleState.STALE);
      expect(staleCheck.reason).toContain('Revision divergence');

      // 4. Revalidate selection across revision increment
      const revalidationReport = pipelineEngine.revalidateSelectionAcrossRevision(
        selectionRev1!,
        docRev2,
        renderDataRev2
      );

      expect(revalidationReport.status).toBe(RevisionLifecycleState.REVALIDATED);
      expect(revalidationReport.revalidatedPick).not.toBeNull();
      expect(revalidationReport.revalidatedPick?.revision).toBe(2);
      expect(revalidationReport.revalidatedPick?.canonicalEntityId).toBe('FACE_1');
      expect(revalidationReport.persistentEntityId).toBe('FACE_1');
    });
  });

  describe('3. Case B — Topology Replacement / Destruction', () => {
    it('should classify old selection as INVALID when Feature regeneration destroys or replaces Face A', () => {
      // 1. Initial State at Revision 1 with FACE_2
      const docRev1 = createMockDoc('DOC-TOPO-001', 1);
      const renderDataRev1 = createCanonicalRenderData(docRev1);

      // Pick FACE_2 at Revision 1
      const selectionFace2 = resolveCanonicalFaceFromTriangle(2, renderDataRev1, { distance: 5 });
      expect(selectionFace2).not.toBeNull();
      expect(selectionFace2?.canonicalEntityId).toBe('FACE_2');

      // 2. Execute Feature Regeneration that destroys FACE_2 (e.g. Cut Out / Delete Face feature)
      const pipelineRes = pipelineEngine.executePipeline(
        docRev1,
        (d) => {
          // Remove FACE_2 from topologyMap
          delete d.derived.mesh?.topologyMap.faceTriangleMap['FACE_2'];
          delete (d.topologyMap as any).faceMap['FACE_2'];
        },
        'Delete Feature removing FACE_2'
      );

      const docRev2 = pipelineRes.updatedDoc;
      const renderDataRev2 = pipelineRes.renderData;

      // 3. Old selection on FACE_2 checked against Revision 2
      const staleCheck = classifyDerivedState(selectionFace2!, renderDataRev2);
      expect(staleCheck.status).toBe(RevisionLifecycleState.STALE);

      // 4. Revalidate selection across topology destruction -> INVALID
      const revalReport = pipelineEngine.revalidateSelectionAcrossRevision(
        selectionFace2!,
        docRev2,
        renderDataRev2
      );

      expect(revalReport.status).toBe(RevisionLifecycleState.INVALID);
      expect(revalReport.revalidatedPick).toBeNull();
      expect(revalReport.reason).toContain('INVALID');
      expect(revalReport.reason).toContain('replaced or destroyed');
    });
  });

  describe('4. Case C — Cross-Workbench Tab Switching Alignment', () => {
    it('should pass alignment when Workbench A and Workbench B share the exact same EngineeringDocument instance and revision', () => {
      const doc = createMockDoc('DOC-TAB-001', 3);

      const alignmentReport = pipelineEngine.verifyTabSwitchAlignment(
        'WORKBENCH_PARAMETRIC_3D',
        doc,
        'WORKBENCH_CAM_TOOLPATH',
        doc
      );

      expect(alignmentReport.isValidCrossWorkbenchState).toBe(true);
      expect(alignmentReport.isSameDocumentInstance).toBe(true);
      expect(alignmentReport.isIdenticalRevision).toBe(true);
      expect(alignmentReport.isIdenticalGeometry).toBe(true);
      expect(alignmentReport.details).toContain('PASS');
    });

    it('should REJECT tab switching when Workbench B has a local shadow document with different ID or stale revision', () => {
      const docA = createMockDoc('DOC-TAB-001', 2);
      const docB_Shadow = createMockDoc('DOC-TAB-001-SHADOW-LOCAL', 1);

      const alignmentReport = pipelineEngine.verifyTabSwitchAlignment(
        'WORKBENCH_A',
        docA,
        'WORKBENCH_B',
        docB_Shadow
      );

      expect(alignmentReport.isValidCrossWorkbenchState).toBe(false);
      expect(alignmentReport.details).toContain('FAIL');
      expect(alignmentReport.details).toContain('Document ID mismatch');
    });

    it('should REJECT tab switching when Workbench B has a stale revision of the same document', () => {
      const docA_Rev2 = createMockDoc('DOC-TAB-001', 2);
      const docB_Rev1 = createMockDoc('DOC-TAB-001', 1);

      const alignmentReport = pipelineEngine.verifyTabSwitchAlignment(
        'WORKBENCH_A',
        docA_Rev2,
        'WORKBENCH_B',
        docB_Rev1
      );

      expect(alignmentReport.isValidCrossWorkbenchState).toBe(false);
      expect(alignmentReport.details).toContain('FAIL');
      expect(alignmentReport.details).toContain('Revision mismatch');
    });
  });
});
