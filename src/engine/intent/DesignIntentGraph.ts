import { DesignIntent, IntentStatus } from './DesignIntentTypes';

/**
 * PATCH-SECP-048-A — Design Intent Graph
 * Tracks the "Why" behind the engineering geometry.
 * Independent of Feature Graph and Constraint Graph.
 */
export class DesignIntentGraph {
  private intents: Map<string, DesignIntent> = new Map();
  private dependencies: Map<string, Set<string>> = new Map(); // childId -> Set<parentId>

  public addIntent(intent: DesignIntent): void {
    if (this.intents.has(intent.id)) {
      throw new Error(`Intent with ID ${intent.id} already exists.`);
    }
    this.intents.set(intent.id, intent);
    if (!this.dependencies.has(intent.id)) {
      this.dependencies.set(intent.id, new Set());
    }
  }

  public addDependency(parentIntentId: string, childIntentId: string): void {
    if (!this.intents.has(parentIntentId)) {
      throw new Error(`Parent intent ${parentIntentId} does not exist.`);
    }
    if (!this.intents.has(childIntentId)) {
      throw new Error(`Child intent ${childIntentId} does not exist.`);
    }
    const set = this.dependencies.get(childIntentId) || new Set();
    set.add(parentIntentId);
    this.dependencies.set(childIntentId, set);

    if (this.hasCycle()) {
      set.delete(parentIntentId);
      throw new Error(`Adding dependency from ${parentIntentId} to ${childIntentId} creates a cycle.`);
    }
  }

  public getIntent(id: string): DesignIntent | undefined {
    return this.intents.get(id);
  }

  public getAllIntents(): DesignIntent[] {
    return Array.from(this.intents.values());
  }

  public updateIntentStatus(id: string, status: IntentStatus): void {
    const intent = this.intents.get(id);
    if (intent) {
      intent.status = status;
      intent.revision++;
    }
  }

  public getIntentsByFeatures(featureIds: string[]): DesignIntent[] {
    return Array.from(this.intents.values()).filter(intent => 
      intent.sourceFeatureIds.some(fid => featureIds.includes(fid))
    );
  }

  public getDanglingIntents(existingFeatureIds: string[]): DesignIntent[] {
    return Array.from(this.intents.values()).filter(intent => {
      if (intent.sourceFeatureIds.length === 0) return false;
      return intent.sourceFeatureIds.some(fid => !existingFeatureIds.includes(fid));
    });
  }

  public hasCycle(): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const parents = this.dependencies.get(nodeId) || new Set();
      for (const p of parents) {
        if (!visited.has(p)) {
          if (dfs(p)) return true;
        } else if (recStack.has(p)) {
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const id of this.intents.keys()) {
      if (!visited.has(id)) {
        if (dfs(id)) return true;
      }
    }
    return false;
  }

  public getSortedIntents(): DesignIntent[] {
    const sorted: DesignIntent[] = [];
    const visited = new Set<string>();

    const visit = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      const parents = this.dependencies.get(id) || new Set();
      for (const p of parents) {
        visit(p);
      }
      const intent = this.intents.get(id);
      if (intent) sorted.push(intent);
    };

    for (const id of this.intents.keys()) {
      visit(id);
    }
    return sorted;
  }

  public clear(): void {
    this.intents.clear();
    this.dependencies.clear();
  }
}

