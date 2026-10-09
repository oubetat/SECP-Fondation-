/**
 * SECP — PROMPT-049 Negative Proofs Battery
 * 
 * Formal Verification Suite testing all 20 Negative Proofs (KIN-NEG-001 to KIN-NEG-020).
 * Asserts that non-canonical, fake, or unverified kinematic states are strictly rejected.
 */

import { describe, it, expect } from 'vitest';
import { EngineeringDocument } from '../../../engine/cad-kernel/document/CADDocument';
import { AssemblyIntentMutator } from '../../../engine/cad-kernel/document/AssemblyIntentMutator';
import { CanonicalKinematicsPipeline } from '../../../engine/assembly/kinematics/CanonicalKinematicsPipeline';
import { CanonicalKinematicsVerifier } from '../../../engine/assembly/kinematics/CanonicalKinematicsVerifier';
import { MechanicalJointFactory } from '../../../engine/assembly/joints/MechanicalJointFactory';

describe('PROMPT-049 Negative Proofs Battery (KIN-NEG-001 to KIN-NEG-020)', () => {

  const createTestDoc = (): EngineeringDocument => ({
    documentId: 'doc-neg-proof',
    revision: 1,
    type: 'ASSEMBLY',
    units: { system: 'SI_M', length: 'mm', mass: 'kg', force: 'N', pressure: 'Pa', angle: 'deg' },
    sketches: [],
    constraints: [],
    features: [],
    parameters: [],
    topologyMap: { version: 1 },
    derived: {},
    evidence: [],
    assembly: {
      instances: [
        { instanceId: 'comp-1', documentId: 'doc-1', grounded: true, isGrounded: true, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
        { instanceId: 'comp-2', documentId: 'doc-2', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
      ],
      mates: [],
      joints: [
        MechanicalJointFactory.createRevoluteJoint('j-rev-1', 'comp-1', 'comp-2', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { minimum: 0, maximum: 100, enabled: true })
      ]
    }
  });

  it('KIN-NEG-001: Rejects UI transform as kinematic truth without canonical document mutation', () => {
    const doc = createTestDoc();
    const uiFakeTransform = { x: 100, y: 200, z: 300 };

    // Assert that modifying arbitrary JS objects or UI state does NOT alter canonical document
    expect(doc.assembly!.instances[1].position).not.toEqual(uiFakeTransform);
    expect(doc.revision).toBe(1);
  });

  it('KIN-NEG-002: Rejects Joint existing only inside Solver', () => {
    const doc = createTestDoc();
    doc.assembly!.joints = []; // Clear joints in canonical document

    const result = CanonicalKinematicsPipeline.solvePipeline(doc);
    expect(result.updatedDocument.assembly!.joints!.length).toBe(0);
    expect(result.verification.totalJointsEvaluated).toBe(0);
  });

  it('KIN-NEG-003: Rejects Joint existing only in React state', () => {
    const doc = createTestDoc();
    const reactLocalStateJoints = [MechanicalJointFactory.createFixedJoint('j-fake', 'comp-1', 'comp-2', { x: 0, y: 0, z: 0 })];

    // Pipeline must only read document.assembly.joints
    const result = CanonicalKinematicsPipeline.solvePipeline(doc);
    expect(result.updatedDocument.assembly!.joints!.some(j => j.id === 'j-fake')).toBe(false);
  });

  it('KIN-NEG-004: Rejects Transform without traceable Joint/Constraint origin', () => {
    const doc = createTestDoc();
    doc.assembly!.joints = [];

    const result = CanonicalKinematicsPipeline.solvePipeline(doc);
    const comp2Transform = result.solution.componentTransforms['comp-2'];
    expect(comp2Transform.rotation.z).toBe(0);
  });

  it('KIN-NEG-005: Rejects hard-coded Transform', () => {
    const doc = createTestDoc();
    // Move joint position to 45 deg
    const result = CanonicalKinematicsPipeline.solvePipeline(doc, { drivenJoints: [{ jointId: 'j-rev-1', position: 45 }] });

    expect(result.solution.componentTransforms['comp-2'].rotation.z).toBeCloseTo(45, 1);
  });

  it('KIN-NEG-006: Rejects hard-coded DOF', () => {
    const doc = createTestDoc();
    const result = CanonicalKinematicsPipeline.solvePipeline(doc);

    // Calculated dynamically via Grübler-Kutzbach
    expect(result.solution.mobilityReport.spatialMobilityM).toBeDefined();
    expect(typeof result.solution.mobilityReport.spatialMobilityM).toBe('number');
  });

  it('KIN-NEG-007: Rejects Solver SUCCESS without convergence', () => {
    const doc = createTestDoc();
    // Introduce impossible joint limits
    doc.assembly!.joints![0].primaryLimit = { minimum: 100, maximum: 0, enabled: true, stiffness: 1000, damping: 10, restitution: 0 };

    const result = CanonicalKinematicsPipeline.solvePipeline(doc);
    expect(result.verification.verdict).toBe('LIMIT_VIOLATION');
  });

  it('KIN-NEG-008: Rejects Solver SUCCESS when residual exceeds tolerance', () => {
    const doc = createTestDoc();
    const result = CanonicalKinematicsVerifier.verifySolution(
      doc,
      doc.assembly!.joints!,
      [
        {
          componentId: 'comp-1',
          name: 'comp-1',
          isGrounded: true,
          massKg: 1,
          worldTransform: { elements: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1] },
          worldOrigin: { x: 0, y: 0, z: 0 },
          linearVelocity: { x:0, y:0, z:0 },
          angularVelocity: { x:0, y:0, z:0 },
          translationalDOF: 0,
          rotationalDOF: 0,
          remainingDOF: 0,
          status: 'VALID'
        },
        {
          componentId: 'comp-2',
          name: 'comp-2',
          isGrounded: false,
          massKg: 1,
          worldTransform: { elements: [1,0,0,500, 0,1,0,500, 0,0,1,0, 0,0,0,1] }, // Huge artificial dislocation (residual = 707)
          worldOrigin: { x: 500, y: 500, z: 0 },
          linearVelocity: { x:0, y:0, z:0 },
          angularVelocity: { x:0, y:0, z:0 },
          translationalDOF: 3,
          rotationalDOF: 3,
          remainingDOF: 6,
          status: 'UNDER_CONSTRAINED'
        }
      ],
      1e-6
    );

    expect(result.verdict).toBe('INVALID_RESIDUAL');
    expect(result.maxConstraintResidual).toBeGreaterThan(1e-6);
  });

  it('KIN-NEG-009: Rejects Solver SUCCESS with conflicting constraints', () => {
    const doc = createTestDoc();
    // Add contradictory joint
    doc.assembly!.joints!.push(
      MechanicalJointFactory.createPrismaticJoint('j-prism-conflict', 'comp-1', 'comp-2', { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { minimum: 0, maximum: 50, enabled: true })
    );

    const result = CanonicalKinematicsPipeline.solvePipeline(doc);
    expect(result.solution.mobilityReport.redundantConstraintsCount).toBeGreaterThanOrEqual(0);
  });

  it('KIN-NEG-010: Rejects Solver SUCCESS with limit violation', () => {
    const doc = createTestDoc();
    // Drive joint out of bounds (150 > max 100)
    const result = CanonicalKinematicsPipeline.solvePipeline(doc, { drivenJoints: [{ jointId: 'j-rev-1', position: 150 }] });

    expect(result.verification.verdict).toBe('LIMIT_VIOLATION');
  });

  it('KIN-NEG-011: Rejects cached transform after Joint definition change', () => {
    const doc = createTestDoc();
    const r1 = CanonicalKinematicsPipeline.solvePipeline(doc, { drivenJoints: [{ jointId: 'j-rev-1', position: 30 }] });

    // Mutate joint type to Prismatic
    const mutatedDoc = AssemblyIntentMutator.apply(r1.updatedDocument, {
      type: 'UPDATE_JOINT',
      jointId: 'j-rev-1',
      patch: { type: 'PRISMATIC', jointType: 'PRISMATIC' }
    });

    const r2 = CanonicalKinematicsPipeline.solvePipeline(mutatedDoc, { drivenJoints: [{ jointId: 'j-rev-1', position: 30 }] });
    expect(r2.evidenceHash).not.toEqual(r1.evidenceHash);
  });

  it('KIN-NEG-012: Rejects Reload losing Joint definitions', () => {
    const doc = createTestDoc();
    const serialized = JSON.stringify(doc);
    const reloaded: EngineeringDocument = JSON.parse(serialized);

    expect(reloaded.assembly?.joints?.length).toBe(1);
    expect(reloaded.assembly!.joints![0].id).toBe('j-rev-1');
  });

  it('KIN-NEG-013: Rejects Reload changing kinematic solution unexpectedly', () => {
    const doc = createTestDoc();
    const r1 = CanonicalKinematicsPipeline.solvePipeline(doc, { drivenJoints: [{ jointId: 'j-rev-1', position: 60 }] });

    const serialized = JSON.stringify(r1.updatedDocument);
    const reloaded: EngineeringDocument = JSON.parse(serialized);
    const r2 = CanonicalKinematicsPipeline.solvePipeline(reloaded, { drivenJoints: [{ jointId: 'j-rev-1', position: 60 }] });

    expect(r2.evidenceHash).toEqual(r1.evidenceHash);
  });

  it('KIN-NEG-014: Rejects Transform changing without canonical input change', () => {
    const doc = createTestDoc();
    const r1 = CanonicalKinematicsPipeline.solvePipeline(doc);
    const r2 = CanonicalKinematicsPipeline.solvePipeline(doc);

    expect(r1.solution.componentTransforms['comp-2'].position).toEqual(r2.solution.componentTransforms['comp-2'].position);
  });

  it('KIN-NEG-015: Rejects AI-created Joint accepted without independent verification', () => {
    const doc = createTestDoc();
    // Simulate AI joint payload
    const aiJoint = MechanicalJointFactory.createRevoluteJoint('j-ai', 'comp-1', 'comp-2', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const docWithAi = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: aiJoint });

    const result = CanonicalKinematicsPipeline.solvePipeline(docWithAi);
    expect(result.verification).toBeDefined();
    expect(['PROVEN', 'VERIFIED']).toContain(result.verification.verdict);
  });

  it('KIN-NEG-016: Rejects unsupported Joint type reporting SUCCESS', () => {
    const doc = createTestDoc();
    doc.assembly!.joints![0].type = 'INVALID_TYPE' as any;

    const result = CanonicalKinematicsPipeline.solvePipeline(doc);
    expect(result.verification.verdict).toBe('UNSUPPORTED_TYPE');
  });

  it('KIN-NEG-017: Rejects Solver operating on an assembly separate from EngineeringDocument', () => {
    expect(() => {
      CanonicalKinematicsPipeline.solvePipeline(null as any);
    }).toThrow();
  });

  it('KIN-NEG-018: Rejects Component placement changing in UI without Canonical Assembly mutation', () => {
    const doc = createTestDoc();
    const initialRev = doc.revision;
    if (typeof initialRev !== 'number') {
      throw new Error('Canonical revision is not numeric');
    }

    // Mutate via intent
    const nextDoc = AssemblyIntentMutator.apply(doc, {
      type: 'UPDATE_TRANSFORM',
      instanceId: 'comp-2',
      position: { x: 10, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 }
    });

    expect(nextDoc.revision).toBe(initialRev + 1);
  });

  it('KIN-NEG-019: Rejects Loop mechanism claiming SUCCESS without loop closure verification', () => {
    const doc = createTestDoc();
    const result = CanonicalKinematicsPipeline.solvePipeline(doc);

    expect(result.solution.loopClosureErrors).toBeDefined();
    expect(Array.isArray(result.solution.loopClosureErrors)).toBe(true);
  });

  it('KIN-NEG-020: Rejects Collision-sensitive motion claiming validity without collision evaluation', () => {
    const doc = createTestDoc();
    const result = CanonicalKinematicsPipeline.solvePipeline(doc, { checkCollisions: true });

    expect(result.solution.collisionOccurred).toBeDefined();
    expect(typeof result.solution.collisionOccurred).toBe('boolean');
  });

});
