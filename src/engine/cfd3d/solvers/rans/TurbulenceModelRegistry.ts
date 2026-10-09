/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-063: Turbulence Model Registry
 */

import { TurbulenceModel, TurbulenceModelIdentity } from './TurbulenceModelContract';

export class TurbulenceModelRegistry {
  private static instance: TurbulenceModelRegistry;
  private readonly registry = new Map<string, TurbulenceModel>();

  private constructor() {}

  public static getInstance(): TurbulenceModelRegistry {
    if (!TurbulenceModelRegistry.instance) {
      TurbulenceModelRegistry.instance = new TurbulenceModelRegistry();
    }
    return TurbulenceModelRegistry.instance;
  }

  public register(model: TurbulenceModel): void {
    const key = `${model.modelId}@${model.version}`;
    const existing = this.registry.get(key);
    
    if (existing) {
      const existingHash = existing.getIdentity().implementationHash;
      const newHash = model.getIdentity().implementationHash;
      if (existingHash !== newHash) {
        throw new Error(`MODEL_IDENTITY_CONFLICT: Model ${model.modelId} version ${model.version} already registered with different implementation hash.`);
      }
    }
    this.registry.set(key, model);
  }

  public get(modelId: string, version: string): TurbulenceModel | undefined {
    return this.registry.get(`${modelId}@${version}`);
  }

  public list(): readonly TurbulenceModel[] {
    return Array.from(this.registry.values());
  }

  public clear(): void {
    this.registry.clear();
  }
}
