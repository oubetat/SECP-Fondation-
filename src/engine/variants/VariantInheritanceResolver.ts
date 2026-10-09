import { Variant, VariantDefinition, VariantStatus } from './types';

export class VariantInheritanceResolver {
  public static resolvePath(
    variantId: string,
    allVariants: Map<string, Variant>
  ): string[] {
    const path: string[] = [];
    const visited = new Set<string>();
    let currentId: string | undefined = variantId;

    while (currentId) {
      if (visited.has(currentId)) {
        throw new Error(`VARIANT_INHERITANCE_CYCLE: Cycle detected at ${currentId}`);
      }
      visited.add(currentId);
      path.unshift(currentId); // Root first

      const variant = allVariants.get(currentId);
      if (!variant) {
        throw new Error(`MISSING_VARIANT: Variant ${currentId} not found in map`);
      }
      currentId = variant.parentVariantId;
    }

    return path;
  }

  public static mergeDefinitions(
    path: string[],
    definitions: Map<string, VariantDefinition>
  ): VariantDefinition {
    if (path.length === 0) {
      throw new Error('EMPTY_INHERITANCE_PATH');
    }

    const baseId = path[0];
    const baseDef = definitions.get(baseId);
    if (!baseDef) throw new Error(`MISSING_DEFINITION: ${baseId}`);

    const merged: VariantDefinition = {
      ...JSON.parse(JSON.stringify(baseDef)),
      overrides: [...(baseDef.overrides || [])]
    };

    for (let i = 1; i < path.length; i++) {
      const currentId = path[i];
      const currentDef = definitions.get(currentId);
      if (!currentDef) throw new Error(`MISSING_DEFINITION: ${currentId}`);

      // Merge Dimensions
      merged.variationDimensions = Array.from(new Set([...merged.variationDimensions, ...currentDef.variationDimensions]));
      
      // Merge Options
      merged.allowedOptions = Array.from(new Set([...merged.allowedOptions, ...currentDef.allowedOptions]));
      merged.requiredOptions = Array.from(new Set([...merged.requiredOptions, ...currentDef.requiredOptions]));
      merged.forbiddenOptions = Array.from(new Set([...merged.forbiddenOptions, ...currentDef.forbiddenOptions]));
      
      // Merge Rules
      merged.variantRules = [...merged.variantRules, ...currentDef.variantRules];
      
      // Overrides
      if (currentDef.overrides) {
        for (const override of currentDef.overrides) {
          const existing = merged.overrides.find(o => o.targetId === override.targetId);
          if (existing) {
            existing.value = override.value;
            existing.reason = `Override by child ${currentId}: ${override.reason}`;
          } else {
            merged.overrides.push(override);
          }
        }
      }
    }

    return merged;
  }
}
