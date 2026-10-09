export class WorkflowDependencyGraph {
  private adjList: Map<string, Set<string>> = new Map(); // taskId -> set of taskIds it depends on (dependencies)
  private dependents: Map<string, Set<string>> = new Map(); // taskId -> set of taskIds that depend on it

  public addDependency(taskId: string, dependsOnId: string): void {
    if (!this.adjList.has(taskId)) {
      this.adjList.set(taskId, new Set());
    }
    this.adjList.get(taskId)!.add(dependsOnId);

    if (!this.dependents.has(dependsOnId)) {
      this.dependents.set(dependsOnId, new Set());
    }
    this.dependents.get(dependsOnId)!.add(taskId);

    // Ensure they both exist in maps
    if (!this.adjList.has(dependsOnId)) this.adjList.set(dependsOnId, new Set());
    if (!this.dependents.has(taskId)) this.dependents.set(taskId, new Set());
  }

  public removeDependency(taskId: string, dependsOnId: string): void {
    if (this.adjList.has(taskId)) {
      this.adjList.get(taskId)!.delete(dependsOnId);
    }
    if (this.dependents.has(dependsOnId)) {
      this.dependents.get(dependsOnId)!.delete(taskId);
    }
  }

  public getDependencies(taskId: string): string[] {
    return Array.from(this.adjList.get(taskId) || []);
  }

  public getDependents(taskId: string): string[] {
    return Array.from(this.dependents.get(taskId) || []);
  }

  public getReadyTasks(completedTaskIds: string[], allTaskIds: string[]): string[] {
    const ready: string[] = [];
    for (const taskId of allTaskIds) {
      if (completedTaskIds.includes(taskId)) continue;
      const deps = this.getDependencies(taskId);
      const allDepsMet = deps.every(dep => completedTaskIds.includes(dep));
      if (allDepsMet) {
        ready.push(taskId);
      }
    }
    return ready;
  }

  public detectCycles(): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);

      const deps = this.adjList.get(node) || new Set();
      for (const neighbor of deps) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(node);
      return false;
    };

    const allNodes = Array.from(this.adjList.keys());
    for (const node of allNodes) {
      if (!visited.has(node)) {
        if (dfs(node)) return true;
      }
    }

    return false;
  }

  public topologicalOrder(): string[] {
    if (this.detectCycles()) {
      throw new Error("Cannot compute topological order: Cycle detected");
    }

    const visited = new Set<string>();
    const order: string[] = [];

    const dfs = (node: string) => {
      visited.add(node);
      const deps = this.adjList.get(node) || new Set();
      for (const neighbor of deps) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        }
      }
      order.push(node);
    };

    const allNodes = Array.from(this.adjList.keys());
    for (const node of allNodes) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return order;
  }
}
