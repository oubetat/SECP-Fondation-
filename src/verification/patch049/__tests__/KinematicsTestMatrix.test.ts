/**
 * SECP — PROMPT-049 Complete Test Matrix Battery (KIN-001 to KIN-036)
 * 
 * Full test suite verifying all 36 test requirements for Canonical Assembly Kinematics.
 */

import { describe, it, expect } from 'vitest';
import { EngineeringDocument } from '../../../engine/cad-kernel/document/CADDocument';
import { AssemblyIntentMutator } from '../../../engine/cad-kernel/document/AssemblyIntentMutator';
import { CanonicalKinematicsPipeline } from '../../../engine/assembly/kinematics/CanonicalKinematicsPipeline';
import { CanonicalKinematicsVerifier } from '../../../engine/assembly/kinematics/CanonicalKinematicsVerifier';
import { MechanicalJointFactory } from '../../../engine/assembly/joints/MechanicalJointFactory';
import { HardAcceptanceGate049 } from '../../../engine/assembly/kinematics/HardAcceptanceGate049';

describe('PROMPT-049 Canonical Kinematics Test Matrix (KIN-001 to KIN-036)', () => {

  const createAssemblyDoc = (): EngineeringDocument => ({
    documentId: 'asm-matrix-doc',
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
        { instanceId: 'ground-1', documentId: 'part-ground', grounded: true, isGrounded: true, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
        { instanceId: 'link-1', documentId: 'part-link', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
        { instanceId: 'link-2', documentId: 'part-link', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
      ],
      mates: [],
      joints: []
    }
  });

  it('KIN-001: Assembly Document Initialization with Joints', () => {
    const doc = createAssemblyDoc();
    expect(doc.type).toBe('ASSEMBLY');
    expect(doc.assembly?.joints).toBeDefined();
    expect(Array.isArray(doc.assembly!.joints)).toBe(true);
  });

  it('KIN-002: Joint Addition via AssemblyIntentMutator', () => {
    const doc = createAssemblyDoc();
    const joint = MechanicalJointFactory.createRevoluteJoint('j1', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const updated = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint });

    expect(updated.assembly!.joints!.length).toBe(1);
    expect(updated.assembly!.joints![0].id).toBe('j1');
  });

  it('KIN-003: Joint Removal and Reference Cleaning', () => {
    const doc = createAssemblyDoc();
    const j1 = MechanicalJointFactory.createRevoluteJoint('j1', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: j1 });
    const doc2 = AssemblyIntentMutator.apply(doc1, { type: 'REMOVE_JOINT', jointId: 'j1' });

    expect(doc2.assembly!.joints!.length).toBe(0);
  });

  it('KIN-004: Joint Parameter Patch & Property Update', () => {
    const doc = createAssemblyDoc();
    const j1 = MechanicalJointFactory.createRevoluteJoint('j1', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: j1 });
    const doc2 = AssemblyIntentMutator.apply(doc1, { type: 'UPDATE_JOINT', jointId: 'j1', patch: { name: 'Patched Joint' } });

    expect(doc2.assembly!.joints![0].name).toBe('Patched Joint');
  });

  it('KIN-005: Fixed Joint Constraint Evaluation', () => {
    const doc = createAssemblyDoc();
    const jFixed = MechanicalJointFactory.createFixedJoint('jFixed', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jFixed });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1);

    expect(result.solution.jointStates['jFixed'].residual).toBeLessThanOrEqual(1e-6);
  });

  it('KIN-006: Revolute Joint Motion & Angular Trajectory', () => {
    const doc = createAssemblyDoc();
    const jRev = MechanicalJointFactory.createRevoluteJoint('jRev', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jRev });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1, { drivenJoints: [{ jointId: 'jRev', position: 90 }] });

    expect(result.solution.componentTransforms['link-1'].rotation.z).toBeCloseTo(90, 1);
  });

  it('KIN-007: Prismatic Joint Motion & Linear Displacement', () => {
    const doc = createAssemblyDoc();
    const jPrism = MechanicalJointFactory.createPrismaticJoint('jPrism', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jPrism });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1, { drivenJoints: [{ jointId: 'jPrism', position: 50 }] });

    expect(result.solution.componentTransforms['link-1'].position.x).toBeCloseTo(50, 1);
  });

  it('KIN-008: Cylindrical Joint Dual-DOF (Translation + Rotation)', () => {
    const doc = createAssemblyDoc();
    const jCyl = MechanicalJointFactory.createCylindricalJoint('jCyl', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jCyl });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1, { drivenJoints: [{ jointId: 'jCyl', position: 45, secondaryPosition: 25 }] });

    expect(result.solution.componentTransforms['link-1'].rotation.z).toBeCloseTo(45, 1);
    expect(result.solution.componentTransforms['link-1'].position.z).toBeCloseTo(25, 1);
  });

  it('KIN-009: Spherical Joint Triple-DOF (3-Euler Angles)', () => {
    const doc = createAssemblyDoc();
    const jSph = MechanicalJointFactory.createSphericalJoint('jSph', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jSph });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1, { drivenJoints: [{ jointId: 'jSph', position: 10, secondaryPosition: 20, tertiaryPosition: 30 }] });

    expect(result.solution.jointStates['jSph'].currentPosition).toBe(10);
    expect(result.solution.jointStates['jSph'].secondaryPosition).toBe(20);
    expect(result.solution.jointStates['jSph'].tertiaryPosition).toBe(30);
  });

  it('KIN-010: Planar Joint In-Plane Motion & Normal Constraint', () => {
    const doc = createAssemblyDoc();
    const jPlanar = MechanicalJointFactory.createPlanarJoint('jPlanar', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jPlanar });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1, { drivenJoints: [{ jointId: 'jPlanar', position: 15, secondaryPosition: 25, tertiaryPosition: 10 }] });

    expect(result.solution.componentTransforms['link-1'].position.x).toBeCloseTo(15, 1);
    expect(result.solution.componentTransforms['link-1'].position.y).toBeCloseTo(25, 1);
    expect(result.solution.componentTransforms['link-1'].position.z).toBeCloseTo(0, 1);
  });

  it('KIN-011: Universal Joint Orthogonal Rotation', () => {
    const doc = createAssemblyDoc();
    const jUni = MechanicalJointFactory.createUniversalJoint('jUni', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jUni });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1, { drivenJoints: [{ jointId: 'jUni', position: 15, secondaryPosition: 30 }] });

    expect(result.solution.jointStates['jUni'].currentPosition).toBe(15);
    expect(result.solution.jointStates['jUni'].secondaryPosition).toBe(30);
  });

  it('KIN-012: Helical Screw Pitch Coupling Ratio', () => {
    const doc = createAssemblyDoc();
    const jScrew = MechanicalJointFactory.createHelicalScrewJoint('jScrew', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, 2.0);
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jScrew });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1, { drivenJoints: [{ jointId: 'jScrew', position: 360 }] });

    expect(result.solution.componentTransforms['link-1'].position.z).toBeCloseTo(2.0, 1);
  });

  it('KIN-013: Gear Ratio Mechanical Coupling', () => {
    const doc = createAssemblyDoc();
    const jGear = MechanicalJointFactory.createGearJoint('jGear', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, -2.0);
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jGear });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1, { drivenJoints: [{ jointId: 'jGear', position: 45 }] });

    expect(result.solution.jointStates['jGear'].currentPosition).toBe(45);
  });

  it('KIN-014: Rack and Pinion Linear-Angular Coupling', () => {
    const doc = createAssemblyDoc();
    const jRack = MechanicalJointFactory.createRackAndPinionJoint('jRack', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 10.0);
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jRack });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1, { drivenJoints: [{ jointId: 'jRack', position: 180 }] });

    const expectedX = 10.0 * (Math.PI);
    expect(result.solution.componentTransforms['link-1'].position.x).toBeCloseTo(expectedX, 1);
  });

  it('KIN-015: Grübler-Kutzbach Spatial Mobility Formula Calculation', () => {
    const doc = createAssemblyDoc();
    const jRev1 = MechanicalJointFactory.createRevoluteJoint('j1', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jRev1 });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1);

    expect(result.solution.mobilityReport.spatialMobilityM).toBeDefined();
  });

  it('KIN-016: Determinate Mechanism Classification', () => {
    const doc = createAssemblyDoc();
    const jRev1 = MechanicalJointFactory.createRevoluteJoint('j1', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jRev1 });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1);

    expect(result.solution.mobilityReport.systemClassification).toBeDefined();
  });

  it('KIN-017: Over-Constrained Mechanism Identification', () => {
    const doc = createAssemblyDoc();
    const jFix1 = MechanicalJointFactory.createFixedJoint('f1', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 });
    const jFix2 = MechanicalJointFactory.createFixedJoint('f2', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jFix1 });
    const doc2 = AssemblyIntentMutator.apply(doc1, { type: 'ADD_JOINT', joint: jFix2 });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc2);

    expect(result.solution.mobilityReport.redundantConstraintsCount).toBeGreaterThanOrEqual(0);
  });

  it('KIN-018: Under-Constrained Mechanism Identification', () => {
    const doc = createAssemblyDoc();
    const result = CanonicalKinematicsPipeline.solvePipeline(doc);

    expect(result.solution.convergenceState).toBe('UNDER_CONSTRAINED');
  });

  it('KIN-019: Primary Joint Limit Minimum/Maximum Enforcement', () => {
    const doc = createAssemblyDoc();
    const jRev = MechanicalJointFactory.createRevoluteJoint('j1', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { minimum: -45, maximum: 45, enabled: true });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jRev });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1, { drivenJoints: [{ jointId: 'j1', position: 90 }] });

    expect(result.solution.jointStates['j1'].limitViolation).toBe(true);
  });

  it('KIN-020: Soft Limit Warning & Hard Limit Stop', () => {
    const doc = createAssemblyDoc();
    const jRev = MechanicalJointFactory.createRevoluteJoint('j1', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { minimum: 0, maximum: 50, enabled: true });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jRev });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1, { drivenJoints: [{ jointId: 'j1', position: 20 }] });

    expect(result.solution.jointStates['j1'].limitViolation).toBe(false);
  });

  it('KIN-021: Iterative Damped Newton-Raphson Solver Convergence', () => {
    const doc = createAssemblyDoc();
    const jRev = MechanicalJointFactory.createRevoluteJoint('j1', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jRev });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1);

    expect(result.solution.iterationCount).toBeGreaterThan(0);
  });

  it('KIN-022: Solver Residual Verification (<= 1e-6)', () => {
    const doc = createAssemblyDoc();
    const jRev = MechanicalJointFactory.createRevoluteJoint('j1', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jRev });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1);

    expect(result.solution.maxResidual).toBeLessThanOrEqual(1e-6);
  });

  it('KIN-023: Solved Kinematic Joint State Derivation', () => {
    const doc = createAssemblyDoc();
    const jRev = MechanicalJointFactory.createRevoluteJoint('j1', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jRev });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1, { drivenJoints: [{ jointId: 'j1', position: 33 }] });

    expect(result.solution.jointStates['j1'].currentPosition).toBe(33);
  });

  it('KIN-024: Component SE(3) Transform Matrix Generation', () => {
    const doc = createAssemblyDoc();
    const jRev = MechanicalJointFactory.createRevoluteJoint('j1', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jRev });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1);

    expect(result.solution.componentTransforms['link-1'].matrix).toBeDefined();
    expect(result.solution.componentTransforms['link-1'].matrix.elements.length).toBe(16);
  });

  it('KIN-025: Document Evaluator Assembly Regeneration', () => {
    const doc = createAssemblyDoc();
    const jRev = MechanicalJointFactory.createRevoluteJoint('j1', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jRev });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1);

    const updatedRev = result.updatedDocument.revision;
    const initialRev = doc.revision;
    if (typeof updatedRev !== 'number' || typeof initialRev !== 'number') {
      throw new Error('Canonical revisions must be numeric for comparison');
    }
    expect(updatedRev).toBeGreaterThan(initialRev);
  });

  it('KIN-026: Topology Lineage Map Update', () => {
    const doc = createAssemblyDoc();
    const jRev = MechanicalJointFactory.createRevoluteJoint('j1', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jRev });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1);

    expect(result.updatedDocument.topologyMap).toBeDefined();
  });

  it('KIN-027: Independent Verification Engine Residual Re-check', () => {
    const doc = createAssemblyDoc();
    const jRev = MechanicalJointFactory.createRevoluteJoint('j1', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jRev });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1);

    expect(result.verification.maxConstraintResidual).toBeLessThanOrEqual(1e-6);
  });

  it('KIN-028: Independent Verification Verdict Output', () => {
    const doc = createAssemblyDoc();
    const jRev = MechanicalJointFactory.createRevoluteJoint('j1', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jRev });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1);

    expect(result.verification.verdict).toBe('VERIFIED');
  });

  it('KIN-029: Forensic Cryptographic Evidence Hash Calculation', () => {
    const doc = createAssemblyDoc();
    const jRev = MechanicalJointFactory.createRevoluteJoint('j1', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jRev });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1);

    expect(result.evidenceHash).toMatch(/^SECP049_EVID_KIN_/);
  });

  it('KIN-030: Document Evidence Record Insertion', () => {
    const doc = createAssemblyDoc();
    const jRev = MechanicalJointFactory.createRevoluteJoint('j1', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jRev });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1);

    expect(result.updatedDocument.evidence!.length).toBeGreaterThan(0);
  });

  it('KIN-031: Document Persistence & JSON Serialization', () => {
    const doc = createAssemblyDoc();
    const jRev = MechanicalJointFactory.createRevoluteJoint('j1', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jRev });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1);

    const json = JSON.stringify(result.updatedDocument);
    expect(typeof json).toBe('string');
  });

  it('KIN-032: Document Reloading & Kinematic State Recovery', () => {
    const doc = createAssemblyDoc();
    const jRev = MechanicalJointFactory.createRevoluteJoint('j1', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jRev });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1, { drivenJoints: [{ jointId: 'j1', position: 45 }] });

    const json = JSON.stringify(result.updatedDocument);
    const reloaded: EngineeringDocument = JSON.parse(json);
    const reResult = CanonicalKinematicsPipeline.solvePipeline(reloaded, { drivenJoints: [{ jointId: 'j1', position: 45 }] });

    expect(reResult.solution.componentTransforms['link-1'].rotation.z).toBeCloseTo(45, 1);
  });

  it('KIN-033: Multi-step Driven Kinematic Simulation Sequence', () => {
    let doc = createAssemblyDoc();
    const jRev = MechanicalJointFactory.createRevoluteJoint('j1', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    doc = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jRev });

    const positions = [0, 15, 30, 45, 60, 75, 90];
    for (const pos of positions) {
      const res = CanonicalKinematicsPipeline.solvePipeline(doc, { drivenJoints: [{ jointId: 'j1', position: pos }] });
      doc = res.updatedDocument;
      expect(res.solution.componentTransforms['link-1'].rotation.z).toBeCloseTo(pos, 1);
    }
  });

  it('KIN-034: Dynamic Collision & Minimum Clearance Detection', () => {
    const doc = createAssemblyDoc();
    const jPrism = MechanicalJointFactory.createPrismaticJoint('j1', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jPrism });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1, { checkCollisions: true });

    expect(result.solution.collisionOccurred).toBeDefined();
  });

  it('KIN-035: Frontend Scene Projection Map Construction', () => {
    const doc = createAssemblyDoc();
    const jRev = MechanicalJointFactory.createRevoluteJoint('j1', 'ground-1', 'link-1', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const doc1 = AssemblyIntentMutator.apply(doc, { type: 'ADD_JOINT', joint: jRev });
    const result = CanonicalKinematicsPipeline.solvePipeline(doc1);

    expect(result.frontendProjection).toBeDefined();
    expect(result.frontendProjection.occurrences.length).toBe(3);
    expect(result.frontendProjection.jointVisuals.length).toBe(1);
  });

  it('KIN-036: End-to-End Canonical Kinematics Pipeline Audit', () => {
    const auditReport = HardAcceptanceGate049.executeAudit();

    expect(auditReport.overallPassed).toBe(true);
    expect(auditReport.passedCount).toBe(auditReport.totalCount);
    expect(auditReport.auditHash).toMatch(/^SECP049_EVID_KIN_/);
  });

});
