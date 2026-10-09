/**
 * SECP Industrial OS — EPC-037 Test Suite
 * Automated unit tests verifying Industrial Robotic Arm Product/System Architecture,
 * Joint/Actuator/Sensor linkages, orphan rejection, cycle rejection,
 * serialization, revision integrity, and SECP core services integration.
 */

import { describe, it, expect } from 'vitest';
import { IndustrialRobotArchitecture } from '../robot/IndustrialRobotArchitecture';
import { RobotArchitectureValidator } from '../robot/RobotArchitectureValidator';
import { EPC037Verifier } from '../robot/EPC037Verifier';
import { ProductArchitectureManager } from '../architecture/ProductArchitectureManager';
import { ProductArchitectureValidator } from '../architecture/ProductArchitectureValidator';
import { ArchitectureTraceabilityBridge } from '../architecture/ArchitectureTraceabilityBridge';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';
import { RobotSystem } from '../robot/RobotArchitectureTypes';

describe('EPC-037: Industrial Robotic Arm System Architecture', () => {
  it('TEST 1: Should create valid industrial robotic arm architecture', () => {
    const robot = IndustrialRobotArchitecture.createDefaultIndustrialRobot();
    expect(robot).toBeDefined();
    expect(robot.id).toContain('ROBOT');
    expect(robot.components.length).toBeGreaterThanOrEqual(7);
    expect(robot.joints.length).toBe(6);
    expect(robot.actuators.length).toBe(6);
    expect(robot.sensors.length).toBeGreaterThanOrEqual(4);
  });

  it('TEST 2: Should validate all required subsystems', () => {
    const robot = IndustrialRobotArchitecture.createDefaultIndustrialRobot();
    expect(() => RobotArchitectureValidator.validateSubsystemsPresent(robot)).not.toThrow();
  });

  it('TEST 3: Should validate component relationships and unique IDs', () => {
    const robot = IndustrialRobotArchitecture.createDefaultIndustrialRobot();
    const ids = robot.components.map(c => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('TEST 4: Should validate joint parent/child relationships', () => {
    const robot = IndustrialRobotArchitecture.createDefaultIndustrialRobot();
    const compIds = new Set(robot.components.map(c => c.id));

    for (const joint of robot.joints) {
      expect(compIds.has(joint.parentComponent)).toBe(true);
      expect(compIds.has(joint.childComponent)).toBe(true);
      expect(joint.limits.min).toBeLessThan(joint.limits.max);
    }
  });

  it('TEST 5: Should validate actuator-to-joint relationships', () => {
    const robot = IndustrialRobotArchitecture.createDefaultIndustrialRobot();
    const jointIds = new Set(robot.joints.map(j => j.id));

    for (const actuator of robot.actuators) {
      expect(jointIds.has(actuator.jointId)).toBe(true);
      expect(actuator.torqueLimit).toBeGreaterThan(0);
      expect(actuator.transmissionRatio).toBeGreaterThan(0);
    }
  });

  it('TEST 6: Should validate sensor references', () => {
    const robot = IndustrialRobotArchitecture.createDefaultIndustrialRobot();
    const compIds = new Set(robot.components.map(c => c.id));
    const jointIds = new Set(robot.joints.map(j => j.id));

    for (const sensor of robot.sensors) {
      const isValidTarget = compIds.has(sensor.target) || jointIds.has(sensor.target) || sensor.target === robot.id;
      expect(isValidTarget).toBe(true);
    }
  });

  it('TEST 7: Should reject invalid architecture missing components', () => {
    const robot = IndustrialRobotArchitecture.createDefaultIndustrialRobot();
    const invalidRobot: RobotSystem = {
      ...robot,
      components: []
    };

    expect(() => RobotArchitectureValidator.validate(invalidRobot)).toThrow();
  });

  it('TEST 8: Should reject orphan components', () => {
    const robot = IndustrialRobotArchitecture.createDefaultIndustrialRobot();
    const orphanComp = {
      id: 'COMP-ORPHAN-01',
      type: 'UNATTACHED_PART',
      partId: 'PART-ORPHAN',
      material: 'Steel',
      mass: 2.0,
      parentId: 'NON_EXISTENT_PARENT',
      revision: '1.0'
    };

    const robotWithOrphan: RobotSystem = {
      ...robot,
      components: [...robot.components, orphanComp]
    };

    expect(() => RobotArchitectureValidator.checkOrphanComponents(robotWithOrphan.components, new Map(robot.joints.map(j => [j.id, j])))).toThrow();
  });

  it('TEST 9: Should reject broken dependencies', () => {
    const robot = IndustrialRobotArchitecture.createDefaultIndustrialRobot();
    const brokenRel = {
      sourceId: 'COMP-ROB-BASE',
      targetId: 'MISSING_TARGET_XYZ',
      relationType: 'MECHANICAL_INTERFACE' as const,
      dependency: true,
      revision: '1.0'
    };

    const robotWithBrokenRel: RobotSystem = {
      ...robot,
      relations: [...robot.relations, brokenRel]
    };

    const compMap = new Map(robot.components.map(c => [c.id, c]));
    const jointMap = new Map(robot.joints.map(j => [j.id, j]));

    expect(() => RobotArchitectureValidator.checkBrokenDependencies(robotWithBrokenRel, compMap, jointMap)).toThrow();
  });

  it('TEST 10: Should verify deterministic serialization and reconstruction', () => {
    const robot = IndustrialRobotArchitecture.createDefaultIndustrialRobot();
    const jsonStr = JSON.stringify(robot);
    const reconstructed: RobotSystem = JSON.parse(jsonStr);

    expect(() => RobotArchitectureValidator.validate(reconstructed)).not.toThrow();

    const hash1 = EvidenceIntegrityService.computeHash(robot);
    const hash2 = EvidenceIntegrityService.computeHash(reconstructed);
    expect(hash1).toBe(hash2);
  });

  it('TEST 11: Should verify revision and configuration integrity', () => {
    const robot = IndustrialRobotArchitecture.createDefaultIndustrialRobot();
    const updateResult = IndustrialRobotArchitecture.updateRobotComponent(robot, 'COMP-ROB-UPPER_ARM', {
      mass: 19.5
    });

    expect(updateResult.revision).not.toBe(robot.revision);
    expect(updateResult.provenanceHash).toBeDefined();
    expect(updateResult.system.components.find(c => c.id === 'COMP-ROB-UPPER_ARM')?.mass).toBe(19.5);
  });

  it('TEST 12: Should verify Evidence and Provenance integration', () => {
    const result = EPC037Verifier.runVerification();
    expect(result.verdict).toBe('PASS');
    expect(result.evidenceHash).toBeDefined();
    expect(result.evidenceHash.length).toBe(64); // SHA-256 length
  });

  it('TEST 13: Should verify reuse of common SECP architecture services', () => {
    const robot = IndustrialRobotArchitecture.createDefaultIndustrialRobot();
    const coreArch = IndustrialRobotArchitecture.toProductArchitecture(robot);

    expect(() => ProductArchitectureValidator.validateArchitecture(coreArch)).not.toThrow();

    const manager = new ProductArchitectureManager([coreArch]);
    expect(manager.getArchitecture(coreArch.architectureId)).toBeDefined();

    const thread = ArchitectureTraceabilityBridge.buildDigitalThreadGraph(coreArch);
    expect(thread.nodes.length).toBeGreaterThanOrEqual(10);
    expect(thread.traceabilityCoveragePercentage).toBe(100);
  });
});
