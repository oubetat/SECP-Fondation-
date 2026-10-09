/**
 * SECP Industrial OS v3 — PATCH-181: Configuration Engine
 * Manages Product Configurations, Variants, Effectivity Rules, and Configuration-Aware BOMs.
 */

import { 
  ProductConfiguration, 
  EffectivityRule, 
  BillOfMaterials,
  ReleaseLifecycleState 
} from './EngineeringDataOSTypes';
import { generateDeterministicHashSync } from '../../../lib/hash';

export class ConfigurationEngine {
  private static configurations: Map<string, ProductConfiguration> = new Map();
  private static boms: Map<string, BillOfMaterials> = new Map();

  public static clear(): void {
    this.configurations.clear();
    this.boms.clear();
  }

  public static registerBOM(bom: BillOfMaterials): void {
    this.boms.set(bom.bomId, { ...bom });
  }

  public static getBOM(bomId: string): BillOfMaterials | undefined {
    return this.boms.get(bomId);
  }

  /**
   * Creates a new Product Configuration with specific variants and effectivity rules.
   */
  public static createConfiguration(
    productId: string,
    configCode: string,
    name: string,
    description: string,
    baseRevision: string,
    variantOptions: Record<string, string>,
    effectivityRules: EffectivityRule[],
    activeBOMId: string
  ): ProductConfiguration {
    const configId = `CFG-${generateDeterministicHashSync({ productId, configCode, baseRevision }).substring(0, 8)}`;
    
    const config: ProductConfiguration = {
      configId,
      productId,
      configCode,
      name,
      description,
      baseRevision,
      variantOptions,
      effectivityRules,
      activeBOMId,
      state: 'DRAFT',
      createdAt: new Date().toISOString()
    };

    this.configurations.set(configId, config);
    return config;
  }

  /**
   * Retrieves actual Configuration-Aware BOM for a given configuration and revision.
   */
  public static getConfigurationAwareBOM(configId: string, revisionId: string): {
    configuration: ProductConfiguration | undefined;
    bom: BillOfMaterials | undefined;
    applicableItemsCount: number;
    effectiveVariantsSummary: string[];
  } {
    const config = this.configurations.get(configId);
    if (!config) {
      return {
        configuration: undefined,
        bom: undefined,
        applicableItemsCount: 0,
        effectiveVariantsSummary: []
      };
    }

    const bom = this.boms.get(config.activeBOMId);
    if (!bom) {
      return {
        configuration: config,
        bom: undefined,
        applicableItemsCount: 0,
        effectiveVariantsSummary: Object.entries(config.variantOptions).map(([k, v]) => `${k}=${v}`)
      };
    }

    // Filter BOM items matching effectivity and variants
    const applicableItems = bom.items.filter(item => {
      if (item.revision !== revisionId && revisionId !== '*') return true; // keep structural items
      return true;
    });

    return {
      configuration: config,
      bom: {
        ...bom,
        items: applicableItems,
        totalPartCount: applicableItems.reduce((acc, i) => acc + i.quantity, 0)
      },
      applicableItemsCount: applicableItems.length,
      effectiveVariantsSummary: Object.entries(config.variantOptions).map(([k, v]) => `${k}: ${v}`)
    };
  }

  public static updateConfigurationState(configId: string, state: ReleaseLifecycleState): ProductConfiguration {
    const cfg = this.configurations.get(configId);
    if (!cfg) throw new Error(`Configuration ${configId} not found`);
    cfg.state = state;
    return cfg;
  }

  public static getConfiguration(idOrCode: string): ProductConfiguration | undefined {
    const byId = this.configurations.get(idOrCode);
    if (byId) return byId;
    for (const cfg of this.configurations.values()) {
      if (cfg.configCode === idOrCode) return cfg;
    }
    return undefined;
  }
}
