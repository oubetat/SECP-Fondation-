/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-063: Turbulence Model Comparison Framework
 */

import { TurbulenceModel } from './TurbulenceModelContract';

export interface ComparisonReport {
  readonly modelId: string;
  readonly capabilitiesCount: number;
  readonly variablesCount: number;
  readonly validationStatus: string;
}

export class TurbulenceModelComparison {
  public static compare(
    models: readonly TurbulenceModel[]
  ): ComparisonReport[] {
    return models.map(model => {
      let capCount = 0;
      for (const val of Object.values(model.capabilities)) {
        if (val === true) capCount++;
      }

      return {
        modelId: model.modelId,
        capabilitiesCount: capCount,
        variablesCount: model.requirements.requiredFields.length,
        validationStatus: model.status
      };
    });
  }
}
