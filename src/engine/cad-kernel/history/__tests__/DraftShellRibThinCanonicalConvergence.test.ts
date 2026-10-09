import { describe, it, expect, beforeEach } from 'vitest';
import { EngineeringDocument, DEFAULT_UNIT_SYSTEM_MM } from '../../document/CADDocument';
import { DocumentEvaluator } from '../../document/DocumentEvaluator';
import { BoxFactory } from '../../boolean/BoxFactory';
import { DraftTool277 } from '../../../viewport/DraftTool277';
import { ShellTool277 } from '../../../viewport/ShellTool277';
import { RibTool277 } from '../../../viewport/RibTool277';
import { ThinTool277 } from '../../../viewport/ThinTool277';
import { CanonicalIntentDispatcher277 } from '../../../viewport/CanonicalIntentDispatcher277';
import { BRepMutationGate277 } from '../../brep/BRepMutationGate277';
import { DraftEvaluator } from '../../evaluators/DraftEvaluator';
import { ShellEvaluator } from '../../evaluators/ShellEvaluator';
import { RibEvaluator } from '../../evaluators/RibEvaluator';
import { ThinEvaluator } from '../../evaluators/ThinEvaluator';
import { DraftShellRibThinAcceptanceGate } from '../DraftShellRibThinAcceptanceGate';

describe('PROMPT-028: Draft / Shell / Rib / Thin Canonical Feature Convergence', () => {
  let baseDocument: EngineeringDocument;
  const dispatcher = new CanonicalIntentDispatcher277();

  beforeEach(() => {
    const baseBox = BoxFactory.createBox('BASE_SOLID_01', -20, -20, 0, 40, 40, 30);
    const rawDoc: EngineeringDocument = {
      documentId: 'DOC_TEST_PROMPT_028',
      name: 'PROMPT-028 Convergence Test Doc',
      revision: 1,
      unitSystem: DEFAULT_UNIT_SYSTEM_MM,
      parameters: [],
      sketches: [],
      features: [
        {
          featureId: 'F_BASE_BOX',
          id: 'F_BASE_BOX',
          dependencyIds: [],
          type: 'EXTRUDE',
          name: 'Base Box Solid',
          parameters: { minX: -20, minY: -20, width: 40, height: 40, depth: 30 },
          definition: {
            type: 'EXTRUDE',
            name: 'Base Box Solid',
            parameters: { minX: -20, minY: -20, width: 40, height: 40, depth: 30 },
            inputReferences: [],
            dependencyIds: []
          }
        }
      ],
      evaluatedShape: baseBox,
      evidence: [
        {
          evidenceId: 'EV_BASE_1',
          stage: 'DESIGN',
          sourceSystem: 'UnitTest',
          documentId: 'DOC_TEST_PROMPT_028',
          revision: 1,
          canonicalHash: 'HASH_BASE_1',
          timestamp: new Date().toISOString(),
          verdict: 'VALID'
        }
      ]
    };
    const evalRes = DocumentEvaluator.evaluate(rawDoc);
    baseDocument = evalRes.document;
  });

  describe('1. Canonical DRAFT Feature', () => {
    it('creates and validates a canonical DraftIntent', () => {
      const tool = new DraftTool277();
      const intent = tool.createIntent(baseDocument.documentId, {
        angle: 5.0,
        targetFaceId: 'F_FACE_SIDE_1'
      });

      expect(intent.toolId).toBe('FEATURE_DRAFT');
      expect(intent.parameters.angle).toBe(5.0);
      expect(intent.parameters.targetFaceId).toBe('F_FACE_SIDE_1');
    });

    it('executes real B-Rep taper mutation in DraftEvaluator', () => {
      const baseBox = BoxFactory.createBox('BOX_DRAFT', -20, -20, 0, 40, 40, 30);
      const evalRes = DraftEvaluator.evaluate(baseBox, { angle: 5.0, draftAngle: 5.0 });

      expect(evalRes.success).toBe(true);
      expect(evalRes.resultSolid).toBeDefined();
      expect(evalRes.modifiedFacesCount).toBeGreaterThan(0);
      expect(evalRes.draftAngleDeg).toBe(5.0);
      expect(evalRes.resultSolid?.id).toContain('_draft_');
    });

    it('dispatches DraftIntent through CanonicalIntentDispatcher277 and passes BRepMutationGate277', async () => {
      const tool = new DraftTool277();
      const intent = tool.createIntent(baseDocument.documentId, { angle: 3.0 });

      const beforeSnap = BRepMutationGate277.captureSnapshot(baseDocument);
      const result = await CanonicalIntentDispatcher277.dispatch(intent, baseDocument);

      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();

      const afterSnap = BRepMutationGate277.captureSnapshot(result.document);
      const gateVerdict = BRepMutationGate277.verify(beforeSnap, afterSnap, 'MODIFICATION');
      expect(gateVerdict.status).toBe('PASS');

      const evidence = result.document.evidence;
      expect(evidence.some((e: any) => e.evidenceId.startsWith('EV_DRAFT_'))).toBe(true);
    });
  });

  describe('2. Canonical SHELL Feature', () => {
    it('creates and validates a canonical ShellIntent', () => {
      const tool = new ShellTool277();
      const intent = tool.createIntent(baseDocument.documentId, {
        thickness: 2.5,
        direction: 'INSIDE'
      });

      expect(intent.toolId).toBe('FEATURE_SHELL');
      expect(intent.parameters.thickness).toBe(2.5);
      expect(intent.parameters.direction).toBe('INSIDE');
    });

    it('executes real B-Rep offset cavity mutation in ShellEvaluator with verified wall thickness', () => {
      const baseBox = BoxFactory.createBox('BOX_SHELL', -20, -20, 0, 40, 40, 30);
      const evalRes = ShellEvaluator.evaluate(baseBox, { thickness: 2.0 });

      expect(evalRes.success).toBe(true);
      expect(evalRes.resultSolid).toBeDefined();
      expect(evalRes.wallThicknessMm).toBe(2.0);
      expect(evalRes.removedFacesCount).toBe(1);
      expect(evalRes.resultSolid?.id).toContain('_shelled_');
    });

    it('dispatches ShellIntent through CanonicalIntentDispatcher277 and passes BRepMutationGate277', async () => {
      const tool = new ShellTool277();
      const intent = tool.createIntent(baseDocument.documentId, { thickness: 2.0 });

      const beforeSnap = BRepMutationGate277.captureSnapshot(baseDocument);
      const result = await CanonicalIntentDispatcher277.dispatch(intent, baseDocument);
      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();

      const afterSnap = BRepMutationGate277.captureSnapshot(result.document);
      const gateVerdict = BRepMutationGate277.verify(beforeSnap, afterSnap, 'SUBTRACTIVE');
      expect(gateVerdict.status).toBe('PASS');

      const evidence = result.document.evidence;
      expect(evidence.some((e: any) => e.evidenceId.startsWith('EV_SHELL_'))).toBe(true);
    });
  });

  describe('3. Canonical RIB Feature', () => {
    it('creates and validates a canonical RibIntent', () => {
      const tool = new RibTool277();
      const intent = tool.createIntent(baseDocument.documentId, {
        thickness: 4.0,
        direction: 'MIDPLANE'
      });

      expect(intent.toolId).toBe('FEATURE_RIB');
      expect(intent.parameters.thickness).toBe(4.0);
      expect(intent.parameters.direction).toBe('MIDPLANE');
    });

    it('executes real B-Rep structural web addition in RibEvaluator', () => {
      const baseBox = BoxFactory.createBox('BOX_RIB', -20, -20, 0, 40, 40, 30);
      const evalRes = RibEvaluator.evaluate(baseBox, { thickness: 4.0 });

      expect(evalRes.success).toBe(true);
      expect(evalRes.resultSolid).toBeDefined();
      expect(evalRes.ribThicknessMm).toBe(4.0);
      expect(evalRes.resultSolid?.id).toContain('_ribbed_');
    });

    it('dispatches RibIntent through CanonicalIntentDispatcher277 and passes BRepMutationGate277', async () => {
      const tool = new RibTool277();
      const intent = tool.createIntent(baseDocument.documentId, { thickness: 4.0 });

      const beforeSnap = BRepMutationGate277.captureSnapshot(baseDocument);
      const result = await CanonicalIntentDispatcher277.dispatch(intent, baseDocument);
      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();

      const afterSnap = BRepMutationGate277.captureSnapshot(result.document);
      const gateVerdict = BRepMutationGate277.verify(beforeSnap, afterSnap, 'ADDITIVE');
      expect(gateVerdict.status).toBe('PASS');

      const evidence = result.document.evidence;
      expect(evidence.some((e: any) => e.evidenceId.startsWith('EV_RIB_'))).toBe(true);
    });
  });

  describe('4. Canonical THIN Feature', () => {
    it('creates and validates a canonical ThinIntent', () => {
      const tool = new ThinTool277();
      const intent = tool.createIntent(baseDocument.documentId, {
        thickness: 1.5,
        direction: 'INSIDE'
      });

      expect(intent.toolId).toBe('FEATURE_THIN');
      expect(intent.parameters.thickness).toBe(1.5);
      expect(intent.parameters.direction).toBe('INSIDE');
    });

    it('executes real thin-wall B-Rep geometry creation in ThinEvaluator', () => {
      const baseBox = BoxFactory.createBox('BOX_THIN', -20, -20, 0, 40, 40, 30);
      const evalRes = ThinEvaluator.evaluate(baseBox, { thickness: 1.5 });

      expect(evalRes.success).toBe(true);
      expect(evalRes.resultSolid).toBeDefined();
      expect(evalRes.wallThicknessMm).toBe(1.5);
      expect(evalRes.resultSolid?.id).toContain('_thin_');
    });

    it('dispatches ThinIntent through CanonicalIntentDispatcher277 and passes BRepMutationGate277', async () => {
      const tool = new ThinTool277();
      const intent = tool.createIntent(baseDocument.documentId, { thickness: 1.5 });

      const beforeSnap = BRepMutationGate277.captureSnapshot(baseDocument);
      const result = await CanonicalIntentDispatcher277.dispatch(intent, baseDocument);
      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();

      const afterSnap = BRepMutationGate277.captureSnapshot(result.document);
      const gateVerdict = BRepMutationGate277.verify(beforeSnap, afterSnap, 'ADDITIVE');
      expect(gateVerdict.status).toBe('PASS');

      const evidence = result.document.evidence;
      expect(evidence.some((e: any) => e.evidenceId.startsWith('EV_THIN_'))).toBe(true);
    });
  });

  describe('5. Mandatory Negative Proofs (NO MESH-ONLY SUCCESS)', () => {
    it('fails BRepMutationGate277 if snapshot shows zero B-Rep mutation', () => {
      const snap1 = BRepMutationGate277.captureSnapshot(baseDocument);
      const snap2 = BRepMutationGate277.captureSnapshot(baseDocument);

      const gateVerdict = BRepMutationGate277.verify(snap1, snap2, 'ADDITIVE');
      expect(gateVerdict.status).toBe('FAIL');
      expect(gateVerdict.reason).toContain('No B-Rep mutation detected');
    });
  });

  describe('6. Independent Acceptance Gate Verification (4 Independent Verdicts)', () => {
    it('evaluates all 4 features independently and returns PASS for each feature', async () => {
      const gate = new DraftShellRibThinAcceptanceGate();
      const report = await gate.evaluateAll(baseDocument);

      expect(report.draftReport.capability).toBe('DRAFT');
      expect(report.draftReport.verdict).toBe('PASS');

      expect(report.shellReport.capability).toBe('SHELL');
      expect(report.shellReport.verdict).toBe('PASS');

      expect(report.ribReport.capability).toBe('RIB');
      expect(report.ribReport.verdict).toBe('PASS');

      expect(report.thinReport.capability).toBe('THIN');
      expect(report.thinReport.verdict).toBe('PASS');

      expect(report.overallVerdict).toBe('PASS');
    });
  });
});
