/**
 * SECP Industrial OS — EPC-037: Robot Architecture Validator
 * Enforces structural integrity, component uniqueness, joint hierarchy,
 * actuator linkages, sensor targets, dependency sanity, and cycle detection.
 */

import {
  RobotArchitectureRelation,
  RobotComponent,
  RobotJoint,
  RobotSystem
} from './RobotArchitectureTypes';

export class RobotArchitectureValidationError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, code = 'ROBOT_ARCH_VALIDATION_ERROR', details?: unknown) {
    super(message);
    this.name = 'RobotArchitectureValidationError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, RobotArchitectureValidationError.prototype);
  }
}

export class RobotArchitectureValidator {
  /**
   * Performs full structural validation on a RobotSystem document.
   */
  public static validate(robotSystem: RobotSystem): void {
    if (!robotSystem) {
      throw new RobotArchitectureValidationError('Robot system cannot be null or undefined', 'NULL_SYSTEM');
    }

    if (!robotSystem.id || robotSystem.id.trim() === '') {
      throw new RobotArchitectureValidationError('Robot system ID is required', 'MISSING_ID');
    }

    if (!robotSystem.revision || robotSystem.revision.trim() === '') {
      throw new RobotArchitectureValidationError('Robot system revision is required', 'MISSING_REVISION');
    }

    if (!robotSystem.configurationId || robotSystem.configurationId.trim() === '') {
      throw new RobotArchitectureValidationError('Robot system configuration ID is required', 'MISSING_CONFIGURATION');
    }

    // 1. Validate mandatory subsystems
    this.validateSubsystemsPresent(robotSystem);

    // 2. Validate Component Uniqueness
    const compMap = new Map<string, RobotComponent>();
    for (const comp of robotSystem.components) {
      if (!comp.id || comp.id.trim() === '') {
        throw new RobotArchitectureValidationError('Robot component missing ID', 'INVALID_COMPONENT');
      }
      if (compMap.has(comp.id)) {
        throw new RobotArchitectureValidationError(`Duplicate component ID found: ${comp.id}`, 'DUPLICATE_COMPONENT_ID');
      }
      compMap.set(comp.id, comp);
    }

    // 3. Validate Joint Parent/Child Relationships
    const jointMap = new Map<string, RobotJoint>();
    for (const joint of robotSystem.joints) {
      if (!joint.id || joint.id.trim() === '') {
        throw new RobotArchitectureValidationError('Robot joint missing ID', 'INVALID_JOINT');
      }
      if (jointMap.has(joint.id)) {
        throw new RobotArchitectureValidationError(`Duplicate joint ID found: ${joint.id}`, 'DUPLICATE_JOINT_ID');
      }
      jointMap.set(joint.id, joint);

      if (!compMap.has(joint.parentComponent)) {
        throw new RobotArchitectureValidationError(
          `Joint ${joint.id} references non-existent parent component: ${joint.parentComponent}`,
          'INVALID_JOINT_PARENT'
        );
      }
      if (!compMap.has(joint.childComponent)) {
        throw new RobotArchitectureValidationError(
          `Joint ${joint.id} references non-existent child component: ${joint.childComponent}`,
          'INVALID_JOINT_CHILD'
        );
      }
    }

    // 4. Validate Actuator-to-Joint Relationships
    for (const actuator of robotSystem.actuators) {
      if (!actuator.id || actuator.id.trim() === '') {
        throw new RobotArchitectureValidationError('Robot actuator missing ID', 'INVALID_ACTUATOR');
      }
      if (!jointMap.has(actuator.jointId)) {
        throw new RobotArchitectureValidationError(
          `Actuator ${actuator.id} references non-existent joint ID: ${actuator.jointId}`,
          'INVALID_ACTUATOR_JOINT'
        );
      }
    }

    // 5. Validate Sensor References
    for (const sensor of robotSystem.sensors) {
      if (!sensor.id || sensor.id.trim() === '') {
        throw new RobotArchitectureValidationError('Robot sensor missing ID', 'INVALID_SENSOR');
      }
      const isTargetComponent = compMap.has(sensor.target);
      const isTargetJoint = jointMap.has(sensor.target);
      const isTargetSpecial = sensor.target.startsWith('INT-') || sensor.target.startsWith('TOOL-') || sensor.target === robotSystem.id;

      if (!isTargetComponent && !isTargetJoint && !isTargetSpecial) {
        throw new RobotArchitectureValidationError(
          `Sensor ${sensor.id} references non-existent target ID: ${sensor.target}`,
          'INVALID_SENSOR_TARGET'
        );
      }
    }

    // 6. Validate Orphan Components
    this.checkOrphanComponents(robotSystem.components, jointMap);

    // 7. Validate Broken Dependencies in Relations
    this.checkBrokenDependencies(robotSystem, compMap, jointMap);

    // 8. Validate Circular Dependencies in Kinematic/Structural tree
    this.checkCircularDependencies(robotSystem.components, jointMap);
  }

  public static validateSubsystemsPresent(system: RobotSystem): void {
    if (!system.components || system.components.length === 0) {
      throw new RobotArchitectureValidationError('Mechanical system (components) is empty', 'MISSING_MECHANICAL_SYSTEM');
    }
    if (!system.actuators || system.actuators.length === 0) {
      throw new RobotArchitectureValidationError('Actuation system is empty', 'MISSING_ACTUATION_SYSTEM');
    }
    if (!system.sensors || system.sensors.length === 0) {
      throw new RobotArchitectureValidationError('Sensing system is empty', 'MISSING_SENSING_SYSTEM');
    }
    if (!system.controller || !system.controller.id) {
      throw new RobotArchitectureValidationError('Control system is missing', 'MISSING_CONTROL_SYSTEM');
    }
    if (!system.powerSystem || !system.powerSystem.id) {
      throw new RobotArchitectureValidationError('Power system is missing', 'MISSING_POWER_SYSTEM');
    }
    if (!system.endEffector || !system.endEffector.id) {
      throw new RobotArchitectureValidationError('End effector system is missing', 'MISSING_END_EFFECTOR');
    }
    if (!system.requirements || system.requirements.length === 0) {
      throw new RobotArchitectureValidationError('Digital thread requirements linkage is missing', 'MISSING_REQUIREMENTS');
    }
  }

  public static checkOrphanComponents(components: readonly RobotComponent[], jointMap: Map<string, RobotJoint>): void {
    // A component is non-orphan if it is either the root base (no parentId) or connected via parentId or a Joint
    const connectedComponents = new Set<string>();

    for (const comp of components) {
      if (!comp.parentId || comp.parentId === 'NONE' || comp.parentId === 'ENVIRONMENT' || comp.type === 'BASE') {
        connectedComponents.add(comp.id);
      }
    }

    // Iteratively discover all components connected via parentId or Joints
    let added = true;
    while (added) {
      added = false;
      for (const comp of components) {
        if (!connectedComponents.has(comp.id) && comp.parentId && connectedComponents.has(comp.parentId)) {
          connectedComponents.add(comp.id);
          added = true;
        }
      }
      for (const joint of jointMap.values()) {
        if (connectedComponents.has(joint.parentComponent) && !connectedComponents.has(joint.childComponent)) {
          connectedComponents.add(joint.childComponent);
          added = true;
        }
      }
    }

    const orphans = components.filter(c => !connectedComponents.has(c.id));
    if (orphans.length > 0) {
      throw new RobotArchitectureValidationError(
        `Found ${orphans.length} orphan components disconnected from kinematic tree: ${orphans.map(o => o.id).join(', ')}`,
        'ORPHAN_COMPONENTS_FOUND',
        { orphanIds: orphans.map(o => o.id) }
      );
    }
  }

  public static checkBrokenDependencies(
    system: RobotSystem,
    compMap: Map<string, RobotComponent>,
    jointMap: Map<string, RobotJoint>
  ): void {
    const validIds = new Set<string>([
      system.id,
      system.controller.id,
      system.powerSystem.id,
      system.endEffector.id,
      ...compMap.keys(),
      ...jointMap.keys(),
      ...system.actuators.map(a => a.id),
      ...system.sensors.map(s => s.id),
      ...system.requirements
    ]);

    for (const rel of system.relations) {
      if (!validIds.has(rel.sourceId)) {
        throw new RobotArchitectureValidationError(
          `Relation references non-existent source ID: ${rel.sourceId}`,
          'BROKEN_RELATION_SOURCE'
        );
      }
      if (!validIds.has(rel.targetId)) {
        throw new RobotArchitectureValidationError(
          `Relation references non-existent target ID: ${rel.targetId}`,
          'BROKEN_RELATION_TARGET'
        );
      }
    }
  }

  public static checkCircularDependencies(components: readonly RobotComponent[], jointMap: Map<string, RobotJoint>): void {
    const adj = new Map<string, string[]>();
    for (const c of components) {
      adj.set(c.id, []);
    }

    for (const c of components) {
      if (c.parentId && adj.has(c.parentId)) {
        adj.get(c.parentId)!.push(c.id);
      }
    }

    for (const j of jointMap.values()) {
      if (adj.has(j.parentComponent)) {
        adj.get(j.parentComponent)!.push(j.childComponent);
      }
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = adj.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true; // Cycle detected
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const c of components) {
      if (!visited.has(c.id)) {
        if (dfs(c.id)) {
          throw new RobotArchitectureValidationError(
            `Circular kinematic or parent-child dependency detected at component: ${c.id}`,
            'CIRCULAR_DEPENDENCY_DETECTED'
          );
        }
      }
    }
  }
}
