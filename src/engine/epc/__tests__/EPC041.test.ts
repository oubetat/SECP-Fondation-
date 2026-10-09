import { describe, it, expect } from 'vitest';
import { RobotAssemblyManager } from '../robot/RobotAssemblyManager';
import { EPC041Verifier } from '../robot/EPC041Verifier';

describe('EPC-041: Industrial Robot Assembly Specification Battery', () => {
  it('TEST-01: Assembly Creation - creates valid root assembly', () => {
    const manager = new RobotAssemblyManager();
    expect(manager.assemblyId).toBe('ASSY-ROBOT-6DOF');
    expect(manager.name).toContain('6-DOF Industrial Robotic Arm Assembly');
    expect(manager.revision).toBe('REV-A');
  });

  it('TEST-02: Part Instance Creation - instantiates multiple parts without duplicating geometry', () => {
    const manager = new RobotAssemblyManager();
    const instances = manager.getAllPartInstances();
    expect(instances.length).toBeGreaterThanOrEqual(15);

    // Motor servo used in J1, J2, J3, Wrist
    const motorInstances = instances.filter(i => i.partId === 'PART-DEF-MOTOR-SERVO');
    expect(motorInstances.length).toBeGreaterThanOrEqual(3);

    // Fasteners used in multiple subassemblies
    const fastenerInstances = instances.filter(i => i.partId === 'PART-DEF-FASTENER-M6');
    expect(fastenerInstances.length).toBeGreaterThanOrEqual(4);

    // Verify all instances have distinct instanceIds and 3D transforms
    const instanceIds = new Set(instances.map(i => i.instanceId));
    expect(instanceIds.size).toBe(instances.length);

    instances.forEach(inst => {
      expect(inst.position).toBeDefined();
      expect(inst.orientation).toBeDefined();
      expect(inst.transform.matrix.length).toBe(4);
    });
  });

  it('TEST-03: Assembly Hierarchy - maintains strict tree parent-child relations', () => {
    const manager = new RobotAssemblyManager();
    const rootNode = manager.getTreeNode('ASSY-ROBOT-6DOF');
    expect(rootNode).toBeDefined();
    expect(rootNode?.nodeType).toBe('ROOT');

    const subBase = manager.getTreeNode('SUB-BASE');
    expect(subBase).toBeDefined();
    expect(subBase?.parentAssemblyId).toBe('ASSY-ROBOT-6DOF');

    const baseChildren = manager.getChildrenOf('SUB-BASE');
    expect(baseChildren.instances.length).toBeGreaterThan(0);

    const plateParent = manager.getParentAssembly('INST-BASE-PLATE');
    expect(plateParent?.id).toBe('SUB-BASE');

    const plateSiblings = manager.getSiblingsOf('INST-BASE-PLATE');
    expect(plateSiblings.some(s => s.instanceId === 'INST-BASE-HOUSING')).toBe(true);
  });

  it('TEST-04: Constraint Registration - registers valid 3D mates', () => {
    const manager = new RobotAssemblyManager();
    const constraints = manager.getAllConstraints();
    expect(constraints.length).toBeGreaterThanOrEqual(8);

    const types = new Set(constraints.map(c => c.constraintType));
    expect(types.has('FIXED')).toBe(true);
    expect(types.has('COINCIDENT')).toBe(true);
    expect(types.has('CONCENTRIC')).toBe(true);
  });

  it('TEST-05: Constraint Solve - converges via AssemblyConstraintSolver', () => {
    const manager = new RobotAssemblyManager();
    const solveRes = manager.solveConstraints();

    expect(solveRes.status).toBe('CONVERGED');
    expect(solveRes.residual).toBeLessThan(1e-4);
    expect(solveRes.isFullyConstrained).toBe(true);
    expect(Object.keys(solveRes.solvedPoses).length).toBeGreaterThan(0);
  });

  it('TEST-06: Broken Reference Detection - detects missing CAD part definitions', () => {
    const manager = new RobotAssemblyManager();
    const inst = manager.getPartInstance('INST-END-EFFECTOR');
    expect(inst).toBeDefined();

    if (inst) {
      inst.partId = 'MISSING-PART-DEF-X';
    }

    const valReport = manager.validateAssembly();
    expect(valReport.valid).toBe(false);
    expect(valReport.noBrokenReferences).toBe(false);
    expect(valReport.brokenReferenceIds).toContain('INST-END-EFFECTOR');
  });

  it('TEST-07: Assembly Validation - passes clean validation checks', () => {
    const manager = new RobotAssemblyManager();
    const valReport = manager.validateAssembly();

    expect(valReport.valid).toBe(true);
    expect(valReport.partsExistence).toBe(true);
    expect(valReport.instancesValid).toBe(true);
    expect(valReport.noBrokenReferences).toBe(true);
    expect(valReport.noOrphanComponents).toBe(true);
    expect(valReport.hierarchyValid).toBe(true);
    expect(valReport.jointReferencesValid).toBe(true);
  });

  it('TEST-08: BOM Consistency - matches instance quantities exactly', () => {
    const manager = new RobotAssemblyManager();
    const bomConsistency = manager.verifyBOMConsistency();

    expect(bomConsistency.isConsistent).toBe(true);
    expect(bomConsistency.totalInstances).toBe(bomConsistency.totalBOMQty);

    const bom = manager.generateBOM();
    expect(bom.length).toBeGreaterThan(0);

    const motorBOM = bom.find(b => b.partNumber === 'ROB-MTR-100');
    expect(motorBOM).toBeDefined();
    expect(motorBOM?.quantity).toBe(4);
  });

  it('TEST-09: CAD ↔ Assembly Dependency - tracks revision changes across subassemblies', () => {
    const manager = new RobotAssemblyManager();
    const impact = manager.updatePartRevision('PART-DEF-MOTOR-SERVO', 'REV-B');

    expect(impact.changedPartId).toBe('PART-DEF-MOTOR-SERVO');
    expect(impact.oldRevision).toBe('REV-A');
    expect(impact.newRevision).toBe('REV-B');
    expect(impact.affectedInstanceIds.length).toBe(4);
    expect(impact.requiresReSolve).toBe(true);
  });

  it('TEST-10: Revision Tracking - maintains complete revision history', () => {
    const manager = new RobotAssemblyManager();
    manager.updatePartRevision('PART-DEF-BASE-PLATE', 'REV-B');

    const evidence = manager.generateEvidencePackage();
    expect(evidence.revision).toBeDefined();
    expect(evidence.cadDependencyStatus.dependencyChainIntact).toBe(true);
  });

  it('TEST-11: Interference Detection - checks part clearance and collision', () => {
    const manager = new RobotAssemblyManager();
    const records = manager.analyzeInterference();

    expect(records.length).toBeGreaterThan(0);
    expect(records[0]).toHaveProperty('collisionStatus');
    expect(records[0]).toHaveProperty('clearanceDistanceMm');
  });

  it('TEST-12: Evidence Generation & Reproducibility - produces bit-identical evidence', () => {
    const fixedTime = '2026-09-03T12:00:00.000Z';
    const manager1 = new RobotAssemblyManager();
    const manager2 = new RobotAssemblyManager();

    const ev1 = manager1.generateEvidencePackage(fixedTime);
    const ev2 = manager2.generateEvidencePackage(fixedTime);

    expect(ev1.verdict).toBe('PASS');
    expect(ev1.evidenceHash).toBe(ev2.evidenceHash);
  });

  it(' Acceptance Gate Report - EPC041Verifier returns PASS', () => {
    const report = EPC041Verifier.verify();
    expect(report.epc).toBe('EPC-041');
    expect(report.verdict).toBe('PASS');
    expect(report.summary.failedChecks).toBe(0);
    expect(report.summary.passedChecks).toBe(12);
  });
});
