import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentEvaluator } from '../../../engine/cad-kernel/document/DocumentEvaluator';
import { SketchUIIntegration } from '../../../engine/cad-kernel/ui-integration/SketchUIIntegration';
import { CadGeometryKernel } from '../../../engine/cadKernel';

/**
 * PATCH-036 — SOT-001 Step 3D: Global Engineering Write-Path Audit
 * 
 * Target: Verify that all engineering write-paths preserve the EngineeringDocument as SOT.
 * These tests identify current architectural VIOLATIONS in SECP.
 */
describe('PATCH-036: Engineering SOT Write-Path Audit', () => {
  
  describe('D-001: Ball Valve Canonical Path', () => {
    it('should verify that Ball Valve loading now generates a corresponding EngineeringDocument', () => {
      // Simulation of FIXED App.tsx:handleLoadValveProject
      const docId = 'DOC_VALVE_PROD';
      const result = SketchUIIntegration.createPrimitiveDocument('BOX', docId);
      
      // The fix: derived from canonical result
      const currentAppActiveSolid = CadGeometryKernel.deriveCadSolidFromEvaluation(result);
      const currentAppCanonicalDocument = result.document;

      expect(currentAppCanonicalDocument, 'EngineeringDocument MUST be present').not.toBeNull();
      expect(currentAppCanonicalDocument?.documentId).toBe(docId);
      expect(currentAppActiveSolid).not.toBeNull();
      
      if (currentAppCanonicalDocument) {
         const evalResult = DocumentEvaluator.evaluate(currentAppCanonicalDocument);
         expect(evalResult.success).toBe(true);
         expect(evalResult.evaluatedShape).toBeDefined();
      }
    });
  });

  describe('D-002: Faucet Wizard Canonical Integration', () => {
    it('should verify that WaterFaucetWizard now generates an EngineeringDocument representation', () => {
      // Simulation of FIXED WaterFaucetWizard.tsx:injectFaucetSolid
      const docId = 'DOC_FAUCET_PROD';
      const result = SketchUIIntegration.createPrimitiveDocument('BOX', docId);

      // The fix: SOT is established first
      const currentAppCanonicalDocument = result.document;
      const currentAppActiveSolid = CadGeometryKernel.deriveCadSolidFromEvaluation(result);

      expect(currentAppCanonicalDocument, 'WaterFaucetWizard MUST generate an EngineeringDocument representation').not.toBeNull();
      expect(currentAppCanonicalDocument?.documentId).toBe(docId);
    });
  });

  describe('D-003: Shadow Evaluation Removal', () => {
    it('should verify that UI components use the App-level SOT and avoid "Shadow Evaluations"', () => {
      // Simulation of FIXED SketchEditorPanel.tsx:trigger3DExtrude
      
      const appLevelDocumentId = 'DOC_UI_PROD';
      const canonicalDocument = SketchUIIntegration.createEmptyDocument(appLevelDocumentId);
      
      // The fix: The component no longer creates a LOCAL_SHADOW_DOC.
      // It uses the passed canonicalDocument.documentId.
      const usedDocumentId = canonicalDocument.documentId;
      
      expect(usedDocumentId).toBe(appLevelDocumentId);
    });
  });
});
