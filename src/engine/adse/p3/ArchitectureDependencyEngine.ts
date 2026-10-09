/**
 * SECP — ADSE-P3 Architecture Dependency Engine
 * Tracks typed architectural dependencies (DATA, POWER, MECHANICAL, CONTROL, LOGICAL),
 * detects dependency cycles (A -> B -> C -> A), boundary violations, and orphan references.
 */

import { ArchitectureElementRegistry } from './ArchitectureElementRegistry';
import { ArchitectureDependency } from './types';

export class ArchitectureDependencyEngine {
  private registry: ArchitectureElementRegistry;
  private dependencies: Map<string, ArchitectureDependency> = new Map();

  constructor(registry: ArchitectureElementRegistry) {
    this.registry = registry;
  }

  public addDependency(params: {
    dependencyId: string;
    sourceArchId: string;
    targetArchId: string;
    dependencyType: 'DATA' | 'POWER' | 'MECHANICAL' | 'CONTROL' | 'LOGICAL';
    configurationId: string;
  }): ArchitectureDependency {
    if (this.dependencies.has(params.dependencyId)) {
      throw new Error(`DEPENDENCY_ERROR: Dependency '${params.dependencyId}' already exists.`);
    }

    const source = this.registry.getElement(params.sourceArchId);
    const target = this.registry.getElement(params.targetArchId);

    if (!source) {
      throw new Error(`DEPENDENCY_ERROR: Source element '${params.sourceArchId}' does not exist.`);
    }
    if (!target) {
      throw new Error(`DEPENDENCY_ERROR: Target element '${params.targetArchId}' does not exist.`);
    }

    // Boundary violation detection: Component depending directly on external system without boundary interface
    const isBoundaryViolation = (source.layer === 'COMPONENT' && target.layer === 'EXTERNAL');

    const dep: ArchitectureDependency = {
      dependencyId: params.dependencyId,
      sourceArchId: params.sourceArchId,
      targetArchId: params.targetArchId,
      dependencyType: params.dependencyType,
      configurationId: params.configurationId,
      revisionId: source.revisionId,
      isBoundaryViolation
    };

    this.dependencies.set(params.dependencyId, dep);

    this.registry.addRelationship({
      relationshipType: 'DEPENDS_ON',
      sourceArchId: params.sourceArchId,
      targetArchId: params.targetArchId,
      configurationId: params.configurationId,
      metadata: { dependencyId: params.dependencyId, type: params.dependencyType }
    });

    return dep;
  }

  public detectCycles(): string[][] {
    const adj = new Map<string, string[]>();

    for (const dep of this.dependencies.values()) {
      if (!adj.has(dep.sourceArchId)) {
        adj.set(dep.sourceArchId, []);
      }
      adj.get(dep.sourceArchId)!.push(dep.targetArchId);
    }

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string) => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = adj.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recStack.has(neighbor)) {
          // Cycle found!
          const cycleStartIdx = path.indexOf(neighbor);
          if (cycleStartIdx !== -1) {
            cycles.push([...path.slice(cycleStartIdx), neighbor]);
          }
        }
      }

      recStack.delete(node);
      path.pop();
    };

    for (const node of adj.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }

  public getAllDependencies(): ArchitectureDependency[] {
    return Array.from(this.dependencies.values());
  }

  public getDependenciesForElement(archId: string): ArchitectureDependency[] {
    return Array.from(this.dependencies.values()).filter(
      d => d.sourceArchId === archId || d.targetArchId === archId
    );
  }

  public clear(): void {
    this.dependencies.clear();
  }
}
