import { EngineeringID, EngineeringObject } from './types';

export class EngineeringTruthEngine {
  private static instance: EngineeringTruthEngine;
  private objects: Map<EngineeringID, EngineeringObject> = new Map();

  private constructor() {}

  public static getInstance(): EngineeringTruthEngine {
    if (!EngineeringTruthEngine.instance) {
      EngineeringTruthEngine.instance = new EngineeringTruthEngine();
    }
    return EngineeringTruthEngine.instance;
  }

  public registerObject(obj: EngineeringObject): void {
    this.objects.set(obj.id, obj);
  }

  public getObject(id: EngineeringID): EngineeringObject | undefined {
    return this.objects.get(id);
  }

  public listAll(): EngineeringObject[] {
    return Array.from(this.objects.values());
  }

  public reset(): void {
    this.objects.clear();
  }
}
