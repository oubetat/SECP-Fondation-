/**
 * PATCH-039A Verification Battery
 * Hierarchical Sub-Assembly Resolution & Recursive Occurrence Graph
 * 
 * Verifies the 12 Core Architectural Requirements & 22 Mandatory Invariants:
 * - TEST-01: Basic nested assembly resolution
 * - TEST-02: Multi-level recursion
 * - TEST-03: occurrencePath correctness
 * - TEST-04: Transform composition (translation only)
 * - TEST-05: Rotation + translation composition
 * - TEST-06: Missing child handling
 * - TEST-07: Cycle detection with active traversal stack
 * - TEST-08: Suppression propagation
 * - TEST-09: Child canonical immutability
 * - TEST-10: Deterministic evaluation (independent of resolver registration order)
 * - TEST-11: Canonical SOT isolation
 * - TEST-12: Persistence round-trip of the recursive graph
 */

import { describe, it, expect } from 'vitest';
import {
  DocumentEvaluator,
  DEFAULT_UNIT_SYSTEM_MM,
  InMemoryDocumentResolver,
  EngineeringDocument,
  MultiDocumentPersistence
} from '../../../engine/cad-kernel/document';

describe('PATCH-039A — Hierarchical Sub-Assembly Resolution & Recursive Occurrence Graph', () => {

  const createPartDoc = (
    docId: string,
    width = 20,
    height = 20,
    depth = 20
  ): EngineeringDocument => {
    const doc = DocumentEvaluator.createDocument({
      documentId: docId,
      units: DEFAULT_UNIT_SYSTEM_MM
    });
    doc.type = 'PART';
    doc.parameters = [
      { id: 'p_w', name: 'width', expression: `${width}`, value: width, unit: 'mm', isDriving: true, category: 'GEOMETRY' },
      { id: 'p_h', name: 'height', expression: `${height}`, value: height, unit: 'mm', isDriving: true, category: 'GEOMETRY' },
      { id: 'p_d', name: 'depth', expression: `${depth}`, value: depth, unit: 'mm', isDriving: true, category: 'GEOMETRY' }
    ];
    doc.features = [
      {
        id: `feat_${docId}`,
        name: 'Base_Extrude',
        type: 'EXTRUDE',
        parameters: { width, height, depth }
      }
    ];
    return doc;
  };

  const createAssemblyDoc = (
    docId: string,
    instances: Array<{
      instanceId: string;
      documentId: string;
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      isSuppressed?: boolean;
      colorHex?: string;
    }> = []
  ): EngineeringDocument => {
    const doc = DocumentEvaluator.createDocument({
      documentId: docId,
      units: DEFAULT_UNIT_SYSTEM_MM
    });
    doc.type = 'ASSEMBLY';
    doc.assembly = {
      instances: instances.map(inst => ({
        instanceId: inst.instanceId,
        documentId: inst.documentId,
        position: { ...inst.position },
        rotation: { ...inst.rotation },
        isSuppressed: !!inst.isSuppressed,
        colorHex: inst.colorHex || '#3b82f6'
      })),
      mates: []
    };
    return doc;
  };

  it('TEST-01: basic nested assembly resolution', () => {
    const resolver = new InMemoryDocumentResolver();

    // L2: Leaf Part
    const leafPart = createPartDoc('PART_GEAR', 15, 15, 5);
    resolver.register(leafPart);

    // L1: Sub-Assembly referencing leaf part
    const subAsm = createAssemblyDoc('ASM_GEARBOX', [
      {
        instanceId: 'inst_gear_1',
        documentId: 'PART_GEAR',
        position: { x: 10, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 }
      }
    ]);
    resolver.register(subAsm);

    // L0: Root Assembly referencing sub-assembly
    const rootAsm = createAssemblyDoc('ASM_ROOT', [
      {
        instanceId: 'inst_gearbox_1',
        documentId: 'ASM_GEARBOX',
        position: { x: 100, y: 50, z: 0 },
        rotation: { x: 0, y: 0, z: 0 }
      }
    ]);

    const result = DocumentEvaluator.evaluate(rootAsm, { context: { resolver } });

    expect(result.success).toBe(true);
    expect(result.evaluatedAssembly).toBeDefined();
    expect(result.evaluatedAssembly?.components.length).toBe(2);

    const comp = result.evaluatedAssembly?.components.find(c => c.documentId === 'PART_GEAR');
    expect(comp?.occurrencePath).toBe('inst_gearbox_1/inst_gear_1');
    expect(comp?.partId).toBe('PART_GEAR');
    expect(comp?.depth).toBe(1);
    expect(comp?.position).toEqual({ x: 110, y: 50, z: 0 });
    expect(comp?.solid).toBeDefined();
  });

  it('TEST-02: multi-level recursion', () => {
    const resolver = new InMemoryDocumentResolver();

    const part = createPartDoc('PART_BEARING', 10, 10, 4);
    resolver.register(part);

    const asmLevel3 = createAssemblyDoc('ASM_L3', [
      { instanceId: 'inst_p', documentId: 'PART_BEARING', position: { x: 1, y: 1, z: 1 }, rotation: { x: 0, y: 0, z: 0 } }
    ]);
    resolver.register(asmLevel3);

    const asmLevel2 = createAssemblyDoc('ASM_L2', [
      { instanceId: 'inst_l3', documentId: 'ASM_L3', position: { x: 10, y: 10, z: 10 }, rotation: { x: 0, y: 0, z: 0 } }
    ]);
    resolver.register(asmLevel2);

    const asmLevel1 = createAssemblyDoc('ASM_L1', [
      { instanceId: 'inst_l2', documentId: 'ASM_L2', position: { x: 100, y: 100, z: 100 }, rotation: { x: 0, y: 0, z: 0 } }
    ]);
    resolver.register(asmLevel1);

    const asmRoot = createAssemblyDoc('ASM_L0', [
      { instanceId: 'inst_l1', documentId: 'ASM_L1', position: { x: 1000, y: 1000, z: 1000 }, rotation: { x: 0, y: 0, z: 0 } }
    ]);

    const result = DocumentEvaluator.evaluate(asmRoot, { context: { resolver } });

    expect(result.success).toBe(true);
    expect(result.evaluatedAssembly?.components.length).toBe(4);

    const comp = result.evaluatedAssembly?.components.find(c => c.documentId === 'PART_BEARING');
    expect(comp?.occurrencePath).toBe('inst_l1/inst_l2/inst_l3/inst_p');
    expect(comp?.depth).toBe(3);
    expect(comp?.position).toEqual({ x: 1111, y: 1111, z: 1111 });
    expect(comp?.solid).toBeDefined();
  });

  it('TEST-03: occurrencePath correctness', () => {
    const resolver = new InMemoryDocumentResolver();

    const part = createPartDoc('PART_WHEEL', 40, 40, 10);
    resolver.register(part);

    const subAsm = createAssemblyDoc('ASM_WHEEL_UNIT', [
      { instanceId: 'inst_rim', documentId: 'PART_WHEEL', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
    ]);
    resolver.register(subAsm);

    const rootAsm = createAssemblyDoc('ASM_CHASSIS', [
      { instanceId: 'front_left', documentId: 'ASM_WHEEL_UNIT', position: { x: 100, y: 50, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
      { instanceId: 'front_right', documentId: 'ASM_WHEEL_UNIT', position: { x: 100, y: -50, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
      { instanceId: 'rear_left', documentId: 'ASM_WHEEL_UNIT', position: { x: -100, y: 50, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
      { instanceId: 'rear_right', documentId: 'ASM_WHEEL_UNIT', position: { x: -100, y: -50, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
    ]);

    const result = DocumentEvaluator.evaluate(rootAsm, { context: { resolver } });
    expect(result.success).toBe(true);
    expect(result.evaluatedAssembly?.components.length).toBe(8);

    const paths = result.evaluatedAssembly?.components
      .filter(c => c.documentId === 'PART_WHEEL')
      .map(c => c.occurrencePath);
    expect(paths).toEqual([
      'front_left/inst_rim',
      'front_right/inst_rim',
      'rear_left/inst_rim',
      'rear_right/inst_rim'
    ]);
  });

  it('TEST-04: transform composition', () => {
    const resolver = new InMemoryDocumentResolver();

    const part = createPartDoc('PART_BLOCK', 10, 10, 10);
    resolver.register(part);

    const subAsm = createAssemblyDoc('ASM_SUB', [
      { instanceId: 'inst_block_a', documentId: 'PART_BLOCK', position: { x: 25, y: -10, z: 5 }, rotation: { x: 0, y: 0, z: 0 } },
      { instanceId: 'inst_block_b', documentId: 'PART_BLOCK', position: { x: -15, y: 30, z: -20 }, rotation: { x: 0, y: 0, z: 0 } }
    ]);
    resolver.register(subAsm);

    const rootAsm = createAssemblyDoc('ASM_ROOT_TRANS', [
      { instanceId: 'inst_sub', documentId: 'ASM_SUB', position: { x: 100, y: 200, z: 300 }, rotation: { x: 0, y: 0, z: 0 } }
    ]);

    const result = DocumentEvaluator.evaluate(rootAsm, { context: { resolver } });
    expect(result.success).toBe(true);

    const compA = result.evaluatedAssembly?.components.find(c => c.occurrencePath === 'inst_sub/inst_block_a');
    const compB = result.evaluatedAssembly?.components.find(c => c.occurrencePath === 'inst_sub/inst_block_b');

    // M_world = M_parent × M_child (Translation composition)
    expect(compA?.position).toEqual({ x: 125, y: 190, z: 305 });
    expect(compB?.position).toEqual({ x: 85, y: 230, z: 280 });
  });

  it('TEST-05: rotation + translation composition', () => {
    const resolver = new InMemoryDocumentResolver();

    const part = createPartDoc('PART_PIN', 5, 5, 20);
    resolver.register(part);

    // Sub-Assembly: Child has local translation +50 along its local X-axis
    const subAsm = createAssemblyDoc('ASM_ROT_SUB', [
      { instanceId: 'inst_pin', documentId: 'PART_PIN', position: { x: 50, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
    ]);
    resolver.register(subAsm);

    // Root Assembly: Places sub-assembly at (100, 100, 0) rotated 90 degrees around Z axis (X -> Y)
    const rootAsm = createAssemblyDoc('ASM_ROT_ROOT', [
      { instanceId: 'inst_rot_sub', documentId: 'ASM_ROT_SUB', position: { x: 100, y: 100, z: 0 }, rotation: { x: 0, y: 0, z: 90 } }
    ]);

    const result = DocumentEvaluator.evaluate(rootAsm, { context: { resolver } });
    expect(result.success).toBe(true);

    const comp = result.evaluatedAssembly?.components.find(c => c.occurrencePath === 'inst_rot_sub/inst_pin');
    expect(comp?.occurrencePath).toBe('inst_rot_sub/inst_pin');
    // In Euler Z 90deg rotation: local X (50) transforms to world Y (+50).
    // World Pos: (100 + 0, 100 + 50, 0) = (100, 150, 0)
    expect(comp?.position).toEqual({ x: 100, y: 150, z: 0 });
    expect(comp?.rotation).toEqual({ x: 0, y: 0, z: 90 });
  });

  it('TEST-06: missing child handling', () => {
    const resolver = new InMemoryDocumentResolver();

    // Sub-assembly references non-existent leaf part
    const subAsm = createAssemblyDoc('ASM_BROKEN_SUB', [
      { instanceId: 'inst_ghost', documentId: 'PART_GHOST_PART', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
    ]);
    resolver.register(subAsm);

    const rootAsm = createAssemblyDoc('ASM_ROOT_MISSING_TEST', [
      { instanceId: 'inst_broken_sub', documentId: 'ASM_BROKEN_SUB', position: { x: 50, y: 50, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
      { instanceId: 'inst_ghost_sub', documentId: 'ASM_GHOST_SUB', position: { x: 100, y: 100, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
    ]);

    const result = DocumentEvaluator.evaluate(rootAsm, { context: { resolver } });

    expect(result.success).toBe(false);
    expect(result.diagnostics.some(d => d.includes('[SECP_DOC_MISSING]'))).toBe(true);

    const brokenComp = result.evaluatedAssembly?.components.find(c => c.occurrencePath === 'inst_broken_sub/inst_ghost');
    const ghostSubComp = result.evaluatedAssembly?.components.find(c => c.occurrencePath === 'inst_ghost_sub');

    expect(brokenComp?.resolutionStatus).toBe('MISSING');
    expect(brokenComp?.solid).toBeUndefined();
    expect(ghostSubComp?.resolutionStatus).toBe('MISSING');
    expect(ghostSubComp?.solid).toBeUndefined();
  });

  it('TEST-07: cycle detection', () => {
    const resolver = new InMemoryDocumentResolver();

    // Deep cycle: A -> B -> C -> A
    const asmA = createAssemblyDoc('ASM_CYCLE_A', [
      { instanceId: 'to_b', documentId: 'ASM_CYCLE_B', position: { x: 10, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
    ]);
    const asmB = createAssemblyDoc('ASM_CYCLE_B', [
      { instanceId: 'to_c', documentId: 'ASM_CYCLE_C', position: { x: 20, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
    ]);
    const asmC = createAssemblyDoc('ASM_CYCLE_C', [
      { instanceId: 'to_a', documentId: 'ASM_CYCLE_A', position: { x: 30, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
    ]);

    resolver.register(asmA);
    resolver.register(asmB);
    resolver.register(asmC);

    const result = DocumentEvaluator.evaluate(asmA, { context: { resolver } });

    expect(result.success).toBe(false);
    expect(result.diagnostics.some(d => d.includes('[SECP_ASSEMBLY_CYCLE_DETECTED]'))).toBe(true);
    expect(result.diagnostics.some(d => d.includes('[SECP_DOC_CYCLIC]'))).toBe(true);
    expect(result.diagnostics.some(d => d.includes('ASM_CYCLE_A → ASM_CYCLE_B → ASM_CYCLE_C → ASM_CYCLE_A'))).toBe(true);

    const cycleComp = result.evaluatedAssembly?.components.find(
      c => c.resolutionStatus === 'CYCLE_ERROR' || c.resolutionStatus === ('CYCLIC' as any)
    );
    expect(cycleComp).toBeDefined();
    expect(cycleComp?.solid).toBeUndefined();
  });

  it('TEST-08: suppression propagation', () => {
    const resolver = new InMemoryDocumentResolver();

    const partA = createPartDoc('PART_A', 10, 10, 10);
    const partB = createPartDoc('PART_B', 10, 10, 10);
    resolver.register(partA);
    resolver.register(partB);

    const subAsm = createAssemblyDoc('ASM_SUB_CASCADE', [
      { instanceId: 'child_a', documentId: 'PART_A', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, isSuppressed: false },
      { instanceId: 'child_b', documentId: 'PART_B', position: { x: 10, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, isSuppressed: false }
    ]);
    resolver.register(subAsm);

    // Root suppresses the parent sub-assembly instance
    const rootAsm = createAssemblyDoc('ASM_ROOT_SUPPRESSED', [
      { instanceId: 'inst_sub', documentId: 'ASM_SUB_CASCADE', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, isSuppressed: true }
    ]);

    const result = DocumentEvaluator.evaluate(rootAsm, { context: { resolver } });
    expect(result.success).toBe(true);

    const components = result.evaluatedAssembly?.components;
    expect(components?.length).toBe(3);

    // All children (subassembly + leaf parts) must have suppressed: true and visible: false
    expect(components?.every(c => c.suppressed === true && c.visible === false)).toBe(true);
  });

  it('TEST-09: child canonical immutability', () => {
    const resolver = new InMemoryDocumentResolver();

    const originalPart = createPartDoc('PART_IMMUTABLE', 30, 30, 30);
    resolver.register(originalPart);

    const originalSub = createAssemblyDoc('ASM_IMMUTABLE', [
      { instanceId: 'inst_p', documentId: 'PART_IMMUTABLE', position: { x: 5, y: 10, z: 15 }, rotation: { x: 0, y: 0, z: 0 } }
    ]);
    resolver.register(originalSub);

    const rootAsm = createAssemblyDoc('ASM_ROOT_IMMUTABILITY', [
      { instanceId: 'inst_sub', documentId: 'ASM_IMMUTABLE', position: { x: 100, y: 200, z: 300 }, rotation: { x: 0, y: 90, z: 0 } }
    ]);

    DocumentEvaluator.evaluate(rootAsm, { context: { resolver } });

    // Child documents in resolver must remain bit-for-bit identical in canonical state
    const resolvedPart = resolver.resolve('PART_IMMUTABLE')!;
    const resolvedSub = resolver.resolve('ASM_IMMUTABLE')!;

    expect((resolvedPart as any).position).toBeUndefined();
    expect((resolvedPart as any).rotation).toBeUndefined();
    expect(resolvedSub.assembly?.instances[0].position).toEqual({ x: 5, y: 10, z: 15 });
  });

  it('TEST-10: deterministic evaluation', () => {
    const partA = createPartDoc('PART_DETERMINISTIC_A', 10, 10, 10);
    const partB = createPartDoc('PART_DETERMINISTIC_B', 20, 20, 20);

    const subAsm = createAssemblyDoc('ASM_DETERMINISTIC_SUB', [
      { instanceId: 'inst_a', documentId: 'PART_DETERMINISTIC_A', position: { x: 5, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
      { instanceId: 'inst_b', documentId: 'PART_DETERMINISTIC_B', position: { x: 15, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
    ]);

    const rootAsm = createAssemblyDoc('ASM_DETERMINISTIC_ROOT', [
      { instanceId: 'inst_sub', documentId: 'ASM_DETERMINISTIC_SUB', position: { x: 100, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
    ]);

    // Resolver 1: Register in order PartA -> PartB -> SubAsm
    const resolver1 = new InMemoryDocumentResolver();
    resolver1.register(partA);
    resolver1.register(partB);
    resolver1.register(subAsm);

    // Resolver 2: Register in reverse order SubAsm -> PartB -> PartA
    const resolver2 = new InMemoryDocumentResolver();
    resolver2.register(subAsm);
    resolver2.register(partB);
    resolver2.register(partA);

    const result1 = DocumentEvaluator.evaluate(rootAsm, { context: { resolver: resolver1 } });
    const result2 = DocumentEvaluator.evaluate(rootAsm, { context: { resolver: resolver2 } });

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    const comps1 = result1.evaluatedAssembly?.components.map(c => ({
      path: c.occurrencePath,
      pos: c.position,
      rot: c.rotation
    }));
    const comps2 = result2.evaluatedAssembly?.components.map(c => ({
      path: c.occurrencePath,
      pos: c.position,
      rot: c.rotation
    }));

    expect(comps1).toEqual(comps2);
  });

  it('TEST-11: canonical SOT isolation', () => {
    const resolver = new InMemoryDocumentResolver();

    const leafPart = createPartDoc('PART_PARAMETRIC', 20, 20, 20); // 8000 mm3
    resolver.register(leafPart);

    const subAsm = createAssemblyDoc('ASM_PARAMETRIC_SUB', [
      { instanceId: 'inst_param_part', documentId: 'PART_PARAMETRIC', position: { x: 10, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
    ]);
    resolver.register(subAsm);

    const rootAsm = createAssemblyDoc('ASM_PARAMETRIC_ROOT', [
      { instanceId: 'inst_sub', documentId: 'ASM_PARAMETRIC_SUB', position: { x: 100, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
    ]);

    // 1. Initial hierarchical evaluation
    const initialResult = DocumentEvaluator.evaluate(rootAsm, { context: { resolver } });
    expect(initialResult.success).toBe(true);
    const initialSolid = initialResult.evaluatedAssembly?.components.find(c => c.documentId === 'PART_PARAMETRIC')?.solid;
    expect(initialSolid).toBeDefined();

    // 2. Modify parametric depth of leaf part in SOT (20 -> 40 mm)
    const updatedLeafPart = createPartDoc('PART_PARAMETRIC', 20, 20, 40); // 16000 mm3
    resolver.register(updatedLeafPart);

    // 3. Re-evaluate hierarchical assembly
    const updatedResult = DocumentEvaluator.evaluate(rootAsm, { context: { resolver } });
    expect(updatedResult.success).toBe(true);
    const updatedSolid = updatedResult.evaluatedAssembly?.components.find(c => c.documentId === 'PART_PARAMETRIC')?.solid;
    expect(updatedSolid).toBeDefined();

    // 4. Verify causality: Leaf parameter change directly modified derived component solid
    expect(updatedSolid).not.toEqual(initialSolid);
  });

  it('TEST-12: persistence round-trip of the recursive graph', () => {
    const resolver = new InMemoryDocumentResolver();

    const leafPart = createPartDoc('PART_PERSIST_LEAF', 25, 25, 10);
    resolver.register(leafPart);

    const subAsm = createAssemblyDoc('ASM_PERSIST_SUB', [
      { instanceId: 'inst_leaf', documentId: 'PART_PERSIST_LEAF', position: { x: 15, y: 20, z: 5 }, rotation: { x: 0, y: 0, z: 0 } }
    ]);
    resolver.register(subAsm);

    const rootAsm = createAssemblyDoc('ASM_PERSIST_ROOT', [
      { instanceId: 'inst_sub', documentId: 'ASM_PERSIST_SUB', position: { x: 100, y: 200, z: 300 }, rotation: { x: 0, y: 90, z: 0 } }
    ]);

    // 1. Initial evaluation before serialization
    const evalBefore = DocumentEvaluator.evaluate(rootAsm, { context: { resolver } });
    expect(evalBefore.success).toBe(true);

    // 2. Serialize recursive graph
    const bundle = MultiDocumentPersistence.serialize(rootAsm, resolver);
    expect(bundle.documents.length).toBe(3); // Root + SubAsm + Leaf

    // 3. Rehydrate and evaluate
    const { evaluationResult: evalAfter } = MultiDocumentPersistence.rehydrateAndEvaluate(bundle);
    expect(evalAfter.success).toBe(true);

    const compsBefore = evalBefore.evaluatedAssembly?.components.map(c => ({
      path: c.occurrencePath,
      pos: c.position,
      rot: c.rotation
    }));
    const compsAfter = evalAfter.evaluatedAssembly?.components.map(c => ({
      path: c.occurrencePath,
      pos: c.position,
      rot: c.rotation
    }));

    expect(compsAfter).toEqual(compsBefore);
  });
});
