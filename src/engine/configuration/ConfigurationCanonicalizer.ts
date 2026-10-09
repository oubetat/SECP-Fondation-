import * as crypto from 'crypto';
import { 
  ConfigurationContext, 
  ConfigurationSelection, 
  ResolvedComponent, 
  ResolvedConfiguration, 
  ConfigurationSnapshot,
  ConfigurationEvidenceChain
} from './types';

export class ConfigurationCanonicalizer {
  public static sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  public static canonicalize(obj: any): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map(item => ConfigurationCanonicalizer.canonicalize(item)).join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    const keyValues = keys.map(key => {
      const val = obj[key];
      if (val === undefined) return null;
      return `${JSON.stringify(key)}:${ConfigurationCanonicalizer.canonicalize(val)}`;
    }).filter(kv => kv !== null);

    return '{' + keyValues.join(',') + '}';
  }

  public static computeContextHash(ctx: ConfigurationContext): string {
    const payload = {
      productId: ctx.productId,
      configurationId: ctx.configurationId,
      configurationVersion: ctx.configurationVersion,
      revisionContext: ctx.revisionContext || '',
      effectivityContext: ctx.effectivityContext || {},
      dateContext: ctx.dateContext || '',
      serialContext: ctx.serialContext || '',
      projectContext: ctx.projectContext || ''
    };
    return ConfigurationCanonicalizer.sha256(ConfigurationCanonicalizer.canonicalize(payload));
  }

  public static computeSelectionsHash(selections: ConfigurationSelection[]): string {
    const sorted = [...selections].sort((a, b) => a.optionId.localeCompare(b.optionId));
    const payload = sorted.map(s => ({
      optionId: s.optionId,
      value: s.value,
      source: s.source
    }));
    return ConfigurationCanonicalizer.sha256(ConfigurationCanonicalizer.canonicalize(payload));
  }

  public static computeResolvedConfigurationHash(res: Partial<ResolvedConfiguration>): string {
    const sortedComponents = [...(res.resolvedComponents || [])].sort((a, b) => 
      a.componentId.localeCompare(b.componentId)
    );
    const sortedOptions = [...(res.resolvedOptions || [])].sort((a, b) => 
      a.optionId.localeCompare(b.optionId)
    );
    const sortedRevisions = [...(res.resolvedRevisions || [])].sort((a, b) => 
      a.entityId.localeCompare(b.entityId)
    );
    const sortedRules = [...(res.resolvedRules || [])].sort();
    const sortedExclusions = [...(res.excludedComponents || [])].sort((a, b) => 
      a.componentId.localeCompare(b.componentId)
    );

    const payload = {
      configurationId: res.configurationId || '',
      configurationVersion: res.configurationVersion || '1.0',
      verdict: res.verdict || 'INVALID',
      resolvedComponents: sortedComponents.map(c => ({
        componentId: c.componentId,
        revisionId: c.revisionId,
        quantity: c.resolvedQuantity,
        isSuppressed: c.isSuppressed,
        inclusionReason: c.inclusionReason
      })),
      resolvedOptions: sortedOptions.map(o => ({
        optionId: o.optionId,
        value: o.value,
        source: o.source
      })),
      resolvedRevisions: sortedRevisions.map(r => ({
        entityId: r.entityId,
        revisionId: r.revisionId
      })),
      resolvedRules: sortedRules,
      excludedComponents: sortedExclusions.map(e => ({
        componentId: e.componentId,
        reason: e.reason
      })),
      effectivity: res.effectivityResults || {}
    };

    return ConfigurationCanonicalizer.sha256(ConfigurationCanonicalizer.canonicalize(payload));
  }

  public static computeEvidenceChainHashes(
    contextHash: string,
    selectionsHash: string,
    ruleEvalHash: string,
    revisionResHash: string,
    bomResHash: string,
    assemblyResHash: string,
    effectivityHash: string
  ): ConfigurationEvidenceChain['stageHashes'] {
    const finalConfigurationHash = ConfigurationCanonicalizer.sha256(
      ConfigurationCanonicalizer.canonicalize({
        contextHash,
        selectionsHash,
        ruleEvalHash,
        revisionResHash,
        bomResHash,
        assemblyResHash,
        effectivityHash
      })
    );

    return {
      inputContextHash: contextHash,
      selectionsHash,
      ruleEvaluationHash: ruleEvalHash,
      revisionResolutionHash: revisionResHash,
      bomResolutionHash: bomResHash,
      assemblyResolutionHash: assemblyResHash,
      effectivityHash,
      finalConfigurationHash
    };
  }
}
