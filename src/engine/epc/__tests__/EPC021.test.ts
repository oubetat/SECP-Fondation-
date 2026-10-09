/**
 * SECP Industrial OS — EPC-021: Industrial Drone Assembly Engine Test Suite
 * Validates Assembly Root, Part Definitions vs Instances, Assembly Tree Hierarchy & Mutability,
 * Component Transforms, Assembly Constraints, Constraint Solver & Degrees of Freedom,
 * Collision & Interference Analysis, Dynamic Automated BOM Generation & Assembly Consistency,
 * Mass Roll-up, Center of Gravity (CG), Revision Tracking, Product Configuration Linkages,
 * Requirement Traceability, and Evidence Package Generation.
 */

import { describe, it, expect } from 'vitest';
import { DroneAssemblyManager } from '../assembly/DroneAssemblyManager';
import { EPC021EvidenceGenerator } from '../assembly/EPC021EvidenceGenerator';
import { EPC021Verifier } from '../assembly/EPC021Verifier';
import { EngineeringEvidencePackageManager } from '../evidence/EngineeringEvidencePackageManager';
import { RequirementTraceabilityEngine } from '../RequirementTraceabilityEngine';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';

describe('SECP EPC-021: Industrial Drone Assembly & Constraint Engine', () => {

  it('TEST-021-001: should instantiate Assembly Root with exact required metadata', () => {
    const manager = new DroneAssemblyManager();
    expect(manager.assemblyId).toBe('EPC-016-DRONE-ASSEMBLY');
    expect(manager.productName).toBe('Industrial Drone');
    expect(manager.caseId).toBe('EPC-1');
    expect(manager.revision).toBe('REV-A');
  });

  it('TEST-021-002: should maintain Part Registry & References with CAD geometry and material references', () => {
    const manager = new DroneAssemblyManager();
    const references = manager.getAllPartReferences();

    expect(references.length).toBeGreaterThanOrEqual(11);
    for (const ref of references) {
      expect(ref.partId).toBeDefined();
      expect(ref.partNumber).toBeDefined();
      expect(ref.quantity).toBeGreaterThan(0);
      expect(ref.geometryReference.geometryHash).toBeDefined();
      expect(ref.materialReference.materialName).toBeDefined();
      expect(ref.status).toBe('RELEASED');
    }
  });

  it('TEST-021-003: should cleanly separate Part Definitions from Part Instances with definition reuse', () => {
    const manager = new DroneAssemblyManager();
    const definitions = manager.getAllPartDefinitions();
    const instances = manager.getAllPartInstances();

    expect(definitions.length).toBe(11);

    const armInstances = instances.filter(i => i.partDefinitionId === 'PART-DEF-ARM');
    expect(armInstances.length).toBe(4);
    expect(armInstances[0].instanceId).not.toBe(armInstances[1].instanceId);

    const mountInstances = instances.filter(i => i.partDefinitionId === 'PART-DEF-MOTOR-MOUNT');
    expect(mountInstances.length).toBe(4);
  });

  it('TEST-021-004: should establish complete navigable Assembly Tree hierarchy', () => {
    const manager = new DroneAssemblyManager();
    const root = manager.getRootNode();

    expect(root.nodeId).toBe('NODE-ROOT');
    expect(root.nodeType).toBe('ROOT');

    const subassemblyNames = root.children.map(c => c.name);
    expect(subassemblyNames).toContain('Airframe');
    expect(subassemblyNames).toContain('Propulsion');
    expect(subassemblyNames).toContain('Motor Mounts');
    expect(subassemblyNames).toContain('Landing Gear');
    expect(subassemblyNames).toContain('Battery Structure');
    expect(subassemblyNames).toContain('Battery');
    expect(subassemblyNames).toContain('Payload Structure');
    expect(subassemblyNames).toContain('Payload');
    expect(subassemblyNames).toContain('Avionics');
  });

  it('TEST-021-005: should support operational mutability on Assembly Tree (Add, Remove, Move, Suppress, Replace, Reorder)', () => {
    const manager = new DroneAssemblyManager();

    // 1. Add Node
    const tempNodeId = 'NODE-TEMP-PART';
    const added = manager.addNode('NODE-AVIONICS', {
      nodeId: tempNodeId,
      parentId: 'NODE-AVIONICS',
      name: 'Auxiliary Sensor Module',
      nodeType: 'PART_INSTANCE',
      partId: 'PART-DEF-AVIONICS',
      instanceId: 'INST-TEMP-001',
      quantity: 1,
      localTransform: { position: { x: 0, y: 0, z: 10 } },
      globalTransform: { position: { x: 0, y: 0, z: 35 } },
      visibility: true,
      suppressionState: 'ACTIVE',
      children: []
    });
    expect(added).toBe(true);
    expect(manager.findNode(tempNodeId)).not.toBeNull();

    // 2. Suppress & Unsuppress Node
    expect(manager.suppressNode(tempNodeId)).toBe(true);
    expect(manager.findNode(tempNodeId)?.suppressionState).toBe('SUPPRESSED');

    expect(manager.unsuppressNode(tempNodeId)).toBe(true);
    expect(manager.findNode(tempNodeId)?.suppressionState).toBe('ACTIVE');

    // 3. Move Node
    expect(manager.moveNode(tempNodeId, 'NODE-PAYLOAD')).toBe(true);
    expect(manager.findNode(tempNodeId)?.parentId).toBe('NODE-PAYLOAD');

    // 4. Remove Node
    expect(manager.removeNode(tempNodeId)).toBe(true);
    expect(manager.findNode(tempNodeId)).toBeNull();
  });

  it('TEST-021-006: should propagate local transforms to global coordinate system (GlobalTransform = Parent × Local)', () => {
    const manager = new DroneAssemblyManager();

    const arm1 = manager.findNode('NODE-ARM-01');
    const airframe = manager.findNode('NODE-AIRFRAME');

    expect(arm1).not.toBeNull();
    expect(airframe).not.toBeNull();

    expect(arm1!.globalTransform.position.x).toBe(airframe!.globalTransform.position.x + arm1!.localTransform.position.x);
    expect(arm1!.globalTransform.position.y).toBe(airframe!.globalTransform.position.y + arm1!.localTransform.position.y);
  });

  it('TEST-021-007: should define assembly constraints covering mandatory constraint types', () => {
    const manager = new DroneAssemblyManager();
    const constraints = manager.getConstraints();

    expect(constraints.length).toBeGreaterThanOrEqual(15);
    const types = new Set(constraints.map(c => c.type));
    expect(types.has('COINCIDENT')).toBe(true);
    expect(types.has('CONCENTRIC')).toBe(true);
    expect(types.has('DISTANCE')).toBe(true);
    expect(types.has('FIXED')).toBe(true);
  });

  it('TEST-021-008: should verify Airframe to Arm mounting and positioning constraints', () => {
    const manager = new DroneAssemblyManager();
    const constraints = manager.getConstraints();
    const armMates = constraints.filter(c => c.componentB.startsWith('INST-ARM'));

    expect(armMates.length).toBe(8); // 2 per arm x 4 arms
  });

  it('TEST-021-009: should verify Arm -> Motor Mount -> Motor constraint chain', () => {
    const manager = new DroneAssemblyManager();
    const constraints = manager.getConstraints();

    const mountMates = constraints.filter(c => c.componentA.startsWith('INST-ARM') && c.componentB.startsWith('INST-MOUNT'));
    const motorMates = constraints.filter(c => c.componentA.startsWith('INST-MOUNT') && c.componentB.startsWith('INST-MOTOR'));

    expect(mountMates.length).toBe(8);
    expect(motorMates.length).toBe(8);
  });

  it('TEST-021-010: should verify Airframe to Landing Gear mounting constraints', () => {
    const manager = new DroneAssemblyManager();
    const constraints = manager.getConstraints();
    const gearMates = constraints.filter(c => c.componentB.startsWith('INST-GEAR'));

    expect(gearMates.length).toBe(6); // 2 per gear x 3 gears
  });

  it('TEST-021-011: should verify Battery & Payload structure constraint links', () => {
    const manager = new DroneAssemblyManager();
    const constraints = manager.getConstraints();

    const batteryMates = constraints.filter(c => c.componentA.includes('BATTERY') || c.componentB.includes('BATTERY'));
    const payloadMates = constraints.filter(c => c.componentA.includes('PAYLOAD') || c.componentB.includes('PAYLOAD'));

    expect(batteryMates.length).toBeGreaterThanOrEqual(2);
    expect(payloadMates.length).toBeGreaterThanOrEqual(2);
  });

  it('TEST-021-012: should execute SECP Assembly Constraint Solver and return SOLVED status', () => {
    const manager = new DroneAssemblyManager();
    const result = manager.solveConstraints();

    expect(result.solverStatus).toBe('SOLVED');
    expect(result.solvedConstraints).toBeGreaterThan(0);
    expect(result.conflictingConstraints).toBe(0);
  });

  it('TEST-021-013: should analyze Degrees of Freedom (Expected DOF = 0, Net System DOF = 0)', () => {
    const manager = new DroneAssemblyManager();
    const result = manager.solveConstraints();
    const dof = result.degreesOfFreedom;

    expect(dof.expectedDOF).toBe(0);
    expect(dof.actualDOF).toBe(0);
    expect(dof.isFullyConstrained).toBe(true);
    expect(dof.isOverConstrained).toBe(false);
  });

  it('TEST-021-014: should execute pair-wise Collision & Interference analysis across components', async () => {
    const manager = new DroneAssemblyManager();
    const collisions = await manager.runCollisionAnalysis(2.0);

    expect(collisions.length).toBeGreaterThan(0);
    for (const record of collisions) {
      expect(record.collisionPair).toBeDefined();
      expect(record.severity).toBeDefined();
    }
  });

  it('TEST-021-015: should dynamically derive BOM from Assembly Tree and Part Definitions', () => {
    const manager = new DroneAssemblyManager();
    const bom = manager.generateBOM();

    expect(bom.length).toBe(11);

    const armItem = bom.find(b => b.partNumber === 'ARM-001');
    expect(armItem).toBeDefined();
    expect(armItem!.quantity).toBe(4);
    expect(armItem!.material).toBe('T700 Carbon Fiber Composite');

    const motorItem = bom.find(b => b.partNumber === 'MOTOR-001');
    expect(motorItem).toBeDefined();
    expect(motorItem!.quantity).toBe(4);
  });

  it('TEST-021-016: should validate BOM ↔ Assembly quantity consistency', () => {
    const manager = new DroneAssemblyManager();
    const consistency = manager.verifyBOMAssemblyConsistency();

    expect(consistency.isConsistent).toBe(true);
    expect(consistency.mismatches.length).toBe(0);
  });

  it('TEST-021-017: should compute physics-based Mass Roll-up for subassemblies and total assembly', () => {
    const manager = new DroneAssemblyManager();
    const rollup = manager.calculateMassRollup();

    expect(rollup.totalAssemblyMassKg).toBeGreaterThan(10.0);
    expect(rollup.subassemblyMasses['SUB-AIRFRAME']).toBeGreaterThan(0);
    expect(rollup.subassemblyMasses['SUB-PROPULSION']).toBeGreaterThan(0);
    expect(rollup.subassemblyMasses['SUB-BATTERY']).toBeGreaterThan(0);
  });

  it('TEST-021-018: should calculate global 3D Center of Gravity (CG) derived from component masses and positions', () => {
    const manager = new DroneAssemblyManager();
    const cg = manager.calculateCenterOfGravity();

    expect(cg.totalMassKg).toBeGreaterThan(10.0);
    expect(typeof cg.centerOfGravity.x).toBe('number');
    expect(typeof cg.centerOfGravity.y).toBe('number');
    expect(typeof cg.centerOfGravity.z).toBe('number');
  });

  it('TEST-021-019: should track Part Revision swaps and link Product Configuration chain', () => {
    const manager = new DroneAssemblyManager();

    // Perform revision change
    const swapped = manager.replaceNodePart('NODE-ARM-01', 'PART-DEF-ARM', 'REV-B');
    expect(swapped).toBe(true);

    const history = manager.getRevisionHistory();
    expect(history.length).toBe(1);
    expect(history[0].previousRevision).toBe('REV-A');
    expect(history[0].newRevision).toBe('REV-B');
    expect(history[0].affectedCAEInvalidated).toBe(true);

    // Build configuration chain
    const chain = manager.buildConfigurationChain();
    expect(chain.chainValid).toBe(true);
    expect(chain.assemblyId).toBe('EPC-016-DRONE-ASSEMBLY');
    expect(chain.bomId).toBe('BOM-IND-DRONE-REV-A');
  });

  it('TEST-021-020: should populate requirement traceability graph and generate signed SHA-256 evidence package', async () => {
    const manager = new DroneAssemblyManager();
    const evidenceManager = new EngineeringEvidencePackageManager();
    const traceEngine = new RequirementTraceabilityEngine('GRAPH-TEST-021', '1.0');

    manager.buildTraceabilityGraph(traceEngine);
    const traceEdges = traceEngine.getOutgoingEdges('REQ-DRONE-001');
    expect(traceEdges.length).toBeGreaterThan(0);

    const reg = await EPC021EvidenceGenerator.registerInEvidenceManager(evidenceManager, manager);
    expect(reg.packageId).toBe('EPC021-EVIDENCE-PACKAGE');
    expect(reg.canonicalHash.length).toBe(64);

    const retrievedPkg = evidenceManager.getPackage(reg.packageId);
    expect(retrievedPkg).not.toBeNull();
  });

  it('TEST-021-MASTER: Master Verifier should return ENGINEERING VERDICT: EPC-021 = PASS', async () => {
    const result = await EPC021Verifier.runVerification();

    expect(result.verdict).toBe('PASS');
    expect(result.overallStatusMessage).toContain('ENGINEERING VERDICT: EPC-021 = PASS');
    expect(result.failedChecks).toBe(0);
    expect(result.passedChecks).toBe(result.totalChecks);
  });
});
