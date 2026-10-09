import { describe, it, expect, beforeEach } from 'vitest';
import { Audit003CapabilitiesEngine } from '../Audit003CapabilitiesEngine';
import { RevisionLifecycleState } from '../../../viewport/RevisionLifecycle';

describe('Audit-003 Capabilities Runtime Execution Test Suite', () => {
  let auditEngine: Audit003CapabilitiesEngine;

  beforeEach(() => {
    auditEngine = Audit003CapabilitiesEngine.getInstance();
  });

  describe('Capability #4: Parametric Scan Fitting Runtime Execution', () => {
    it('should execute Scan → Fitting → Feature Recognition → Parametric Feature → Canonical EngineeringDocument in runtime', () => {
      const result = auditEngine.runParametricScanFittingPipeline();

      expect(result.isSuccess).toBe(true);
      expect(result.fittedPrimitivesCount).toBeGreaterThan(0);
      expect(result.recognizedFeaturesCount).toBeGreaterThan(0);
      expect(result.parametricFeaturesCount).toBeGreaterThan(0);

      // Verify canonical document commitment
      expect(result.committedDocument).toBeDefined();
      expect(result.committedDocument.documentId).toContain('DOC-RE-');
      expect(result.committedDocument.features.length).toBeGreaterThan(0);
      expect(result.documentRevision).toBe(1);
      expect(result.brepHash).not.toBe('');
      expect(result.meshHash).not.toBe('');

      // Verify pipeline trace steps
      expect(result.pipelineTrace.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('Capability #9: Feature Recognition to Reconstruction Pipeline', () => {
    it('should flow recognized features into reconstruction pipeline and populate canonical document SOT', () => {
      const sampleMesh = auditEngine.createSampleScanMesh('RECOG-TEST-MESH');
      const scanFitResult = auditEngine.runParametricScanFittingPipeline(sampleMesh);

      expect(scanFitResult.recognizedFeaturesCount).toBeGreaterThan(0);
      expect(scanFitResult.committedDocument.features.some(f => f.type === 'EXTRUDE' || f.type === 'HOLE' || f.type === 'PLANE' || f.type === 'HOLE_THROUGH')).toBe(true);
      expect(scanFitResult.committedDocument.evidence[0].status).toBe('VERIFIED');
    });
  });

  describe('Capability #10: B-Rep Reconstruction Watertight Proof from Single Artifact', () => {
    it('should prove input scan/mesh → reconstruction → watertight B-Rep → canonical document → evaluation → rendering from exact same artifact', () => {
      const result = auditEngine.runBRepWatertightReconstructionPipeline();

      expect(result.isSuccess).toBe(true);
      expect(result.isWatertight).toBe(true);
      expect(result.manifoldStatus).toBe('MANIFOLD');
      expect(result.shellCount).toBeGreaterThan(0);
      expect(result.faceCount).toBe(6); // Box solid has 6 faces

      // Canonical Document SOT check
      expect(result.canonicalDocument.documentId).toContain('DOC-BREP-');
      expect(result.canonicalDocument.features).toHaveLength(1);

      // Viewport CanonicalRenderData evaluation check
      expect(result.evaluatedRenderData.vertices.length).toBeGreaterThan(0);
      expect(result.evaluatedRenderData.indices.length).toBeGreaterThan(0);
      expect(result.evaluatedRenderData.revision).toBe(1);
    });
  });

  describe('Capability #11: Natural Language CAD Pipeline Execution', () => {
    it('should prove Natural Language → Intent → Staging → Canonical Commit → Revision → Evaluation → B-Rep → Viewport → PLM Evidence', () => {
      const prompt = 'Create a mounting bracket with 4 M6 corner holes and 25mm thickness';
      const result = auditEngine.runNaturalLanguageCADPipeline(prompt);

      expect(result.isSuccess).toBe(true);
      expect(result.parsedIntentCommand).toBeDefined();
      expect(result.stagedPlanStepsCount).toBeGreaterThan(0);

      // Canonical SOT document check
      expect(result.committedDocument.documentId).toContain('DOC-NLCAD-');
      expect(result.committedDocument.revision).toBe(1);
      expect(result.committedDocument.features.length).toBeGreaterThan(0);

      // Viewport CanonicalRenderData evaluation check
      expect(result.renderDataVerticesCount).toBeGreaterThan(0);

      // PLM Evidence log check
      expect(result.plmEvidenceStatus).toBe('COMMITTED_TO_PLM');
      expect(result.revisionId).toContain('REV-NLCAD-');
    });
  });
});
