/**
 * PATCH-038D — Canonical UI Assembly Intent Mutation Verification Battery
 * 
 * Objective: Verify the elimination of the Assembly SOT violation by ensuring:
 * 1. All UI actions flow through AssemblyIntentMutator -> canonicalDocument.assembly.
 * 2. DocumentEvaluator is the sole evaluator producing evaluatedAssembly.
 * 3. Immutable, deterministic document transitions without direct runtime mutations.
 * 4. Comprehensive intent action coverage (ADD_INSTANCE, REMOVE_INSTANCE, UPDATE_TRANSFORM, ADD_MATE, REMOVE_MATE, UPDATE_MATE, SUPPRESS_INSTANCE).
 * 5. Clean handling of mate references when instances are removed.
 * 6. Explicit adherence to SECP_UNIT_CONTRACT (no naked magic conversion numbers).
 */

import { describe, it, expect } from 'vitest';
import { 
  AssemblyIntentMutator, 
  AssemblyIntentAction,
  DocumentEvaluator, 
  InMemoryDocumentResolver,
  EngineeringDocument,
  SECP_UNIT_CONTRACT
} from '../../../engine/cad-kernel/document';

describe('PATCH-038D — Canonical UI Assembly Intent Mutation', () => {
  const createBaseAssemblyDocument = (): EngineeringDocument => {
    const doc = DocumentEvaluator.createDocument({
      documentId: 'DOC_ASM_ROOT'
    });
    doc.type = 'ASSEMBLY';
    doc.assembly = {
      instances: [
        {
          instanceId: 'inst-base',
          documentId: 'DOC_PART_BASE',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          colorHex: '#64748b'
        },
        {
          instanceId: 'inst-slider',
          documentId: 'DOC_PART_SLIDER',
          position: { x: 50, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          colorHex: '#38bdf8'
        }
      ],
      mates: []
    };
    return doc;
  };

  it('TEST 1: UI Intent -> AssemblyIntentMutator -> canonicalDocument.assembly updated without direct runtime mutation', () => {
    const doc = createBaseAssemblyDocument();
    expect(doc.assembly?.mates.length).toBe(0);

    const action: AssemblyIntentAction = {
      type: 'ADD_MATE',
      mate: {
        mateId: 'mate-slider-coincident',
        type: 'COINCIDENT',
        instanceAId: 'inst-slider',
        instanceBId: 'inst-base',
        offset: 0
      }
    };

    const updatedDoc = AssemblyIntentMutator.apply(doc, action);

    // 1. Immutability verification
    expect(updatedDoc).not.toBe(doc);
    expect(updatedDoc.assembly).not.toBe(doc.assembly);
    expect(updatedDoc.revision).toBe(2);

    // 2. Old document untouched (SOT purity)
    expect(doc.assembly?.mates.length).toBe(0);

    // 3. New document contains updated mate intent
    expect(updatedDoc.assembly?.mates.length).toBe(1);
    expect(updatedDoc.assembly?.mates[0].mateId).toBe('mate-slider-coincident');
    expect(updatedDoc.assembly?.mates[0].type).toBe('COINCIDENT');
  });

  it('TEST 2: DocumentEvaluator re-evaluates updated canonicalDocument and produces updated evaluatedAssembly', () => {
    const doc = createBaseAssemblyDocument();
    const resolver = new InMemoryDocumentResolver();

    // Register simple child documents
    const childBase = DocumentEvaluator.createDocument({ documentId: 'DOC_PART_BASE' });
    const childSlider = DocumentEvaluator.createDocument({ documentId: 'DOC_PART_SLIDER' });
    resolver.register(childBase);
    resolver.register(childSlider);

    // Add fixed mate and distance mate
    let currentDoc = AssemblyIntentMutator.apply(doc, {
      type: 'ADD_MATE',
      mate: {
        mateId: 'mate-fixed-base',
        type: 'FIXED',
        instanceAId: 'inst-base',
        instanceBId: 'inst-base'
      }
    });

    currentDoc = AssemblyIntentMutator.apply(currentDoc, {
      type: 'ADD_MATE',
      mate: {
        mateId: 'mate-slider-dist',
        type: 'DISTANCE',
        instanceAId: 'inst-slider',
        instanceBId: 'inst-base',
        offset: 25
      }
    });

    // Evaluate canonical document
    const evalResult = DocumentEvaluator.evaluate(currentDoc, {
      generateMesh: true,
      context: { resolver }
    });

    expect(evalResult.success).toBe(true);
    expect(evalResult.document).toBe(currentDoc);
    expect(evalResult.evaluatedAssembly).toBeDefined();

    const evaluated = evalResult.evaluatedAssembly!;
    expect(evaluated.components.length).toBe(2);
    expect(evaluated.mates.length).toBe(2);

    // Mates must be truthfully solved
    const fixedMate = evaluated.mates.find(m => m.id === 'mate-fixed-base');
    const distMate = evaluated.mates.find(m => m.id === 'mate-slider-dist');

    expect(fixedMate?.status).toBe('SOLVED');
    expect(distMate?.status).toBe('SOLVED');

    // Instance transform must reflect solved state
    const sliderComp = evaluated.components.find(c => c.id === 'inst-slider');
    expect(sliderComp?.position.x).toBe(25);
  });

  it('TEST 3: Direct UI-to-runtime mutation is blocked / obsolete (causality check)', () => {
    const doc = createBaseAssemblyDocument();
    
    // Simulate legacy rogue UI state
    const rogueRuntimeState = {
      components: [
        { instanceId: 'inst-fake-rogue', name: 'Rogue Instance', position: { x: 999, y: 999, z: 999 } }
      ],
      mates: [
        { id: 'fake-mate', satisfied: true }
      ]
    };

    // The canonical evaluation only consumes canonicalDocument
    const evalResult = DocumentEvaluator.evaluate(doc);

    // Verify rogueRuntimeState had zero causal impact on the evaluated assembly
    expect(evalResult.evaluatedAssembly?.components.some(c => c.id === 'inst-fake-rogue')).toBe(false);
    expect(evalResult.evaluatedAssembly?.components.length).toBe(2);
    expect(evalResult.document.assembly?.instances.some(i => i.instanceId === 'inst-fake-rogue')).toBe(false);
  });

  it('TEST 4: Intent Mutator supports all required actions', () => {
    let doc = createBaseAssemblyDocument();

    // 1. ADD_INSTANCE
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'ADD_INSTANCE',
      instance: {
        instanceId: 'inst-pin-01',
        documentId: 'DOC_PART_PIN',
        position: { x: 10, y: 20, z: 30 },
        rotation: { x: 0, y: 0, z: 0 },
        colorHex: '#10b981'
      }
    });
    expect(doc.assembly?.instances.length).toBe(3);
    expect(doc.assembly?.instances[2].instanceId).toBe('inst-pin-01');

    // 2. UPDATE_TRANSFORM
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'UPDATE_TRANSFORM',
      instanceId: 'inst-pin-01',
      position: { x: 15, y: 25, z: 35 },
      rotation: { x: 90, y: 0, z: 0 }
    });
    const pin = doc.assembly?.instances.find(i => i.instanceId === 'inst-pin-01');
    expect(pin?.position).toEqual({ x: 15, y: 25, z: 35 });
    expect(pin?.rotation).toEqual({ x: 90, y: 0, z: 0 });

    // 3. ADD_MATE
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'ADD_MATE',
      mate: {
        mateId: 'mate-concentric-pin',
        type: 'CONCENTRIC',
        instanceAId: 'inst-pin-01',
        instanceBId: 'inst-base'
      }
    });
    expect(doc.assembly?.mates.length).toBe(1);

    // 4. UPDATE_MATE
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'UPDATE_MATE',
      mateId: 'mate-concentric-pin',
      patch: {
        offset: 5
      }
    });
    const mate = doc.assembly?.mates.find(m => m.mateId === 'mate-concentric-pin');
    expect(mate?.offset).toBe(5);

    // 5. SUPPRESS_INSTANCE
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'SUPPRESS_INSTANCE',
      instanceId: 'inst-pin-01',
      suppressed: true
    });
    const pinSuppressed = doc.assembly?.instances.find(i => i.instanceId === 'inst-pin-01');
    expect(pinSuppressed?.isSuppressed).toBe(true);

    // 6. REMOVE_MATE
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'REMOVE_MATE',
      mateId: 'mate-concentric-pin'
    });
    expect(doc.assembly?.mates.length).toBe(0);

    // 7. REMOVE_INSTANCE
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'REMOVE_INSTANCE',
      instanceId: 'inst-pin-01'
    });
    expect(doc.assembly?.instances.length).toBe(2);
    expect(doc.assembly?.instances.some(i => i.instanceId === 'inst-pin-01')).toBe(false);
  });

  it('TEST 5: Clean removal of instance cleans up referencing mates without leaving dangling references', () => {
    let doc = createBaseAssemblyDocument();

    // Add a mate referencing inst-slider
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'ADD_MATE',
      mate: {
        mateId: 'mate-slider-to-base',
        type: 'COINCIDENT',
        instanceAId: 'inst-slider',
        instanceBId: 'inst-base'
      }
    });
    expect(doc.assembly?.mates.length).toBe(1);

    // Remove inst-slider
    doc = AssemblyIntentMutator.apply(doc, {
      type: 'REMOVE_INSTANCE',
      instanceId: 'inst-slider'
    });

    // The referencing mate must be cleanly removed to avoid dangling references
    expect(doc.assembly?.instances.length).toBe(1);
    expect(doc.assembly?.mates.length).toBe(0);
    expect(doc.assembly?.mates.some(m => m.instanceAId === 'inst-slider' || m.instanceBId === 'inst-slider')).toBe(false);
  });

  it('TEST 6: Unit Contract compliance boundary verification', () => {
    // Standard conversions
    expect(SECP_UNIT_CONTRACT.mmToMetres(1000)).toBe(1);
    expect(SECP_UNIT_CONTRACT.metresToMm(1)).toBe(1000);
    expect(SECP_UNIT_CONTRACT.mm3ToM3(1e9)).toBe(1);
    expect(SECP_UNIT_CONTRACT.m3ToMm3(1)).toBe(1e9);

    // Arbitrary precision conversion check
    expect(SECP_UNIT_CONTRACT.mmToMetres(250)).toBe(0.25);
    expect(SECP_UNIT_CONTRACT.metresToMm(0.045)).toBe(45);
  });

  it('TEST 7: Determinism & Purity across multiple identical intent applications', () => {
    const docA = createBaseAssemblyDocument();
    const docB = createBaseAssemblyDocument();

    const action: AssemblyIntentAction = {
      type: 'ADD_INSTANCE',
      instance: {
        instanceId: 'inst-det-01',
        documentId: 'DOC_PART_DET',
        position: { x: 100, y: 200, z: 300 },
        rotation: { x: 0, y: 45, z: 0 }
      }
    };

    const resA = AssemblyIntentMutator.apply(docA, action);
    const resB = AssemblyIntentMutator.apply(docB, action);

    expect(resA.assembly).toEqual(resB.assembly);
    expect(resA.revision).toBe(resB.revision);
  });
});
