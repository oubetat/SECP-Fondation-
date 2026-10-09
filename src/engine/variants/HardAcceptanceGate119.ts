import { VariantResolutionEngine, VariantResolutionInput } from './VariantResolutionEngine';
import { Variant, VariantDefinition, VariantRule } from './types';
import { ConfigurationContext, ConfigurationOption } from '../configuration/types';
import { VariantInheritanceResolver } from './VariantInheritanceResolver';

export class HardAcceptanceGate119 {
  public static evaluate(): { passed: boolean; checks: any[] } {
    const checks: any[] = [];

    // Setup Test Data
    const baseVariant: Variant = {
      variantId: 'V-BASE',
      productId: 'P-PUMP',
      variantCode: 'BASE',
      variantName: 'Base Variant',
      variantVersion: '1.0',
      status: 'VALID',
      createdAt: new Date().toISOString(),
      createdBy: 'ENGINEER-01',
      variantHash: '',
      ruleSetVersion: '1.0'
    };

    const childVariant: Variant = {
      variantId: 'V-CHILD',
      productId: 'P-PUMP',
      variantCode: 'CHILD',
      variantName: 'Child Variant',
      variantVersion: '1.0',
      status: 'VALID',
      parentVariantId: 'V-BASE',
      createdAt: new Date().toISOString(),
      createdBy: 'ENGINEER-01',
      variantHash: '',
      ruleSetVersion: '1.0'
    };

    const allVariants = new Map<string, Variant>([
      ['V-BASE', baseVariant],
      ['V-CHILD', childVariant]
    ]);

    const baseDef: VariantDefinition = {
      baseProduct: 'P-PUMP',
      variationDimensions: ['POWERTRAIN'],
      allowedOptions: ['OPT-ENGINE'],
      requiredOptions: ['OPT-ENGINE'],
      forbiddenOptions: [],
      variantRules: [],
      effectivity: {},
      overrides: [{ targetId: 'OPT-ENGINE', value: 'DIESEL', reason: 'Standard for base' }]
    };

    const childDef: VariantDefinition = {
      baseProduct: 'P-PUMP',
      variationDimensions: ['MATERIAL'],
      allowedOptions: ['OPT-SEAL'],
      requiredOptions: ['OPT-SEAL'],
      forbiddenOptions: [],
      variantRules: [
        {
          ruleId: 'VR-01',
          ruleCode: 'SEAL_RULE',
          version: '1.0',
          priority: 1,
          type: 'SELECT',
          condition: () => true,
          action: { type: 'SELECT_OPTION', targetId: 'OPT-SEAL', value: 'VITON' },
          severity: 'CRITICAL',
          scope: 'VARIANT',
          status: 'ACTIVE'
        }
      ],
      effectivity: {},
      overrides: [{ targetId: 'OPT-ENGINE', value: 'ELECTRIC', reason: 'Child preference' }]
    };

    const definitions = new Map<string, VariantDefinition>([
      ['V-BASE', baseDef],
      ['V-CHILD', childDef]
    ]);

    const context: ConfigurationContext = {
      productId: 'P-PUMP',
      configurationId: 'C-TEST',
      configurationVersion: '1.0'
    };

    const configOptions: ConfigurationOption[] = [
      { optionId: 'OPT-ENGINE', optionCode: 'ENG', name: 'Engine', description: '', type: 'ENUM', required: true, status: 'ACTIVE' },
      { optionId: 'OPT-SEAL', optionCode: 'SEAL', name: 'Seal', description: '', type: 'ENUM', required: true, status: 'ACTIVE' }
    ];

    const input: VariantResolutionInput = {
      variantId: 'V-CHILD',
      allVariants,
      definitions,
      context,
      configOptions,
      configRules: [],
      configDependencies: [],
      components: []
    };

    // 1. Inheritance Resolution Check
    const path = VariantInheritanceResolver.resolvePath('V-CHILD', allVariants);
    checks.push({
      id: 'GATE-119-01',
      name: 'Explicit Inheritance Resolution',
      passed: path.length === 2 && path[0] === 'V-BASE' && path[1] === 'V-CHILD',
      details: `Path resolved: ${path.join(' -> ')}`
    });

    // 2. Inheritance Override Traceability
    const merged = VariantInheritanceResolver.mergeDefinitions(path, definitions);
    const engineOverride = merged.overrides.find(o => o.targetId === 'OPT-ENGINE');
    checks.push({
      id: 'GATE-119-02',
      name: 'Inheritance Override Traceability',
      passed: engineOverride?.value === 'ELECTRIC',
      details: `Merged engine value: ${engineOverride?.value} (Expected ELECTRIC from child)`
    });

    // 3. Inheritance Cycle Detection
    const cycleVariants = new Map<string, Variant>([
      ['V-A', { ...baseVariant, variantId: 'V-A', parentVariantId: 'V-B' }],
      ['V-B', { ...baseVariant, variantId: 'V-B', parentVariantId: 'V-A' }]
    ]);
    let cycleCaught = false;
    try {
      VariantInheritanceResolver.resolvePath('V-A', cycleVariants);
    } catch (e: any) {
      if (e.message.includes('VARIANT_INHERITANCE_CYCLE')) cycleCaught = true;
    }
    checks.push({
      id: 'GATE-119-03',
      name: 'Inheritance Cycle Detection',
      passed: cycleCaught,
      details: 'Correctly identified circular inheritance'
    });

    // 4. Variant Resolution & Configuration Binding
    const { resolved } = VariantResolutionEngine.resolveVariant(input);
    const resolvedEngine = resolved.resolvedConfiguration.resolvedOptions.find(o => o.optionId === 'OPT-ENGINE');
    const resolvedSeal = resolved.resolvedConfiguration.resolvedOptions.find(o => o.optionId === 'OPT-SEAL');
    
    checks.push({
      id: 'GATE-119-04',
      name: 'Variant-to-Configuration Binding (Option Selection)',
      passed: resolvedEngine?.value === 'ELECTRIC' && resolvedSeal?.value === 'VITON',
      details: `Engine: ${resolvedEngine?.value}, Seal: ${resolvedSeal?.value}`
    });

    // 5. Deterministic Hashing
    const { resolved: resolved2 } = VariantResolutionEngine.resolveVariant(input);
    checks.push({
      id: 'GATE-119-05',
      name: 'Deterministic Variant Hashing',
      passed: resolved.variantHash === resolved2.variantHash,
      details: `Hash: ${resolved.variantHash}`
    });

    // 6. Verdict Validity
    checks.push({
      id: 'GATE-119-06',
      name: 'Variant Resolution Verdict Validity',
      passed: resolved.verdict === 'VALID',
      details: `Verdict: ${resolved.verdict}`
    });

    const passed = checks.every(c => c.passed);
    return { passed, checks };
  }
}
