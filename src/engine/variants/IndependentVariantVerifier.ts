import { ResolvedVariant, VariantVerdict } from './types';
import { VariantResolutionEngine, VariantResolutionInput } from './VariantResolutionEngine';

export class IndependentVariantVerifier {
  public static verify(
    stored: ResolvedVariant,
    input: VariantResolutionInput
  ): { verdict: 'MATCH' | 'MISMATCH' | 'INCOMPLETE'; details: string[] } {
    const details: string[] = [];
    
    // Re-resolve
    const { resolved: recomputed } = VariantResolutionEngine.resolveVariant(input);

    // Compare Hashes
    if (stored.variantHash !== recomputed.variantHash) {
      details.push(`HASH_MISMATCH: Stored ${stored.variantHash} vs Recomputed ${recomputed.variantHash}`);
    }

    // Compare Verdicts
    if (stored.verdict !== recomputed.verdict) {
      details.push(`VERDICT_MISMATCH: Stored ${stored.verdict} vs Recomputed ${recomputed.verdict}`);
    }

    // Compare Resolved Configuration Hashes
    if (stored.resolvedConfiguration.configurationHash !== recomputed.resolvedConfiguration.configurationHash) {
      details.push(`CONFIG_HASH_MISMATCH: Stored ${stored.resolvedConfiguration.configurationHash} vs Recomputed ${recomputed.resolvedConfiguration.configurationHash}`);
    }

    // Compare Inheritance Path
    if (JSON.stringify(stored.evidence.inheritancePath) !== JSON.stringify(recomputed.evidence.inheritancePath)) {
      details.push(`INHERITANCE_PATH_MISMATCH`);
    }

    const isMatch = details.length === 0;
    return {
      verdict: isMatch ? 'MATCH' : 'MISMATCH',
      details
    };
  }
}
