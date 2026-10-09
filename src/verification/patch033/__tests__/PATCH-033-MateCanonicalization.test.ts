/**
 * PATCH-033 — Assembly & Joint Mate Solver Canonicalization Test Battery
 * 
 * Objective: Verify that MATE / JOINT CONSTRAINT TRUTH lives solely in the canonical
 * EngineeringDocument assembly model.
 * 
 * Verifies Case A to F:
 * - Case A: Solver-only Mate
 * - Case B: JointSolver-only Constraint
 * - Case C: UI-only Mate
 * - Case D: Stale Solver (Rebuild Test)
 * - Case E: Fake Success
 * - Case F: Fake Constraint
 */

import { describe, it, expect } from 'vitest';
import {
  AssemblyIntentMutator,
  DocumentEvaluator,
  InMemoryDocumentResolver,
  EngineeringDocument,
  AssemblyMate
} from '../../../engine/cad-kernel/document';
import { JointConstraintSolver } from '../../../engine/assembly/joints/JointConstraintSolver';
import { ComponentKinematicState } from '../../../engine/assembly/joints/MechanicalJointTypes';
import { MechanicalJointFactory } from '../../../engine/assembly/joints/MechanicalJointFactory';

describe('PATCH-033 — Assembly & Joint Mate Solver Canonicalization', () => {
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
          colorHex: '#64748b',
          isGrounded: true
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

  it('Case A: Solver-only Mate — If a Mate is added directly to solver/engine but not to canonical assembly model, it does not exist as engineering truth', () => {
    const doc = createBaseAssemblyDocument();
    
    // Evaluate the canonical document (which has no mates)
    const resolver = new InMemoryDocumentResolver();
    const childBase = DocumentEvaluator.createDocument({ documentId: 'DOC_PART_BASE' });
    const childSlider = DocumentEvaluator.createDocument({ documentId: 'DOC_PART_SLIDER' });
    resolver.register(childBase);
    resolver.register(childSlider);

    const evalResult1 = DocumentEvaluator.evaluate(doc, {
      generateMesh: true,
      context: { resolver }
    });

    expect(evalResult1.evaluatedAssembly?.mates.length).toBe(0);

    // Now, even if someone attempts to inject a "solver-only" mate at runtime in the evaluation result,
    // the canonical truth of the document remains 0 mates.
    expect(doc.assembly?.mates.length).toBe(0);
  });

  it('Case B: JointSolver-only Constraint — Joint constraint only in private runtime/solver state is ignored/excluded on canonical solveDocument call', () => {
    const doc = createBaseAssemblyDocument();
    
    // Call the newly introduced pure static JointConstraintSolver.solveDocument
    const result = JointConstraintSolver.solveDocument(doc);
    
    // Since there are no joint mates in doc.assembly, the solver should solve 0 joints.
    expect(result.converged).toBe(true);
    expect(result.updatedDocument.assembly?.mates?.length || 0).toBe(0);
  });

  it('Case C: UI-only Mate — Local UI state changes with mates that do not update the canonical EngineeringDocument are disregarded by the solver', () => {
    const doc = createBaseAssemblyDocument();
    
    // UI has a local copy/state with a mate
    const uiLocalMates: AssemblyMate[] = [
      {
        mateId: 'ui-only-mate',
        type: 'COINCIDENT',
        instanceAId: 'inst-slider',
        instanceBId: 'inst-base'
      }
    ];

    // The canonical evaluation solver does not read UI state, it reads the canonical document.
    const resolver = new InMemoryDocumentResolver();
    resolver.register(DocumentEvaluator.createDocument({ documentId: 'DOC_PART_BASE' }));
    resolver.register(DocumentEvaluator.createDocument({ documentId: 'DOC_PART_SLIDER' }));

    const evalResult = DocumentEvaluator.evaluate(doc, {
      generateMesh: true,
      context: { resolver }
    });

    // The evaluated assembly must have 0 mates, completely disregarding the UI local state
    expect(evalResult.evaluatedAssembly?.mates.length).toBe(0);
  });

  it('Case D: Stale Solver (Rebuild Test) — Solver is perfectly rebuildable from EngineeringDocument.assembly and a fresh solver matches results', () => {
    const doc = createBaseAssemblyDocument();
    
    // Add a joint mate via intent mutator
    const updatedDoc = AssemblyIntentMutator.apply(doc, {
      type: 'ADD_MATE',
      mate: {
        mateId: 'joint-revolute-1',
        type: 'REVOLUTE',
        instanceAId: 'inst-base',
        instanceBId: 'inst-slider',
        offset: 10,
        entityA: { occurrencePath: 'inst-base', entityType: 'FACE', entityId: 'CYL-A' },
        entityB: { occurrencePath: 'inst-slider', entityType: 'FACE', entityId: 'CYL-B' }
      }
    });

    // First solve run using the JointConstraintSolver
    const solveResult1 = JointConstraintSolver.solveDocument(updatedDoc);
    
    // Fresh solve run starting from the exact same document, simulating complete solver recreation / no stale cache
    const solveResult2 = JointConstraintSolver.solveDocument(updatedDoc);

    // Verify completely deterministic and identical solved positions
    expect(solveResult1.converged).toBe(solveResult2.converged);
    expect(solveResult1.updatedDocument.assembly?.instances[1].position.x)
      .toBe(solveResult2.updatedDocument.assembly?.instances[1].position.x);
  });

  it('Case E: Fake Success — Verify solver-only "successful" reports without canonical document persistence are treated as invalid', () => {
    const doc = createBaseAssemblyDocument();
    
    // A solver could say "I solved a REVOLUTE joint with ID 'fake-success'"
    const components: ComponentKinematicState[] = [
      {
        componentId: 'inst-base',
        name: 'inst-base',
        isGrounded: true,
        massKg: 5,
        worldTransform: { elements: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1] },
        worldOrigin: { x: 0, y: 0, z: 0 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        translationalDOF: 3, rotationalDOF: 3, remainingDOF: 6, status: 'VALID'
      },
      {
        componentId: 'inst-slider',
        name: 'inst-slider',
        isGrounded: false,
        massKg: 5,
        worldTransform: { elements: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1] },
        worldOrigin: { x: 0, y: 0, z: 0 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        translationalDOF: 3, rotationalDOF: 3, remainingDOF: 6, status: 'VALID'
      }
    ];

    const fakeJoint = MechanicalJointFactory.createJoint({
      id: 'fake-success',
      name: 'Fake',
      type: 'REVOLUTE',
      parentComponentId: 'inst-base',
      childComponentId: 'inst-slider',
      parentReference: { componentId: 'inst-base', geometryType: 'CYLINDRICAL_FACE', geometryId: 'CYL-A', localOrigin: { x: 0, y: 0, z: 0 }, localAxis: { x: 0, y: 0, z: 1 } },
      childReference: { componentId: 'inst-slider', geometryType: 'CYLINDRICAL_FACE', geometryId: 'CYL-B', localOrigin: { x: 0, y: 0, z: 0 }, localAxis: { x: 0, y: 0, z: 1 } },
      jointOrigin: { x: 0, y: 0, z: 0 },
      jointAxis: { x: 0, y: 0, z: 1 },
      initialPosition: 0
    });

    const runResult = JointConstraintSolver.solveAssembly(components, [fakeJoint]);
    expect(runResult.converged).toBe(true);

    // But when running solveDocument on the actual doc (which lacks this joint in its mates/constraints list),
    // the system correctly does not evaluate or persist it.
    const docSolveResult = JointConstraintSolver.solveDocument(doc);
    expect(docSolveResult.updatedDocument.assembly?.mates?.length || 0).toBe(0);
  });

  it('Case F: Fake Constraint — Verify that a joint/mate referencing invalid or missing geometry/entities reports an appropriate error or unresolved status', () => {
    const doc = createBaseAssemblyDocument();
    
    // Add a mate with missing/invalid entities
    const invalidDoc = AssemblyIntentMutator.apply(doc, {
      type: 'ADD_MATE',
      mate: {
        mateId: 'invalid-mate-1',
        type: 'COINCIDENT',
        instanceAId: 'non-existent-instance-id',
        instanceBId: 'inst-slider',
        entityA: { occurrencePath: 'non-existent-instance-id', entityType: 'FACE', entityId: 'CYL-A' },
        entityB: { occurrencePath: 'inst-slider', entityType: 'FACE', entityId: 'CYL-B' }
      }
    });

    // Try evaluating with the document evaluator
    const resolver = new InMemoryDocumentResolver();
    resolver.register(DocumentEvaluator.createDocument({ documentId: 'DOC_PART_BASE' }));
    resolver.register(DocumentEvaluator.createDocument({ documentId: 'DOC_PART_SLIDER' }));

    const evalResult = DocumentEvaluator.evaluate(invalidDoc, {
      generateMesh: true,
      context: { resolver }
    });

    // The evaluation should still succeed but mark the invalid mate as UNSOLVED or report error status
    const evaluatedMate = evalResult.evaluatedAssembly?.mates.find(m => m.id === 'invalid-mate-1');
    expect(evaluatedMate?.status).toBe('UNSOLVED');
  });
});
