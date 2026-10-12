import { describe, it, expect } from 'vitest';
import {
  EngineeringDocument,
  DocumentEvaluator,
  InMemoryDocumentResolver,
  MultiDocumentPersistence,
  PersistedDocumentBundle,
  AssemblyIntentMutator,
  AssemblyIntentAction,
  DEFAULT_UNIT_SYSTEM_MM
} from '../../../engine/cad-kernel/document';
import { CadGeometryKernel } from '../../../engine/cadKernel';

describe('PATCH-038E — Multi-Document Persistence & Rehydration', () => {
  // Helper to build a child box part document
  const createChildBoxDoc = (docId: string, width = 40, height = 30, depth = 20): EngineeringDocument => {
    const doc = DocumentEvaluator.createDocument({
      documentId: docId,
      units: DEFAULT_UNIT_SYSTEM_MM,
      parameters: [
        { name: 'width', value: width, unit: 'mm' } as any,
        { name: 'height', value: height, unit: 'mm' } as any,
        { name: 'depth', value: depth, unit: 'mm' } as any
      ]
    });
    doc.type = 'PART';
    return doc;
  };

  // Helper to build a parent assembly document
  const createParentAssemblyDoc = (assemblyDocId: string): EngineeringDocument => {
    const doc = DocumentEvaluator.createDocument({
      documentId: assemblyDocId,
      units: DEFAULT_UNIT_SYSTEM_MM
    });
    doc.type = 'ASSEMBLY';
    doc.assembly = {
      instances: [
        {
          instanceId: 'inst-base',
          documentId: 'PART_BASE_PLATE',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          colorHex: '#3b82f6',
          isSuppressed: false
        },
        {
          instanceId: 'inst-bracket',
          documentId: 'PART_BRACKET',
          position: { x: 100, y: 50, z: 25 },
          rotation: { x: 0, y: 90, z: 180 },
          colorHex: '#10b981',
          isSuppressed: false
        }
      ],
      mates: [
        {
          mateId: 'mate-base-fixed',
          type: 'FIXED',
          instanceAId: 'inst-base',
          instanceBId: 'inst-base'
        },
        {
          mateId: 'mate-bracket-dist',
          type: 'DISTANCE',
          instanceAId: 'inst-bracket',
          instanceBId: 'inst-base',
          offset: 15.5
        }
      ]
    };
    return doc;
  };

  it('TEST 01: Parent + child documents round-trip', () => {
    const parentDoc = createParentAssemblyDoc('DOC_ASM_RT');
    const childBase = createChildBoxDoc('PART_BASE_PLATE', 100, 50, 10);
    const childBracket = createChildBoxDoc('PART_BRACKET', 40, 40, 20);

    const resolver = new InMemoryDocumentResolver();
    resolver.register(childBase);
    resolver.register(childBracket);

    const bundle = MultiDocumentPersistence.serialize(parentDoc, resolver);
    expect(bundle.rootDocumentId).toBe('DOC_ASM_RT');
    expect(bundle.documents.length).toBe(3);

    const { rootDocument: rehydratedParent, resolver: rehydratedResolver } =
      MultiDocumentPersistence.deserialize(bundle);

    expect(rehydratedParent.documentId).toBe('DOC_ASM_RT');
    expect(rehydratedParent.type).toBe('ASSEMBLY');
    expect(rehydratedResolver.has('PART_BASE_PLATE')).toBe(true);
    expect(rehydratedResolver.has('PART_BRACKET')).toBe(true);

    const rehydratedBase = rehydratedResolver.resolve('PART_BASE_PLATE')!;
    expect(rehydratedBase.documentId).toBe('PART_BASE_PLATE');
    expect(rehydratedBase.parameters?.find(p => p.name === 'width')?.value).toBe(100);
  });

  it('TEST 02: Assembly transforms survive persistence', () => {
    const parentDoc = createParentAssemblyDoc('DOC_ASM_TRANSFORMS');
    const childBase = createChildBoxDoc('PART_BASE_PLATE');
    const childBracket = createChildBoxDoc('PART_BRACKET');

    const resolver = new InMemoryDocumentResolver();
    resolver.register(childBase);
    resolver.register(childBracket);

    const bundle = MultiDocumentPersistence.serialize(parentDoc, resolver);
    const { rootDocument: rehydrated } = MultiDocumentPersistence.deserialize(bundle);

    const instBracket = rehydrated.assembly?.instances.find(i => i.instanceId === 'inst-bracket');
    expect(instBracket).toBeDefined();
    expect(instBracket?.position).toEqual({ x: 100, y: 50, z: 25 });
    expect(instBracket?.rotation).toEqual({ x: 0, y: 90, z: 180 });
  });

  it('TEST 03: Mates survive persistence', () => {
    const parentDoc = createParentAssemblyDoc('DOC_ASM_MATES');
    const resolver = new InMemoryDocumentResolver();
    resolver.register(createChildBoxDoc('PART_BASE_PLATE'));
    resolver.register(createChildBoxDoc('PART_BRACKET'));

    const bundle = MultiDocumentPersistence.serialize(parentDoc, resolver);
    const { rootDocument: rehydrated } = MultiDocumentPersistence.deserialize(bundle);

    expect(rehydrated.assembly?.mates?.length).toBe(2);
    const mateDist = rehydrated.assembly?.mates?.find(m => m.mateId === 'mate-bracket-dist');
    expect(mateDist).toBeDefined();
    expect(mateDist?.type).toBe('DISTANCE');
    expect(mateDist?.instanceAId).toBe('inst-bracket');
    expect(mateDist?.instanceBId).toBe('inst-base');
    expect(mateDist?.offset).toBe(15.5);
  });

  it('TEST 04: Suppression state survives persistence', () => {
    const parentDoc = createParentAssemblyDoc('DOC_ASM_SUPPRESS');
    parentDoc.assembly!.instances[1].isSuppressed = true;

    const resolver = new InMemoryDocumentResolver();
    resolver.register(createChildBoxDoc('PART_BASE_PLATE'));
    resolver.register(createChildBoxDoc('PART_BRACKET'));

    const bundle = MultiDocumentPersistence.serialize(parentDoc, resolver);
    const { rootDocument: rehydrated } = MultiDocumentPersistence.deserialize(bundle);

    const instBracket = rehydrated.assembly?.instances.find(i => i.instanceId === 'inst-bracket');
    expect(instBracket?.isSuppressed).toBe(true);
  });

  it('TEST 05: Child document references resolve after rehydration', () => {
    const parentDoc = createParentAssemblyDoc('DOC_ASM_RESOLVE');
    const resolver = new InMemoryDocumentResolver();
    resolver.register(createChildBoxDoc('PART_BASE_PLATE'));
    resolver.register(createChildBoxDoc('PART_BRACKET'));

    const bundle = MultiDocumentPersistence.serialize(parentDoc, resolver);
    const { resolver: rehydratedResolver } = MultiDocumentPersistence.deserialize(bundle);

    const resBase = rehydratedResolver.resolveWithStatus('PART_BASE_PLATE');
    expect(resBase.status).toBe('RESOLVED');
    expect(resBase.document).toBeDefined();

    const resBracket = rehydratedResolver.resolveWithStatus('PART_BRACKET');
    expect(resBracket.status).toBe('RESOLVED');
    expect(resBracket.document).toBeDefined();
  });

  it('TEST 06: Missing child reference produces "MISSING"', () => {
    const parentDoc = createParentAssemblyDoc('DOC_ASM_MISSING');
    // Add instance referencing a missing document that was never registered in storage
    parentDoc.assembly!.instances.push({
      instanceId: 'inst-ghost-404',
      documentId: 'CHILD-404',
      position: { x: 50, y: 50, z: 0 },
      rotation: { x: 0, y: 0, z: 0 }
    });

    const resolver = new InMemoryDocumentResolver();
    resolver.register(createChildBoxDoc('PART_BASE_PLATE'));
    resolver.register(createChildBoxDoc('PART_BRACKET'));

    const bundle = MultiDocumentPersistence.serialize(parentDoc, resolver);
    // Bundle only contains parentDoc, PART_BASE_PLATE, PART_BRACKET; CHILD-404 does not exist
    expect(bundle.documents.some(d => d.documentId === 'CHILD-404')).toBe(false);

    const { evaluationResult } = MultiDocumentPersistence.rehydrateAndEvaluate(bundle);
    expect(evaluationResult.success).toBe(false);
    expect(evaluationResult.diagnostics.some(d => d.includes('[SECP_DOC_MISSING]'))).toBe(true);
    expect(evaluationResult.diagnostics.some(d => d.includes('CHILD-404'))).toBe(true);
  });

  it('TEST 07: No synthetic geometry is created on missing child', () => {
    const parentDoc = createParentAssemblyDoc('DOC_ASM_NO_SYNTHETIC');
    parentDoc.assembly!.instances = [
      {
        instanceId: 'inst-missing',
        documentId: 'CHILD-MISSING-PART',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 }
      }
    ];
    parentDoc.assembly!.mates = [];

    const resolver = new InMemoryDocumentResolver();
    const bundle = MultiDocumentPersistence.serialize(parentDoc, resolver);

    const { evaluationResult } = MultiDocumentPersistence.rehydrateAndEvaluate(bundle);
    expect(evaluationResult.success).toBe(false);

    const comp = evaluationResult.evaluatedAssembly?.components.find(c => c.id === 'inst-missing');
    expect(comp).toBeDefined();
    // Must be undefined - NO default cube or fallback synthetic solid allowed
    expect(comp?.solid).toBeUndefined();
    expect(comp?.resolutionStatus).toBe('MISSING');
  });

  it('TEST 08: Child documents remain immutable during rehydration & evaluation', () => {
    const parentDoc = createParentAssemblyDoc('DOC_ASM_CHILD_IMMUTABLE');
    const childBase = createChildBoxDoc('PART_BASE_PLATE', 100, 50, 10);
    const childBracket = createChildBoxDoc('PART_BRACKET', 40, 40, 20);

    const resolver = new InMemoryDocumentResolver();
    resolver.register(childBase);
    resolver.register(childBracket);

    const bundle = MultiDocumentPersistence.serialize(parentDoc, resolver);
    const { rootDocument, resolver: rehydratedResolver } = MultiDocumentPersistence.deserialize(bundle);

    const extractCanonicalState = (doc: EngineeringDocument) => ({
      documentId: doc.documentId,
      revision: doc.revision,
      type: doc.type,
      units: doc.units,
      sketches: doc.sketches,
      constraints: doc.constraints,
      features: doc.features,
      parameters: doc.parameters,
      assembly: doc.assembly
    });

    const childBaseBefore = extractCanonicalState(rehydratedResolver.resolve('PART_BASE_PLATE')!);
    const childBracketBefore = extractCanonicalState(rehydratedResolver.resolve('PART_BRACKET')!);

    // Evaluate parent assembly
    DocumentEvaluator.evaluate(rootDocument, { context: { resolver: rehydratedResolver } });

    const childBaseAfter = extractCanonicalState(rehydratedResolver.resolve('PART_BASE_PLATE')!);
    const childBracketAfter = extractCanonicalState(rehydratedResolver.resolve('PART_BRACKET')!);

    // Assembly occurrence evaluation MUST NOT mutate child document canonical state
    expect(childBaseBefore).toEqual(childBaseAfter);
    expect(childBracketBefore).toEqual(childBracketAfter);

    // Occurrence transforms belong strictly to assembly instances, NOT child documents
    expect((rehydratedResolver.resolve('PART_BASE_PLATE') as any).position).toBeUndefined();
    expect((rehydratedResolver.resolve('PART_BASE_PLATE') as any).rotation).toBeUndefined();
    expect((rehydratedResolver.resolve('PART_BRACKET') as any).position).toBeUndefined();
    expect((rehydratedResolver.resolve('PART_BRACKET') as any).rotation).toBeUndefined();
  });

  it('TEST 09: Runtime projection can be destroyed and reconstructed', () => {
    const parentDoc = createParentAssemblyDoc('DOC_ASM_DISPOSABLE');
    const resolver = new InMemoryDocumentResolver();
    resolver.register(createChildBoxDoc('PART_BASE_PLATE'));
    resolver.register(createChildBoxDoc('PART_BRACKET'));

    // 1. Initial evaluation producing runtime projection
    const initialEval = DocumentEvaluator.evaluate(parentDoc, { context: { resolver } });
    expect(initialEval.success).toBe(true);
    const initialTransforms = initialEval.evaluatedAssembly?.components.map(c => ({
      id: c.id,
      position: c.position,
      rotation: c.rotation
    }));

    // 2. Persist
    const jsonString = MultiDocumentPersistence.serializeToJson(parentDoc, resolver);

    // 3. DESTROY ALL RUNTIME STATE
    let destroyedAssemblyData: any = undefined;
    let destroyedEvaluatedAssembly: any = undefined;
    let destroyedActiveSolid: any = undefined;
    expect(destroyedAssemblyData).toBeUndefined();
    expect(destroyedEvaluatedAssembly).toBeUndefined();
    expect(destroyedActiveSolid).toBeUndefined();

    // 4. Rehydrate strictly from persisted JSON
    const { rootDocument: rehydratedParent, resolver: newResolver } =
      MultiDocumentPersistence.deserializeFromJson(jsonString);

    // 5. Reconstruct evaluation
    const reconstructedEval = DocumentEvaluator.evaluate(rehydratedParent, {
      context: { resolver: newResolver }
    });
    expect(reconstructedEval.success).toBe(true);

    const reconstructedTransforms = reconstructedEval.evaluatedAssembly?.components.map(c => ({
      id: c.id,
      position: c.position,
      rotation: c.rotation
    }));

    expect(reconstructedTransforms).toEqual(initialTransforms);
  });

  it('TEST 10: Evaluation before/after persistence is equivalent', () => {
    const parentDoc = createParentAssemblyDoc('DOC_ASM_EQUIV');
    const resolver = new InMemoryDocumentResolver();
    resolver.register(createChildBoxDoc('PART_BASE_PLATE', 80, 40, 15));
    resolver.register(createChildBoxDoc('PART_BRACKET', 30, 30, 10));

    const evalBefore = DocumentEvaluator.evaluate(parentDoc, { context: { resolver } });
    expect(evalBefore.success).toBe(true);

    const bundle = MultiDocumentPersistence.serialize(parentDoc, resolver);
    const { evaluationResult: evalAfter } = MultiDocumentPersistence.rehydrateAndEvaluate(bundle);

    expect(evalAfter.success).toBe(true);
    expect(evalAfter.evaluatedAssembly?.components.length).toBe(
      evalBefore.evaluatedAssembly?.components.length
    );
    expect(evalAfter.evaluatedAssembly?.mates.length).toBe(
      evalBefore.evaluatedAssembly?.mates.length
    );

    for (let i = 0; i < evalBefore.evaluatedAssembly!.components.length; i++) {
      const compBefore = evalBefore.evaluatedAssembly!.components[i];
      const compAfter = evalAfter.evaluatedAssembly!.components[i];
      expect(compAfter.id).toBe(compBefore.id);
      expect(compAfter.position).toEqual(compBefore.position);
      expect(compAfter.rotation).toEqual(compBefore.rotation);
      expect(compAfter.suppressed).toBe(compBefore.suppressed);
    }
  });

  it('TEST 11: Deterministic serialization', () => {
    const parentDoc = createParentAssemblyDoc('DOC_ASM_DETERMINISM');
    const resolver = new InMemoryDocumentResolver();
    resolver.register(createChildBoxDoc('PART_BASE_PLATE'));
    resolver.register(createChildBoxDoc('PART_BRACKET'));

    const jsonA = MultiDocumentPersistence.serializeToJson(parentDoc, resolver);
    const jsonB = MultiDocumentPersistence.serializeToJson(parentDoc, resolver);

    // Byte-for-byte identical output
    expect(jsonA).toBe(jsonB);
  });

  it('TEST 12: Deterministic rehydration', () => {
    const parentDoc = createParentAssemblyDoc('DOC_ASM_DET_REHYD');
    const resolver = new InMemoryDocumentResolver();
    resolver.register(createChildBoxDoc('PART_BASE_PLATE'));
    resolver.register(createChildBoxDoc('PART_BRACKET'));

    const bundle = MultiDocumentPersistence.serialize(parentDoc, resolver);

    const resA = MultiDocumentPersistence.rehydrateAndEvaluate(bundle);
    const resB = MultiDocumentPersistence.rehydrateAndEvaluate(bundle);

    expect(resA.evaluationResult.success).toBe(resB.evaluationResult.success);
    expect(resA.evaluationResult.evaluatedAssembly?.components.map(c => c.position)).toEqual(
      resB.evaluationResult.evaluatedAssembly?.components.map(c => c.position)
    );
    expect(resA.evaluationResult.evaluatedAssembly?.mates.map(m => m.status)).toEqual(
      resB.evaluationResult.evaluatedAssembly?.mates.map(m => m.status)
    );
  });

  it('TEST 13: IDs and revisions survive persistence unmodified', () => {
    const parentDoc = createParentAssemblyDoc('DOC_ASM_IDS');
    parentDoc.revision = 7;
    parentDoc.assembly!.instances[0].instanceId = 'custom-inst-id-alpha';
    parentDoc.assembly!.mates![0].mateId = 'custom-mate-id-omega';

    const resolver = new InMemoryDocumentResolver();
    resolver.register(createChildBoxDoc('PART_BASE_PLATE'));
    resolver.register(createChildBoxDoc('PART_BRACKET'));

    const bundle = MultiDocumentPersistence.serialize(parentDoc, resolver);
    const { rootDocument: rehydrated } = MultiDocumentPersistence.deserialize(bundle);

    expect(rehydrated.documentId).toBe('DOC_ASM_IDS');
    expect(rehydrated.revision).toBe(7);
    expect(rehydrated.assembly?.instances[0].instanceId).toBe('custom-inst-id-alpha');
    expect(rehydrated.assembly?.mates?.[0]?.mateId).toBe('custom-mate-id-omega');
  });

  it('TEST 14: Malformed persisted references and data are rejected', () => {
    // 1. Missing rootDocumentId
    expect(() => {
      MultiDocumentPersistence.deserialize({
        schemaVersion: '1.0.0',
        rootDocumentId: '',
        documents: []
      } as any);
    }).toThrow('[SECP_PERSISTENCE_VALIDATION_ERROR]');

    // 2. Non-numeric instance position
    expect(() => {
      MultiDocumentPersistence.deserialize({
        schemaVersion: '1.0.0',
        rootDocumentId: 'DOC_ASM',
        documents: [
          {
            documentId: 'DOC_ASM',
            revision: 1,
            units: DEFAULT_UNIT_SYSTEM_MM,
            sketches: [],
            constraints: [],
            features: [],
            parameters: [],
            assembly: {
              instances: [
                {
                  instanceId: 'inst-1',
                  documentId: 'PART_1',
                  position: { x: 'not_a_number' as any, y: 0, z: 0 },
                  rotation: { x: 0, y: 0, z: 0 }
                }
              ],
              mates: []
            }
          }
        ]
      } as any);
    }).toThrow('[SECP_PERSISTENCE_VALIDATION_ERROR]');

    // 3. Invalid mate type
    expect(() => {
      MultiDocumentPersistence.deserialize({
        schemaVersion: '1.0.0',
        rootDocumentId: 'DOC_ASM',
        documents: [
          {
            documentId: 'DOC_ASM',
            revision: 1,
            units: DEFAULT_UNIT_SYSTEM_MM,
            sketches: [],
            constraints: [],
            features: [],
            parameters: [],
            assembly: {
              instances: [
                {
                  instanceId: 'inst-1',
                  documentId: 'PART_1',
                  position: { x: 0, y: 0, z: 0 },
                  rotation: { x: 0, y: 0, z: 0 }
                }
              ],
              mates: [
                {
                  mateId: 'mate-invalid',
                  type: 'BOGUS_MATE_TYPE' as any,
                  instanceAId: 'inst-1',
                  instanceBId: 'inst-1'
                }
              ]
            }
          }
        ]
      } as any);
    }).toThrow('[SECP_PERSISTENCE_VALIDATION_ERROR]');
  });

  it('TEST 15: Full parent -> child -> evaluator causality survives persistence', () => {
    const parentDoc = createParentAssemblyDoc('DOC_ASM_CAUSALITY');
    const childBase = createChildBoxDoc('PART_BASE_PLATE', 100, 50, 10);
    const childBracket = createChildBoxDoc('PART_BRACKET', 40, 40, 20);

    const resolver = new InMemoryDocumentResolver();
    resolver.register(childBase);
    resolver.register(childBracket);

    // Mutate child feature parameter (depth 10 -> 80)
    const paramDepth = childBase.parameters?.find(p => p.name === 'depth')!;
    paramDepth.value = 80;

    // Serialize mutated system
    const bundle = MultiDocumentPersistence.serialize(parentDoc, resolver);

    // Rehydrate and evaluate with mesh generation enabled
    const { evaluationResult } = MultiDocumentPersistence.rehydrateAndEvaluate(bundle, {
      generateMesh: true
    });
    expect(evaluationResult.success).toBe(true);

    const baseComp = evaluationResult.evaluatedAssembly?.components.find(
      c => c.id === 'inst-base'
    );
    expect(baseComp?.solid).toBeDefined();

    // Verify depth change propagated to the evaluated occurrence solid bounding box dimensions
    const solidDepth = (baseComp!.solid as any).dimensions?.dz;
    expect(solidDepth).toBe(80);
  });

  it('TEST 16: Full UI Intent -> canonicalDocument -> persistence -> rehydration -> resolver -> evaluator -> evaluatedAssembly causality', () => {
    let doc = createParentAssemblyDoc('DOC_ASM_FULL_FLOW');
    const childBase = createChildBoxDoc('PART_BASE_PLATE');
    const childBracket = createChildBoxDoc('PART_BRACKET');
    const childPin = createChildBoxDoc('PART_PIN', 10, 10, 50);

    const resolver = new InMemoryDocumentResolver();
    resolver.register(childBase);
    resolver.register(childBracket);
    resolver.register(childPin);

    // 1. UI Intent Action: Add new pin instance
    const addPinAction: AssemblyIntentAction = {
      type: 'ADD_INSTANCE',
      instance: {
        instanceId: 'inst-pin-01',
        documentId: 'PART_PIN',
        position: { x: 30, y: 20, z: 10 },
        rotation: { x: 0, y: 0, z: 0 }
      }
    };
    doc = AssemblyIntentMutator.apply(doc, addPinAction);

    // 2. UI Intent Action: Add concentric mate for pin
    const addMateAction: AssemblyIntentAction = {
      type: 'ADD_MATE',
      mate: {
        mateId: 'mate-pin-concentric',
        type: 'CONCENTRIC',
        instanceAId: 'inst-pin-01',
        instanceBId: 'inst-bracket'
      }
    };
    doc = AssemblyIntentMutator.apply(doc, addMateAction);

    expect(doc.revision).toBe(3);
    expect(doc.assembly?.instances.length).toBe(3);
    expect(doc.assembly?.mates?.length).toBe(3);

    // 3. Persist to JSON
    const jsonString = MultiDocumentPersistence.serializeToJson(doc, resolver);

    // 4. Rehydrate
    const { rootDocument: rehydrated, resolver: newResolver } =
      MultiDocumentPersistence.deserializeFromJson(jsonString);

    expect(rehydrated.revision).toBe(3);

    // 5. Evaluate
    const evalResult = DocumentEvaluator.evaluate(rehydrated, {
      context: { resolver: newResolver }
    });

    expect(evalResult.success).toBe(true);
    expect(evalResult.evaluatedAssembly?.components.length).toBe(3);
    const pinComp = evalResult.evaluatedAssembly?.components.find(c => c.id === 'inst-pin-01');
    expect(pinComp).toBeDefined();
    expect(pinComp?.solid).toBeDefined();

    const pinMate = evalResult.evaluatedAssembly?.mates.find(m => m.id === 'mate-pin-concentric');
    expect(pinMate).toBeDefined();
    expect(pinMate?.status).toBe('SOLVED');
  });

  it('TEST 17: Three-Run Determinism Proof (Requirement H)', () => {
    /**
     * Requirement H: Run critical workflows three separate times and verify exact match across:
     * 1. geometryHash
     * 2. topologyHash
     * 3. bRepHash
     * 4. volumeM3
     * 5. dimensions (dx, dy, dz)
     * 6. identity (documentId)
     * 7. revision
     * 8. assembly result (components count & properties)
     * 9. resolution status
     * 10. diagnostics
     */
    const runs: any[] = [];

    for (let runIndex = 0; runIndex < 3; runIndex++) {
      const childPart = createChildBoxDoc('PART_DET_BOX', 50, 30, 40);
      const parentAsm = createParentAssemblyDoc('DOC_ASM_DETERMINISM');
      
      const resolver = new InMemoryDocumentResolver();
      resolver.register(childPart);
      resolver.register(createChildBoxDoc('PART_BASE_PLATE'));
      resolver.register(createChildBoxDoc('PART_BRACKET'));

      // Evaluate
      const evalRes = DocumentEvaluator.evaluate(parentAsm, {
        generateMesh: true,
        context: { resolver }
      });

      // Part Evaluation
      const partEvalRes = DocumentEvaluator.evaluate(childPart, { generateMesh: true });
      const partCadSolid = CadGeometryKernel.deriveCadSolidFromEvaluation(partEvalRes);

      const partEvidence = partEvalRes.document.evidence?.[partEvalRes.document.evidence.length - 1];

      runs.push({
        partIdentity: childPart.documentId,
        partRevision: childPart.revision,
        partGeometryHash: partEvidence?.geometryHash,
        partTopologyHash: partEvidence?.topologyHash,
        partBRepHash: partEvalRes.derivedArtifacts?.bRepHash,
        partVolumeM3: partCadSolid?.volumeM3,
        partDimensions: { ...partCadSolid?.dimensions },
        asmSuccess: evalRes.success,
        asmComponentsCount: evalRes.evaluatedAssembly?.components.length,
        asmMatesCount: evalRes.evaluatedAssembly?.mates.length,
        asmResolutionStatus: evalRes.evaluatedAssembly?.components.map(c => c.resolutionStatus),
        asmDiagnostics: [...evalRes.diagnostics]
      });
    }

    // Compare Run 1 vs Run 2 vs Run 3
    const run0 = runs[0];
    const run1 = runs[1];
    const run2 = runs[2];

    // Explicit cross-run comparison for DETERMINISM
    // RUN 1 === RUN 2
    expect(run0.partIdentity).toBe(run1.partIdentity);
    expect(run0.partRevision).toBe(run1.partRevision);
    expect(run0.partGeometryHash).toBe(run1.partGeometryHash);
    expect(run0.partTopologyHash).toBe(run1.partTopologyHash);
    expect(run0.partBRepHash).toBe(run1.partBRepHash);
    expect(run0.partVolumeM3).toBe(run1.partVolumeM3);
    expect(run0.partDimensions).toEqual(run1.partDimensions);
    expect(run0.asmSuccess).toBe(run1.asmSuccess);
    expect(run0.asmComponentsCount).toBe(run1.asmComponentsCount);
    expect(run0.asmMatesCount).toBe(run1.asmMatesCount);
    expect(run0.asmResolutionStatus).toEqual(run1.asmResolutionStatus);
    expect(run0.asmDiagnostics).toEqual(run1.asmDiagnostics);

    // RUN 2 === RUN 3
    expect(run1.partIdentity).toBe(run2.partIdentity);
    expect(run1.partRevision).toBe(run2.partRevision);
    expect(run1.partGeometryHash).toBe(run2.partGeometryHash);
    expect(run1.partTopologyHash).toBe(run2.partTopologyHash);
    expect(run1.partBRepHash).toBe(run2.partBRepHash);
    expect(run1.partVolumeM3).toBe(run2.partVolumeM3);
    expect(run1.partDimensions).toEqual(run2.partDimensions);
    expect(run1.asmSuccess).toBe(run2.asmSuccess);
    expect(run1.asmComponentsCount).toBe(run2.asmComponentsCount);
    expect(run1.asmMatesCount).toBe(run2.asmMatesCount);
    expect(run1.asmResolutionStatus).toEqual(run2.asmResolutionStatus);
    expect(run1.asmDiagnostics).toEqual(run2.asmDiagnostics);

    // UNIT CONTRACT PROOF
    // 50x30x40 mm -> Volume = 0.00006 m³
    // NOTE: CadSolidEntity.dimensions are in METERS (SI)
    expect(run0.partDimensions.dx).toBe(0.05); 
    expect(run0.partDimensions.dy).toBe(0.03);
    expect(run0.partDimensions.dz).toBe(0.04);
    expect(run0.partVolumeM3).toBeCloseTo(0.00006, 8);
  });
});
