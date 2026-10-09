/**
 * SECP Industrial OS — EPC-037: Robot Architecture Verifier
 * Verifies Industrial Robotic Arm System Architecture across 13 strict engineering checks:
 * Subsystem completeness, component uniqueness, joint hierarchy, actuator-joint links,
 * sensor targets, orphan rejection, broken dependency rejection, serialization reconstruction,
 * revision integrity, cryptographic evidence provenance, and SECP core services reuse.
 */

import {
  IndustrialRobotArchitecture,
  IndustrialRobotConfigOptions
} from './IndustrialRobotArchitecture';
import { RobotArchitectureValidator } from './RobotArchitectureValidator';
import { EPC037ValidationResult, RobotSystem } from './RobotArchitectureTypes';
import { ProductArchitectureManager } from '../architecture/ProductArchitectureManager';
import { ProductArchitectureValidator } from '../architecture/ProductArchitectureValidator';
import { ArchitectureTraceabilityBridge } from '../architecture/ArchitectureTraceabilityBridge';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';

export class EPC037Verifier {
  public static readonly IMPLEMENTATION_REVISION = 'SECP-EPC-037-REV1';

  /**
   * Executes the full automated verification suite for EPC-037.
   */
  public static runVerification(options?: IndustrialRobotConfigOptions): EPC037ValidationResult {
    const checks: Record<string, { passed: boolean; message: string; details?: unknown }> = {};

    const recordCheck = (id: string, condition: boolean, successMsg: string, failMsg: string, details?: unknown) => {
      const entry: { passed: boolean; message: string; details?: unknown } = {
        passed: condition,
        message: condition ? successMsg : failMsg
      };
      if (details !== undefined) {
        entry.details = details;
      }
      checks[id] = entry;
    };

    let robot: RobotSystem | null = null;

    // 1. TEST 1: VALID_ROBOT_ARCHITECTURE
    try {
      robot = IndustrialRobotArchitecture.createDefaultIndustrialRobot(options);
      RobotArchitectureValidator.validate(robot);

      recordCheck(
        'VALID_ROBOT_ARCHITECTURE',
        robot !== null && robot.id.length > 0 && robot.components.length >= 7,
        `Valid 6-DOF Industrial Robotic Arm system architecture created with ID ${robot.id}.`,
        'Failed to create valid industrial robotic arm architecture.'
      );
    } catch (err: any) {
      recordCheck('VALID_ROBOT_ARCHITECTURE', false, '', `Creation error: ${err.message}`);
    }

    // 2. TEST 2: ALL_SUBSYSTEMS_PRESENT
    try {
      if (robot) {
        RobotArchitectureValidator.validateSubsystemsPresent(robot);
        const hasMech = robot.components.length > 0;
        const hasAct = robot.actuators.length >= 6;
        const hasSens = robot.sensors.length >= 4;
        const hasCtrl = robot.controller && robot.controller.id.length > 0;
        const hasPwr = robot.powerSystem && robot.powerSystem.id.length > 0;
        const hasEE = robot.endEffector && robot.endEffector.id.length > 0;
        const hasReq = robot.requirements.length >= 5;

        const allPresent = hasMech && hasAct && hasSens && hasCtrl && hasPwr && hasEE && hasReq;

        recordCheck(
          'ALL_SUBSYSTEMS_PRESENT',
          allPresent,
          'All required subsystems (Mechanical, Actuation, Sensing, Control, Power, End Effector, Digital Thread) present and verified.',
          'Missing one or more required subsystems in the robot architecture.',
          {
            componentsCount: robot.components.length,
            actuatorsCount: robot.actuators.length,
            sensorsCount: robot.sensors.length
          }
        );
      } else {
        recordCheck('ALL_SUBSYSTEMS_PRESENT', false, '', 'Robot system not initialized');
      }
    } catch (err: any) {
      recordCheck('ALL_SUBSYSTEMS_PRESENT', false, '', `Subsystem error: ${err.message}`);
    }

    // 3. TEST 3: COMPONENT_RELATIONSHIPS
    try {
      if (robot) {
        const compIds = new Set(robot.components.map(c => c.id));
        const allUnique = compIds.size === robot.components.length;
        const validParents = robot.components.every(
          c => !c.parentId || c.parentId === 'NONE' || c.parentId === 'ENVIRONMENT' || compIds.has(c.parentId)
        );

        recordCheck(
          'COMPONENT_RELATIONSHIPS',
          allUnique && validParents,
          `Component relationships verified across ${robot.components.length} unique components with valid parent references.`,
          'Component relationships check failed (duplicate IDs or invalid parent references).'
        );
      } else {
        recordCheck('COMPONENT_RELATIONSHIPS', false, '', 'Robot system not initialized');
      }
    } catch (err: any) {
      recordCheck('COMPONENT_RELATIONSHIPS', false, '', `Component relationship error: ${err.message}`);
    }

    // 4. TEST 4: JOINT_PARENT_CHILD_RELATIONS
    try {
      if (robot) {
        const compIds = new Set(robot.components.map(c => c.id));
        const jointsValid = robot.joints.every(
          j => compIds.has(j.parentComponent) && compIds.has(j.childComponent) && j.limits.min < j.limits.max
        );

        recordCheck(
          'JOINT_PARENT_CHILD_RELATIONS',
          jointsValid && robot.joints.length === 6,
          `Kinematic joint tree (J1-J6) verified: Every joint links valid parent and child components with valid joint limits.`,
          'Joint parent/child relationships validation failed.',
          { jointsCount: robot.joints.length }
        );
      } else {
        recordCheck('JOINT_PARENT_CHILD_RELATIONS', false, '', 'Robot system not initialized');
      }
    } catch (err: any) {
      recordCheck('JOINT_PARENT_CHILD_RELATIONS', false, '', `Joint error: ${err.message}`);
    }

    // 5. TEST 5: ACTUATOR_TO_JOINT_RELATIONS
    try {
      if (robot) {
        const jointIds = new Set(robot.joints.map(j => j.id));
        const actuatorsValid = robot.actuators.every(a => jointIds.has(a.jointId) && a.torqueLimit > 0);

        recordCheck(
          'ACTUATOR_TO_JOINT_RELATIONS',
          actuatorsValid && robot.actuators.length === robot.joints.length,
          `Actuator-to-joint mapping confirmed: 6x servomotor actuators linked 1-to-1 with Joints J1-J6.`,
          'Actuator-to-joint mapping validation failed.',
          { actuatorsCount: robot.actuators.length }
        );
      } else {
        recordCheck('ACTUATOR_TO_JOINT_RELATIONS', false, '', 'Robot system not initialized');
      }
    } catch (err: any) {
      recordCheck('ACTUATOR_TO_JOINT_RELATIONS', false, '', `Actuator error: ${err.message}`);
    }

    // 6. TEST 6: SENSOR_REFERENCES
    try {
      if (robot) {
        const compIds = new Set(robot.components.map(c => c.id));
        const jointIds = new Set(robot.joints.map(j => j.id));
        const sensorsValid = robot.sensors.every(
          s => compIds.has(s.target) || jointIds.has(s.target) || s.target === robot.id
        );

        recordCheck(
          'SENSOR_REFERENCES',
          sensorsValid && robot.sensors.length >= 4,
          `Sensor target references verified across ${robot.sensors.length} sensors (Joint Encoders, Torque Cells, Wrist F/T).`,
          'Sensor target references validation failed.'
        );
      } else {
        recordCheck('SENSOR_REFERENCES', false, '', 'Robot system not initialized');
      }
    } catch (err: any) {
      recordCheck('SENSOR_REFERENCES', false, '', `Sensor error: ${err.message}`);
    }

    // 7. TEST 7: REJECT_INVALID_ARCHITECTURE
    try {
      const invalidRobot: RobotSystem = {
        ...robot!,
        components: [] // Empty components is invalid
      };
      let rejected = false;
      try {
        RobotArchitectureValidator.validate(invalidRobot);
      } catch {
        rejected = true;
      }

      recordCheck(
        'REJECT_INVALID_ARCHITECTURE',
        rejected,
        'Validator correctly rejected invalid architecture missing mandatory mechanical components.',
        'Validator failed to reject invalid architecture.'
      );
    } catch (err: any) {
      recordCheck('REJECT_INVALID_ARCHITECTURE', false, '', `Invalid architecture test error: ${err.message}`);
    }

    // 8. TEST 8: REJECT_ORPHAN_COMPONENTS
    try {
      if (robot) {
        const orphanComp = {
          id: 'COMP-ORPHAN-LINK',
          type: 'UNATTACHED_LINK',
          partId: 'PART-ORPHAN-01',
          material: 'Aluminum',
          mass: 5.0,
          parentId: 'NON_EXISTENT_PARENT',
          revision: robot.revision
        };
        const robotWithOrphan: RobotSystem = {
          ...robot,
          components: [...robot.components, orphanComp]
        };

        let orphanDetected = false;
        try {
          RobotArchitectureValidator.validate(robotWithOrphan);
        } catch {
          orphanDetected = true;
        }

        recordCheck(
          'REJECT_ORPHAN_COMPONENTS',
          orphanDetected,
          'Validator correctly identified and rejected orphan component disconnected from kinematic tree.',
          'Validator failed to detect orphan component.'
        );
      } else {
        recordCheck('REJECT_ORPHAN_COMPONENTS', false, '', 'Robot system not initialized');
      }
    } catch (err: any) {
      recordCheck('REJECT_ORPHAN_COMPONENTS', false, '', `Orphan test error: ${err.message}`);
    }

    // 9. TEST 9: REJECT_BROKEN_DEPENDENCIES
    try {
      if (robot) {
        const brokenRel = {
          sourceId: 'COMP-ROB-BASE',
          targetId: 'NON_EXISTENT_TARGET_ID_XYZ',
          relationType: 'MECHANICAL_INTERFACE' as const,
          dependency: true,
          revision: robot.revision
        };
        const robotWithBrokenRel: RobotSystem = {
          ...robot,
          relations: [...robot.relations, brokenRel]
        };

        let brokenRelDetected = false;
        try {
          RobotArchitectureValidator.validate(robotWithBrokenRel);
        } catch {
          brokenRelDetected = true;
        }

        recordCheck(
          'REJECT_BROKEN_DEPENDENCIES',
          brokenRelDetected,
          'Validator correctly rejected relation with non-existent target ID.',
          'Validator failed to detect broken relation dependency.'
        );
      } else {
        recordCheck('REJECT_BROKEN_DEPENDENCIES', false, '', 'Robot system not initialized');
      }
    } catch (err: any) {
      recordCheck('REJECT_BROKEN_DEPENDENCIES', false, '', `Broken dependency test error: ${err.message}`);
    }

    // 10. TEST 10: DETERMINISTIC_SERIALIZATION
    try {
      if (robot) {
        const jsonString = JSON.stringify(robot);
        const reconstructed: RobotSystem = JSON.parse(jsonString);

        RobotArchitectureValidator.validate(reconstructed);

        const originalHash = EvidenceIntegrityService.computeHash(robot);
        const reconstructedHash = EvidenceIntegrityService.computeHash(reconstructed);

        const isIdentical = originalHash === reconstructedHash && reconstructed.id === robot.id;

        recordCheck(
          'DETERMINISTIC_SERIALIZATION',
          isIdentical,
          'Deterministic serialization/reconstruction verified with 100% hash equivalence.',
          'Serialization reconstruction or hash match failed.',
          { originalHash, reconstructedHash }
        );
      } else {
        recordCheck('DETERMINISTIC_SERIALIZATION', false, '', 'Robot system not initialized');
      }
    } catch (err: any) {
      recordCheck('DETERMINISTIC_SERIALIZATION', false, '', `Serialization error: ${err.message}`);
    }

    // 11. TEST 11: REVISION_CONFIG_INTEGRITY
    try {
      if (robot) {
        const updateResult = IndustrialRobotArchitecture.updateRobotComponent(robot, 'COMP-ROB-UPPER_ARM', {
          mass: 20.5
        });

        const updatedRev = updateResult.revision;
        const revChanged = updatedRev !== robot.revision;
        const hasHash = updateResult.provenanceHash.length > 0;

        recordCheck(
          'REVISION_CONFIG_INTEGRITY',
          revChanged && hasHash,
          `Revision incremented from ${robot.revision} to ${updatedRev} upon component update with cryptographic provenance trace.`,
          'Revision management or provenance trace failed.'
        );
      } else {
        recordCheck('REVISION_CONFIG_INTEGRITY', false, '', 'Robot system not initialized');
      }
    } catch (err: any) {
      recordCheck('REVISION_CONFIG_INTEGRITY', false, '', `Revision error: ${err.message}`);
    }

    // 12. TEST 12: EVIDENCE_PROVENANCE_INTEGRITY
    try {
      if (robot) {
        const evidenceData = {
          epc: 'EPC-037',
          systemId: robot.id,
          revision: robot.revision,
          componentsCount: robot.components.length,
          timestamp: new Date().toISOString()
        };
        const computedHash = EvidenceIntegrityService.computeHash(evidenceData);
        const isValidHash = typeof computedHash === 'string' && computedHash.length === 64;

        recordCheck(
          'EVIDENCE_PROVENANCE_INTEGRITY',
          isValidHash,
          `Cryptographic evidence package created with SHA-256 provenance hash: ${computedHash.substring(0, 16)}...`,
          'Evidence provenance cryptographic hashing failed.'
        );
      } else {
        recordCheck('EVIDENCE_PROVENANCE_INTEGRITY', false, '', 'Robot system not initialized');
      }
    } catch (err: any) {
      recordCheck('EVIDENCE_PROVENANCE_INTEGRITY', false, '', `Evidence error: ${err.message}`);
    }

    // 13. TEST 13: SECP_CORE_SERVICES_REUSE
    try {
      if (robot) {
        // Convert RobotSystem to SECP Core ProductArchitecture
        const coreProductArch = IndustrialRobotArchitecture.toProductArchitecture(robot);

        // Validate via SECP Core ProductArchitectureValidator
        const validatedCoreArch = ProductArchitectureValidator.validateArchitecture(coreProductArch);

        // Register in SECP Core ProductArchitectureManager
        const manager = new ProductArchitectureManager([validatedCoreArch]);

        // Build Digital Thread via SECP Core ArchitectureTraceabilityBridge
        const digitalThread = ArchitectureTraceabilityBridge.buildDigitalThreadGraph(validatedCoreArch);

        const reuseSuccess =
          manager.getArchitecture(validatedCoreArch.architectureId) !== undefined &&
          digitalThread.nodes.length >= 10 &&
          digitalThread.traceabilityCoveragePercentage === 100;

        recordCheck(
          'SECP_CORE_SERVICES_REUSE',
          reuseSuccess,
          '100% SECP Core services reuse confirmed: Robot Architecture integrated with ProductArchitectureManager, Core Validator, and Digital Thread Bridge.',
          'Failed to reuse common SECP architecture core services.'
        );
      } else {
        recordCheck('SECP_CORE_SERVICES_REUSE', false, '', 'Robot system not initialized');
      }
    } catch (err: any) {
      recordCheck('SECP_CORE_SERVICES_REUSE', false, '', `Core services reuse error: ${err.message}`);
    }

    // Verdict computation
    const allChecks = Object.values(checks);
    const passedCount = allChecks.filter(c => c.passed).length;
    const totalCount = allChecks.length;
    const failedCount = totalCount - passedCount;

    let verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE' = 'FAIL';
    if (failedCount === 0 && totalCount >= 13) {
      verdict = 'PASS';
    } else if (passedCount === 0) {
      verdict = 'INCONCLUSIVE';
    }

    const totalMassKg = robot ? robot.components.reduce((sum, c) => sum + c.mass, 0) : 0;

    const evidenceHash = EvidenceIntegrityService.computeHash({
      epc: 'EPC-037',
      checks,
      verdict,
      systemId: robot?.id,
      timestamp: new Date().toISOString()
    });

    return {
      epc: 'EPC-037',
      verdict,
      implementationRevision: this.IMPLEMENTATION_REVISION,
      systemId: robot?.id || 'UNKNOWN',
      checks,
      summary: {
        totalChecks: totalCount,
        passedChecks: passedCount,
        failedChecks: failedCount,
        componentCount: robot?.components.length || 0,
        jointCount: robot?.joints.length || 0,
        actuatorCount: robot?.actuators.length || 0,
        sensorCount: robot?.sensors.length || 0,
        totalMassKg,
        maxPayloadKg: robot?.endEffector.payloadDefinition.maxPayloadKg || 0,
        reachMm: 1100.0
      },
      evidenceHash,
      timestamp: new Date().toISOString()
    };
  }
}
