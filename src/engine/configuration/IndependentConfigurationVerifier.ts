import { 
  ResolvedConfiguration, 
  DifferentialConfigurationResult, 
  ConfigurationContext, 
  ConfigurationOption, 
  ConfigurationSelection, 
  ConfigurationRule, 
  OptionDependency 
} from './types';
import { ConfigurationEvaluationEngine, EvaluationInput } from './ConfigurationEvaluationEngine';
import { ConfigurationCanonicalizer } from './ConfigurationCanonicalizer';

export class IndependentConfigurationVerifier {
  public static verifyConfiguration(
    stored: ResolvedConfiguration,
    input: EvaluationInput
  ): DifferentialConfigurationResult {
    const mismatches: string[] = [];

    // 1. Re-run resolution independently
    const { resolved: recomputed } = ConfigurationEvaluationEngine.resolveConfiguration(input);

    // 2. Compare Options
    let optionsMatch = true;
    if (stored.resolvedOptions.length !== recomputed.resolvedOptions.length) {
      optionsMatch = false;
      mismatches.push(`OPTION_COUNT_MISMATCH: Stored ${stored.resolvedOptions.length} vs Recomputed ${recomputed.resolvedOptions.length}`);
    } else {
      const storedOptionMap = new Map(stored.resolvedOptions.map(o => [o.optionId, o.value]));
      for (const opt of recomputed.resolvedOptions) {
        if (!storedOptionMap.has(opt.optionId)) {
          optionsMatch = false;
          mismatches.push(`MISSING_OPTION_IN_STORED: Option ${opt.optionId} missing`);
        } else if (storedOptionMap.get(opt.optionId) !== opt.value) {
          optionsMatch = false;
          mismatches.push(`OPTION_VALUE_MISMATCH for ${opt.optionId}: Stored ${storedOptionMap.get(opt.optionId)} vs Recomputed ${opt.value}`);
        }
      }
    }

    // 3. Compare Resolved Components
    let componentsMatch = true;
    if (stored.resolvedComponents.length !== recomputed.resolvedComponents.length) {
      componentsMatch = false;
      mismatches.push(`COMPONENT_COUNT_MISMATCH: Stored ${stored.resolvedComponents.length} vs Recomputed ${recomputed.resolvedComponents.length}`);
    } else {
      const storedCompMap = new Map(stored.resolvedComponents.map(c => [c.componentId, c]));
      for (const comp of recomputed.resolvedComponents) {
        const storedComp = storedCompMap.get(comp.componentId);
        if (!storedComp) {
          componentsMatch = false;
          mismatches.push(`MISSING_COMPONENT_IN_STORED: Component ${comp.componentId} missing`);
        } else if (storedComp.revisionId !== comp.revisionId || storedComp.resolvedQuantity !== comp.resolvedQuantity) {
          componentsMatch = false;
          mismatches.push(`COMPONENT_MISMATCH for ${comp.componentId}: Revision (${storedComp.revisionId} vs ${comp.revisionId}) or Quantity (${storedComp.resolvedQuantity} vs ${comp.resolvedQuantity})`);
        }
      }
    }

    // 4. Compare Rules Executed
    let rulesMatch = true;
    if (stored.resolvedRules.length !== recomputed.resolvedRules.length) {
      rulesMatch = false;
      mismatches.push(`RULE_COUNT_MISMATCH: Stored ${stored.resolvedRules.length} vs Recomputed ${recomputed.resolvedRules.length}`);
    }

    // 5. Compare Revisions
    let revisionsMatch = true;
    if (stored.resolvedRevisions.length !== recomputed.resolvedRevisions.length) {
      revisionsMatch = false;
      mismatches.push(`REVISION_COUNT_MISMATCH: Stored ${stored.resolvedRevisions.length} vs Recomputed ${recomputed.resolvedRevisions.length}`);
    }

    // 6. Compare Hashes
    const computedHash = ConfigurationCanonicalizer.computeResolvedConfigurationHash(stored);
    let hashMatch = stored.configurationHash === recomputed.configurationHash;

    if (!hashMatch) {
      mismatches.push(`CONFIGURATION_HASH_MISMATCH: Stored ${stored.configurationHash} vs Recomputed ${recomputed.configurationHash}`);
    }

    const isMatch = optionsMatch && componentsMatch && rulesMatch && revisionsMatch && hashMatch && mismatches.length === 0;

    let verdict: DifferentialConfigurationResult['verdict'] = 'MATCH';
    if (!isMatch) {
      verdict = stored.verdict === 'INCOMPLETE' ? 'INCOMPLETE' : 'MISMATCH';
    }

    return {
      verdict,
      optionsMatch,
      revisionsMatch,
      componentsMatch,
      rulesMatch,
      hashMatch,
      mismatches
    };
  }
}
