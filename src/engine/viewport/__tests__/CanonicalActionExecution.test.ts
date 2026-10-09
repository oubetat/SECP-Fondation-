import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';
import { SketchUIIntegration } from '../../cad-kernel/ui-integration/SketchUIIntegration';
import { DocumentEvaluator } from '../../cad-kernel/document/DocumentEvaluator';
import { CanonicalIntentDispatcher277 } from '../CanonicalIntentDispatcher277';
import { ExtrudeTool277 } from '../ExtrudeTool277';
import { RevolveTool277 } from '../RevolveTool277';
import { SweepTool277 } from '../SweepTool277';
import { LoftTool277 } from '../LoftTool277';
import { verifyCanonicalSuccess } from '../CanonicalAction277';

describe('PROMPT-013 — Canonical Action Execution Matrix', () => {

  let testDoc: EngineeringDocument;

  beforeEach(() => {
    const { document } = SketchUIIntegration.createPrimitiveDocument('BOX', 'DOC_ACTION_TEST');
    testDoc = document;
  });

  // =========================================================================
  // 1. CANONICAL EXECUTION (Test 1, 2, 3, 4, 5)
  // =========================================================================
  it('Executes Extrude Action: Mutation -> Revision N+1 -> Evaluator -> Success', async () => {
    const extrudeTool = new ExtrudeTool277();
    const intent = extrudeTool.createIntent(testDoc.documentId, 'F_SKETCH_1', 120);
    
    const initialRev = Number(testDoc.revision);
    const result = await extrudeTool.execute(intent, testDoc);

    expect(verifyCanonicalSuccess(result)).toBe(true);
    expect(result.revision).toBe(initialRev + 1);
    expect(result.evaluationResult.success).toBe(true);
    
    // Verify B-Rep mutation (depth parameter in feature history)
    const newDoc = result.evaluationResult.document;
    const extrudeFeat = newDoc.features.find((f: any) => f.type === 'EXTRUDE');
    expect(extrudeFeat.definition.parameters.depth).toBe(120);
  });

  it('Executes Revolve Action: Direct Document Mutation -> Revision N+1 -> Evaluator', async () => {
    const revolveTool = new RevolveTool277();
    const intent = revolveTool.createIntent(testDoc.documentId, 'F_SKETCH_1', 360);
    
    const initialRev = Number(testDoc.revision);
    const result = await revolveTool.execute(intent, testDoc);

    expect(verifyCanonicalSuccess(result)).toBe(true);
    expect(result.revision).toBe(initialRev + 1);
    expect(result.canonicalActionId).toBe('FeatureAction.revolve');
    
    // Verify feature was added to SOT
    const newDoc = result.evaluationResult.document;
    expect(newDoc.features.some((f: any) => f.type === 'REVOLVE')).toBe(true);
  });

  it('Executes Sweep Action: Direct Document Mutation -> Revision N+1 -> Evaluator -> Real B-Rep Solid', async () => {
    const sweepTool = new SweepTool277();
    const path = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 30 },
      { x: 20, y: 0, z: 60 },
      { x: 50, y: 0, z: 80 }
    ];
    const intent = sweepTool.createIntent(testDoc.documentId, 'F_SKETCH_1', path, {
      orientation: 'FOLLOW_PATH',
      twistAngleDeg: 45
    });
    
    const initialRev = Number(testDoc.revision);
    const result = await sweepTool.execute(intent, testDoc);

    expect(verifyCanonicalSuccess(result)).toBe(true);
    expect(result.revision).toBe(initialRev + 1);
    expect(result.canonicalActionId).toBe('FeatureAction.sweep');
    
    // Verify feature was added to SOT with SWEEP type, NOT EXTRUDE or REVOLVE
    const newDoc = result.evaluationResult.document;
    const sweepFeat = newDoc.features.find((f: any) => f.type === 'SWEEP');
    expect(sweepFeat).toBeDefined();
    expect(sweepFeat.type).toBe('SWEEP');
    expect(sweepFeat.definition.parameters.orientation).toBe('FOLLOW_PATH');
    expect(sweepFeat.definition.parameters.twistAngleDeg).toBe(45);

    // Verify Real B-Rep geometry output
    const solid = result.evaluationResult.evaluatedShape!;
    expect(solid).toBeDefined();
    expect(solid.shapeType).toBe('SOLID');
    expect(solid.outerShell).toBeDefined();
    expect(solid.outerShell.orientedFaces.length).toBeGreaterThan(4);
  });

  it('Executes Loft Action: Direct Document Mutation -> Revision N+1 -> Evaluator -> Real B-Rep Solid', async () => {
    const loftTool = new LoftTool277();
    const sections = [
      [
        { x: -30, y: -30, z: 0 },
        { x: 30, y: -30, z: 0 },
        { x: 30, y: 30, z: 0 },
        { x: -30, y: 30, z: 0 }
      ],
      [
        { x: -20, y: -20, z: 40 },
        { x: 20, y: -20, z: 40 },
        { x: 20, y: 20, z: 40 },
        { x: -20, y: 20, z: 40 }
      ],
      [
        { x: -10, y: -10, z: 80 },
        { x: 10, y: -10, z: 80 },
        { x: 10, y: 10, z: 80 },
        { x: -10, y: 10, z: 80 }
      ]
    ];
    const intent = loftTool.createIntent(testDoc.documentId, sections, {
      sectionIds: ['F_SKETCH_1'],
      closed: false,
      solidMode: true
    });
    
    const initialRev = Number(testDoc.revision);
    const result = await loftTool.execute(intent, testDoc);

    expect(verifyCanonicalSuccess(result)).toBe(true);
    expect(result.revision).toBe(initialRev + 1);
    expect(result.canonicalActionId).toBe('FeatureAction.loft');
    
    // Verify feature was added to SOT with LOFT type, NOT EXTRUDE, REVOLVE, or SWEEP
    const newDoc = result.evaluationResult.document;
    const loftFeat = newDoc.features.find((f: any) => f.type === 'LOFT');
    expect(loftFeat).toBeDefined();
    expect(loftFeat.type).toBe('LOFT');
    expect(loftFeat.definition.parameters.solidMode).toBe(true);

    // Verify Real B-Rep geometry output
    const solid = result.evaluationResult.evaluatedShape!;
    expect(solid).toBeDefined();
    expect(solid.shapeType).toBe('SOLID');
    expect(solid.outerShell).toBeDefined();
    expect(solid.outerShell.orientedFaces.length).toBeGreaterThan(4);
  });

  // =========================================================================
  // 2. FAILURE ATOMICITY & NO FALSE POSITIVES (Test 10, 12, 15, 21)
  // =========================================================================
  it('Fails Action and reports failure if DocumentEvaluator fails', async () => {
    // Mock DocumentEvaluator to fail
    const originalEvaluate = DocumentEvaluator.evaluate;
    DocumentEvaluator.evaluate = vi.fn().mockReturnValue({
      success: false,
      error: 'KERNEL_CRASH',
      document: { ...testDoc, revision: 999 }
    });

    const extrudeTool = new ExtrudeTool277();
    const intent = extrudeTool.createIntent(testDoc.documentId, 'F_SKETCH_1', 50);
    
    const result = await extrudeTool.execute(intent, testDoc);

    expect(result.success).toBe(false);
    expect(result.error).toContain('EVALUATION_FAILURE');
    expect(verifyCanonicalSuccess(result)).toBe(false);

    // Restore evaluator
    DocumentEvaluator.evaluate = originalEvaluate;
  });

  it('Rejects mutation if targeted at a different Document ID', async () => {
    const extrudeTool = new ExtrudeTool277();
    const intent = extrudeTool.createIntent('FORGED_DOC_ID', 'F_SKETCH_1', 50);

    const result = await CanonicalIntentDispatcher277.dispatch(intent, testDoc);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('INVALID_DOCUMENT');
  });

  // =========================================================================
  // 3. SELECTION CONTRACT INTEGRATION (Test 16)
  // =========================================================================
  it('Enforces PROMPT-010 SelectionReference verification before Action execution', async () => {
    const extrudeTool = new ExtrudeTool277();
    const invalidRef = {
      referenceType: 'FACE' as const,
      persistentId: 'NON_EXISTENT',
      sourceId: testDoc.documentId,
      faceId: 'NONE'
    };

    const intent = extrudeTool.createIntent(testDoc.documentId, 'F_SKETCH_1', 50, [invalidRef]);

    const result = await CanonicalIntentDispatcher277.dispatch(intent, testDoc);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('INVALID_SELECTION');
  });

  // =========================================================================
  // 4. REAL TOOL -> INTENT -> DISPATCHER -> ACTION E2E (Test 11, 19)
  // =========================================================================
  it('E2E Production Flow: Tool creates Intent -> Dispatcher routes -> Action mutates -> Revision updates', async () => {
    const extrudeTool = new ExtrudeTool277();
    const intent = extrudeTool.createIntent(testDoc.documentId, 'F_SKETCH_1', 200);

    // Dispatch through central authority
    const result = await CanonicalIntentDispatcher277.dispatch(intent, testDoc);

    expect(verifyCanonicalSuccess(result)).toBe(true);
    expect(result.canonicalActionId).toBe('SketchUIIntegration.applyExtrudeAction');
    expect(result.revision).toBe(Number(testDoc.revision) + 1);
  });
});
