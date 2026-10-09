import { WorkflowDefinition } from './types';
import { CapabilityResolver } from '../capabilities/CapabilityResolver';
import { WorkflowDependencyGraph } from './WorkflowDependencyGraph';

export class WorkflowValidator {
  /**
   * Validate a WorkflowDefinition before execution.
   * Performs structural, validation, reference, capability availability, and cycle checks.
   */
  public static validate(definition: WorkflowDefinition, resolver?: CapabilityResolver): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 1. Workflow ID check
    if (!definition.id || typeof definition.id !== 'string' || definition.id.trim() === '') {
      errors.push("Workflow ID is missing or empty.");
    }

    // 2. Version check
    if (!definition.version || typeof definition.version !== 'string' || definition.version.trim() === '') {
      errors.push("Workflow version is missing or empty.");
    }

    // 3. Tasks list check
    if (!definition.tasks || !Array.isArray(definition.tasks) || definition.tasks.length === 0) {
      errors.push("Workflow must contain at least one task.");
      return { isValid: false, errors };
    }

    // 4. Task IDs uniqueness, formats, and basic structure
    const taskIds = new Set<string>();
    for (const task of definition.tasks) {
      if (!task.id || typeof task.id !== 'string' || task.id.trim() === '') {
        errors.push(`Task ID is missing or empty for task: ${JSON.stringify(task)}`);
      } else {
        if (taskIds.has(task.id)) {
          errors.push(`Duplicate Task ID found: '${task.id}'`);
        }
        taskIds.add(task.id);
      }

      // 5. Capability ID check: must start with 'capability:'
      if (!task.capabilityId || typeof task.capabilityId !== 'string' || !task.capabilityId.startsWith('capability:')) {
        errors.push(`Task '${task.id || 'unknown'}' capabilityId '${task.capabilityId}' is invalid (must start with 'capability:').`);
      } else if (resolver) {
        // 10. Capability Availability check
        const resolved = resolver.resolve(task.capabilityId);
        if (resolved.status === 'UNAVAILABLE' && resolved.missingRequirements.includes('CAPABILITY_REGISTRATION_MISSING')) {
          errors.push(`Task '${task.id}' refers to unregistered capability '${task.capabilityId}'.`);
        }
      }

      // 6. Object IDs validation
      if (!task.objectIds || !Array.isArray(task.objectIds)) {
        errors.push(`Task '${task.id || 'unknown'}' objectIds must be a valid array.`);
      }
    }

    // 7. Dependency references and circular paths
    const graph = new WorkflowDependencyGraph();
    for (const task of definition.tasks) {
      if (task.dependsOn && Array.isArray(task.dependsOn)) {
        for (const depId of task.dependsOn) {
          if (!taskIds.has(depId)) {
            errors.push(`Task '${task.id}' has unsatisfied dependency: target task '${depId}' does not exist.`);
          } else {
            graph.addDependency(task.id, depId);
          }
        }
      }
    }

    // 8. Cycle checks
    if (graph.detectCycles()) {
      errors.push("Circular dependency cycle detected within tasks (WORKFLOW_INVALID).");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
