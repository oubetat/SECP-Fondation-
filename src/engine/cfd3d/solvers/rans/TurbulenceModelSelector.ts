/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-063: Turbulence Model Selector
 */

import { TurbulenceModel, TurbulenceModelCapabilities } from './TurbulenceModelContract';
import { TurbulenceModelRegistry } from './TurbulenceModelRegistry';

export class TurbulenceModelSelector {
  public static filterByCapability(
    cap: keyof TurbulenceModelCapabilities
  ): readonly TurbulenceModel[] {
    const registry = TurbulenceModelRegistry.getInstance();
    return registry.list().filter(model => model.capabilities[cap] === true);
  }

  public static filterByRequirements(
    requiredField: string
  ): readonly TurbulenceModel[] {
    const registry = TurbulenceModelRegistry.getInstance();
    return registry.list().filter(model => model.requirements.requiredFields.includes(requiredField));
  }

  public static reportIncompatible(
    model: TurbulenceModel,
    unsupportedFeatures: string[]
  ): string[] {
    const incompatibilities: string[] = [];
    for (const feat of unsupportedFeatures) {
      if ((model.capabilities as any)[feat] === false) {
        incompatibilities.push(`Model ${model.modelId} does not support capability: ${feat}`);
      }
    }
    return incompatibilities;
  }
}
