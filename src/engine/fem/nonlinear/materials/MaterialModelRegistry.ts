/**
 * SECP Industrial OS v2 — Material Model Registry
 * Phase 17 (PATCH-177: FEM Benchmark → Nonlinear FEM 2.0)
 *
 * Centralized factory & registry for all FEM constitutive models:
 * - LINEAR_ELASTIC
 * - J2_PLASTICITY
 * - NEO_HOOKEAN
 * - MOONEY_RIVLIN
 */

import {
  AnyMaterialParameters,
  J2PlasticityParameters,
  LinearElasticParameters,
  MaterialModelIdentity,
  MooneyRivlinParameters,
  NeoHookeanParameters,
  NonlinearConstitutiveModel
} from '../types/NonlinearFEMTypes';
import { J2PlasticityModel, LinearElasticModel } from './SolidMaterialModels';
import { MooneyRivlinModel, NeoHookeanModel } from './HyperelasticMaterialModels';

export class MaterialModelRegistry {
  private static registeredModels: Map<MaterialModelIdentity, (params: any) => NonlinearConstitutiveModel> = new Map();

  static {
    this.register('LINEAR_ELASTIC', (p: LinearElasticParameters) => new LinearElasticModel(p));
    this.register('J2_PLASTICITY', (p: J2PlasticityParameters) => new J2PlasticityModel(p));
    this.register('NEO_HOOKEAN', (p: NeoHookeanParameters) => new NeoHookeanModel(p));
    this.register('MOONEY_RIVLIN', (p: MooneyRivlinParameters) => new MooneyRivlinModel(p));
  }

  public static register(
    identity: MaterialModelIdentity,
    factory: (params: any) => NonlinearConstitutiveModel
  ): void {
    this.registeredModels.set(identity, factory);
  }

  public static create(params: AnyMaterialParameters): NonlinearConstitutiveModel {
    const factory = this.registeredModels.get(params.modelIdentity);
    if (!factory) {
      throw new Error(`Material model '${params.modelIdentity}' is not registered in MaterialModelRegistry.`);
    }
    const model = factory(params);
    const validation = model.validateParameters();
    if (!validation.isValid) {
      throw new Error(`Material parameter validation failed for ${params.modelIdentity}: ${validation.errors.join('; ')}`);
    }
    return model;
  }

  public static getAvailableIdentities(): MaterialModelIdentity[] {
    return Array.from(this.registeredModels.keys());
  }
}
