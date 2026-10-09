import { EngineeringID } from './types';

export interface EngineeringDependency {
  sourceId: EngineeringID;
  targetId: EngineeringID;
  type: string;
  isCritical: boolean;
}

export class InvalidationEngine {
  private static instance: InvalidationEngine;
  private dependencies: EngineeringDependency[] = [];

  private constructor() {}

  public static getInstance(): InvalidationEngine {
    if (!InvalidationEngine.instance) {
      InvalidationEngine.instance = new InvalidationEngine();
    }
    return InvalidationEngine.instance;
  }

  public addDependency(dep: EngineeringDependency): void {
    this.dependencies.push(dep);
  }

  public invalidateDownstream(id: EngineeringID): EngineeringID[] {
    return this.dependencies
      .filter(d => d.sourceId === id)
      .map(d => d.targetId);
  }

  public reset(): void {
    this.dependencies = [];
  }
}
