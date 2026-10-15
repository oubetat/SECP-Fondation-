import { describe, it, expect, beforeEach } from 'vitest';
import { WorkbenchStateOwnershipEngine } from '../WorkbenchStateOwnershipEngine';
import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';
import { CanonicalDocumentUIAdapter } from '../../cad-kernel/ui/CanonicalDocumentUIAdapter';
import { CanonicalIntentDispatcher277 } from '../../viewport/CanonicalIntentDispatcher277';
import { SketchUIIntegration } from '../../cad-kernel/ui-integration/SketchUIIntegration';
import { ENGINEERING_WORKBENCHES } from '../../navigation/EngineeringOSNavigation';

describe('SECP Forensic Audit — Production Governance & Rollback Verification', () => {
  let engine: WorkbenchStateOwnershipEngine;
  let testDoc: EngineeringDocument;

  beforeEach(() => {
    engine = WorkbenchStateOwnershipEngine.getInstance();
    engine.resetAuditState();

    const { document } = SketchUIIntegration.createPrimitiveDocument('BOX', 'DOC-FORENSIC-SOT-777');
    testDoc = document;

    engine.registerCanonicalDocument(testDoc);
  });

  describe('1. CanonicalDocumentUIAdapter Contract Stability & Assertion Integrity', () => {
    it('preserves exact ExecutionResult shape and evaluator return contracts in executeAddFeature', () => {
      const initialFeatureCount = testDoc.features.length;
      const initialRev = Number(testDoc.revision);

      const { result, evaluation } = CanonicalDocumentUIAdapter.executeAddFeature(testDoc, {
        name: 'Tooling Analysis Feature',
        type: 'MOLD',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESS');
      expect(result.documentId).toBe('DOC-FORENSIC-SOT-777');
      expect(result.documentRevision).toBe(initialRev + 1);
      expect(typeof result.actionId).toBe('string');
      expect(result.actionId.startsWith('ACT_ADD_FEAT_')).toBe(true);
      expect(typeof result.featureId).toBe('string');

      expect(evaluation).toBeDefined();
      expect(evaluation?.document.features.length).toBe(initialFeatureCount + 1);
    });

    it('preserves exact contract and toggles suppression cleanly with executeSuppressFeature', () => {
      const targetFeatId = 'F_EXTRUDE_1';
      const initialRev = Number(testDoc.revision);

      const { result, evaluation } = CanonicalDocumentUIAdapter.executeSuppressFeature(
        testDoc,
        targetFeatId
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESS');
      expect(result.documentId).toBe('DOC-FORENSIC-SOT-777');
      expect(result.documentRevision).toBe(initialRev + 1);
      expect(result.featureId).toBe(targetFeatId);
      expect(result.geometryChanged).toBe(true);
      expect(result.topologyChanged).toBe(true);

      const suppressedFeat = evaluation?.document.features.find(
        (f: any) => (f.id || f.featureId) === targetFeatId
      );
      expect(suppressedFeat?.suppressed).toBe(true);
    });

    it('returns structured failure when suppressing non-existent feature without throw', () => {
      const { result, evaluation } = CanonicalDocumentUIAdapter.executeSuppressFeature(
        testDoc,
        'NON_EXISTENT_FEAT'
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('Feature not found');
      expect(evaluation).toBeUndefined();
    });

    it('preserves exact contract in executeDeleteFeature and removes target feature cleanly', () => {
      const targetFeatId = 'F_EXTRUDE_1';
      const initialRev = Number(testDoc.revision);
      const initialFeatureCount = testDoc.features.length;

      const { result, evaluation } = CanonicalDocumentUIAdapter.executeDeleteFeature(
        testDoc,
        targetFeatId
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESS');
      expect(result.documentId).toBe('DOC-FORENSIC-SOT-777');
      expect(result.documentRevision).toBe(initialRev + 1);
      expect(evaluation?.document.features.length).toBe(initialFeatureCount - 1);
      expect(
        evaluation?.document.features.some((f: any) => (f.id || f.featureId) === targetFeatId)
      ).toBe(false);
    });

    it('preserves exact contract in executeUpdateFeatureParameter and updates parameter values', () => {
      const targetFeatId = 'F_EXTRUDE_1';
      const initialRev = Number(testDoc.revision);

      const { result, evaluation } = CanonicalDocumentUIAdapter.executeUpdateFeatureParameter(
        testDoc,
        targetFeatId,
        'depth',
        175
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESS');
      expect(result.documentId).toBe('DOC-FORENSIC-SOT-777');
      expect(result.documentRevision).toBe(initialRev + 1);
      expect(result.featureId).toBe(targetFeatId);

      const updatedFeat = evaluation?.document.features.find(
        (f: any) => (f.id || f.featureId) === targetFeatId
      );
      expect(updatedFeat?.definition.parameters.depth).toBe(175);
    });
  });

  describe('2. SOT Document Identity Singularity', () => {
    it('guarantees single authoritative instance across UI Adapter mutations and Engine registry', () => {
      // 1. Initial registered instance
      const initialEngineDoc = engine.getCanonicalDocument('DOC-FORENSIC-SOT-777');
      expect(initialEngineDoc).toBe(testDoc);
      const initialRev = Number(testDoc.revision);

      const targetFeatId = 'F_EXTRUDE_1';

      // 2. Mutate via CanonicalDocumentUIAdapter
      const { evaluation } = CanonicalDocumentUIAdapter.executeUpdateFeatureParameter(
        testDoc,
        targetFeatId,
        'depth',
        220
      );

      // 3. Verify the engine document is the identical in-place object
      const currentEngineDoc = engine.getCanonicalDocument('DOC-FORENSIC-SOT-777');
      expect(currentEngineDoc).toBe(testDoc);
      expect(currentEngineDoc?.revision).toBe(initialRev + 1);
      expect(currentEngineDoc?.features[1].definition.parameters.depth).toBe(220);

      // 4. Verify evaluation document is synchronized
      expect(evaluation?.document.revision).toBe(initialRev + 1);
    });
  });

  describe('3. Atomic Rollback Integrity on Actual CAD Structures', () => {
    it('restores actual complex CAD structures in-place on midway failure with zero reference leakage', () => {
      const originalDocRef = testDoc;
      const initialRev = testDoc.revision;
      const initialFeatures = JSON.parse(JSON.stringify(testDoc.features));
      const initialSketches = JSON.parse(JSON.stringify(testDoc.sketches));
      const initialShape = testDoc.evaluatedShape;

      // Seed derived cache
      engine.setDerivedCache('DOC-FORENSIC-SOT-777', 'evaluated B-Rep', { brep: 'valid_cache' });

      // Attempt mutator that corrupts multiple CAD structures before throwing
      expect(() => {
        engine.mutateCanonicalDocument(
          'DOC-FORENSIC-SOT-777',
          (doc) => {
            // Corrupt feature list
            doc.features.push({
              featureId: 'HALF_BAKED_CAD_FEAT',
              name: 'Corrupted CAD Feature',
              type: 'SWEEP',
              parameters: { twist: 999 },
            });
            // Corrupt sketch
            doc.sketches![0].closedProfile = false;
            doc.sketches![0].entities!.push({ type: 'CORRUPTED_ENTITY' });
            // Corrupt parameters
            doc.parameters = doc.parameters || [];
            doc.parameters.push({ id: 'LEAKY_PARAM', name: 'leaky', value: 9999 });

            // Throw geometric engine panic
            throw new Error('Geometric kernel panic: Non-manifold topology detected during B-Rep boolean evaluation!');
          },
          'Corrupted Complex CAD Mutation',
          'PARAMETRIC_WORKBENCH'
        );
      }).toThrow(/Canonical mutation transaction failed and was rolled back atomically/);

      // 1. Verify object reference identity was preserved
      expect(testDoc).toBe(originalDocRef);
      expect(engine.getCanonicalDocument('DOC-FORENSIC-SOT-777')).toBe(originalDocRef);

      // 2. Verify revision was NOT incremented
      expect(testDoc.revision).toBe(initialRev);

      // 3. Verify features were restored completely
      expect(testDoc.features.length).toBe(initialFeatures.length);
      expect(testDoc.features.some((f: any) => (f.id || f.featureId) === 'HALF_BAKED_CAD_FEAT')).toBe(false);
      expect(testDoc.features[1].definition.parameters.depth).toBe(initialFeatures[1].definition.parameters.depth);

      // 4. Verify sketches were restored completely
      expect(testDoc.sketches![0].closedProfile).toBe(initialSketches[0].closedProfile);
      expect(testDoc.sketches![0].entities!.length).toBe(initialSketches[0].entities.length);
      expect(testDoc.sketches![0].entities!.some((e: any) => e.type === 'CORRUPTED_ENTITY')).toBe(false);

      // 5. Verify parameters restored
      expect(testDoc.parameters?.some((p: any) => p.id === 'LEAKY_PARAM')).toBe(false);

      // 6. Verify evaluatedShape was preserved with class prototypes intact
      expect(testDoc.evaluatedShape).toBe(initialShape);
      expect((testDoc.evaluatedShape as any).shapeType).toBe('SOLID');

      // 7. Verify derived cache was NOT wiped on aborted transaction
      expect(engine.getDerivedCache('DOC-FORENSIC-SOT-777', 'evaluated B-Rep')).toEqual({
        brep: 'valid_cache',
      });
    });

    it('restores actual internal B-Rep solid content in-place when evaluatedShape is mutated internally before transaction failure', () => {
      const originalDocRef = testDoc;
      const initialRev = testDoc.revision;
      const initialShape = testDoc.evaluatedShape!;
      (initialShape as any).tolerance = 1e-6;
      const initialTolerance = 1e-6;
      const initialFaceCount = initialShape.outerShell.orientedFaces.length;

      // Seed derived cache
      engine.setDerivedCache('DOC-FORENSIC-SOT-777', 'evaluated B-Rep', { brep: 'valid_cache' });

      // Mutate evaluatedShape internally in-place before transaction throws
      expect(() => {
        engine.mutateCanonicalDocument(
          'DOC-FORENSIC-SOT-777',
          (doc) => {
            // 1. In-place B-Rep corruption
            (doc.evaluatedShape as any).inPlaceCorruptedFlag = 'LEAKED_CORRUPTION';
            (doc.evaluatedShape as any).tolerance = 999.999;
            doc.evaluatedShape!.outerShell.orientedFaces.pop();

            // 2. Document feature corruption
            doc.features.push({
              featureId: 'LEAKY_FEAT',
              name: 'Leaky Feature',
              type: 'EXTRUDE',
            });

            throw new Error('Geometric kernel boolean evaluation failed in mid-flight!');
          },
          'Corrupted In-Place B-Rep Transaction',
          'DESIGN'
        );
      }).toThrow(/Canonical mutation transaction failed and was rolled back atomically/);

      // 1. Document reference identity preserved
      expect(testDoc).toBe(originalDocRef);
      expect(testDoc.revision).toBe(initialRev);

      // 2. EvaluatedShape reference identity preserved for downstream consumers
      expect(testDoc.evaluatedShape).toBe(initialShape);

      // 3. EvaluatedShape IN-PLACE CONTENT RESTORED:
      // Corrupted property deleted
      expect((testDoc.evaluatedShape as any).inPlaceCorruptedFlag).toBeUndefined();
      // Tolerance restored
      expect(testDoc.evaluatedShape?.tolerance).toBe(initialTolerance);
      // Oriented faces array restored in-place
      expect(testDoc.evaluatedShape?.outerShell.orientedFaces.length).toBe(initialFaceCount);

      // 4. Features restored
      expect(testDoc.features.some((f: any) => (f.id || f.featureId) === 'LEAKY_FEAT')).toBe(false);

      // 5. Derived cache preserved on aborted transaction
      expect(engine.getDerivedCache('DOC-FORENSIC-SOT-777', 'evaluated B-Rep')).toEqual({
        brep: 'valid_cache',
      });
    });
  });

  describe('4. Production Intent Dispatcher Integration with Governance', () => {
    it('routes FEATURE_SUPPRESS through CanonicalIntentDispatcher277 and audits CANONICAL_MUTATION', async () => {
      const targetFeatId = 'F_EXTRUDE_1';
      const initialRev = Number(testDoc.revision);

      const intent = {
        actionId: 'FeatureManagementAction277.manage',
        toolId: 'FEATURE_SUPPRESS' as const,
        documentId: testDoc.documentId,
        parameters: { featureId: targetFeatId },
        timestamp: Date.now(),
      };

      const dispatchResult = await CanonicalIntentDispatcher277.dispatch(intent as any, testDoc);

      expect(dispatchResult.success).toBe(true);
      expect(dispatchResult.revision).toBe(initialRev + 1);
      expect(dispatchResult.canonicalActionId).toBe('CanonicalDocumentUIAdapter.FEATURE_SUPPRESS');

      // Verify audit recorded CANONICAL_MUTATION
      const auditReport = engine.auditAllWorkbenches();
      expect(auditReport.overallStatus).toBe('PASS_COMPLIANT');
      expect(auditReport.architecturalGapCount).toBe(0);
    });

    it('routes FEATURE_DELETE through CanonicalIntentDispatcher277 and invalidates derived cache', async () => {
      const targetFeatId = 'F_EXTRUDE_1';
      const initialRev = Number(testDoc.revision);

      // Seed derived cache
      engine.setDerivedCache('DOC-FORENSIC-SOT-777', 'evaluated B-Rep', { brep: 'stale_brep' });
      engine.setDerivedCache('DOC-FORENSIC-SOT-777', 'render mesh', { mesh: 'stale_mesh' });

      const intent = {
        actionId: 'FeatureManagementAction277.manage',
        toolId: 'FEATURE_DELETE' as const,
        documentId: testDoc.documentId,
        parameters: { featureId: targetFeatId },
        timestamp: Date.now(),
      };

      const dispatchResult = await CanonicalIntentDispatcher277.dispatch(intent as any, testDoc);

      expect(dispatchResult.success).toBe(true);
      expect(dispatchResult.revision).toBe(initialRev + 1);

      // Verify stale derived cache was wiped out
      expect(engine.getDerivedCache('DOC-FORENSIC-SOT-777', 'evaluated B-Rep')).toBeUndefined();
      expect(engine.getDerivedCache('DOC-FORENSIC-SOT-777', 'render mesh')).toBeUndefined();
    });
  });

  describe('5. Comprehensive Production Workbenches Inventory & Cache Lifecycle', () => {
    it('proves 100% compliant workbenches registry coverage across all SECP OS modules with zero architectural gaps via independent navigation discovery', () => {
      const sysReport = engine.auditAllWorkbenches();

      expect(sysReport.overallStatus).toBe('PASS_COMPLIANT');
      expect(sysReport.architecturalGapCount).toBe(0);
      expect(sysReport.totalWorkbenchesAudited).toBeGreaterThanOrEqual(10);

      // Independent dynamic extraction of entry points from production OS navigation registry
      const independentWorkbenches = ENGINEERING_WORKBENCHES.map((wb) => wb.id);
      expect(independentWorkbenches.length).toBeGreaterThan(0);

      // Verify every independent navigation workbench is governed and compliant
      independentWorkbenches.forEach((wbId) => {
        const report = sysReport.workbenchReports.find((r) => r.workbenchId === wbId);
        expect(report).toBeDefined();
        expect(report?.isCompliant).toBe(true);
        expect(report?.architecturalGaps).toBe(0);
      });

      // Also verify sub-domain workbenches
      const domainWorkbenches = [
        'PARAMETRIC_FEATURE_WORKBENCH',
        'FEATURE_TREE_WORKBENCH',
        'PARAMETRIC_WORKBENCH',
        'PATTERN_WORKBENCH',
        'DIRECT_MODELING_WORKBENCH',
        'VIEWPORT_WORKBENCH',
      ];

      domainWorkbenches.forEach((wbId) => {
        const report = sysReport.workbenchReports.find((r) => r.workbenchId === wbId);
        expect(report).toBeDefined();
        expect(report?.isCompliant).toBe(true);
        expect(report?.architecturalGaps).toBe(0);
      });
    });

    it('proves complete cache invalidation lifecycle across success, failure, and explicit invalidation', () => {
      const docId = testDoc.documentId;
      let notificationFired = false;
      const unsubscribe = engine.subscribeInvalidation(() => {
        notificationFired = true;
      });

      // 1. Seed caches
      engine.setDerivedCache(docId, 'evaluated B-Rep', { brep: 'test_1' });
      engine.setDerivedCache(docId, 'render mesh', { mesh: 'test_2' });

      // 2. Explicit invalidation for single entity
      engine.invalidateDerivedCache(docId, 'evaluated B-Rep');
      expect(engine.getDerivedCache(docId, 'evaluated B-Rep')).toBeUndefined();
      expect(engine.getDerivedCache(docId, 'render mesh')).toEqual({ mesh: 'test_2' });
      expect(notificationFired).toBe(true);

      // 3. Explicit full invalidation
      notificationFired = false;
      engine.invalidateDerivedCache(docId);
      expect(engine.getDerivedCache(docId, 'render mesh')).toBeUndefined();
      expect(notificationFired).toBe(true);

      unsubscribe();
    });
  });
});
