export class CapabilityGraph {
  private readonly adjList: Map<string, string[]> = new Map();
  private readonly revAdjList: Map<string, string[]> = new Map();

  public static buildFromRegistry(registry: any): CapabilityGraph {
    const graph = new CapabilityGraph();
    for (const cap of registry.list()) {
      graph.addNode(cap.id);
      for (const depId of cap.requiredCapabilities) {
        graph.addEdge(cap.id, depId);
      }
    }
    return graph;
  }

  public addNode(id: string): void {
    if (!this.adjList.has(id)) {
      this.adjList.set(id, []);
    }
    if (!this.revAdjList.has(id)) {
      this.revAdjList.set(id, []);
    }
  }

  public addEdge(from: string, to: string): void {
    this.addNode(from);
    this.addNode(to);
    
    // Prevent self loops
    if (from === to) {
      throw new Error(`Circular dependency detected: Self-loop on capability '${from}' is prohibited.`);
    }

    if (!this.adjList.get(from)!.includes(to)) {
      this.adjList.get(from)!.push(to);
    }
    if (!this.revAdjList.get(to)!.includes(from)) {
      this.revAdjList.get(to)!.push(from);
    }
  }

  public getDependencies(id: string): string[] {
    return this.adjList.get(id) || [];
  }

  public getDependents(id: string): string[] {
    return this.revAdjList.get(id) || [];
  }

  /**
   * Check if there are any circular dependencies in the DAG using DFS.
   */
  public hasCycle(): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);

      const neighbors = this.adjList.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(node);
      return false;
    };

    for (const node of Array.from(this.adjList.keys())) {
      if (!visited.has(node)) {
        if (dfs(node)) return true;
      }
    }
    return false;
  }

  /**
   * Get all transitive dependencies (downwards) of a capability.
   */
  public getTransitiveDependencies(id: string): string[] {
    const result = new Set<string>();
    const dfs = (node: string) => {
      const neighbors = this.adjList.get(node) || [];
      for (const neighbor of neighbors) {
        if (!result.has(neighbor)) {
          result.add(neighbor);
          dfs(neighbor);
        }
      }
    };
    dfs(id);
    return Array.from(result);
  }

  /**
   * Get all transitive dependents (upwards) of a capability.
   */
  public getTransitiveDependents(id: string): string[] {
    const result = new Set<string>();
    const dfs = (node: string) => {
      const dependents = this.revAdjList.get(node) || [];
      for (const dep of dependents) {
        if (!result.has(dep)) {
          result.add(dep);
          dfs(dep);
        }
      }
    };
    dfs(id);
    return Array.from(result);
  }

  /**
   * Returns a list of capability IDs sorted topologically.
   */
  public topologicalSort(): string[] {
    if (this.hasCycle()) {
      throw new Error('Cannot sort topologically: Circular dependency detected in Capability Graph.');
    }

    const visited = new Set<string>();
    const stack: string[] = [];

    const dfs = (node: string) => {
      visited.add(node);
      const neighbors = this.adjList.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        }
      }
      stack.push(node);
    };

    for (const node of Array.from(this.adjList.keys())) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return stack.reverse();
  }

  /**
   * Return a queryable model of the DAG hierarchy for output reports.
   */
  public toJSON(): Record<string, any> {
    const nodes: Record<string, any> = {};
    for (const id of Array.from(this.adjList.keys())) {
      nodes[id] = {
        id,
        dependencies: this.getDependencies(id),
        dependents: this.getDependents(id),
        transitiveDependencies: this.getTransitiveDependencies(id)
      };
    }
    return {
      nodes,
      hasCycle: this.hasCycle(),
      topologicalOrder: this.hasCycle() ? [] : this.topologicalSort()
    };
  }
}
