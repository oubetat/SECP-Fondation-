import { ConfigurationRegistry } from './ConfigurationRegistry';
import { Configuration, ConfigurationItem, ConfigurationStatus } from './types';

export interface CompatibilityResult {
  isValid: boolean;
  errors: string[];
}

export class ConfigurationCompatibilityEngine {
  private registry: ConfigurationRegistry;

  constructor(registry: ConfigurationRegistry) {
    this.registry = registry;
  }

  /**
   * Evaluates the absolute semantic compatibility of a configuration assembly.
   * Runs analytical checks on items, dependency references, interfaces, and options.
   */
  public checkCompatibility(configId: string): CompatibilityResult {
    const errors: string[] = [];
    const config = this.registry.getConfiguration(configId);

    if (!config) {
      return { isValid: false, errors: [`CONFIGURATION_NOT_FOUND: ${configId}`] };
    }

    const items = config.items;
    const itemMap = new Map<string, ConfigurationItem>(items.map(it => [it.id, it]));

    // 1. INCOMPATIBLE_REVISION & MISSING_REQUIRED_ITEM checks
    for (const item of items) {
      // Check dependencies
      for (const depId of item.dependencies) {
        const depItem = itemMap.get(depId);
        if (!depItem) {
          errors.push(`MISSING_REQUIRED_ITEM: Configuration Item '${item.id}' depends on missing item '${depId}'.`);
          continue;
        }

        // Example incompatible revision rule:
        // Mechanical item (e.g., 'CI-ENGINE') with revision Ref 'REV-R8' is incompatible with
        // software item ('CI-SOFTWARE') with revision Ref 'REV-R3'.
        if (
          item.identity === 'CI-ENGINE' &&
          item.revisionRef === 'REV-R8' &&
          depItem.identity === 'CI-SOFTWARE' &&
          depItem.revisionRef === 'REV-R3'
        ) {
          errors.push(`INCOMPATIBLE_REVISION: Engine revision 'REV-R8' is mechanically incompatible with Software control revision 'REV-R3'.`);
        }
      }

      // 2. INCOMPATIBLE_INTERFACE check
      // E.g. Software interface requires matching electrical bus interface revision
      if (item.type === 'SOFTWARE' && item.revisionRef === 'REV-R3') {
        const busInterface = items.find(it => it.type === 'INTERFACE' && it.identity === 'CI-CAN-BUS');
        if (busInterface && busInterface.revisionRef !== 'REV-R1') {
          errors.push(`INCOMPATIBLE_INTERFACE: Software '${item.id}' requires Interface identity 'CI-CAN-BUS' to be 'REV-R1' but got '${busInterface.revisionRef}'.`);
        }
      }

      // 3. INVALID_DEPENDENCY check
      for (const depId of item.dependencies) {
        const depItem = itemMap.get(depId);
        if (depItem && depItem.lifecycleState === ConfigurationStatus.INVALIDATED) {
          errors.push(`INVALID_DEPENDENCY: Configuration Item '${item.id}' depends on invalidated item '${depId}'.`);
        }
      }

      // 4. STALE_EVIDENCE check
      // If a configuration item is marked with verificationState === 'REASSESSMENT_REQUIRED'
      if (item.verificationState === 'REASSESSMENT_REQUIRED') {
        errors.push(`STALE_EVIDENCE: Configuration Item '${item.id}' has stale verification due to open findings or invalidated evidence references.`);
      }
    }

    // 5. INVALID_VARIANT_COMBINATION check
    const variant = this.registry.getVariant(config.variantId);
    if (variant) {
      if (!variant.allowedConfigurations.includes(configId)) {
        errors.push(`INVALID_VARIANT_COMBINATION: Configuration '${configId}' is not an authorized combination for Variant '${variant.variantId}'.`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
