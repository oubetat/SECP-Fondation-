/**
 * PATCH-038C — Deterministic Transform & Truthful Mate Solver Test Battery
 * 
 * Formal verification for:
 * - Deterministic occurrence transforms
 * - Truthful mate status reporting (SOLVED, UNSOLVED, UNSUPPORTED, CONFLICTING)
 * - True constraint satisfaction within geometric tolerance
 * - Complete removal of hardcoded satisfied: true
 * - Solver -> Transform -> Solid causality chain
 * - Child EngineeringDocument immutability
 * - No synthetic geometry fabrication
 */

import { describe, it, expect } from 'vitest';
import {
  EngineeringDocument,
  DEFAULT_UNIT_SYSTEM_MM
} from '../../../engine/cad-kernel/document/CADDocument';
import { DocumentEvaluator } from '../../../engine/cad-kernel/document/DocumentEvaluator';
import { InMemoryDocumentResolver } from '../../../engine/cad-kernel/document/DocumentResolver';
import { AssemblyEngine } from '../../../engine/assembly';
import { AssemblyMateSolver } from '../../../engine/cad-kernel/document/AssemblyMateSolver';

describe('PATCH-038C — Deterministic Transform & Truthful Mate Solver', () => {
  const createMockChildDoc = (docId: string, name: string): EngineeringDocument => ({
    documentId: docId,
    revision: '1.0.0',
    type: 'PART',
    units: DEFAULT_UNIT_SYSTEM_MM,
    metadata: {
      name,
      description: 'Test Child Part',
      author: 'SECP Engineer',
      createdAt: '2026-09-04T00:00:00.000Z',
      updatedAt: '2026-09-04T00:00:00.000Z'
    },
    parameters: [
      { id: 'p1', name: 'width', value: 20, unit: 'mm', expression: '20' },
      { id: 'p2', name: 'height', value: 30, unit: 'mm', expression: '30' },
      { id: 'p3', name: 'depth', value: 40, unit: 'mm', expression: '40' }
    ],
    sketches: [],
    features: [
      {
        id: `FEAT_EXTRUDE_${docId}`,
        type: 'EXTRUDE',
        name: 'BaseBody',
        parameters: { width: 'width', height: 'height', depth: 'depth' }
      }
    ],
    constraints: [],
    topologyMap: {
      version: 1,
      elements: new Map(),
      hashes: { geometryHash: '', topologyHash: '', parameterHash: '' },
      featureMap: new Map()
    },
    derived: {},
    evidence: []
  });

  // TEST-01 — FIXED Mate
  it('TEST-01: FIXED Mate locks ground/world frame deterministically', () => {
    const parentDoc: EngineeringDocument = {
      documentId: 'DOC_ASM_FIXED',
      revision: '1.0.0',
      type: 'ASSEMBLY',
      units: DEFAULT_UNIT_SYSTEM_MM,
      metadata: { name: 'Fixed Assembly', createdAt: '', updatedAt: '' },
      parameters: [],
      sketches: [],
      features: [],
      constraints: [],
      topologyMap: { version: 1, elements: new Map(), hashes: { geometryHash: '', topologyHash: '', parameterHash: '' }, featureMap: new Map() },
      derived: {},
      evidence: [],
      assembly: {
        assemblyId: 'ASM_FIXED',
        name: 'Fixed Assembly',
        instances: [
          {
            instanceId: 'inst_ground',
            documentId: 'CHILD_PART_01',
            position: { x: 10, y: 20, z: 30 },
            rotation: { x: 0, y: 0, z: 0 }
          }
        ],
        mates: [
          {
            mateId: 'mate_ground',
            type: 'FIXED',
            instanceAId: 'inst_ground',
            instanceBId: 'inst_ground'
          }
        ]
      }
    };

    const result = DocumentEvaluator.evaluate(parentDoc);
    expect(result.evaluatedAssembly).toBeDefined();
    expect(result.evaluatedAssembly!.mates.length).toBe(1);

    const mate = result.evaluatedAssembly!.mates[0];
    expect(mate.id).toBe('mate_ground');
    expect(mate.kind).toBe('FIXED');
    expect(mate.status).toBe('SOLVED');
    expect(mate.satisfied).toBe(true);
    expect(mate.residual).toBe(0);

    const comp = result.evaluatedAssembly!.components[0];
    expect(comp.position).toEqual({ x: 10, y: 20, z: 30 });
    expect(comp.rotation).toEqual({ x: 0, y: 0, z: 0 });
  });

  // TEST-02 — Repeatability & Determinism
  it('TEST-02: Repeatability & Determinism ensures identical outputs for identical inputs', () => {
    const assemblyDef = {
      assemblyId: 'ASM_DET',
      name: 'Determinism Test',
      instances: [
        {
          instanceId: 'inst_a',
          documentId: 'PART_A',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 }
        },
        {
          instanceId: 'inst_b',
          documentId: 'PART_B',
          position: { x: 50, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 }
        }
      ],
      mates: [
        {
          mateId: 'm1_ground',
          type: 'FIXED',
          instanceAId: 'inst_a',
          instanceBId: 'inst_a'
        },
        {
          mateId: 'm2_dist',
          type: 'DISTANCE',
          instanceAId: 'inst_a',
          instanceBId: 'inst_b',
          offset: 75
        }
      ]
    };

    const run1 = AssemblyMateSolver.solve(assemblyDef);
    const run2 = AssemblyMateSolver.solve(assemblyDef);

    expect(run1.allMatesSolved).toBe(true);
    expect(run2.allMatesSolved).toBe(true);
    expect(run1.transforms.get('inst_b')?.position).toEqual(run2.transforms.get('inst_b')?.position);
    expect(run1.evaluatedMates).toEqual(run2.evaluatedMates);
    expect(run1.diagnostics).toEqual(run2.diagnostics);
  });

  // TEST-03 — DISTANCE Mate
  it('TEST-03: DISTANCE Mate satisfies actual geometric distance within tolerance', () => {
    const parentDoc: EngineeringDocument = {
      documentId: 'DOC_ASM_DIST',
      revision: '1.0.0',
      type: 'ASSEMBLY',
      units: DEFAULT_UNIT_SYSTEM_MM,
      metadata: { name: 'Distance Assembly', createdAt: '', updatedAt: '' },
      parameters: [],
      sketches: [],
      features: [],
      constraints: [],
      topologyMap: { version: 1, elements: new Map(), hashes: { geometryHash: '', topologyHash: '', parameterHash: '' }, featureMap: new Map() },
      derived: {},
      evidence: [],
      assembly: {
        assemblyId: 'ASM_DIST',
        name: 'Distance Assembly',
        instances: [
          {
            instanceId: 'inst_base',
            documentId: 'CHILD_BASE',
            position: { x: 10, y: 20, z: 0 },
            rotation: { x: 0, y: 0, z: 0 }
          },
          {
            instanceId: 'inst_offset',
            documentId: 'CHILD_OFFSET',
            position: { x: 10, y: 20, z: 10 },
            rotation: { x: 0, y: 0, z: 0 }
          }
        ],
        mates: [
          {
            mateId: 'mate_base_fixed',
            type: 'FIXED',
            instanceAId: 'inst_base',
            instanceBId: 'inst_base'
          },
          {
            mateId: 'mate_dist_45',
            type: 'DISTANCE',
            instanceAId: 'inst_base',
            instanceBId: 'inst_offset',
            offset: 45,
            parameters: {
              direction: { x: 0, y: 0, z: 1 }
            }
          }
        ]
      }
    };

    const result = DocumentEvaluator.evaluate(parentDoc);
    expect(result.success).toBe(true);

    const compBase = result.evaluatedAssembly!.components.find(c => c.id === 'inst_base')!;
    const compOffset = result.evaluatedAssembly!.components.find(c => c.id === 'inst_offset')!;

    const dx = compOffset.position.x - compBase.position.x;
    const dy = compOffset.position.y - compBase.position.y;
    const dz = compOffset.position.z - compBase.position.z;
    const actualDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    expect(Math.abs(actualDistance - 45)).toBeLessThanOrEqual(AssemblyMateSolver.DEFAULT_TOLERANCE);

    const distMate = result.evaluatedAssembly!.mates.find(m => m.id === 'mate_dist_45')!;
    expect(distMate.status).toBe('SOLVED');
    expect(distMate.satisfied).toBe(true);
    expect(distMate.residual!).toBeLessThanOrEqual(AssemblyMateSolver.DEFAULT_TOLERANCE);
  });

  // TEST-04 — COINCIDENT Mate
  it('TEST-04: COINCIDENT Mate aligns points and surfaces geometrically', () => {
    const parentDoc: EngineeringDocument = {
      documentId: 'DOC_ASM_COINCIDENT',
      revision: '1.0.0',
      type: 'ASSEMBLY',
      units: DEFAULT_UNIT_SYSTEM_MM,
      metadata: { name: 'Coincident Assembly', createdAt: '', updatedAt: '' },
      parameters: [],
      sketches: [],
      features: [],
      constraints: [],
      topologyMap: { version: 1, elements: new Map(), hashes: { geometryHash: '', topologyHash: '', parameterHash: '' }, featureMap: new Map() },
      derived: {},
      evidence: [],
      assembly: {
        assemblyId: 'ASM_COINCIDENT',
        name: 'Coincident Assembly',
        instances: [
          {
            instanceId: 'inst_1',
            documentId: 'CHILD_01',
            position: { x: 100, y: 200, z: 300 },
            rotation: { x: 0, y: 0, z: 0 }
          },
          {
            instanceId: 'inst_2',
            documentId: 'CHILD_02',
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 }
          }
        ],
        mates: [
          {
            mateId: 'm_fixed',
            type: 'FIXED',
            instanceAId: 'inst_1',
            instanceBId: 'inst_1'
          },
          {
            mateId: 'm_coincident',
            type: 'COINCIDENT',
            instanceAId: 'inst_1',
            instanceBId: 'inst_2',
            offset: 0
          }
        ]
      }
    };

    const result = DocumentEvaluator.evaluate(parentDoc);
    expect(result.success).toBe(true);

    const c1 = result.evaluatedAssembly!.components.find(c => c.id === 'inst_1')!;
    const c2 = result.evaluatedAssembly!.components.find(c => c.id === 'inst_2')!;

    expect(c2.position.x).toBeCloseTo(c1.position.x, 4);
    expect(c2.position.y).toBeCloseTo(c1.position.y, 4);
    expect(c2.position.z).toBeCloseTo(c1.position.z, 4);

    const mate = result.evaluatedAssembly!.mates.find(m => m.id === 'm_coincident')!;
    expect(mate.status).toBe('SOLVED');
    expect(mate.satisfied).toBe(true);
    expect(mate.residual!).toBeLessThanOrEqual(AssemblyMateSolver.DEFAULT_TOLERANCE);
  });

  // TEST-05 — CONCENTRIC Mate
  it('TEST-05: CONCENTRIC Mate aligns axes within geometric tolerance', () => {
    const parentDoc: EngineeringDocument = {
      documentId: 'DOC_ASM_CONCENTRIC',
      revision: '1.0.0',
      type: 'ASSEMBLY',
      units: DEFAULT_UNIT_SYSTEM_MM,
      metadata: { name: 'Concentric Assembly', createdAt: '', updatedAt: '' },
      parameters: [],
      sketches: [],
      features: [],
      constraints: [],
      topologyMap: { version: 1, elements: new Map(), hashes: { geometryHash: '', topologyHash: '', parameterHash: '' }, featureMap: new Map() },
      derived: {},
      evidence: [],
      assembly: {
        assemblyId: 'ASM_CONCENTRIC',
        name: 'Concentric Assembly',
        instances: [
          {
            instanceId: 'inst_cylinder',
            documentId: 'CHILD_CYL',
            position: { x: 50, y: 50, z: 0 },
            rotation: { x: 0, y: 0, z: 0 }
          },
          {
            instanceId: 'inst_piston',
            documentId: 'CHILD_PIST',
            position: { x: 99, y: 88, z: 120 },
            rotation: { x: 0, y: 0, z: 0 }
          }
        ],
        mates: [
          {
            mateId: 'm_fixed_cyl',
            type: 'FIXED',
            instanceAId: 'inst_cylinder',
            instanceBId: 'inst_cylinder'
          },
          {
            mateId: 'm_concentric',
            type: 'CONCENTRIC',
            instanceAId: 'inst_cylinder',
            instanceBId: 'inst_piston',
            parameters: {
              axis: { x: 0, y: 0, z: 1 } // Z-axis aligned
            }
          }
        ]
      }
    };

    const result = DocumentEvaluator.evaluate(parentDoc);
    expect(result.success).toBe(true);

    const cyl = result.evaluatedAssembly!.components.find(c => c.id === 'inst_cylinder')!;
    const pist = result.evaluatedAssembly!.components.find(c => c.id === 'inst_piston')!;

    // Radial coordinates (X, Y) must match cylinder exactly
    expect(pist.position.x).toBeCloseTo(cyl.position.x, 4);
    expect(pist.position.y).toBeCloseTo(cyl.position.y, 4);
    // Axial coordinate (Z) is preserved
    expect(pist.position.z).toBeCloseTo(120, 4);

    const mate = result.evaluatedAssembly!.mates.find(m => m.id === 'm_concentric')!;
    expect(mate.status).toBe('SOLVED');
    expect(mate.satisfied).toBe(true);
    expect(mate.residual!).toBeLessThanOrEqual(AssemblyMateSolver.DEFAULT_TOLERANCE);
  });

  // TEST-06 — Unsupported Mate Truthfulness
  it('TEST-06: Unsupported Mate reports UNSUPPORTED and sets assembly.success to false', () => {
    const parentDoc: EngineeringDocument = {
      documentId: 'DOC_ASM_UNSUPPORTED',
      revision: '1.0.0',
      type: 'ASSEMBLY',
      units: DEFAULT_UNIT_SYSTEM_MM,
      metadata: { name: 'Unsupported Assembly', createdAt: '', updatedAt: '' },
      parameters: [],
      sketches: [],
      features: [],
      constraints: [],
      topologyMap: { version: 1, elements: new Map(), hashes: { geometryHash: '', topologyHash: '', parameterHash: '' }, featureMap: new Map() },
      derived: {},
      evidence: [],
      assembly: {
        assemblyId: 'ASM_UNSUP',
        name: 'Unsupported Assembly',
        instances: [
          { instanceId: 'inst_a', documentId: 'PART_A', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
          { instanceId: 'inst_b', documentId: 'PART_B', position: { x: 10, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
        ],
        mates: [
          {
            mateId: 'mate_gear',
            type: 'GEAR' as any,
            instanceAId: 'inst_a',
            instanceBId: 'inst_b'
          }
        ]
      }
    };

    const result = DocumentEvaluator.evaluate(parentDoc);
    expect(result.success).toBe(false);

    const mate = result.evaluatedAssembly!.mates[0];
    expect(mate.status).toBe('UNSUPPORTED');
    expect(mate.satisfied).toBe(false);
    expect(result.diagnostics.some(d => d.includes('[SECP_MATE_UNSUPPORTED]'))).toBe(true);
  });

  // TEST-07 — Conflicting Constraints Truthfulness
  it('TEST-07: Conflicting Constraints report CONFLICTING and set assembly.success to false', () => {
    const parentDoc: EngineeringDocument = {
      documentId: 'DOC_ASM_CONFLICT',
      revision: '1.0.0',
      type: 'ASSEMBLY',
      units: DEFAULT_UNIT_SYSTEM_MM,
      metadata: { name: 'Conflicting Assembly', createdAt: '', updatedAt: '' },
      parameters: [],
      sketches: [],
      features: [],
      constraints: [],
      topologyMap: { version: 1, elements: new Map(), hashes: { geometryHash: '', topologyHash: '', parameterHash: '' }, featureMap: new Map() },
      derived: {},
      evidence: [],
      assembly: {
        assemblyId: 'ASM_CONF',
        name: 'Conflicting Assembly',
        instances: [
          { instanceId: 'inst_a', documentId: 'PART_A', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
          { instanceId: 'inst_b', documentId: 'PART_B', position: { x: 10, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
        ],
        mates: [
          {
            mateId: 'm_dist_10',
            type: 'DISTANCE',
            instanceAId: 'inst_a',
            instanceBId: 'inst_b',
            offset: 10
          },
          {
            mateId: 'm_dist_25',
            type: 'DISTANCE',
            instanceAId: 'inst_a',
            instanceBId: 'inst_b',
            offset: 25
          }
        ]
      }
    };

    const result = DocumentEvaluator.evaluate(parentDoc);
    expect(result.success).toBe(false);

    const m1 = result.evaluatedAssembly!.mates.find(m => m.id === 'm_dist_10')!;
    const m2 = result.evaluatedAssembly!.mates.find(m => m.id === 'm_dist_25')!;

    expect(m1.status).toBe('CONFLICTING');
    expect(m1.satisfied).toBe(false);
    expect(m2.status).toBe('CONFLICTING');
    expect(m2.satisfied).toBe(false);

    expect(result.diagnostics.some(d => d.includes('[SECP_MATE_CONFLICT]'))).toBe(true);
  });

  // TEST-08 — Solver → Transform → Solid Causality
  it('TEST-08: Changing mate constraint causally alters occurrence transform and derived solid placement', () => {
    const registry = new InMemoryDocumentResolver();
    const childDoc = createMockChildDoc('CHILD_BLOCK', 'Block');
    registry.register(childDoc);

    const createDocWithOffset = (offsetVal: number): EngineeringDocument => ({
      documentId: `DOC_ASM_CAUSALITY_${offsetVal}`,
      revision: '1.0.0',
      type: 'ASSEMBLY',
      units: DEFAULT_UNIT_SYSTEM_MM,
      metadata: { name: 'Causality Assembly', createdAt: '', updatedAt: '' },
      parameters: [],
      sketches: [],
      features: [],
      constraints: [],
      topologyMap: { version: 1, elements: new Map(), hashes: { geometryHash: '', topologyHash: '', parameterHash: '' }, featureMap: new Map() },
      derived: {},
      evidence: [],
      assembly: {
        assemblyId: 'ASM_CAUSAL',
        name: 'Causality Assembly',
        instances: [
          { instanceId: 'inst_base', documentId: 'CHILD_BLOCK', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
          { instanceId: 'inst_target', documentId: 'CHILD_BLOCK', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
        ],
        mates: [
          { mateId: 'm_ground', type: 'FIXED', instanceAId: 'inst_base', instanceBId: 'inst_base' },
          {
            mateId: 'm_dist',
            type: 'DISTANCE',
            instanceAId: 'inst_base',
            instanceBId: 'inst_target',
            offset: offsetVal,
            parameters: { direction: { x: 1, y: 0, z: 0 } }
          }
        ]
      }
    });

    const res30 = DocumentEvaluator.evaluate(createDocWithOffset(30), { context: { resolver: registry } });
    const res80 = DocumentEvaluator.evaluate(createDocWithOffset(80), { context: { resolver: registry } });

    expect(res30.success).toBe(true);
    expect(res80.success).toBe(true);

    const comp30 = res30.evaluatedAssembly!.components.find(c => c.id === 'inst_target')!;
    const comp80 = res80.evaluatedAssembly!.components.find(c => c.id === 'inst_target')!;

    // Solved component position changes causally
    expect(comp30.position.x).toBeCloseTo(30, 4);
    expect(comp80.position.x).toBeCloseTo(80, 4);

    // Derived runtime solid position changes causally
    expect(comp30.solid).toBeDefined();
    expect(comp80.solid).toBeDefined();
    expect(comp30.solid!.position.x).toBeCloseTo(30, 4);
    expect(comp80.solid!.position.x).toBeCloseTo(80, 4);

    // Center of gravity shifts causally with occurrence transform
    expect(comp80.solid!.centerOfGravity.x).toBeGreaterThan(comp30.solid!.centerOfGravity.x);
  });

  // TEST-09 — Independent Invariant Preservation (No Mutation of Child EngineeringDocument)
  it('TEST-09: Solver does not mutate child EngineeringDocument', () => {
    const registry = new InMemoryDocumentResolver();
    const childDoc = createMockChildDoc('CHILD_UNTOUCHED', 'Untouched Part');
    registry.register(childDoc);

    const childDocCopy = JSON.parse(JSON.stringify(childDoc));

    const parentDoc: EngineeringDocument = {
      documentId: 'DOC_ASM_MUTATION_CHECK',
      revision: '1.0.0',
      type: 'ASSEMBLY',
      units: DEFAULT_UNIT_SYSTEM_MM,
      metadata: { name: 'Mutation Check Assembly', createdAt: '', updatedAt: '' },
      parameters: [],
      sketches: [],
      features: [],
      constraints: [],
      topologyMap: { version: 1, elements: new Map(), hashes: { geometryHash: '', topologyHash: '', parameterHash: '' }, featureMap: new Map() },
      derived: {},
      evidence: [],
      assembly: {
        assemblyId: 'ASM_MUT_CHECK',
        name: 'Mutation Check Assembly',
        instances: [
          { instanceId: 'inst_1', documentId: 'CHILD_UNTOUCHED', position: { x: 50, y: 60, z: 70 }, rotation: { x: 0, y: 0, z: 0 } }
        ],
        mates: [
          { mateId: 'm1', type: 'FIXED', instanceAId: 'inst_1', instanceBId: 'inst_1' }
        ]
      }
    };

    DocumentEvaluator.evaluate(parentDoc, { context: { resolver: registry } });

    // Ensure child in registry was never mutated
    const childInRegistry = registry.resolve('CHILD_UNTOUCHED')!;
    expect(childInRegistry.parameters).toEqual(childDocCopy.parameters);
    expect(childInRegistry.documentId).toBe(childDocCopy.documentId);
    expect((childInRegistry as any).position).toBeUndefined();
  });

  // TEST-10 — No Synthetic Geometry
  it('TEST-10: When child resolution fails or mate cannot be solved, no synthetic geometry is fabricated', () => {
    const registry = new InMemoryDocumentResolver(); // Empty registry: all children missing

    const parentDoc: EngineeringDocument = {
      documentId: 'DOC_ASM_MISSING_CHILD',
      revision: '1.0.0',
      type: 'ASSEMBLY',
      units: DEFAULT_UNIT_SYSTEM_MM,
      metadata: { name: 'Missing Child Assembly', createdAt: '', updatedAt: '' },
      parameters: [],
      sketches: [],
      features: [],
      constraints: [],
      topologyMap: { version: 1, elements: new Map(), hashes: { geometryHash: '', topologyHash: '', parameterHash: '' }, featureMap: new Map() },
      derived: {},
      evidence: [],
      assembly: {
        assemblyId: 'ASM_MISSING',
        name: 'Missing Assembly',
        instances: [
          { instanceId: 'inst_ghost', documentId: 'CHILD_NONEXISTENT', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
        ],
        mates: [
          { mateId: 'm_fixed', type: 'FIXED', instanceAId: 'inst_ghost', instanceBId: 'inst_ghost' }
        ]
      }
    };

    const result = DocumentEvaluator.evaluate(parentDoc, { context: { resolver: registry } });

    expect(result.success).toBe(false);
    const comp = result.evaluatedAssembly!.components[0];
    expect(comp.solid).toBeUndefined(); // Zero synthetic geometry fabricated
    expect(comp.resolutionStatus).toBe('MISSING');
  });

  // TEST-11 — Regression Invariant: Canonical Engine Assembly
  it('TEST-11: Canonical Engine Assembly evaluates successfully with all mates solved', () => {
    const doc = AssemblyEngine.createEngineAssemblyDocument();
    const result = DocumentEvaluator.evaluate(doc);

    expect(doc.type).toBe('ASSEMBLY');
    expect(result.success).toBe(true);
    expect(result.evaluatedAssembly).toBeDefined();

    // Verify all mates are solved and none are unhandled
    for (const mate of result.evaluatedAssembly!.mates) {
      expect(mate.status).toBe('SOLVED');
      expect(mate.satisfied).toBe(true);
      expect(mate.residual!).toBeLessThanOrEqual(AssemblyMateSolver.DEFAULT_TOLERANCE);
    }

    const firstInstance = doc.assembly!.instances[0];
    const firstComponent = result.evaluatedAssembly!.components[0];
    expect(firstComponent.id).toBe(firstInstance.instanceId);
    expect(firstComponent.partId).toBe(firstInstance.documentId);
    expect(firstComponent.position).toEqual(firstInstance.position);
    expect(firstComponent.rotation).toEqual(firstInstance.rotation);
  });
});
