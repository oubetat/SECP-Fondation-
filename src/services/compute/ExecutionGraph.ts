import { EngineeringTask } from '../../engine/engineering_compute/types';

export class ExecutionGraph {
  public static validateDAG(tasks: EngineeringTask[]): { valid: boolean; error?: string } {
    const taskMap = new Map<string, EngineeringTask>();
    tasks.forEach(t => taskMap.set(t.taskId, t));

    // Check missing dependencies
    for (const t of tasks) {
      for (const depId of t.dependencies) {
        if (!taskMap.has(depId)) {
          return { valid: false, error: `MISSING_DEPENDENCY: Task ${t.taskId} depends on unknown task ${depId}` };
        }
      }
    }

    // Check cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (taskId: string): boolean => {
      visited.add(taskId);
      recursionStack.add(taskId);

      const task = taskMap.get(taskId)!;
      for (const depId of task.dependencies) {
        if (!visited.has(depId)) {
          if (dfs(depId)) return true;
        } else if (recursionStack.has(depId)) {
          return true; // Cycle detected
        }
      }

      recursionStack.delete(taskId);
      return false;
    };

    for (const t of tasks) {
      if (!visited.has(t.taskId)) {
        if (dfs(t.taskId)) {
          return { valid: false, error: 'EXECUTION_GRAPH_INVALID: Cyclic dependency detected' };
        }
      }
    }

    return { valid: true };
  }
}
