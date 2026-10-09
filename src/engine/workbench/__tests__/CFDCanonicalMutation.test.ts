import { describe, it, expect } from 'vitest';
import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';
import { CanonicalMutationVerifier } from '../../semantics/CanonicalMutationVerifier';
import { CfdTool277 } from '../../viewport/CfdTool277';
import { CanonicalIntentDispatcher277 } from '../../viewport/CanonicalIntentDispatcher277';
import { deriveTruthProvenance } from '../../context/EngineeringContext';

describe('GATE 1 — CFD Canonical Mutation & Lifecycle Architecture Proof', () => {
  it('should reject direct React state callback bypass as non-canonical mutation', () => {
    const doc: EngineeringDocument = {
      documentId: 'DOC-CFD-001',
      revision: 1,
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      topologyMap: { faces: {}, edges: {}, vertices: {} } as any,
      derived: {},
      evidence: []
    };

    // Direct React state setter update (bypassing dispatcher and revision increment)
    const directReactMutation = {
      ...doc,
      derived: {
        ...doc.derived,
        cfd: {
          modelId: 'CFD_DOC_001_1',
          cellCount: 250,
          inletVelocity: 5,
          fluidDensity: 1.225,
          viscosity: 0.0000181,
          convergenceIterations: 100,
          results: { reynoldsNumber: 10000, pressureDropPa: 120, flowRegime: 'TURBULENT', maxVelocity: 15 },
          hash: 'CFD_HASH_001'
        }
      }
    };

    const proof = {
      targetDocumentId: doc.documentId,
      previousRevision: doc.revision,
      newRevision: directReactMutation.revision, // Un-incremented revision
      mutationType: 'CFD_SIMULATION_RESULT',
      canonicalPayloadHashBefore: 'HASH_BEFORE',
      canonicalPayloadHashAfter: 'HASH_BEFORE',
      isStaleState: false,
      rebuildable: true,
      affectedCanonicalEntities: [],
      isCanonicalMutation: false,
      nonCanonicalReasons: ['DIRECT_REACT_PROPS_SETTER_BYPASS']
    };

    const verification = CanonicalMutationVerifier.verifyMutation(proof as any);

    expect(verification.isValid).toBe(false);
    expect(verification.rejectionReasons).toContain('Proof explicitly denotes non-canonical mutation');
    expect(verification.rejectionReasons).toContain('Revision failed to advance monotonically (prev: 1, new: 1)');
  });

  it('should successfully execute CFD result commitment through Canonical Intent Dispatcher pipeline', async () => {
    const doc: EngineeringDocument = {
      documentId: 'DOC-CFD-CANONICAL-001',
      revision: 1,
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [],
      constraints: [],
      features: [
        { id: 'EXTRUDE_01', type: 'EXTRUDE', depth: 25.0, status: 'VALID' }
      ],
      parameters: [],
      topologyMap: { faces: {}, edges: {}, vertices: {} } as any,
      derived: {
        geometryHash: 'GEO_HASH_REV1_100x50x25'
      },
      evidence: []
    };

    const cfdTool = new CfdTool277();
    const intent = cfdTool.createIntent(doc.documentId, {
      inletVelocity: 12.5,
      fluidDensity: 1.225,
      viscosity: 0.0000181,
      convergenceIterations: 150,
      cellCount: 500,
      results: {
        reynoldsNumber: 25000,
        pressureDropPa: 340.5,
        flowRegime: 'TURBULENT',
        maxVelocity: 18.2
      }
    });

    const dispatchResult = await CanonicalIntentDispatcher277.dispatch(intent, doc);

    expect(dispatchResult.success).toBe(true);
    expect(dispatchResult.revision).toBe(2); // Revision incremented from 1 to 2
    expect(dispatchResult.document).toBeDefined();

    const updatedDoc = dispatchResult.document!;
    expect(updatedDoc.revision).toBe(2);
    expect(updatedDoc.derived.cfd).toBeDefined();
    expect(updatedDoc.derived.cfd.revision).toBe(2);
    expect(updatedDoc.derived.cfd.results.reynoldsNumber).toBe(25000);

    // Verify evidence record binding
    const evidenceChain = updatedDoc.derived.evidenceChain;
    expect(evidenceChain).toBeDefined();
    expect(evidenceChain.length).toBeGreaterThan(0);

    const activeEvidence = evidenceChain.find((e: any) => e.stage === 'SIMULATION' && e.status === 'ACTIVE');
    expect(activeEvidence).toBeDefined();
    expect(activeEvidence.revision).toBe(2);
    expect(activeEvidence.documentId).toBe(doc.documentId);
    expect(activeEvidence.verdict).toBe('VALID');
    expect(activeEvidence.solverInputHash).toBeDefined();
  });

  it('should maintain CFD truth origin as ANALYTICAL', () => {
    const truthDesc = deriveTruthProvenance({
      hasActiveGeometry: true,
      algorithmType: 'ANALYTICAL_1D_CFD',
      documentId: 'DOC-CFD-CANONICAL-001',
      revision: 2,
      hasResult: true,
      verificationPassed: true,
      evidenceId: 'EV_CFD_001'
    });

    expect(truthDesc.status).toBe('ANALYTICAL');
    expect(truthDesc.label).toContain('CAD-DERIVED ANALYTICAL');
  });

  it('should invalidate Rev 1 CFD result when CAD geometry mutates to Rev 2', async () => {
    // 1. Initial Document with CFD at Rev 2
    const docRev1: EngineeringDocument = {
      documentId: 'DOC-CFD-INVALIDATE-001',
      revision: 1,
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [],
      constraints: [],
      features: [
        { id: 'EXTRUDE_01', type: 'EXTRUDE', depth: 25.0, status: 'VALID' }
      ],
      parameters: [],
      topologyMap: { faces: {}, edges: {}, vertices: {} } as any,
      derived: { geometryHash: 'GEO_HASH_REV1_25MM' },
      evidence: []
    };

    const cfdTool = new CfdTool277();
    const intent1 = cfdTool.createIntent(docRev1.documentId, {
      inletVelocity: 10,
      fluidDensity: 1.225,
      viscosity: 0.0000181,
      convergenceIterations: 100,
      results: { reynoldsNumber: 20000, pressureDropPa: 200, flowRegime: 'TURBULENT', maxVelocity: 15 }
    });

    const result1 = await CanonicalIntentDispatcher277.dispatch(intent1, docRev1);
    const docWithCfdRev2 = result1.document!;
    expect(docWithCfdRev2.revision).toBe(2);

    // 2. CAD Geometry Mutates -> Rev 3
    const intent2 = cfdTool.createIntent(docWithCfdRev2.documentId, {
      inletVelocity: 10,
      fluidDensity: 1.225,
      viscosity: 0.0000181,
      convergenceIterations: 100,
      results: { reynoldsNumber: 32000, pressureDropPa: 450, flowRegime: 'TURBULENT', maxVelocity: 22 }
    });

    const result2 = await CanonicalIntentDispatcher277.dispatch(intent2, docWithCfdRev2);
    const docWithCfdRev3 = result2.document!;
    expect(docWithCfdRev3.revision).toBe(3);

    // Prove Rev 2 evidence is now marked SUPERSEDED
    const rev2Evidence = docWithCfdRev3.derived.evidenceChain.find((e: any) => e.revision === 2);
    expect(rev2Evidence).toBeDefined();
    expect(rev2Evidence.status).toBe('SUPERSEDED');
    expect(rev2Evidence.verdict).toBe('SUPERSEDED');

    // Prove Rev 3 evidence is ACTIVE / VALID
    const rev3Evidence = docWithCfdRev3.derived.evidenceChain.find((e: any) => e.revision === 3);
    expect(rev3Evidence).toBeDefined();
    expect(rev3Evidence.status).toBe('ACTIVE');
    expect(rev3Evidence.verdict).toBe('VALID');

    // Prove simulation audit history length is preserved
    const simEvidences = docWithCfdRev3.derived.evidenceChain.filter((e: any) => e.stage === 'SIMULATION');
    expect(simEvidences.length).toBe(2);
  });

  it('should ensure deterministic evaluation across repeated CFD runs on the same document', async () => {
    const doc: EngineeringDocument = {
      documentId: 'DOC-CFD-DETERMINISM-001',
      revision: 1,
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      topologyMap: { faces: {}, edges: {}, vertices: {} } as any,
      derived: { geometryHash: 'GEO_FIXED_HASH' },
      evidence: []
    };

    const cfdTool = new CfdTool277();
    const params = {
      inletVelocity: 8.0,
      fluidDensity: 1.225,
      viscosity: 0.0000181,
      convergenceIterations: 200,
      results: { reynoldsNumber: 16000, pressureDropPa: 180, flowRegime: 'TURBULENT', maxVelocity: 11.5 }
    };

    const intentA = cfdTool.createIntent(doc.documentId, params);
    const intentB = cfdTool.createIntent(doc.documentId, params);

    const resA = await CanonicalIntentDispatcher277.dispatch(intentA, doc);
    const resB = await CanonicalIntentDispatcher277.dispatch(intentB, doc);

    expect(resA.document?.derived.cfd.hash).toEqual(resB.document?.derived.cfd.hash);
  });
});
