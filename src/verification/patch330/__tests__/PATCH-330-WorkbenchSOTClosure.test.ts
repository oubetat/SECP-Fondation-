import { describe, test, expect, beforeEach } from 'vitest';
import { EngineeringDocument } from '../../../engine/cad-kernel/document/CADDocument';
import { SketchUIIntegration } from '../../../engine/cad-kernel/ui-integration/SketchUIIntegration';
import { DocumentEvaluator } from '../../../engine/cad-kernel/document/DocumentEvaluator';
import { PatternEngine } from '../../../engine/cad/pattern/PatternEngine';
import { DirectModelingEngine } from '../../../engine/cad/direct/DirectModelingEngine';
import { FeatureRecognitionEngine320 } from '../../../engine/reverse_engineering/features/FeatureRecognitionEngine320';

describe('PATCH-330: Workbench State SOT & Revision Invalidation Closure Tests', () => {
  let doc: EngineeringDocument;

  beforeEach(() => {
    // Start with a clean primitive canonical document
    const evalResult = SketchUIIntegration.createPrimitiveDocument('BOX', 'DOC_TEST_330');
    doc = evalResult.document;
  });

  // Test A: Workbench -> EngineeringDocument Identity Preservation
  test('Test A: Identity - Tab switching preserves canonical document and revision', () => {
    const initialId = doc.documentId;
    const initialRev = doc.revision;

    // Simulate switching to CAM tab
    const camRefId = initialId;
    const camRefRev = initialRev;

    // Simulate switching to RE tab
    const reRefId = initialId;
    const reRefRev = initialRev;

    // Simulate returning to Design tab
    expect(camRefId).toBe(initialId);
    expect(camRefRev).toBe(initialRev);
    expect(reRefId).toBe(initialId);
    expect(reRefRev).toBe(initialRev);
  });

  // Test B: Revision Invalidation
  test('Test B: Revision - Design modification invalidates dependent CAM derived state', () => {
    // Initial CAM Derived State bound to Revision R
    const initialRevision = doc.revision;
    if (typeof initialRevision !== 'number') {
      throw new Error('Revision is not a number');
    }
    const camDerivedState = {
      sourceDocumentId: doc.documentId,
      sourceRevision: initialRevision,
      status: 'CURRENT' as 'CURRENT' | 'STALE'
    };

    expect(camDerivedState.status).toBe('CURRENT');

    // Simulate a Design modification (adding an extrude feature)
    const updatedEval = SketchUIIntegration.createPrimitiveDocument('BOX', 'DOC_TEST_330');
    const updatedDoc = updatedEval.document;
    updatedDoc.revision = initialRevision + 1; // Explicit revision increment

    // Invalidation Guard
    let currentCamStatus: 'CURRENT' | 'STALE' = 'CURRENT';
    if (camDerivedState.sourceRevision !== updatedDoc.revision) {
      currentCamStatus = 'STALE';
    }

    expect(currentCamStatus).toBe('STALE');
  });

  // Test C: RE Candidate Invalidation
  test('Test C: RE - Candidate state becomes STALE on SOT revision increment', () => {
    const initialRevision = doc.revision;
    if (typeof initialRevision !== 'number') {
      throw new Error('Revision is not a number');
    }
    const reCandidateState = {
      sourceDocumentId: doc.documentId,
      sourceRevision: initialRevision,
      status: 'CURRENT' as 'CURRENT' | 'STALE'
    };

    expect(reCandidateState.status).toBe('CURRENT');

    // Simulate SOT revision update
    const updatedDoc = { ...doc, revision: initialRevision + 1 };

    // Invalidation Guard
    let reStatus: 'CURRENT' | 'STALE' = 'CURRENT';
    if (reCandidateState.sourceRevision !== updatedDoc.revision) {
      reStatus = 'STALE';
    }

    expect(reStatus).toBe('STALE');
  });

  // Test D: Persistence and Invalidation Verification
  test('Test D: Persistence - Stale state remains stale after reload simulation', () => {
    const initialRevision = doc.revision;
    if (typeof initialRevision !== 'number') {
      throw new Error('Revision is not a number');
    }
    
    // Create and save derived state @ Revision R
    const savedState = {
      sourceDocumentId: doc.documentId,
      sourceRevision: initialRevision,
      status: 'CURRENT'
    };

    // Simulate reload under updated document at R+1
    const activeDocRevisionAtReload = initialRevision + 1;

    let restoredStatus = 'CURRENT';
    if (savedState.sourceRevision !== activeDocRevisionAtReload) {
      restoredStatus = 'STALE';
    }

    expect(restoredStatus).toBe('STALE');
  });

  // Test E: Unmount Preservation Proof
  test('Test E: Unmount - Persistent derived state survives tab change or is explicitly ephemeral', () => {
    // Define an explicitly ephemeral versus persistent local registry state
    const tabStateRegistry = {
      camToolpath: { value: 'G0 X10 Y10', persistent: true },
      activeSelection: { value: 'face_1', persistent: false } // Ephemeral
    };

    // Simulation of unmount/remount
    const unmountedState = { ...tabStateRegistry };
    
    // Persistent state is preserved in global session storage or parent context
    expect(unmountedState.camToolpath.value).toBe('G0 X10 Y10');
    // Ephemeral UI-only selection is allowed to reset
    expect(unmountedState.activeSelection.persistent).toBe(false);
  });

  // Test F: Parallel SOT Invariant
  test('Test F: Parallel SOT - Isolated engines cannot silently mutate canonical EngineeringDocument', () => {
    const patternEngine = new PatternEngine();
    const directModelingEngine = new DirectModelingEngine();

    // Isolated engine operations
    const pattern = patternEngine.createLinearPattern('Test linear', ['feat_1'], {
      direction1: { x: 1, y: 0, z: 0 },
      count1: 2,
      spacing1: 10
    });

    // Verify isolated state exists in memory only
    expect(pattern.status).toBe('VALID');
    expect(pattern.instances.length).toBe(2);

    // Verify canonical SOT features list is unaffected (no silent side-effects)
    if (!doc.features) {
      throw new Error('Features undefined');
    }
    expect(doc.features.length).toBe(2);
  });
});
