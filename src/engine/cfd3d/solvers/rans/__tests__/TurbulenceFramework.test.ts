/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-063: Turbulence Framework Tests
 */

import { describe, it, expect } from 'vitest';
import { TurbulenceModelRegistry } from '../TurbulenceModelRegistry';
import { GenericTurbulenceModel } from '../GenericTurbulenceModel';
import { ModelBoundChecker } from '../ModelBoundChecker';
import { RealizabilityChecker } from '../RealizabilityChecker';
import { TurbulenceModelComparison } from '../TurbulenceModelComparison';
import { TurbulenceModelSelector } from '../TurbulenceModelSelector';

describe('PATCH-063: Turbulence Model Framework Core Tests', () => {
  it('Verify Model Registry and Double Registration Protection', () => {
    const registry = TurbulenceModelRegistry.getInstance();
    registry.clear();

    const model = new GenericTurbulenceModel();
    registry.register(model);

    expect(registry.list().length).toBe(1);

    // Register same ID/version but mock different hash to simulate identity conflict
    const conflictModel = {
      ...model,
      getIdentity: () => ({
        modelId: model.modelId,
        family: model.family,
        version: model.version,
        implementationHash: 'modified-hash',
        equationSetHash: 'generic-eqn-hash-063',
        configurationHash: 'generic-config-hash-063'
      })
    };

    expect(() => registry.register(conflictModel as any)).toThrow('MODEL_IDENTITY_CONFLICT');
  });

  it('Verify Model Selector & Comparison Utilities', () => {
    const model = new GenericTurbulenceModel();
    const comparison = TurbulenceModelComparison.compare([model]);
    expect(comparison[0].modelId).toBe(model.modelId);

    const filtered = TurbulenceModelSelector.filterByCapability('steady');
    expect(filtered.length).toBeGreaterThanOrEqual(1);
  });
});
