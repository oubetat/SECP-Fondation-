/**
 * SECP Industrial OS v2 — Turbulence Model Registry
 * Phase 16 (PATCH-176: Turbulence Benchmark → Advanced Turbulence Framework)
 *
 * Implements the extensible model registry ensuring all models are dynamically
 * instantiated and configured without hardcoded branching in the CFD solver.
 */

import { TurbulenceModel } from '../contract/TurbulenceModel';
import { TurbulenceModelIdentity, TurbulenceModelFamily, TurbulenceModelCapabilities } from '../types/TurbulenceTypes';
import { KEpsilonModel } from '../models/rans/KEpsilonModel';
import { KOmegaModel } from '../models/rans/KOmegaModel';
import { KOmegaSSTModel } from '../models/rans/KOmegaSSTModel';
import { GammaReThetaTransitionModel } from '../models/transition/GammaReThetaTransitionModel';
import { SmagorinskyLillyModel } from '../models/les/SmagorinskyLillyModel';

export type ModelFactory = (profile?: 'DEFAULT' | 'VALIDATED' | 'BENCHMARK') => TurbulenceModel;

export interface ModelMetadata {
  identity: TurbulenceModelIdentity;
  name: string;
  family: TurbulenceModelFamily;
  capabilities: TurbulenceModelCapabilities;
  isIndustrialStandard: boolean;
}

export class TurbulenceModelRegistry {
  private static readonly registry: Map<TurbulenceModelIdentity, ModelFactory> = new Map();
  private static readonly metadata: Map<TurbulenceModelIdentity, ModelMetadata> = new Map();
  private static isInitialized = false;

  /**
   * Initialize and register built-in production turbulence models
   */
  public static initialize(): void {
    if (this.isInitialized) return;

    this.register(
      'KEPSILON_STANDARD',
      (p) => new KEpsilonModel(p),
      {
        identity: 'KEPSILON_STANDARD',
        name: 'Standard k-ε (Launder & Sharma)',
        family: 'RANS',
        capabilities: new KEpsilonModel().capabilities,
        isIndustrialStandard: true
      }
    );

    this.register(
      'KOMEGA_STANDARD',
      (p) => new KOmegaModel(p),
      {
        identity: 'KOMEGA_STANDARD',
        name: 'Standard k-ω (Wilcox 2006)',
        family: 'RANS',
        capabilities: new KOmegaModel().capabilities,
        isIndustrialStandard: true
      }
    );

    this.register(
      'KOMEGA_SST',
      (p) => new KOmegaSSTModel(p),
      {
        identity: 'KOMEGA_SST',
        name: 'Menter Shear Stress Transport (k-ω SST)',
        family: 'RANS',
        capabilities: new KOmegaSSTModel().capabilities,
        isIndustrialStandard: true
      }
    );

    this.register(
      'TRANSITION_GAMMA_RETHETA',
      (p) => new GammaReThetaTransitionModel(p),
      {
        identity: 'TRANSITION_GAMMA_RETHETA',
        name: 'γ-Reθt Correlation Transition Model',
        family: 'TRANSITION',
        capabilities: new GammaReThetaTransitionModel().capabilities,
        isIndustrialStandard: true
      }
    );

    this.register(
      'LES_SMAGORINSKY_LILLY',
      (p) => new SmagorinskyLillyModel(p),
      {
        identity: 'LES_SMAGORINSKY_LILLY',
        name: 'Smagorinsky-Lilly Subgrid Scale Model',
        family: 'LES',
        capabilities: new SmagorinskyLillyModel().capabilities,
        isIndustrialStandard: true
      }
    );

    this.isInitialized = true;
  }

  /**
   * Register a new custom or plug-in turbulence model
   */
  public static register(
    identity: TurbulenceModelIdentity,
    factory: ModelFactory,
    meta: ModelMetadata
  ): void {
    this.registry.set(identity, factory);
    this.metadata.set(identity, meta);
  }

  /**
   * Create an instance of a registered turbulence model
   */
  public static create(
    identity: TurbulenceModelIdentity = 'KOMEGA_SST',
    profile: 'DEFAULT' | 'VALIDATED' | 'BENCHMARK' = 'VALIDATED'
  ): TurbulenceModel {
    this.initialize();
    const factory = this.registry.get(identity);
    if (!factory) {
      console.warn(`Turbulence model '${identity}' not found in registry. Falling back to KOMEGA_SST.`);
      return new KOmegaSSTModel(profile);
    }
    return factory(profile);
  }

  /**
   * List all registered turbulence models and their metadata
   */
  public static listAvailableModels(): ModelMetadata[] {
    this.initialize();
    return Array.from(this.metadata.values());
  }

  /**
   * Check if a specific model supports a required capability
   */
  public static checkCompatibility(
    identity: TurbulenceModelIdentity,
    requirement: { isTransient?: boolean; isCompressible?: boolean; isLES?: boolean }
  ): { compatible: boolean; reason?: string } {
    this.initialize();
    const meta = this.metadata.get(identity);
    if (!meta) return { compatible: false, reason: `Model ${identity} is not registered.` };

    if (requirement.isLES && !meta.capabilities.supportsLES) {
      return { compatible: false, reason: `Model ${identity} does not support Large Eddy Simulation (LES).` };
    }
    if (requirement.isTransient && !meta.capabilities.supportsTransient) {
      return { compatible: false, reason: `Model ${identity} does not support transient time integration.` };
    }
    if (requirement.isCompressible && !meta.capabilities.supportsCompressible) {
      return { compatible: false, reason: `Model ${identity} does not support compressible flow physics.` };
    }

    return { compatible: true };
  }
}
